/**
 * @deprecated Use createLLMClient().chatCompletionStream() instead.
 * This module is kept only for test compatibility.
 * Long-term: refactor streaming.test.ts to test chatCompletionStream(),
 * then delete this module entirely.
 *
 * Streaming Support — SSE parser and utilities for real-time LLM output.
 *
 * This module handles:
 * 1. Parsing Server-Sent Events (SSE) from a provider or the local relay
 * 2. Normalizing streaming chunks from different provider formats
 *    (OpenAI, Anthropic, Google Gemini, HuggingFace)
 * 3. Providing an async iterable interface for consuming streaming responses
 *
 * Both transports stream: the browser can read the provider's SSE stream
 * directly, and the local relay forwards it without buffering.
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
  /** Provider endpoint (direct transport) or relay /api/llm (relay transport) */
  url: string;
  /** Provider auth headers (direct) or relay envelope headers (relay) */
  headers: Record<string, string>;
  /** Request body: provider-native JSON (direct) or relay envelope JSON (relay) */
  body: string;
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
// FINISH-REASON NORMALIZATION
// ============================================================================

/**
 * Normalize a provider-specific finish/stop reason to the OpenAI vocabulary
 * used by the rest of the app ('stop' | 'length' | 'content_filter' | ...).
 *
 * This matters for the buffered path (llm-client.normalizeProviderResponse)
 * and equally for streaming: Gemini sends 'MAX_TOKENS', Anthropic sends
 * 'max_tokens', and a truncated answer must be recognizable as truncation.
 */
export function normalizeStreamingFinishReason(provider: LLMProvider, reason?: string): string | undefined {
  if (!reason) return undefined;
  const raw = String(reason);

  if (provider === 'google') {
    switch (raw) {
      case 'STOP': return 'stop';
      case 'MAX_TOKENS': return 'length';
      case 'SAFETY':
      case 'RECITATION':
      case 'BLOCKLIST':
      case 'PROHIBITED':
      case 'SPII': return 'content_filter';
      case 'MALFORMED_FUNCTION_CALL': return 'tool_call_error';
      default: return raw.toLowerCase();
    }
  }

  if (provider === 'anthropic') {
    switch (raw) {
      case 'end_turn':
      case 'stop_sequence': return 'stop';
      case 'max_tokens': return 'length';
      case 'tool_use': return 'tool_calls';
      default: return raw;
    }
  }

  // OpenAI-compatible providers already use the target vocabulary.
  return raw;
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
          return { text: '', finishReason: normalizeStreamingFinishReason(provider, parsed.delta?.stop_reason) };
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
        const finishReason = normalizeStreamingFinishReason(provider, candidate?.finishReason);
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
        const finishReason = normalizeStreamingFinishReason(provider, choice?.finish_reason);
        return { text: delta, finishReason };
      }
    }
  } catch {
    // Failed to parse JSON — skip this event silently
    return { text: '' };
  }
}

/** Default timeout for streaming requests (milliseconds).
 * 5 minutes — streaming requests should be long-lived. The proxy now has a
 * matching 300s timeout (previously 25s). This safety net prevents infinite
 * hangs if the proxy/provider stops sending data without closing the connection.
 */
const STREAMING_TIMEOUT_MS = 300_000;

// ============================================================================
// STREAMING CLIENT
// ============================================================================

/**
 * Execute a streaming LLM request (direct provider or local relay).
 *
 * This function:
 * 1. Sends the request with `Accept: text/event-stream`
 * 2. Reads the response as a ReadableStream
 * 3. Parses SSE events and extracts text deltas
 * 4. Calls onChunk for each delta with accumulated text
 * 5. Returns the complete text when the stream finishes
 *
 * BUGFIX: Added default client-side timeout (120s) for streaming requests.
 * Previously, if no signal was provided, the streaming request could hang
 * indefinitely if the proxy/provider stopped sending data without closing
 * the connection.
 *
 * @returns The complete text accumulated from all streaming chunks
 */
export async function streamChatCompletion(config: StreamingConfig): Promise<string> {
  const { provider, url, headers, body, signal, onChunk } = config;

  // ── Client-side timeout for streaming requests ──────────────────────
  // If the caller didn't provide a signal (or the signal has no timeout),
  // we add our own safety timeout to prevent infinite hangs.
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), STREAMING_TIMEOUT_MS);

  const combinedSignal = signal
    ? AbortSignal.any([signal, timeoutController.signal])
    : timeoutController.signal;

  // Make the streaming request: direct provider endpoint or local relay.
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        ...headers,
        'Accept': 'text/event-stream',
      },
      body,
      signal: combinedSignal,
    });
  } catch (fetchError: unknown) {
    clearTimeout(timeoutId);
    // Handle timeout / abort errors with user-friendly messages
    if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
      throw new Error(
        'Запрос отменён по таймауту. Попробуйте более быструю модель или более короткий текст.'
      );
    }
    if (fetchError instanceof TypeError) {
      throw new Error(
        'Не удалось подключиться к API. Проверьте интернет и транспорт в Настройках ' +
        '(«Напрямую» или «Локальный релей»).'
      );
    }
    throw fetchError;
  }

  // Handle error responses — these come as regular JSON, not SSE
  if (!response.ok) {
    clearTimeout(timeoutId);
    let errorMessage = '';
    try {
      // Read body as text first, then try to parse as JSON — avoids
      // "body already consumed" error if json() partially reads the stream
      const errorBody = await response.text();
      try {
        const errData = JSON.parse(errorBody) as { message?: string; error?: string | { message?: string }; details?: string };
        errorMessage = errData.message
          || (typeof errData.error === 'string' ? errData.error : errData.error?.message)
          || errData.details
          || '';
      } catch {
        errorMessage = errorBody;
      }
    } catch {
      errorMessage = 'Unknown error';
    }

    switch (response.status) {
      case 401:
      case 403:
        throw new Error(`API-ключ отклонён (${response.status})${errorMessage ? `: ${errorMessage}` : ''}`);
      case 404:
        throw new Error(`Модель или endpoint не найден (404)${errorMessage ? `: ${errorMessage}` : ''}`);
      case 504:
        throw new Error(
          errorMessage || 'Таймаут. Модель думает слишком долго. Попробуйте более быструю модель или более короткий текст.'
        );
      case 413:
        throw new Error(
          errorMessage || 'Слишком большой запрос. Уменьшите текст или выберите модель с большим контекстом.'
        );
      case 429:
        throw new Error(
          errorMessage || 'Превышен лимит запросов. Подождите минуту и попробуйте снова.'
        );
      case 500:
      case 502:
      case 503:
        throw new Error(
          errorMessage || 'Провайдер временно недоступен. Подождите минуту и попробуйте снова.'
        );
      default:
        throw new Error(`Ошибка API (${response.status})${errorMessage ? `: ${errorMessage}` : ''}`);
    }
  }

  // Handle non-streaming response (fallback when proxy couldn't stream)
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/event-stream') && !contentType.includes('application/json')) {
    // Unknown content type — read as text and return
    clearTimeout(timeoutId);
    const text = await response.text();
    onChunk({ text, delta: text, done: true });
    return text;
  }

  // If the proxy returned buffered JSON (not SSE), handle it directly
  if (contentType.includes('application/json') && !contentType.includes('text/event-stream')) {
    clearTimeout(timeoutId);
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
        // Flush the decoder, normalize line endings, and process the tail.
        buffer = (buffer + decoder.decode()).replace(/\r\n/g, '\n');
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

      // Decode the chunk and add to buffer.
      // CRLF is normalized here so providers/proxies that separate SSE events
      // with \r\n\r\n are parsed as events instead of one giant unterminated block.
      buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, '\n');

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
    // Always release the timer — previously an exception in the read loop left
    // the 300s timeout armed and the reader locked.
    clearTimeout(timeoutId);
    reader.releaseLock();
  }

  // Final chunk — signal completion.
  // If text arrived but the provider never sent a finish event, the answer is
  // NOT confirmed complete (SSE may have been cut): report 'incomplete' so the
  // audit is marked partial instead of silently claiming success.
  onChunk({
    text: accumulated,
    delta: '',
    done: true,
    finishReason: finishReason || (accumulated.length > 0 ? 'incomplete' : 'stop'),
  });

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
