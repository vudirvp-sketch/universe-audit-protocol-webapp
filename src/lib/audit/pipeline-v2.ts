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
  ScreeningAnswer,
  CriterionAssessment,
  ChecklistItem,
} from './types-v2';
import type { ModelCapabilities } from '../llm-client';
import type { LLMStreamingResult } from './llm-streaming';
import { getModelCapabilities } from '../llm-client';
import { buildStep1Prompt, buildStep2ChunkPrompt, buildStep3Prompt } from './prompts-v2';
import {
  parseStep1Response,
  parseStep2Response,
  parseStep3Response,
  ParseError,
  guessLevelFromId,
} from './markdown-parser';
import type { GriefArchitectureMatrix } from './types-v2';
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

// ============================================================
// Step 2: Chunk-разбиение критериев
// ============================================================

/**
 * Группы критериев для параллельных LLM-запросов в Step 2.
 *
 * Проблема: один запрос на 52+ критерия занимает 90-120с,
 * что превышает 30-секундный лимит Cloudflare Workers (бесплатный план).
 *
 * Решение: разбиваем критерии на 3 чанка по ~17 штук,
 * каждый из которых укладывается в 15-25с.
 *
 * Группировка по смыслу:
 *   2A — Фундамент (структура, связность, системы, новые элементы) — 23 критерия
 *   2B — Жизненность + Персонажи + Тематическая физика — 16 критериев
 *   2C — Сцены + Инфраструктура + Горе + Культовость + Мета + Финал — 15 критериев
 */
const STEP2_CHUNK_GROUPS: string[][] = [
  // Chunk 2A: Фундамент (Structure + Connectedness + Systems + New Elements)
  ['A1','A2','A3','A4','A5','A6','A7', 'B1','B2','B3','B4','B5','B6','B7','B8', 'E1','E2','E3','E4','E5','E6', 'F1','F2'],
  // Chunk 2B: Vitality + Characters + Thematic Physics
  ['C1','C2','C3','C4','C5','C6','C7', 'D1','D2','D3','D4','D5','D6','D7', 'I1','I2'],
  // Chunk 2C: Scenes + Narrative Infrastructure + Grief + Cult + Meta + Finale
  ['H1', 'L1','L2','L3', 'J1','J2','J3', 'G1', 'K1','K2','K3','K4', 'M1','M2','M3'],
];

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

    // DIAG: логируем ответ LLM для Step 1
    console.log(`[Pipeline] Step 1: ответ LLM — ${raw1.length} символов`);
    if (raw1.length === 0) {
      console.warn('[Pipeline] Step 1: ПУСТОЙ ответ LLM! accumulatedText1 =', accumulatedText1.length, 'символов');
    } else if (raw1.length < 100) {
      console.warn('[Pipeline] Step 1: подозрительно короткий ответ:', raw1);
    } else {
      console.log('[Pipeline] Step 1: первые 300 символов:', raw1.slice(0, 300));
    }

    // Best-effort parsing: if ParseError, use accumulated streaming text as fallback
    try {
      state.step1 = parseStep1Response(raw1);
    } catch (parseErr) {
      if (parseErr instanceof ParseError && accumulatedText1.trim().length > 0) {
        console.warn('[Pipeline] Step 1: ParseError on raw response, retrying with accumulated streaming text');
        try {
          state.step1 = parseStep1Response(accumulatedText1);
        } catch {
          console.warn('[Pipeline] Step 1: Fallback parse also failed, using empty Step1Result');
          state.step1 = makeEmptyStep1Result();
        }
      } else if (parseErr instanceof ParseError) {
        console.warn('[Pipeline] Step 1: Empty LLM response, using empty Step1Result');
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
    // Запрос 2: Оценка по критериям (чанкованный — параллельные вызовы)
    // ============================================================
    // Каждый чанк содержит ~17 критериев и отправляется отдельным
    // LLM-запросом. Это позволяет уложиться в 30-секундный лимит
    // Cloudflare Workers (бесплатный план): вместо одного запроса
    // на 52 критерия (~90-120с) делаем 3 запроса по ~17 (~15-25с).
    //
    // Чанки выполняются параллельно (Promise.allSettled) — общее
    // время Step 2 ≈ max(2A, 2B, 2C) ≈ 20-25с вместо 90-120с.
    // Если один чанк падает — остальные сохраняются, а упавшие
    // критерии получают verdict=insufficient_data.
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

    // --- Split criteria into chunks ---
    const criteriaV2ById = new Map<string, ChecklistItem>(criteriaV2.map(c => [c.id, c]));
    const allCriteriaIds = criteria.map(c => c.id);

    const chunkSpecs = STEP2_CHUNK_GROUPS.map((groupIds, idx) => {
      const chunkCriteria = groupIds
        .map(id => criteriaV2ById.get(id))
        .filter((c): c is ChecklistItem => c !== undefined);
      return {
        criteria: chunkCriteria,
        criteriaIds: chunkCriteria.map(c => c.id),
        chunkIndex: idx,
        hasL3: chunkCriteria.some(c => c.level === 'L3'),
      };
    }).filter(spec => spec.criteria.length > 0); // Remove empty chunks (media-filtered)

    console.log(
      `[Pipeline] Step 2: ${allCriteriaIds.length} criteria → ${chunkSpecs.length} chunks:`,
      chunkSpecs.map(s => `${s.criteriaIds.length} criteria [${s.criteriaIds[0]}..${s.criteriaIds[s.criteriaIds.length - 1]}]`).join(', ')
    );

    // --- Run chunks in parallel ---
    const chunkPromises = chunkSpecs.map((spec) => {
      let accumulatedTextChunk = '';
      return callWithRetry(
        () => callLLMStreaming({
          prompt: buildStep2ChunkPrompt(
            state.step1!.skeleton,
            textForStep2,
            spec.criteria,
            spec.hasL3, // grief matrix hint only for chunk with L3 criteria
            compressedMode2,
            spec.chunkIndex + 1,
            chunkSpecs.length,
          ),
          llmConfig,
          onChunk: (text) => { accumulatedTextChunk += text; callbacks.onChunk(2, text); },
          maxTokens: maxTokens2,
          abortSignal,
          responseFormat: 'markdown',
        }),
        () => accumulatedTextChunk,
        2,
        abortSignal,
      ).then(result => ({
        raw: typeof result === 'string' ? result : result.text,
        usage: typeof result === 'string' ? null : result.usage,
        criteriaIds: spec.criteriaIds,
        hasL3: spec.hasL3,
        chunkIndex: spec.chunkIndex,
      }));
    });

    const chunkResponses = await Promise.allSettled(chunkPromises);

    // --- Merge results from all chunks ---
    let allAssessments: CriterionAssessment[] = [];
    let griefMatrix: GriefArchitectureMatrix | null = null;
    let successfulChunks = 0;
    let failedChunks = 0;

    for (let i = 0; i < chunkResponses.length; i++) {
      const response = chunkResponses[i];
      const spec = chunkSpecs[i];

      if (response.status === 'fulfilled') {
        const { raw, usage, criteriaIds, hasL3 } = response.value;

        // Accumulate token usage
        if (usage) {
          state.meta.tokensUsed.prompt += usage.prompt;
          state.meta.tokensUsed.completion += usage.completion;
          state.meta.tokensUsed.total += usage.total;
        }

        // DIAG: log chunk response
        console.log(`[Pipeline] Step 2 chunk ${i + 1}/${chunkSpecs.length}: ${raw.length} символов`);
        if (raw.length === 0) {
          console.warn(`[Pipeline] Step 2 chunk ${i + 1}: ПУСТОЙ ответ LLM!`);
        } else if (raw.length < 100) {
          console.warn(`[Pipeline] Step 2 chunk ${i + 1}: подозрительно короткий ответ:`, raw.slice(0, 200));
        }

        // Parse chunk
        try {
          const parsed = parseStep2Response(raw, criteriaIds);
          allAssessments.push(...parsed.assessments);
          if (parsed.griefMatrix) griefMatrix = parsed.griefMatrix;
          successfulChunks++;
        } catch (parseErr) {
          if (parseErr instanceof ParseError) {
            console.warn(`[Pipeline] Step 2 chunk ${i + 1}: ParseError — filling ${criteriaIds.length} criteria with insufficient_data`);
          } else {
            console.error(`[Pipeline] Step 2 chunk ${i + 1}: Unexpected parse error:`, parseErr);
          }
          // Fill this chunk's criteria with insufficient_data
          for (const id of criteriaIds) {
            if (!allAssessments.find(a => a.id === id)) {
              allAssessments.push({
                id,
                level: guessLevelFromId(id),
                verdict: 'insufficient_data',
                evidence: '',
                explanation: 'Не удалось распарсить ответ LLM для этой части',
              });
            }
          }
          failedChunks++;
        }
      } else {
        // Chunk failed entirely (network error, timeout, etc.)
        console.error(`[Pipeline] Step 2 chunk ${i + 1} FAILED:`, response.reason);
        for (const id of spec.criteriaIds) {
          allAssessments.push({
            id,
            level: guessLevelFromId(id),
            verdict: 'insufficient_data',
            evidence: '',
            explanation: 'LLM не ответила на эту часть (ошибка запроса)',
          });
        }
        failedChunks++;
      }
    }

    // Fill any missing criteria (e.g., media-filtered out of all chunks)
    const foundIds = new Set(allAssessments.map(a => a.id));
    for (const id of allCriteriaIds) {
      if (!foundIds.has(id)) {
        allAssessments.push({
          id,
          level: guessLevelFromId(id),
          verdict: 'insufficient_data',
          evidence: '',
          explanation: 'Критерий не был включён ни в один чанк',
        });
      }
    }

    console.log(
      `[Pipeline] Step 2 complete: ${successfulChunks}/${chunkSpecs.length} chunks OK, ` +
      `${allAssessments.length} assessments ` +
      `(${allAssessments.filter(a => a.verdict !== 'insufficient_data').length} with data, ` +
      `${allAssessments.filter(a => a.verdict === 'insufficient_data').length} insufficient_data)`
    );

    state.step2 = {
      assessments: allAssessments,
      griefMatrix,
    };
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

    const weakAssessments = state.step2?.assessments.filter(a => a.verdict === 'weak') ?? [];
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

    // DIAG: логируем ответ LLM для Step 3
    console.log(`[Pipeline] Step 3: ответ LLM — ${raw3.length} символов`);
    if (raw3.length === 0) {
      console.warn('[Pipeline] Step 3: ПУСТОЙ ответ LLM! accumulatedText3 =', accumulatedText3.length, 'символов');
    } else {
      console.log('[Pipeline] Step 3: первые 300 символов:', raw3.slice(0, 300));
    }

    // Best-effort parsing for Step 3
    try {
      state.step3 = parseStep3Response(raw3);
    } catch (parseErr) {
      if (parseErr instanceof ParseError && accumulatedText3.trim().length > 0) {
        console.warn('[Pipeline] Step 3: ParseError on raw response, retrying with accumulated streaming text');
        try {
          state.step3 = parseStep3Response(accumulatedText3);
        } catch {
          console.warn('[Pipeline] Step 3: Fallback parse also failed, using empty Step3Result');
          state.step3 = makeEmptyStep3Result();
        }
      } else if (parseErr instanceof ParseError) {
        console.warn('[Pipeline] Step 3: Empty LLM response, using empty Step3Result');
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
    // BUGFIX: Прежде чем решать — ретрай или фатал — проверяем,
    // получили ли мы часть текста через streaming. Если да —
    // используем partial текст вместо ретрая.
    // Это критично для таймаутов: LLM может думать 90-120сек,
    // прокси возвращает 504, но мы уже получили 80% ответа
    // через streaming. Ретрай в этом случае только потеряет время.
    const partial = getAccumulatedText();
    if (partial.trim().length > 0) {
      console.warn(`Step ${step}: error after streaming, but have partial text (${partial.length} chars) — using it instead of retry`);
      return { text: partial, usage: null };
    }

    if (isTransientError(error)) {
      // 429, 503, 502 — один повтор через 5 секунд (уменьшено с 10,
      // т.к. прокси уже делает свои ретраи)
      console.warn(`Step ${step}: transient error, retrying in 5s...`, error instanceof Error ? error.message : String(error));
      await abortAwareSleep(5_000, abortSignal);
      try {
        return await fn();
      } catch (retryError) {
        // Вторая транзиентная ошибка — проверяем partial ещё раз
        const partialAfterRetry = getAccumulatedText();
        if (partialAfterRetry.trim().length > 0) {
          console.warn(`Step ${step}: transient error after retry, using partial text (${partialAfterRetry.length} chars)`);
          return { text: partialAfterRetry, usage: null };
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
function makeEmptyStep2Result(criteriaIds: string[], reason?: string): Step2Result {
  const explanation = reason || 'Не удалось распарсить ответ LLM';
  const assessments: CriterionAssessment[] = criteriaIds.map((id) => ({
    id,
    level: guessLevelFromId(id),
    verdict: 'insufficient_data' as const,
    evidence: '',
    explanation,
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
