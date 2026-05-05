/**
 * LLM Streaming wrapper for Pipeline V2 (Universe Audit Protocol v11.0).
 *
 * Обёртка над llm-client.ts, добавляющая streaming-поддержку.
 * Использует существующий streaming.ts для SSE-парсинга.
 *
 * Стратегия: сначала пробуем streaming, если он вернул пустой текст —
 * фоллбэк на обычный buffered-запрос. Это гарантирует, что мы всегда
 * получаем ответ от LLM, даже если прокси не поддерживает SSE.
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
 * 2. Если streaming вернул пустой текст (прокси не поддерживает SSE и т.п.) —
 *    фоллбэк на buffered chatCompletion
 * 3. Если streaming выбросил ошибку — тоже фоллбэк на buffered
 *
 * Возвращает полный текст ответа.
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

  // Accumulate streaming text for fallback purposes
  let streamingAccumulated = '';

  // Try streaming first
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
      const bufferedResponse = await client.chatCompletion({
        messages,
        max_tokens: maxTokens,
        temperature: 0.7,
        signal: abortSignal,
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
    // If streaming fails, fall back to buffered request
    console.warn('Streaming failed, falling back to buffered request:', streamError);

    // If we accumulated some text via streaming before the error, try to use it
    if (streamingAccumulated.trim().length > 0) {
      console.warn('Using partially accumulated streaming text as fallback');
      return { text: streamingAccumulated, usage: null };
    }

    const response = await client.chatCompletion({
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
      signal: abortSignal,
      responseFormat: options.responseFormat || 'markdown',
    });

    const fullText = response.choices?.[0]?.message?.content || '';
    // Emulate streaming by sending the whole text at once
    onChunk(fullText);
    return { text: fullText, usage: extractUsage(response) };
  }
}
