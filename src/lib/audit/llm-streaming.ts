/**
 * LLM Streaming wrapper for Pipeline V2 (Universe Audit Protocol v11.0).
 *
 * Обёртка над llm-client.ts, добавляющая streaming-поддержку.
 * Использует существующий streaming.ts для SSE-парсинга.
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
}

// ============================================================
// Основная функция
// ============================================================

/**
 * Вызвать LLM с streaming.
 *
 * Если провайдер поддерживает streaming — использовать SSE,
 * прокидывая каждый чанк через onChunk.
 *
 * Если провайдер НЕ поддерживает streaming — вернуть весь ответ
 * одним блоком через onChunk после завершения.
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

  // Try streaming first
  try {
    const response = await client.chatCompletionStream(
      {
        messages,
        max_tokens: maxTokens,
        temperature: 0.7,
        signal: abortSignal,
      },
      (text: string, _delta: string) => {
        // Only call onChunk with the delta (new text), not accumulated
        onChunk(_delta);
      }
    );

    const fullText = response.choices?.[0]?.message?.content || '';
    return { text: fullText, usage: extractUsage(response) };
  } catch (streamError) {
    // If streaming fails, fall back to buffered request
    console.warn('Streaming failed, falling back to buffered request:', streamError);

    const response = await client.chatCompletion({
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
      signal: abortSignal,
    });

    const fullText = response.choices?.[0]?.message?.content || '';
    // Emulate streaming by sending the whole text at once
    onChunk(fullText);
    return { text: fullText, usage: extractUsage(response) };
  }
}
