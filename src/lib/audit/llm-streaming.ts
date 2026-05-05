/**
 * LLM Streaming wrapper for Pipeline V2 (Universe Audit Protocol v11.0).
 *
 * Обёртка над llm-client.ts, добавляющая streaming-поддержку.
 * Использует существующий streaming.ts для SSE-парсинга.
 *
 * Стратегия: сначала пробуем streaming, если он вернул пустой текст —
 * фоллбэк на обычный buffered-запрос. Это гарантирует, что мы всегда
 * получаем ответ от LLM, даже если прокси не поддерживает SSE.
 *
 * ВАЖНО: Добавлен собственный таймаут (DEFAULT_TIMEOUT_MS = 120 сек),
 * чтобы LLM-вызов не висел бесконечно, если abortSignal не предоставлен.
 */

import type { LLMConfig, PromptSet } from './types-v2';
import { createLLMClient, type LLMProvider } from '../llm-client';

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
  /** Response format — 'markdown' for V2 pipeline, 'json' for legacy */
  responseFormat?: 'markdown' | 'json';
}

// ============================================================
// Константы
// ============================================================

/** Default timeout for LLM calls (streaming + buffered) in milliseconds */
const DEFAULT_TIMEOUT_MS = 120_000; // 2 minutes

// ============================================================
// Основная функция
// ============================================================

/**
 * Вызвать LLM с streaming.
 *
 * Стратегия:
 * 1. Пробуем streaming через chatCompletionStream
 * 2. Если streaming вернул пустой текст (прокси не поддерживает SSE и т.п.) —
 *    фоллбэк на buffered chatCompletion
 * 3. Если streaming выбросил ошибку — тоже фоллбэк на buffered
 *
 * Возвращает полный текст ответа.
 *
 * BUGFIX: Добавлен собственный таймаут (120 сек) через AbortController,
 * объединяемый с внешним abortSignal через AbortSignal.any().
 * Это гарантирует, что вызов не зависнет бесконечно.
 */
export async function callLLMStreaming(options: LLMStreamingOptions): Promise<LLMStreamingResult> {
  const { prompt, llmConfig, onChunk, maxTokens, abortSignal } = options;

  const provider = llmConfig.provider as LLMProvider;
  const client = createLLMClient({
    provider,
    apiKey: llmConfig.apiKey,
    model: llmConfig.model,
    baseUrl: llmConfig.baseUrl,
    proxyUrl: llmConfig.proxyUrl,
  });

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

  // ── Create a combined AbortController with default timeout ────────
  // This ensures the LLM call doesn't hang forever even if the caller
  // doesn't provide an abortSignal with a timeout.
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), DEFAULT_TIMEOUT_MS);

  const combinedSignal = abortSignal
    ? AbortSignal.any([abortSignal, timeoutController.signal])
    : timeoutController.signal;

  // Track whether buffered fallback was already tried
  // (prevents double-timeout: streaming empty → buffered fails → catch retries buffered AGAIN)
  let bufferedFallbackAttempted = false;

  try {
    // Accumulate streaming text for fallback purposes
    let streamingAccumulated = '';

    // Try streaming first
    try {
      const response = await client.chatCompletionStream(
        {
          messages,
          max_tokens: maxTokens,
          temperature: 0.7,
          signal: combinedSignal,
          responseFormat: options.responseFormat || 'markdown',
        },
        (text: string, _delta: string) => {
          // Accumulate delta for potential fallback use
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
        clearTimeout(timeoutId);
        return { text: streamingAccumulated, usage: extractUsage(response) };
      }

      // If streaming returned empty text AND no accumulated text,
      // fall back to buffered request (proxy may not support SSE)
      if (fullText.trim() === '' && streamingAccumulated.trim() === '') {
        console.warn('Streaming returned empty text, falling back to buffered request');
        bufferedFallbackAttempted = true;

        const bufferedResponse = await client.chatCompletion({
          messages,
          max_tokens: maxTokens,
          temperature: 0.7,
          signal: combinedSignal,
          responseFormat: options.responseFormat || 'markdown',
        });

        const bufferedText = bufferedResponse.choices?.[0]?.message?.content || '';
        if (bufferedText.trim().length > 0) {
          // Emulate streaming by sending the whole text at once
          onChunk(bufferedText);
          clearTimeout(timeoutId);
          return { text: bufferedText, usage: extractUsage(bufferedResponse) };
        }
        // Both streaming and buffered returned empty — return empty
        clearTimeout(timeoutId);
        return { text: '', usage: extractUsage(bufferedResponse) };
      }

      clearTimeout(timeoutId);
      return { text: fullText, usage: extractUsage(response) };
    } catch (streamError) {
      // If streaming fails, fall back to buffered request
      console.warn('Streaming failed, falling back to buffered request:', streamError);

      // If we already tried buffered fallback above (streaming returned empty,
      // buffered timed out), DON'T try buffered again — that causes double-timeout.
      // Instead, check if we have any partially accumulated streaming text.
      if (bufferedFallbackAttempted) {
        console.warn('Buffered fallback was already attempted, not retrying');
        if (streamingAccumulated.trim().length > 0) {
          console.warn('Using partially accumulated streaming text');
          clearTimeout(timeoutId);
          return { text: streamingAccumulated, usage: null };
        }
        // No accumulated text and buffered already failed — throw the original error
        clearTimeout(timeoutId);
        throw streamError;
      }

      // If we accumulated some text via streaming before the error, try to use it
      if (streamingAccumulated.trim().length > 0) {
        console.warn('Using partially accumulated streaming text as fallback');
        clearTimeout(timeoutId);
        return { text: streamingAccumulated, usage: null };
      }

      const response = await client.chatCompletion({
        messages,
        max_tokens: maxTokens,
        temperature: 0.7,
        signal: combinedSignal,
        responseFormat: options.responseFormat || 'markdown',
      });

      const fullText = response.choices?.[0]?.message?.content || '';
      // Emulate streaming by sending the whole text at once
      onChunk(fullText);
      clearTimeout(timeoutId);
      return { text: fullText, usage: extractUsage(response) };
    }
  } catch (outerError) {
    clearTimeout(timeoutId);
    throw outerError;
  }
}
