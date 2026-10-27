/**
 * LLM Streaming wrapper for Pipeline V3 (Universe Audit Protocol).
 *
 * Обёртка над llm-client.ts, добавляющая streaming-поддержку.
 * Использует существующий streaming.ts для SSE-парсинга.
 *
 * Стратегия (v6 — free-plan compatible):
 * 1. Пробуем streaming через chatCompletionStream
 * 2. Если streaming вернул непустой текст — используем его
 * 3. Если streaming упал с ошибкой, но мы получили часть текста —
 *    используем partial текст (лучшая стратегия для таймаутов)
 * 4. Если streaming упал БЕЗ partial текста (AbortError/timeout) —
 *    выбрасываем ProxyTimeoutError, чтобы пайплайн мог решить,
 *    повторить с меньшим чанком или показать ошибку пользователю.
 * 5. Buffered fallback УДАЛЁН — на free plan он гарантированно
 *    получает тот же таймаут и только усугубляет каскад ошибок.
 * 6. Если ответ обрезан лимитом вывода (finish_reason=length/max_tokens/
 *    MAX_TOKENS) или поток оборвался — дописываем его запросом-продолжением
 *    (см. `continuation`), не теряя хвост отчёта вместе с вердиктом §26.S/§27.
 *
 * ВАЖНО: Мы НЕ добавляем свой таймаут поверх нижних уровней.
 * streaming.ts и llm-client.ts уже имеют свои таймауты.
 */

import type { LLMConfig, PromptSet } from './types-v3';
import { createLLMClient, type LLMProvider, type ChatCompletionResponse, type CustomModelOverrides } from '../llm-client';

// ============================================================
// Типы
// ============================================================

export interface LLMStreamingResult {
  /** Full text of the LLM response */
  text: string;
  /** Token usage from the LLM response (if available) */
  usage: { prompt: number; completion: number; total: number } | null;
  /**
   * Provider-normalized finish reason of the streamed choice
   * ('stop' | 'length' | 'content_filter' | ...). 'length' means the answer
   * was cut off by the output-token limit and must not be reported as complete.
   * With `continuation` enabled this is the reason of the LAST request, so a
   * successfully continued answer reports 'stop'.
   */
  finishReason?: string | null;
  /** True when the text was recovered from an interrupted stream — a partial answer. */
  incomplete?: boolean;
}

/**
 * Политика дописывания обрезанного ответа.
 *
 * Один запрос может упереться в max_tokens и потерять хвост отчёта, в котором
 * живёт вердикт §26.S/§27. Вместо того чтобы молча отдать обрезок, обёртка
 * просит модель продолжить с места обрыва — в тот же UI-поток.
 * Выключено по умолчанию: активируется только передачей объекта.
 */
export interface ContinuationPolicy {
  /** Максимум продолжений на один запрос. По умолчанию DEFAULT_MAX_CONTINUATIONS. */
  maxContinuations?: number;
  /** Предел накопленного текста: дальше продолжения не запрашиваются. */
  charCap?: number;
  /** Вызывается перед каждым продолжением — пайплайн пишет сюда строку журнала. */
  onContinue?: (attempt: number, maxAttempts: number) => void;
  /** Пауза по RPM перед продолжением; обязана уважать AbortSignal. */
  pace?: () => Promise<unknown>;
}

export interface LLMStreamingOptions {
  prompt: PromptSet;
  llmConfig: LLMConfig;
  onChunk: (text: string) => void;
  maxTokens: number;
  abortSignal?: AbortSignal;
  /** Response format — 'markdown' for V3 pipeline, 'json' for legacy */
  responseFormat?: 'markdown' | 'json';
  /** Temperature for LLM generation. If not provided, defaults to 0.7. */
  temperature?: number;
  /** Дописывание обрезанного ответа. Отсутствует — поведение прежнее. */
  continuation?: ContinuationPolicy;
}

// ============================================================
// Политика продолжения
// ============================================================

/** Два продолжения покрывают обрыв на середине раздела, но не удваивают расход. */
export const DEFAULT_MAX_CONTINUATIONS = 2;

/** Жёсткий предел текста одного чанка: защита от бесконечного дописывания. */
export const DEFAULT_CONTINUATION_CHAR_CAP = 32_000;

/** Минимальный прирост, ради которого стоит тратить ещё один запрос. */
const MIN_CONTINUATION_GAIN = 120;

/** Сколько символов требований к ответу напомнить модели в продолжении. */
const CONTINUATION_SPEC_TAIL_CHARS = 6_000;

/** Сколько символов уже написанного вернуть модели, чтобы она продолжила с обрыва. */
const CONTINUATION_WRITTEN_TAIL_CHARS = 4_000;

/** Совпадение хвоста и начала продолжения длиннее этого считаем повтором. */
const OVERLAP_MIN_CHARS = 32;
const OVERLAP_MAX_CHARS = 400;

/** Finish reasons, означающие «ответ обрезан или его завершение не подтверждено». */
const TRUNCATING_FINISH_REASONS = new Set(['length', 'max_tokens', 'MAX_TOKENS', 'incomplete', 'aborted']);

/** Текст запроса-продолжения (экспортируется для тестов и для UI-подсказок). */
export const CONTINUATION_INSTRUCTION = `ПРОДОЛЖЕНИЕ ОБРЕЗАННОГО ОТВЕТА.
Твой предыдущий ответ был обрезан лимитом вывода. Продолжи с места обрыва, не повторяй уже написанное: без вступления, без пересказа и без новых вводных абзацев. Формат — тот же свободный markdown и те же разделы протокола; выводи только недостающий текст.
Если по протоколу ещё не выданы разделы после места обрыва — в том числе §26.S «Итоговый вердикт» и машиночитаемый блок §27, — обязательно выдай их в этом продолжении.`;

/** True, если finish reason означает обрезанный ответ. */
export function isTruncatingFinishReason(reason: string | null | undefined): boolean {
  return !!reason && TRUNCATING_FINISH_REASONS.has(reason);
}

/** Последние `max` символов строки (без разрыва посередине суррогатной пары). */
function tailOf(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(text.length - max).replace(/^[\uDC00-\uDFFF]/, '');
}

/** Отрезать хвост материала: продолжению нужны требования, а не исходный текст. */
function stripMaterialSection(user: string): string {
  const idx = user.lastIndexOf('\nМАТЕРИАЛ:');
  return idx === -1 ? user : user.slice(0, idx);
}

/** Приклеить продолжение, сняв дословный повтор стыка (модель любит повторить хвост). */
function appendWithoutOverlap(base: string, addition: string): string {
  if (!base || !addition) return base + addition;
  const max = Math.min(OVERLAP_MAX_CHARS, base.length, addition.length);
  for (let length = max; length >= OVERLAP_MIN_CHARS; length--) {
    if (base.endsWith(addition.slice(0, length))) {
      return base + addition.slice(length);
    }
  }
  return base + addition;
}

function sumUsage(
  base: LLMStreamingResult['usage'],
  next: LLMStreamingResult['usage'],
): LLMStreamingResult['usage'] {
  if (!base) return next;
  if (!next) return base;
  return {
    prompt: base.prompt + next.prompt,
    completion: base.completion + next.completion,
    total: base.total + next.total,
  };
}

/**
 * Запрос-продолжение: те же требования к ответу (хвост исходного запроса без
 * материала) + хвост уже написанного, чтобы модель продолжила с места обрыва.
 */
export function buildContinuationPrompt(original: PromptSet, writtenText: string): PromptSet {
  const specTail = tailOf(stripMaterialSection(original.user).trim(), CONTINUATION_SPEC_TAIL_CHARS);
  const writtenTail = tailOf(writtenText, CONTINUATION_WRITTEN_TAIL_CHARS);

  return {
    system: original.system,
    user: `${CONTINUATION_INSTRUCTION}

[ТРЕБОВАНИЯ К ОТВЕТУ — конец исходного запроса]
${specTail}
[КОНЕЦ ТРЕБОВАНИЙ]

[УЖЕ НАПИСАННЫЙ ОТВЕТ — НЕ ПОВТОРЯТЬ И НЕ ПЕРЕСКАЗЫВАТЬ]
${writtenTail}
[КОНЕЦ УЖЕ НАПИСАННОГО]

Продолжи ровно с последнего символа уже написанного ответа.`,
  };
}

// ============================================================
// Основная функция
// ============================================================

/**
 * Вызвать LLM с streaming.
 *
 * Стратегия (v6):
 * 1. Пробуем streaming через chatCompletionStream
 * 2. Если streaming вернул непустой текст — используем его
 * 3. Если streaming упал с ошибкой, но мы получили часть текста —
 *    используем partial текст
 * 4. Если streaming упал БЕЗ partial текста (timeout/AbortError) —
 *    выбрасываем ProxyTimeoutError для обработки пайплайном
 * 5. Buffered fallback НЕ используется — он только усиливает каскад
 * 6. Если ответ обрезан и передана политика `continuation` — дописываем его
 *    запросами-продолжениями, пока ответ не завершится нормально или не
 *    исчерпан лимит продолжений / длины
 */
export async function callLLMStreaming(options: LLMStreamingOptions): Promise<LLMStreamingResult> {
  const { prompt, llmConfig, onChunk, maxTokens, abortSignal, temperature } = options;
  const effectiveTemperature = temperature ?? 0.7;

  const provider = llmConfig.provider as LLMProvider;
  const customOverrides: CustomModelOverrides | undefined = (
    llmConfig.customContextWindow || llmConfig.customMaxOutputTokens || llmConfig.customSupportsJSONMode != null
  ) ? {
    customContextWindow: llmConfig.customContextWindow || undefined,
    customMaxOutputTokens: llmConfig.customMaxOutputTokens || undefined,
    customSupportsJSONMode: llmConfig.customSupportsJSONMode,
  } : undefined;

  const client = createLLMClient({
    provider,
    apiKey: llmConfig.apiKey,
    model: llmConfig.model,
    baseUrl: llmConfig.baseUrl,
    transport: llmConfig.transport,
    relayUrl: llmConfig.relayUrl,
  }, customOverrides);

  // Helper to extract usage from response
  const extractUsage = (response: { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } } | undefined): { prompt: number; completion: number; total: number } | null => {
    if (response?.usage) {
      return {
        prompt: response.usage.prompt_tokens || 0,
        completion: response.usage.completion_tokens || 0,
        total: response.usage.total_tokens || 0,
      };
    }
    return null;
  };

  /**
   * Один запрос к провайдеру со стримингом.
   * Возвращает результат попытки либо partial текст, если поток оборвался.
   */
  const requestOnce = async (userContent: string): Promise<LLMStreamingResult> => {
    // Accumulate text of THIS attempt for partial-text recovery
    let attemptAccumulated = '';

    try {
      const response = await client.chatCompletionStream(
        {
          messages: [
            { role: 'system' as const, content: prompt.system },
            { role: 'user' as const, content: userContent },
          ],
          max_tokens: maxTokens,
          temperature: effectiveTemperature,
          signal: abortSignal,
          responseFormat: options.responseFormat || 'markdown',
        },
        (text: string, _delta: string) => {
          // Accumulate delta for potential partial-text recovery
          attemptAccumulated += _delta;
          // Call onChunk with the delta (new text), not accumulated
          onChunk(_delta);
        }
      );

      const fullText = response.choices?.[0]?.message?.content || '';
      const finishReason = response.choices?.[0]?.finish_reason ?? null;

      // If streaming returned empty text but we accumulated text via callbacks,
      // use the accumulated text (proxy might not populate choices[0].message.content)
      if (fullText.trim() === '' && attemptAccumulated.trim().length > 0) {
        console.warn('Streaming response had empty choices[0].message.content, using accumulated streaming text');
        return { text: attemptAccumulated, usage: extractUsage(response), finishReason };
      }

      // If streaming returned empty text AND no accumulated text —
      // this likely means the proxy didn't support SSE or returned empty response.
      // Return empty — the pipeline will handle it.
      if (fullText.trim() === '' && attemptAccumulated.trim() === '') {
        console.warn('Streaming returned empty text and no accumulated text');
        return { text: '', usage: extractUsage(response), finishReason };
      }

      return { text: fullText, usage: extractUsage(response), finishReason };
    } catch (streamError) {
      // A user cancel is not a partial answer: stop immediately and let the
      // pipeline unwind. Recovering here would keep the audit running after the
      // user pressed «Отменить аудит».
      if (abortSignal?.aborted) {
        throw streamError;
      }

      // Partial text recovery — if we got ANY text before the error, use it
      if (attemptAccumulated.trim().length > 0) {
        console.warn(
          'Streaming failed but partial text received (' + attemptAccumulated.length +
          ' chars), using partial text instead of retrying buffered request'
        );
        return { text: attemptAccumulated, usage: null, finishReason: null, incomplete: true };
      }

      // No partial text — streaming was aborted before ANY data arrived.
      // DO NOT fall back to buffered request — it will hit the same timeout.
      // Instead, throw a specific error that the pipeline can handle.
      const isAbort = streamError instanceof DOMException && streamError.name === 'AbortError';
      const isTimeout = streamError instanceof Error && /timeout|таймаут/i.test(streamError.message);

      if (isAbort || isTimeout) {
        // Throw a specific error type that the pipeline can catch and decide
        // whether to retry with a smaller chunk or give up
        const timeoutError = new Error(
          'PROXY_TIMEOUT: LLM request exceeded proxy timeout. ' +
          'The request was too large for the proxy to handle within its time limit. ' +
          'Solutions: (1) Use a faster model, (2) Reduce input/output size, ' +
          '(3) Split the request into smaller chunks.'
        );
        timeoutError.name = 'ProxyTimeoutError';
        throw timeoutError;
      }

      // Non-timeout error — rethrow as-is
      throw streamError;
    }
  };

  const first = await requestOnce(prompt.user);

  const policy = options.continuation;
  if (!policy) return first;

  const maxContinuations = Math.max(0, policy.maxContinuations ?? DEFAULT_MAX_CONTINUATIONS);
  const charCap = Math.max(0, policy.charCap ?? DEFAULT_CONTINUATION_CHAR_CAP);

  let text = first.text;
  let usage = first.usage;
  let finishReason = first.finishReason ?? null;
  let incomplete = first.incomplete === true;
  let continuations = 0;

  while (continuations < maxContinuations) {
    const truncated = incomplete || isTruncatingFinishReason(finishReason);
    if (!truncated) break;
    // Нечего продолжать: пустой ответ или уже достигнут предел длины.
    if (text.trim().length === 0) break;
    if (text.length >= charCap) break;
    if (abortSignal?.aborted) break;

    const attempt = continuations + 1;
    policy.onContinue?.(attempt, maxContinuations);
    // Пауза по RPM: бесплатный тариф считает продолжение отдельным запросом.
    if (policy.pace) await policy.pace();
    if (abortSignal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const next = await requestOnce(buildContinuationPrompt(prompt, text).user);
    continuations = attempt;

    const combined = appendWithoutOverlap(text, next.text);
    const gain = combined.length - text.length;
    text = combined;
    usage = sumUsage(usage, next.usage);
    finishReason = next.finishReason ?? null;
    incomplete = next.incomplete === true;

    // Продолжение завершилось нормально — ответ больше не обрезан.
    if (!incomplete && !isTruncatingFinishReason(finishReason)) break;
    // Продолжение ничего не добавило — второй раз не пытаемся.
    if (gain < MIN_CONTINUATION_GAIN) break;
  }

  return {
    text,
    usage,
    finishReason,
    incomplete: incomplete || undefined,
  };
}
