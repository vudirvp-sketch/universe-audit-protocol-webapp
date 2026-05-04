/**
 * Streaming Support — SSE parser and utilities for real-time LLM output.
 *
 * This module handles:
 * 1. Parsing Server-Sent Events (SSE) from the CORS proxy
 * 2. Normalizing streaming chunks from different provider formats
 *    (OpenAI, Anthropic, Google Gemini, HuggingFace)
 * 3. Providing an async iterable interface for consuming streaming responses
 *
 * The CORS proxy (worker/cors-proxy.js) already supports streaming passthrough
 * when the client sends `Accept: text/event-stream`. The proxy forwards the
 * ReadableStream from the provider without buffering.
 *
 * Provider-specific SSE formats:
 * - OpenAI-compatible (openai, deepseek, groq, mistral, openrouter, together, xai, zai, qwen, kimi):
 *   `data: {"choices":[{"delta":{"content":"..."}}]}`
 * - Anthropic:
 *   `data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"..."}}`
 * - Google Gemini:
 *   `data: {"candidates":[{"content":{"parts":[{"text":"..."}]}}]}`
 * - HuggingFace: Does not support streaming — fallback to buffered response.
 */

import type { LLMProvider } from './llm-client';

// ============================================================================
// TYPES
// ============================================================================

/** A single normalized streaming chunk */
export interface StreamingChunk {
  /** The text content accumulated so far (not just the delta) */
  text: string;
  /** The delta text from this chunk only */
  delta: string;
  /** Whether the stream has finished */
  done: boolean;
  /** The finish reason, if the stream has finished */
  finishReason?: string;
}

/** Callback for receiving streaming chunks */
export type OnChunkCallback = (chunk: StreamingChunk) => void;

/** Configuration for a streaming request */
export interface StreamingConfig {
  /** The LLM provider — determines how SSE events are parsed */
  provider: LLMProvider;
  /** The CORS proxy URL */
  proxyUrl: string;
  /** The API key for the provider */
  apiKey: string;
  /** The target URL for the provider's API */
  targetUrl: string;
  /** The JSON-stringified request body for the provider */
  payload: string;
  /** AbortSignal for cancelling the stream */
  signal?: AbortSignal;
  /** Callback for each chunk of text received */
  onChunk: OnChunkCallback;
}

// ============================================================================
// SSE LINE PARSER
// ============================================================================

/**
 * Parse SSE text lines into individual events.
 * SSE format:
 *   field:value\n
 *   \n  (blank line = end of event)
 *
 * We only care about `data:` lines. Lines starting with `:` are comments.
 */
export function* parseSSELines(chunk: string): Generator<string, void, unknown> {
  const lines = chunk.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith(':')) continue;
    // Only process data lines
    if (trimmed.startsWith('data:')) {
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') {
        return; // Stream end marker (OpenAI format)
      }
      yield data;
    }
  }
}

// ============================================================================
// PROVIDER-SPECIFIC DELTA EXTRACTORS
// ============================================================================

/**
 * Extract the text delta from a streaming event based on the provider format.
 * Returns the delta text, or empty string if no text in this event.
 */
export function extractDelta(provider: LLMProvider, eventData: string): { text: string; finishReason?: string } {
  try {
    const parsed = JSON.parse(eventData);

    switch (provider) {
      case 'anthropic': {
        // Anthropic streaming format
        // content_block_delta: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"..."}}
        // message_stop: {"type":"message_stop"}
        // message_delta: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{...}}
        if (parsed.type === 'content_block_delta') {
          return { text: parsed.delta?.text || '' };
        }
        if (parsed.type === 'message_delta') {
          return { text: '', finishReason: parsed.delta?.stop_reason };
        }
        if (parsed.type === 'message_stop') {
          return { text: '', finishReason: 'stop' };
        }
        // message_start, ping, etc. — no text content
        return { text: '' };
      }

      case 'google': {
        // Google Gemini streaming format
        // {"candidates":[{"content":{"parts":[{"text":"..."}]},"finishReason":"STOP"}]}
        const candidates = parsed.candidates;
        if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
          return { text: '' };
        }
        const candidate = candidates[0];
        const parts = candidate?.content?.parts;
        const text = parts?.[0]?.text || '';
        const finishReason = candidate?.finishReason || undefined;
        return { text, finishReason };
      }

      case 'huggingface': {
        // HuggingFace doesn't support streaming — this shouldn't be called
        // but handle gracefully
        return { text: '' };
      }

      default: {
        // OpenAI-compatible format (openai, deepseek, groq, mistral, openrouter, together, xai, zai, qwen, kimi, custom)
        // {"choices":[{"delta":{"content":"..."},"finish_reason":null}]}
        const choices = parsed.choices;
        if (!choices || !Array.isArray(choices) || choices.length === 0) {
          return { text: '' };
        }
        const choice = choices[0];
        const delta = choice?.delta?.content || '';
        const finishReason = choice?.finish_reason || undefined;
        return { text: delta, finishReason };
      }
    }
  } catch {
    // Failed to parse JSON — skip this event silently
    return { text: '' };
  }
}

// ============================================================================
// STREAMING CLIENT
// ============================================================================

/**
 * Execute a streaming LLM request through the CORS proxy.
 *
 * This function:
 * 1. Sends the request to the proxy with `Accept: text/event-stream`
 * 2. Reads the response as a ReadableStream
 * 3. Parses SSE events and extracts text deltas
 * 4. Calls onChunk for each delta with accumulated text
 * 5. Returns the complete text when the stream finishes
 *
 * @returns The complete text accumulated from all streaming chunks
 */
export async function streamChatCompletion(config: StreamingConfig): Promise<string> {
  const { provider, proxyUrl, apiKey, targetUrl, payload, signal, onChunk } = config;

  // Build the proxy request body — same format as buffered requests
  // but the proxy will detect Accept: text/event-stream and switch to streaming mode
  const proxyRequestBody = JSON.stringify({
    provider,
    apiKey,
    targetUrl,
    payload,
  });

  // Make the streaming request
  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
    body: proxyRequestBody,
    signal,
  });

  // Handle error responses — these come as regular JSON, not SSE
  if (!response.ok) {
    let errorMessage = '';
    try {
      // Read body as text first, then try to parse as JSON — avoids
      // "body already consumed" error if json() partially reads the stream
      const errorBody = await response.text();
      try {
        const errData = JSON.parse(errorBody) as { message?: string; error?: string; details?: string };
        errorMessage = errData.message || errData.error || errData.details || '';
      } catch {
        errorMessage = errorBody;
      }
    } catch {
      errorMessage = 'Unknown error';
    }

    switch (response.status) {
      case 504:
        throw new Error(
          errorMessage || 'Таймаут. Модель думает слишком долго. Попробуйте более быструю модель или более короткий текст.'
        );
      case 413:
        throw new Error(
          errorMessage || 'Слишком большой запрос. Текст будет разбит на части автоматически (chunking).'
        );
      case 429:
        throw new Error(
          errorMessage || 'Превышен лимит запросов. Подождите минуту и попробуйте снова.'
        );
      case 500:
      case 502:
        throw new Error(
          errorMessage || 'Прокси временно недоступен. Подождите минуту и попробуйте снова.'
        );
      default:
        throw new Error(`Ошибка прокси (${response.status}): ${errorMessage}`);
    }
  }

  // Handle non-streaming response (fallback when proxy couldn't stream)
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/event-stream') && !contentType.includes('application/json')) {
    // Unknown content type — read as text and return
    const text = await response.text();
    onChunk({ text, delta: text, done: true });
    return text;
  }

  // If the proxy returned buffered JSON (not SSE), handle it directly
  if (contentType.includes('application/json') && !contentType.includes('text/event-stream')) {
    const data = await response.json();
    // Extract text from the buffered response based on provider format
    let text = '';
    if (data.choices?.[0]?.message?.content) {
      text = data.choices[0].message.content;
    } else if (data.content?.[0]?.text) {
      text = data.content[0].text;
    } else if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      text = data.candidates[0].content.parts[0].text;
    } else if (Array.isArray(data) && data[0]?.generated_text) {
      text = data[0].generated_text;
    } else if (typeof data === 'string') {
      text = data;
    }
    onChunk({ text, delta: text, done: true, finishReason: 'stop' });
    return text;
  }

  // ── SSE Streaming: read from ReadableStream ──────────────────────────
  let accumulated = '';
  let finishReason: string | undefined;

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Streaming response has no readable body.');
  }

  const decoder = new TextDecoder();

  try {
    let buffer = ''; // Buffer for incomplete SSE lines across chunks

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // Stream ended — process any remaining buffered data
        if (buffer.trim()) {
          for (const eventData of parseSSELines(buffer)) {
            const { text, finishReason: reason } = extractDelta(provider, eventData);
            if (text) {
              accumulated += text;
              onChunk({ text: accumulated, delta: text, done: false });
            }
            if (reason) finishReason = reason;
          }
        }
        break;
      }

      // Decode the chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE events from the buffer
      // SSE events are separated by blank lines (\n\n)
      let eventEnd: number;
      while ((eventEnd = buffer.indexOf('\n\n')) !== -1) {
        const eventBlock = buffer.slice(0, eventEnd);
        buffer = buffer.slice(eventEnd + 2);

        for (const eventData of parseSSELines(eventBlock)) {
          const { text, finishReason: reason } = extractDelta(provider, eventData);
          if (text) {
            accumulated += text;
            onChunk({ text: accumulated, delta: text, done: false });
          }
          if (reason) finishReason = reason;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Final chunk — signal completion
  onChunk({ text: accumulated, delta: '', done: true, finishReason: finishReason || 'stop' });

  return accumulated;
}

// ============================================================================
// UTILITY: Build streaming request body with stream: true
// ============================================================================

/**
 * Inject `stream: true` into a provider-specific request payload.
 * For Google Gemini, adds `alt=sse` query parameter instead.
 * Returns the modified payload and optionally the modified targetUrl.
 */
export function enableStreamingInPayload(
  provider: LLMProvider,
  payload: string,
  targetUrl: string
): { payload: string; targetUrl: string } {
  if (provider === 'google') {
    // Google Gemini uses `alt=sse` query parameter for streaming
    const url = new URL(targetUrl);
    if (!url.searchParams.has('alt')) {
      url.searchParams.set('alt', 'sse');
    }
    // Also need to add stream: true to the body for newer Gemini models
    try {
      JSON.parse(payload);
      // Gemini doesn't use stream:true in body — alt=sse is sufficient
      return { payload, targetUrl: url.toString() };
    } catch {
      return { payload, targetUrl: url.toString() };
    }
  }

  // For all other providers, inject stream: true into the JSON body
  try {
    const body = JSON.parse(payload) as Record<string, unknown>;
    body.stream = true;
    return { payload: JSON.stringify(body), targetUrl };
  } catch {
    // If payload isn't valid JSON, return as-is
    return { payload, targetUrl };
  }
}
