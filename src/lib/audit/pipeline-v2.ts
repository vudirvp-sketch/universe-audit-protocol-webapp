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
  ParseError,
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
        responseFormat: 'markdown',
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

    // Best-effort parsing: if ParseError, use accumulated streaming text as fallback
    try {
      state.step1 = parseStep1Response(raw1);
    } catch (parseErr) {
      if (parseErr instanceof ParseError && accumulatedText1.trim().length > 0) {
        console.warn('Step 1: ParseError on raw response, retrying with accumulated streaming text');
        try {
          state.step1 = parseStep1Response(accumulatedText1);
        } catch {
          console.warn('Step 1: Fallback parse also failed, using empty Step1Result');
          state.step1 = makeEmptyStep1Result();
        }
      } else if (parseErr instanceof ParseError) {
        console.warn('Step 1: Empty LLM response, using empty Step1Result');
        state.step1 = makeEmptyStep1Result();
      } else {
        throw parseErr;
      }
    }
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
        responseFormat: 'markdown',
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

    // Best-effort parsing for Step 2
    try {
      state.step2 = parseStep2Response(raw2, criteria.map(c => c.id));
    } catch (parseErr) {
      if (parseErr instanceof ParseError && accumulatedText2.trim().length > 0) {
        console.warn('Step 2: ParseError on raw response, retrying with accumulated streaming text');
        try {
          state.step2 = parseStep2Response(accumulatedText2, criteria.map(c => c.id));
        } catch {
          console.warn('Step 2: Fallback parse also failed, using empty Step2Result');
          state.step2 = makeEmptyStep2Result(criteria.map(c => c.id));
        }
      } else if (parseErr instanceof ParseError) {
        console.warn('Step 2: Empty LLM response, using empty Step2Result');
        state.step2 = makeEmptyStep2Result(criteria.map(c => c.id));
      } else {
        throw parseErr;
      }
    }
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
        responseFormat: 'markdown',
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

    // Best-effort parsing for Step 3
    try {
      state.step3 = parseStep3Response(raw3);
    } catch (parseErr) {
      if (parseErr instanceof ParseError && accumulatedText3.trim().length > 0) {
        console.warn('Step 3: ParseError on raw response, retrying with accumulated streaming text');
        try {
          state.step3 = parseStep3Response(accumulatedText3);
        } catch {
          console.warn('Step 3: Fallback parse also failed, using empty Step3Result');
          state.step3 = makeEmptyStep3Result();
        }
      } else if (parseErr instanceof ParseError) {
        console.warn('Step 3: Empty LLM response, using empty Step3Result');
        state.step3 = makeEmptyStep3Result();
      } else {
        throw parseErr;
      }
    }
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

// ============================================================
// Best-effort fallback constructors (empty results for ParseError)
// ============================================================

import type { ScreeningAnswer, CriterionAssessment, FixRecommendation } from './types-v2';

const SCREENING_QUESTIONS = [
  'Тематический закон работает как правило',
  'Мир существует без протагониста',
  'Воплощённость (мир ощущается телесно)',
  'Хамартия (фатальный изъян)',
  'Болезненный выбор',
  'Логика антагониста',
  'Необратимость финала',
];

/** Create an empty Step1Result when parsing fails */
function makeEmptyStep1Result(): Step1Result {
  const screeningAnswers: ScreeningAnswer[] = SCREENING_QUESTIONS.map((q) => ({
    question: q,
    passed: false,
    explanation: 'Не удалось распарсить ответ LLM',
  }));
  return {
    auditMode: 'conflict',
    modeRationale: 'Автоматический выбор (LLM не ответила)',
    authorProfile: {
      type: 'hybrid',
      percentage: 50,
      confidence: 0,
      risks: [],
      auditPriorities: [],
    },
    skeleton: {
      thematicLaw: null,
      rootTrauma: null,
      hamartia: null,
      pillars: [],
      emotionalEngine: null,
      authorProhibition: null,
      targetExperience: null,
      centralQuestion: null,
    },
    screeningAnswers,
    screeningFlags: screeningAnswers.filter(a => !a.passed).map(a => a.question),
  };
}

/** Create an empty Step2Result when parsing fails */
function makeEmptyStep2Result(criteriaIds: string[]): Step2Result {
  const assessments: CriterionAssessment[] = criteriaIds.map((id) => ({
    id,
    level: guessLevelFromId(id),
    verdict: 'insufficient_data' as const,
    evidence: '',
    explanation: 'Не удалось распарсить ответ LLM',
  }));
  return {
    assessments,
    griefMatrix: null,
  };
}

/** Create an empty Step3Result when parsing fails */
function makeEmptyStep3Result(): Step3Result {
  return {
    fixList: [],
    whatForChains: [],
    generative: null,
  };
}

/** Guess level from criterion ID prefix */
function guessLevelFromId(id: string): 'L1' | 'L2' | 'L3' | 'L4' {
  const block = id.charAt(0).toUpperCase();
  switch (block) {
    case 'A': case 'B': case 'E': case 'F': return 'L1';
    case 'C': case 'D': case 'H': return 'L2';
    case 'J': case 'I': return 'L3';
    case 'G': case 'K': case 'M': return 'L4';
    default: return 'L1';
  }
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
