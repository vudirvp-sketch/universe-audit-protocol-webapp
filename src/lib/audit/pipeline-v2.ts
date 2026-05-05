/**
 * Pipeline V2 — 3-шаговый пайплайн аудита (Universe Audit Protocol v11.0).
 *
 * Однопроходный генератор аудита:
 *   Пользователь вводит концепт → получает полный отчёт → готово.
 * Нет гейтов, нет блокировок, нет возобновлений.
 */

import type {
  AuditInput,
  LLMConfig,
  StreamingCallbacks,
  PipelineStateV2,
  PipelineMeta,
  Step1Result,
  Step2Result,
  Step3Result,
  MediaType,
} from './types-v2';
import type { ModelCapabilities } from '../llm-client';
import type { LLMStreamingResult } from './llm-streaming';
import { getModelCapabilities } from '../llm-client';
import { buildStep1Prompt, buildStep2Prompt, buildStep3Prompt } from './prompts-v2';
import {
  parseStep1Response,
  parseStep2Response,
  parseStep3Response,
} from './markdown-parser';
import { callLLMStreaming } from './llm-streaming';
import { MASTER_CHECKLIST } from './protocol-data';
import { getAdaptiveDigestThreshold, computeDigestForV2 } from './narrative-processor-v2';
import { classifyLLMError } from './error-handler';

// Re-export StreamingCallbacks for consumers
export type { StreamingCallbacks } from './types-v2';

// ============================================================
// Токен-менеджмент
// ============================================================

/** Желаемые max_tokens для каждого шага */
const DESIRED_MAX_TOKENS: Record<1 | 2 | 3, number> = {
  1: 8192,
  2: 16384,
  3: 16384,
};

/** Вычислить фактический max_tokens для шага с учётом возможностей модели */
export function resolveStepMaxTokens(step: 1 | 2 | 3, modelCaps: ModelCapabilities): number {
  return Math.min(DESIRED_MAX_TOKENS[step], modelCaps.maxOutputTokens);
}

// ============================================================
// Главный пайплайн
// ============================================================

/**
 * Запустить 3-шаговый пайплайн аудита.
 *
 * Возвращает PipelineStateV2 с результатами всех шагов.
 * При фатальной ошибке — состояние error.
 * При частичных данных — состояние done с пометками insufficient_data.
 */
export async function runAuditPipelineV2(
  input: AuditInput,
  llmConfig: LLMConfig,
  callbacks: StreamingCallbacks,
  abortSignal?: AbortSignal,
): Promise<PipelineStateV2> {
  const pipelineStart = Date.now();
  const meta = initMeta(input);
  const state: PipelineStateV2 = {
    phase: 'running',
    currentStep: 0,
    step1: null,
    step2: null,
    step3: null,
    meta,
    error: null,
  };

  try {
    // Определить возможности модели
    const modelCaps = getModelCapabilities(
      llmConfig.provider as Parameters<typeof getModelCapabilities>[0],
      llmConfig.model,
    );

    // ============================================================
    // Определить стратегию ввода (digest threshold)
    // ============================================================
    const digestThreshold = getAdaptiveDigestThreshold(modelCaps);
    const needsDigest = input.text.length > digestThreshold;

    // Для длинных текстов: используем текст как есть, если контекст модели позволяет
    // Сценарий C (chunking + pre-skeleton) пока не реализован — будет добавлен отдельно
    // На данный момент длинные тексты подаются целиком для моделей с ≥128K контекстом
    const textForStep1 = input.text;
    if (needsDigest) {
      console.warn(
        `Text exceeds digest threshold (${input.text.length} > ${digestThreshold}), ` +
        `but chunking is not yet implemented. Using full text.`
      );
    }

    // ============================================================
    // Запрос 1: Знакомство + Скелет
    // ============================================================
    state.currentStep = 1;
    callbacks.onStepStart(1);
    const step1Start = Date.now();

    let accumulatedText1 = '';
    const maxTokens1 = resolveStepMaxTokens(1, modelCaps);

    const result1 = await callWithRetry(
      () => callLLMStreaming({
        prompt: buildStep1Prompt(textForStep1, input.mediaType),
        llmConfig,
        onChunk: (text) => { accumulatedText1 += text; callbacks.onChunk(1, text); },
        maxTokens: maxTokens1,
        abortSignal,
      }),
      () => accumulatedText1,
      1,
      abortSignal,
    );

    const raw1 = typeof result1 === 'string' ? result1 : result1.text;
    const usage1 = typeof result1 === 'string' ? null : result1.usage;
    if (usage1) {
      state.meta.tokensUsed.prompt += usage1.prompt;
      state.meta.tokensUsed.completion += usage1.completion;
      state.meta.tokensUsed.total += usage1.total;
    }

    state.step1 = parseStep1Response(raw1);
    state.meta.stepTimings.step1 = Date.now() - step1Start;
    callbacks.onStepComplete(1, state.step1);

    // Check abort
    if (abortSignal?.aborted) {
      state.phase = 'error';
      state.error = 'Аудит отменён пользователем';
      return state;
    }

    // ============================================================
    // Определить текст для Запроса 2
    // ============================================================
    const textForStep2 = needsDigest
      ? computeDigestForV2(input.text, state.step1!.skeleton)
      : input.text;

    // ============================================================
    // Запрос 2: Оценка по критериям
    // ============================================================
    state.currentStep = 2;
    callbacks.onStepStart(2);
    const step2Start = Date.now();

    const criteria = filterByMediaType(
      MASTER_CHECKLIST,
      mapMediaTypeToLegacy(input.mediaType)
    );
    // Map to ChecklistItem format
    const criteriaV2 = criteria.map(c => ({
      id: c.id,
      name: c.text.split('—')[0]?.trim() || c.text,
      description: c.text,
      level: normalizeLevel(c.level),
    }));

    const maxTokens2 = resolveStepMaxTokens(2, modelCaps);
    const compressedMode2 = maxTokens2 < 8192;
    let accumulatedText2 = '';

    const result2 = await callWithRetry(
      () => callLLMStreaming({
        prompt: buildStep2Prompt(
          state.step1!.skeleton,
          textForStep2,
          criteriaV2,
          true,
          compressedMode2
        ),
        llmConfig,
        onChunk: (text) => { accumulatedText2 += text; callbacks.onChunk(2, text); },
        maxTokens: maxTokens2,
        abortSignal,
      }),
      () => accumulatedText2,
      2,
      abortSignal,
    );

    const raw2 = typeof result2 === 'string' ? result2 : result2.text;
    const usage2 = typeof result2 === 'string' ? null : result2.usage;
    if (usage2) {
      state.meta.tokensUsed.prompt += usage2.prompt;
      state.meta.tokensUsed.completion += usage2.completion;
      state.meta.tokensUsed.total += usage2.total;
    }

    state.step2 = parseStep2Response(raw2, criteria.map(c => c.id));
    state.meta.stepTimings.step2 = Date.now() - step2Start;
    callbacks.onStepComplete(2, state.step2);

    // Check abort
    if (abortSignal?.aborted) {
      state.phase = 'error';
      state.error = 'Аудит отменён пользователем';
      return state;
    }

    // ============================================================
    // Запрос 3: Рекомендации
    // ============================================================
    state.currentStep = 3;
    callbacks.onStepStart(3);
    const step3Start = Date.now();

    const weakAssessments = state.step2.assessments.filter(a => a.verdict === 'weak');
    const maxTokens3 = resolveStepMaxTokens(3, modelCaps);
    const compressedMode3 = maxTokens3 < 8192;
    let accumulatedText3 = '';

    const result3 = await callWithRetry(
      () => callLLMStreaming({
        prompt: buildStep3Prompt(weakAssessments, state.step1!.skeleton, compressedMode3),
        llmConfig,
        onChunk: (text) => { accumulatedText3 += text; callbacks.onChunk(3, text); },
        maxTokens: maxTokens3,
        abortSignal,
      }),
      () => accumulatedText3,
      3,
      abortSignal,
    );

    const raw3 = typeof result3 === 'string' ? result3 : result3.text;
    const usage3 = typeof result3 === 'string' ? null : result3.usage;
    if (usage3) {
      state.meta.tokensUsed.prompt += usage3.prompt;
      state.meta.tokensUsed.completion += usage3.completion;
      state.meta.tokensUsed.total += usage3.total;
    }

    state.step3 = parseStep3Response(raw3);
    state.meta.stepTimings.step3 = Date.now() - step3Start;
    callbacks.onStepComplete(3, state.step3);

    // ============================================================
    // Завершение
    // ============================================================
    state.meta.elapsedMs = Date.now() - pipelineStart;
    state.phase = 'done';
    return state;

  } catch (error: unknown) {
    const classified = classifyLLMError(error);
    state.phase = 'error';
    state.error = classified.userMessage;
    callbacks.onError(classified.userMessage);
    return state;
  }
}

// ============================================================
// Retry logic
// ============================================================

/**
 * Вызвать LLM с ретраем.
 *
 * @param fn — функция вызова LLM, возвращает LLMStreamingResult
 * @param getAccumulatedText — возвращает уже полученный streaming-текст
 * @param step — номер шага (для логирования)
 */
async function callWithRetry(
  fn: () => Promise<LLMStreamingResult>,
  getAccumulatedText: () => string,
  step: number,
  abortSignal?: AbortSignal,
): Promise<LLMStreamingResult> {
  try {
    return await fn();
  } catch (error: unknown) {
    if (isTransientError(error)) {
      // 429, 503, 502 — один повтор через 10 секунд
      await abortAwareSleep(10_000, abortSignal);
      try {
        return await fn();
      } catch {
        // Вторая транзиентная ошибка — не убивать пайплайн
        // Если уже получили часть текста через streaming — парсим лучшее усилие
        const partial = getAccumulatedText();
        if (partial.trim().length > 0) {
          console.warn(`Step ${step}: transient error after retry, using partial text (${partial.length} chars)`);
          return { text: partial, usage: null };
        }
        // Нет даже partial текста — это фатально
        throw new Error(`LLM не ответил на шаге ${step} после повторной попытки`);
      }
    }
    if (isFatalError(error)) {
      // 401, 403, CORS — нет смысла повторять
      throw error;
    }
    // Неизвестная ошибка — не повторять, пробросить
    throw error;
  }
}

function isTransientError(error: unknown): boolean {
  const classified = classifyLLMError(error);
  return classified.retryable && classified.type === 'transient_error';
}

function isFatalError(error: unknown): boolean {
  const classified = classifyLLMError(error);
  return !classified.retryable && (
    classified.type === 'fatal_auth_error' ||
    classified.type === 'fatal_cors_error'
  );
}

function abortAwareSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

// ============================================================
// Helpers
// ============================================================

function initMeta(input: AuditInput): PipelineMeta {
  return {
    inputText: input.text,
    mediaType: input.mediaType,
    narrativeDigest: null,
    elapsedMs: 0,
    stepTimings: {},
    tokensUsed: { prompt: 0, completion: 0, total: 0 },
  };
}

/**
 * Map MediaType to legacy MediaType for getFilteredCriteria.
 * V2 uses 'narrative' and 'visual' instead of 'novel'/'film'/'anime'/'series'.
 */
function mapMediaTypeToLegacy(mediaType: MediaType): LegacyMediaType {
  switch (mediaType) {
    case 'narrative': return 'novel';
    case 'visual': return 'film';
    case 'game': return 'game';
    case 'ttrpg': return 'ttrpg';
    default: return 'novel';
  }
}

/**
 * Normalize level strings like 'L1/L2' to a single level.
 * Takes the first level for categorization purposes.
 */
function normalizeLevel(level: string): 'L1' | 'L2' | 'L3' | 'L4' {
  if (level.startsWith('L4')) return 'L4';
  if (level.startsWith('L3')) return 'L3';
  if (level.startsWith('L2')) return 'L2';
  return 'L1';
}

// ============================================================
// Media type filtering (inlined from scoring-algorithm.ts)
// ============================================================

type LegacyMediaType = 'novel' | 'film' | 'anime' | 'series' | 'game' | 'ttrpg';

/** Filter checklist items by media type — marks applicable items */
function filterByMediaType(
  checklist: typeof MASTER_CHECKLIST,
  mediaType: LegacyMediaType
): (typeof MASTER_CHECKLIST[number] & { applicable: boolean })[] {
  return checklist.map(item => {
    const applicable = checkMediaApplicability(item.tag, mediaType);
    return { ...item, applicable };
  });
}

/** Check if a tag is applicable to media type */
function checkMediaApplicability(tag: string, mediaType: LegacyMediaType): boolean {
  if (tag === 'CORE') return true;
  if (tag.includes('|')) {
    return tag.split('|').some(t => checkMediaApplicability(t, mediaType));
  }
  if (tag === 'GAME' && (mediaType === 'game' || mediaType === 'ttrpg')) return true;
  if (tag === 'VISUAL' && ['film', 'anime', 'series'].includes(mediaType)) return true;
  if (tag === 'AUDIO' && ['film', 'anime', 'series'].includes(mediaType)) return true;
  if (tag === 'INTERACTIVE' && (mediaType === 'game' || mediaType === 'ttrpg')) return true;
  return false;
}
