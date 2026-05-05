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
  MediaTypeV2,
} from './types-v2';
import type { ModelCapabilities } from '../llm-client';
import { getModelCapabilities } from '../llm-client';
import { buildStep1Prompt, buildStep2Prompt, buildStep3Prompt } from './prompts-v2';
import {
  parseStep1Response,
  parseStep2Response,
  parseStep3Response,
} from './markdown-parser';
import { callLLMStreaming } from './llm-streaming';
import { MASTER_CHECKLIST } from './protocol-data';
import { filterByMediaType } from './scoring-algorithm';
import { getAdaptiveDigestThreshold } from './narrative-processor-v2';
import { classifyLLMError } from './error-handler';

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

    const raw1 = await callWithRetry(
      () => callLLMStreaming({
        prompt: buildStep1Prompt(textForStep1, input.mediaType),
        llmConfig,
        onChunk: (text) => { accumulatedText1 += text; callbacks.onChunk(1, text); },
        maxTokens: maxTokens1,
        abortSignal,
      }),
      () => accumulatedText1,
      1
    );

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
      ? input.text  // TODO: computeNarrativeDigest(input.text, skeletonKeywords)
      : input.text;

    // ============================================================
    // Запрос 2: Оценка по критериям
    // ============================================================
    state.currentStep = 2;
    callbacks.onStepStart(2);
    const step2Start = Date.now();

    const criteria = filterByMediaType(
      MASTER_CHECKLIST,
      mapMediaTypeV2ToLegacy(input.mediaType) as Parameters<typeof filterByMediaType>[1]
    );
    // Map to ChecklistItemV2 format
    const criteriaV2 = criteria.map(c => ({
      id: c.id,
      name: c.text.split('—')[0]?.trim() || c.text,
      description: c.text,
      level: normalizeLevel(c.level),
    }));

    const compressedMode2 = maxTokens1 < 8192;
    let accumulatedText2 = '';
    const maxTokens2 = resolveStepMaxTokens(2, modelCaps);

    const raw2 = await callWithRetry(
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
      2
    );

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
    const compressedMode3 = maxTokens1 < 8192;
    let accumulatedText3 = '';
    const maxTokens3 = resolveStepMaxTokens(3, modelCaps);

    const raw3 = await callWithRetry(
      () => callLLMStreaming({
        prompt: buildStep3Prompt(weakAssessments, state.step1!.skeleton, compressedMode3),
        llmConfig,
        onChunk: (text) => { accumulatedText3 += text; callbacks.onChunk(3, text); },
        maxTokens: maxTokens3,
        abortSignal,
      }),
      () => accumulatedText3,
      3
    );

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
 * @param fn — функция вызова LLM, возвращает полный текст
 * @param getAccumulatedText — возвращает уже полученный streaming-текст
 * @param step — номер шага (для логирования)
 */
async function callWithRetry(
  fn: () => Promise<string>,
  getAccumulatedText: () => string,
  step: number
): Promise<string> {
  try {
    return await fn();
  } catch (error: unknown) {
    if (isTransientError(error)) {
      // 429, 503, 502 — один повтор через 10 секунд
      await sleep(10_000);
      try {
        return await fn();
      } catch {
        // Вторая транзиентная ошибка — не убивать пайплайн
        // Если уже получили часть текста через streaming — парсим лучшее усилие
        const partial = getAccumulatedText();
        if (partial.trim().length > 0) {
          console.warn(`Step ${step}: transient error after retry, using partial text (${partial.length} chars)`);
          return partial;
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
  return classified.retryable && (
    classified.type === 'rate_limit' ||
    classified.type === 'provider_overloaded' ||
    classified.type === 'timeout'
  );
}

function isFatalError(error: unknown): boolean {
  const classified = classifyLLMError(error);
  return !classified.retryable && (
    classified.type === 'auth' ||
    classified.type === 'cors'
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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
 * Map MediaTypeV2 to legacy MediaType for getFilteredCriteria.
 * V2 uses 'narrative' and 'visual' instead of 'novel'/'film'/'anime'/'series'.
 */
function mapMediaTypeV2ToLegacy(mediaType: MediaTypeV2): string {
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
