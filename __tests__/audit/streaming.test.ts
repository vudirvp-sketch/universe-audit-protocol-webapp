/**
 * Tests for the streaming module — SSE parsing, delta extraction,
 * ReadableStream consumption, and error handling.
 *
 * Covers:
 * 1. parseSSELines — splitting raw SSE text into data payloads
 * 2. extractDelta — provider-specific delta extraction (OpenAI, Anthropic, Google)
 * 3. enableStreamingInPayload — injecting stream:true into request bodies
 * 4. streamChatCompletion — end-to-end streaming with mocked fetch/ReadableStream
 * 5. Connection interruption and error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseSSELines,
  extractDelta,
  enableStreamingInPayload,
  streamChatCompletion,
} from '@/lib/streaming';
import type { LLMProvider } from '@/lib/llm-client';

// ============================================================================
// 1. parseSSELines
// ============================================================================

describe('parseSSELines', () => {
  it('extracts data from standard SSE lines', () => {
    const chunk = 'data: {"choices":[{"delta":{"content":"hello"}}]}\n\n';
    const results = [...parseSSELines(chunk)];
    expect(results).toHaveLength(1);
    expect(results[0]).toBe('{"choices":[{"delta":{"content":"hello"}}]}');
  });

  it('handles multiple SSE events in one chunk', () => {
    const chunk =
      'data: {"choices":[{"delta":{"content":"hel"}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n';
    const results = [...parseSSELines(chunk)];
    expect(results).toHaveLength(2);
    expect(results[0]).toBe('{"choices":[{"delta":{"content":"hel"}}]}');
    expect(results[1]).toBe('{"choices":[{"delta":{"content":"lo"}}]}');
  });

  it('skips comment lines (starting with :)', () => {
    const chunk = ': this is a comment\ndata: {"text":"ok"}\n\n';
    const results = [...parseSSELines(chunk)];
    expect(results).toHaveLength(1);
    expect(results[0]).toBe('{"text":"ok"}');
  });

  it('skips empty lines', () => {
    const chunk = '\n\ndata: {"text":"ok"}\n\n\n\n';
    const results = [...parseSSELines(chunk)];
    expect(results).toHaveLength(1);
  });

  it('stops at [DONE] marker', () => {
    const chunk = 'data: {"text":"ok"}\ndata: [DONE]\ndata: {"text":"ignored"}\n\n';
    const results = [...parseSSELines(chunk)];
    expect(results).toHaveLength(1);
    expect(results[0]).toBe('{"text":"ok"}');
  });

  it('handles chunk with no SSE data gracefully', () => {
    const chunk = 'just some random text\nno data prefix\n\n';
    const results = [...parseSSELines(chunk)];
    expect(results).toHaveLength(0);
  });

  it('handles single-line SSE event (no trailing \\n\\n)', () => {
    // The parser should still extract the data line even without blank line separator
    const chunk = 'data: {"text":"ok"}';
    const results = [...parseSSELines(chunk)];
    expect(results).toHaveLength(1);
    expect(results[0]).toBe('{"text":"ok"}');
  });
});

// ============================================================================
// 2. extractDelta — provider-specific delta extraction
// ============================================================================

describe('extractDelta', () => {
  // --- OpenAI-compatible format (default) ---
  it('extracts delta from OpenAI format', () => {
    const event = '{"choices":[{"delta":{"content":"world"},"finish_reason":null}]}';
    const result = extractDelta('openai' as LLMProvider, event);
    expect(result.text).toBe('world');
    expect(result.finishReason).toBeUndefined();
  });

  it('detects finish_reason from OpenAI format', () => {
    const event = '{"choices":[{"delta":{},"finish_reason":"stop"}]}';
    const result = extractDelta('openai' as LLMProvider, event);
    expect(result.text).toBe('');
    expect(result.finishReason).toBe('stop');
  });

  it('handles empty choices array in OpenAI format', () => {
    const event = '{"choices":[]}';
    const result = extractDelta('openai' as LLMProvider, event);
    expect(result.text).toBe('');
  });

  // DeepSeek, Groq, Mistral, etc. use the same format as OpenAI
  it('extracts delta from DeepSeek (OpenAI-compatible)', () => {
    const event = '{"choices":[{"delta":{"content":"deepseek text"}}]}';
    const result = extractDelta('deepseek' as LLMProvider, event);
    expect(result.text).toBe('deepseek text');
  });

  it('extracts delta from Groq (OpenAI-compatible)', () => {
    const event = '{"choices":[{"delta":{"content":"groq text"}}]}';
    const result = extractDelta('groq' as LLMProvider, event);
    expect(result.text).toBe('groq text');
  });

  // --- Anthropic format ---
  it('extracts text from Anthropic content_block_delta', () => {
    const event = '{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"claude text"}}';
    const result = extractDelta('anthropic' as LLMProvider, event);
    expect(result.text).toBe('claude text');
  });

  it('extracts finish reason from Anthropic message_delta', () => {
    const event = '{"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{}}';
    const result = extractDelta('anthropic' as LLMProvider, event);
    expect(result.text).toBe('');
    expect(result.finishReason).toBe('end_turn');
  });

  it('handles Anthropic message_stop', () => {
    const event = '{"type":"message_stop"}';
    const result = extractDelta('anthropic' as LLMProvider, event);
    expect(result.text).toBe('');
    expect(result.finishReason).toBe('stop');
  });

  it('ignores Anthropic message_start (no text)', () => {
    const event = '{"type":"message_start","message":{"id":"msg_123"}}';
    const result = extractDelta('anthropic' as LLMProvider, event);
    expect(result.text).toBe('');
  });

  // --- Google Gemini format ---
  it('extracts text from Gemini candidates format', () => {
    const event = '{"candidates":[{"content":{"parts":[{"text":"gemini text"}]}}]}';
    const result = extractDelta('google' as LLMProvider, event);
    expect(result.text).toBe('gemini text');
  });

  it('extracts finishReason from Gemini format', () => {
    const event = '{"candidates":[{"content":{"parts":[{"text":"last"}]},"finishReason":"STOP"}]}';
    const result = extractDelta('google' as LLMProvider, event);
    expect(result.text).toBe('last');
    expect(result.finishReason).toBe('STOP');
  });

  it('handles empty candidates in Gemini format', () => {
    const event = '{"candidates":[]}';
    const result = extractDelta('google' as LLMProvider, event);
    expect(result.text).toBe('');
  });

  // --- HuggingFace ---
  it('returns empty for HuggingFace (no streaming support)', () => {
    const event = '{"generated_text":"some text"}';
    const result = extractDelta('huggingface' as LLMProvider, event);
    expect(result.text).toBe('');
  });

  // --- Error handling ---
  it('returns empty string for invalid JSON', () => {
    const result = extractDelta('openai' as LLMProvider, 'not valid json');
    expect(result.text).toBe('');
  });
});

// ============================================================================
// 3. enableStreamingInPayload
// ============================================================================

describe('enableStreamingInPayload', () => {
  it('injects stream:true for OpenAI-compatible providers', () => {
    const payload = JSON.stringify({ model: 'gpt-4o', messages: [], stream: false });
    const result = enableStreamingInPayload('openai' as LLMProvider, payload, 'https://api.openai.com/v1/chat/completions');
    const parsed = JSON.parse(result.payload);
    expect(parsed.stream).toBe(true);
    expect(result.targetUrl).toBe('https://api.openai.com/v1/chat/completions');
  });

  it('adds alt=sse query parameter for Google Gemini', () => {
    const payload = JSON.stringify({ contents: [], generationConfig: {} });
    const result = enableStreamingInPayload('google' as LLMProvider, payload, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent');
    expect(result.targetUrl).toContain('alt=sse');
  });

  it('does not add duplicate alt=sse for Google if already present', () => {
    const payload = JSON.stringify({ contents: [], generationConfig: {} });
    const result = enableStreamingInPayload('google' as LLMProvider, payload, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?alt=sse');
    expect(result.targetUrl).toContain('alt=sse');
    // Should not duplicate
    const url = new URL(result.targetUrl);
    expect(url.searchParams.getAll('alt')).toHaveLength(1);
  });

  it('handles invalid JSON payload gracefully', () => {
    const result = enableStreamingInPayload('openai' as LLMProvider, 'not json', 'https://api.openai.com/v1/chat/completions');
    expect(result.payload).toBe('not json');
  });
});

// ============================================================================
// 4. streamChatCompletion — end-to-end with mocked fetch/ReadableStream
// ============================================================================

// Helper: create a ReadableStream from an array of string chunks
function createMockReadableStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

// Helper: create an SSE-formatted chunk
function sseData(data: string): string {
  return `data: ${data}\n\n`;
}

describe('streamChatCompletion', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('accumulates text from OpenAI streaming chunks', async () => {
    const chunks = [
      sseData('{"choices":[{"delta":{"content":"Hello"}}]}'),
      sseData('{"choices":[{"delta":{"content":" world"}}]}'),
      sseData('{"choices":[{"delta":{},"finish_reason":"stop"}]}'),
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      body: createMockReadableStream(chunks),
    } as Response);

    const receivedChunks: string[] = [];

    const fullText = await streamChatCompletion({
      provider: 'openai' as LLMProvider,
      proxyUrl: 'https://proxy.example.com',
      apiKey: 'test-key',
      targetUrl: 'https://api.openai.com/v1/chat/completions',
      payload: JSON.stringify({ model: 'gpt-4o', messages: [], stream: true }),
      onChunk: (chunk) => {
        receivedChunks.push(chunk.delta);
      },
    });

    expect(fullText).toBe('Hello world');
    // The finish_reason chunk produces an empty delta — filter for non-empty
    expect(receivedChunks.filter(c => c.length > 0)).toEqual(['Hello', ' world']);
  });

  it('accumulates text from Anthropic streaming chunks', async () => {
    const chunks = [
      sseData('{"type":"content_block_delta","delta":{"type":"text_delta","text":"Claude "}}'),
      sseData('{"type":"content_block_delta","delta":{"type":"text_delta","text":"says hi"}}'),
      sseData('{"type":"message_delta","delta":{"stop_reason":"end_turn"}}'),
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      body: createMockReadableStream(chunks),
    } as Response);

    const fullText = await streamChatCompletion({
      provider: 'anthropic' as LLMProvider,
      proxyUrl: 'https://proxy.example.com',
      apiKey: 'test-key',
      targetUrl: 'https://api.anthropic.com/v1/messages',
      payload: JSON.stringify({ model: 'claude-3', messages: [], stream: true }),
      onChunk: () => {},
    });

    expect(fullText).toBe('Claude says hi');
  });

  it('accumulates text from Gemini streaming chunks', async () => {
    const chunks = [
      sseData('{"candidates":[{"content":{"parts":[{"text":"Gemini "}]}}]}'),
      sseData('{"candidates":[{"content":{"parts":[{"text":"response"}]},"finishReason":"STOP"}]}'),
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      body: createMockReadableStream(chunks),
    } as Response);

    const fullText = await streamChatCompletion({
      provider: 'google' as LLMProvider,
      proxyUrl: 'https://proxy.example.com',
      apiKey: 'test-key',
      targetUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse',
      payload: JSON.stringify({ contents: [] }),
      onChunk: () => {},
    });

    expect(fullText).toBe('Gemini response');
  });

  it('handles buffered JSON fallback (non-SSE response)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        choices: [{ message: { content: 'Buffered response' } }],
      }),
    } as Response);

    const fullText = await streamChatCompletion({
      provider: 'openai' as LLMProvider,
      proxyUrl: 'https://proxy.example.com',
      apiKey: 'test-key',
      targetUrl: 'https://api.openai.com/v1/chat/completions',
      payload: JSON.stringify({ model: 'gpt-4o', messages: [] }),
      onChunk: () => {},
    });

    expect(fullText).toBe('Buffered response');
  });

  // --- Error handling ---

  it('throws on 504 timeout from proxy', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 504,
      headers: new Headers(),
      json: async () => ({ error: 'timeout', message: 'Timeout' }),
      text: async () => '{"error":"timeout"}',
    } as Response);

    await expect(
      streamChatCompletion({
        provider: 'openai' as LLMProvider,
        proxyUrl: 'https://proxy.example.com',
        apiKey: 'test-key',
        targetUrl: 'https://api.openai.com/v1/chat/completions',
        payload: '{}',
        onChunk: () => {},
      })
    ).rejects.toThrow();
  });

  it('throws on 429 rate limit', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: new Headers(),
      json: async () => ({ error: 'rate_limit' }),
      text: async () => '{"error":"rate_limit"}',
    } as Response);

    await expect(
      streamChatCompletion({
        provider: 'openai' as LLMProvider,
        proxyUrl: 'https://proxy.example.com',
        apiKey: 'test-key',
        targetUrl: 'https://api.openai.com/v1/chat/completions',
        payload: '{}',
        onChunk: () => {},
      })
    ).rejects.toThrow();
  });

  it('throws on 500 proxy error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers(),
      json: async () => ({ error: 'proxy_error' }),
      text: async () => '{"error":"proxy_error"}',
    } as Response);

    await expect(
      streamChatCompletion({
        provider: 'openai' as LLMProvider,
        proxyUrl: 'https://proxy.example.com',
        apiKey: 'test-key',
        targetUrl: 'https://api.openai.com/v1/chat/completions',
        payload: '{}',
        onChunk: () => {},
      })
    ).rejects.toThrow();
  });

  it('handles empty stream gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      body: createMockReadableStream([]),
    } as Response);

    const fullText = await streamChatCompletion({
      provider: 'openai' as LLMProvider,
      proxyUrl: 'https://proxy.example.com',
      apiKey: 'test-key',
      targetUrl: 'https://api.openai.com/v1/chat/completions',
      payload: '{}',
      onChunk: () => {},
    });

    expect(fullText).toBe('');
  });

  it('handles connection error during streaming', async () => {
    // Simulate a stream that throws an error during read
    const errorStream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(sseData('{"choices":[{"delta":{"content":"partial"}}]}')));
        controller.error(new Error('Connection lost'));
      },
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      body: errorStream,
    } as Response);

    await expect(
      streamChatCompletion({
        provider: 'openai' as LLMProvider,
        proxyUrl: 'https://proxy.example.com',
        apiKey: 'test-key',
        targetUrl: 'https://api.openai.com/v1/chat/completions',
        payload: '{}',
        onChunk: () => {},
      })
    ).rejects.toThrow('Connection lost');
  });

  it('handles response with no body (null body)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      body: null,
    } as Response);

    await expect(
      streamChatCompletion({
        provider: 'openai' as LLMProvider,
        proxyUrl: 'https://proxy.example.com',
        apiKey: 'test-key',
        targetUrl: 'https://api.openai.com/v1/chat/completions',
        payload: '{}',
        onChunk: () => {},
      })
    ).rejects.toThrow('no readable body');
  });

  it('supports AbortSignal for cancellation', async () => {
    const controller = new AbortController();
    // Abort immediately
    controller.abort();

    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => {
      throw new DOMException('The operation was aborted', 'AbortError');
    });

    await expect(
      streamChatCompletion({
        provider: 'openai' as LLMProvider,
        proxyUrl: 'https://proxy.example.com',
        apiKey: 'test-key',
        targetUrl: 'https://api.openai.com/v1/chat/completions',
        payload: '{}',
        signal: controller.signal,
        onChunk: () => {},
      })
    ).rejects.toThrow();
  });
});
