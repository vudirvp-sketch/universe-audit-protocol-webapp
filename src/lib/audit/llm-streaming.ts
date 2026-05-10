/**
 * LLM Streaming wrapper for Pipeline V3 (Universe Audit Protocol).
 *
 * Обёртка над llm-client.ts, добавляющая streaming-поддержку.
 * Использует существующий streaming.ts для SSE-парсинга.
 *
 * Стратегия (v5 — free-plan compatible):
 * 1. Пробуем streaming через chatCompletionStream
 * 2. Если streaming вернул непустой текст — используем его
 * 3. Если streaming упал с ошибкой, но мы получили часть текста —
 *    используем partial текст (лучшая стратегия для таймаутов)
 * 4. Если streaming упал БЕЗ partial текста (AbortError/timeout) —
 *    выбрасываем ProxyTimeoutError, чтобы пайплайн мог решить,
 *    повторить с меньшим чанком или показать ошибку пользователю.
 * 5. Buffered fallback УДАЛЁН — на free plan он гарантированно
 *    получает тот же таймаут и только усугубляет каскад ошибок.
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
}

// ============================================================
// Основная функция
// ============================================================

/**
 * Вызвать LLM с streaming.
 *
 * Стратегия (v5):
 * 1. Пробуем streaming через chatCompletionStream
 * 2. Если streaming вернул непустой текст — используем его
 * 3. Если streaming упал с ошибкой, но мы получили часть текста —
 *    используем partial текст
 * 4. Если streaming упал БЕЗ partial текста (timeout/AbortError) —
 *    выбрасываем ProxyTimeoutError для обработки пайплайном
 * 5. Buffered fallback НЕ используется — он только усиливает каскад
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
    proxyUrl: llmConfig.proxyUrl,
  }, customOverrides);

  const messages = [
    { role: 'system' as const, content: prompt.system },
    { role: 'user' as const, content: prompt.user },
  ];

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

  // Accumulate streaming text for partial-text recovery
  let streamingAccumulated = '';

  try {
    const response = await client.chatCompletionStream(
      {
        messages,
        max_tokens: maxTokens,
        temperature: effectiveTemperature,
        signal: abortSignal,
        responseFormat: options.responseFormat || 'markdown',
      },
      (text: string, _delta: string) => {
        // Accumulate delta for potential partial-text recovery
        streamingAccumulated += _delta;
        // Call onChunk with the delta (new text), not accumulated
        onChunk(_delta);
      }
    );

    const fullText = response.choices?.[0]?.message?.content || '';

    // If streaming returned empty text but we accumulated text via callbacks,
    // use the accumulated text (proxy might not populate choices[0].message.content)
    if (fullText.trim() === '' && streamingAccumulated.trim().length > 0) {
      console.warn('Streaming response had empty choices[0].message.content, using accumulated streaming text');
      return { text: streamingAccumulated, usage: extractUsage(response) };
    }

    // If streaming returned empty text AND no accumulated text —
    // this likely means the proxy didn't support SSE or returned empty response.
    // Return empty — the pipeline will handle it.
    if (fullText.trim() === '' && streamingAccumulated.trim() === '') {
      console.warn('Streaming returned empty text and no accumulated text');
      return { text: '', usage: extractUsage(response) };
    }

    return { text: fullText, usage: extractUsage(response) };
  } catch (streamError) {
    // Partial text recovery — if we got ANY text before the error, use it
    if (streamingAccumulated.trim().length > 0) {
      console.warn(
        'Streaming failed but partial text received (' + streamingAccumulated.length +
        ' chars), using partial text instead of retrying buffered request'
      );
      return { text: streamingAccumulated, usage: null };
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
}
