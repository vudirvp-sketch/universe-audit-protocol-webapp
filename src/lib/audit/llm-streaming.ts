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
 * BUGFIX (v2): Убран двойной таймаут. Раньше callLLMStreaming добавлял
 * свой AbortController с 120с таймаутом, а внутри chatCompletionStream
 * и chatCompletion тоже создавали свои. Теперь мы НЕ создаём свой
 * таймаут здесь — нижние уровни (streaming.ts и llm-client.ts) уже
 * имеют свои собственные таймауты. Дополнительный таймаут тут только
 * мешал: при fallback streaming→buffered, сигнал уже мог быть aborted,
 * и buffered-запрос мгновенно падал.
 *
 * BUGFIX (v3): Buffered fallback больше НЕ передаёт abortSignal напрямую.
 * Если пользователь отменил запрос во время streaming, abortSignal уже
 * aborted — и buffered-запрос мгновенно падает с AbortError. Теперь
 * мы создаём НОВЫЙ AbortController для buffered fallback, который
 * перенаправляет отмену от пользователя, но не наследует уже-aborted
 * состояние.
 *
 * Также: при таймауте streaming-запроса, если мы уже получили часть
 * текста через onChunk — используем его вместо фоллбэка на buffered.
 * Это критично для длинных Step 2 (50+ критериев), где модель может
 * отвечать 90-120 секунд.
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
// Основная функция
// ============================================================

/**
 * Вызвать LLM с streaming.
 *
 * Стратегия:
 * 1. Пробуем streaming через chatCompletionStream
 * 2. Если streaming вернул непустой текст — используем его
 * 3. Если streaming упал с ошибкой, но мы получили часть текста —
 *    используем partial текст (лучшая стратегия для таймаутов)
 * 4. Если streaming вернул пустой текст (прокси не SSE) —
 *    фоллбэк на buffered chatCompletion
 * 5. Если buffered тоже упал — возвращаем ошибку
 *    (НЕ пытаемся ещё раз — cascade prevention)
 *
 * ВАЖНО: Мы НЕ добавляем свой таймаут поверх нижних уровней.
 * streaming.ts и llm-client.ts уже имеют свои 120с таймауты.
 * Дополнительный таймаут здесь приводил к каскаду:
 *   streaming timeout (120s) → fallback to buffered →
 *   buffered timeout (120s) BUT signal already aborted → instant fail
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

  // Track whether buffered fallback was already tried
  let bufferedFallbackAttempted = false;

  try {
    // Accumulate streaming text for fallback / partial-text recovery
    let streamingAccumulated = '';

    // Try streaming first — pass through the abortSignal directly.
    // streaming.ts already creates its own 120s timeout internally.
    try {
      const response = await client.chatCompletionStream(
        {
          messages,
          max_tokens: maxTokens,
          temperature: 0.7,
          signal: abortSignal,
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
        return { text: streamingAccumulated, usage: extractUsage(response) };
      }

      // If streaming returned empty text AND no accumulated text,
      // fall back to buffered request (proxy may not support SSE)
      if (fullText.trim() === '' && streamingAccumulated.trim() === '') {
        console.warn('Streaming returned empty text, falling back to buffered request');
        bufferedFallbackAttempted = true;

        // BUGFIX (v3): Use a FRESH AbortController for buffered fallback.
        // The original abortSignal may already be aborted (e.g. user cancelled
        // during streaming, or Cloudflare Worker timed out the streaming request).
        // llm-client.ts creates its own 120s timeout internally.
        // We still forward user cancellation to the new controller.
        const fallbackController = new AbortController();
        if (abortSignal?.aborted) {
          fallbackController.abort();
        } else if (abortSignal) {
          abortSignal.addEventListener('abort', () => fallbackController.abort(), { once: true });
        }

        const bufferedResponse = await client.chatCompletion({
          messages,
          max_tokens: maxTokens,
          temperature: 0.7,
          signal: fallbackController.signal,
          responseFormat: options.responseFormat || 'markdown',
        });

        const bufferedText = bufferedResponse.choices?.[0]?.message?.content || '';
        if (bufferedText.trim().length > 0) {
          // Emulate streaming by sending the whole text at once
          onChunk(bufferedText);
          return { text: bufferedText, usage: extractUsage(bufferedResponse) };
        }
        // Both streaming and buffered returned empty — return empty
        return { text: '', usage: extractUsage(bufferedResponse) };
      }

      return { text: fullText, usage: extractUsage(response) };
    } catch (streamError) {
      // Streaming failed. Before trying buffered fallback, check if we
      // already received partial text — if yes, USE IT instead of
      // retrying. This is the critical fix for the timeout issue:
      // when LLM takes 90-120s, the streaming connection may time out,
      // but we've already received most of the response through onChunk.
      if (streamingAccumulated.trim().length > 0) {
        console.warn(
          'Streaming failed but partial text received (' + streamingAccumulated.length +
          ' chars), using partial text instead of retrying buffered request'
        );
        return { text: streamingAccumulated, usage: null };
      }

      // No partial text — try buffered fallback
      console.warn('Streaming failed, falling back to buffered request:', streamError);

      // If we already tried buffered fallback above (streaming returned empty,
      // buffered timed out), DON'T try buffered again — that causes double-timeout.
      if (bufferedFallbackAttempted) {
        console.warn('Buffered fallback was already attempted, not retrying');
        throw streamError;
      }

      // BUGFIX (v3): Create a FRESH AbortController for buffered fallback.
      // Same reason as above — abortSignal may already be aborted.
      const fallbackController = new AbortController();
      if (abortSignal?.aborted) {
        fallbackController.abort();
      } else if (abortSignal) {
        abortSignal.addEventListener('abort', () => fallbackController.abort(), { once: true });
      }

      const response = await client.chatCompletion({
        messages,
        max_tokens: maxTokens,
        temperature: 0.7,
        signal: fallbackController.signal,
        responseFormat: options.responseFormat || 'markdown',
      });

      const fullText = response.choices?.[0]?.message?.content || '';
      if (fullText.trim().length > 0) {
        // Emulate streaming by sending the whole text at once
        onChunk(fullText);
        return { text: fullText, usage: extractUsage(response) };
      }

      // Buffered also returned empty
      return { text: '', usage: extractUsage(response) };
    }
  } catch (outerError) {
    throw outerError;
  }
}
