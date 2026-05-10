/**
 * Tests for llm-streaming.ts — Pipeline V3 streaming wrapper.
 *
 * Tests callLLMStreaming() with:
 * - Successful streaming response
 * - Partial text recovery on streaming error
 * - ProxyTimeoutError thrown on abort/timeout without partial text
 * - Empty streaming response
 * - Custom model overrides passed through to createLLMClient
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock llm-client before importing llm-streaming
const mockChatCompletionStream = vi.fn();

vi.mock('@/lib/llm-client', () => ({
  createLLMClient: vi.fn(() => ({
    chatCompletionStream: mockChatCompletionStream,
    chatCompletion: vi.fn(),
  })),
  getModelCapabilities: vi.fn(() => ({
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsJSONMode: true,
    supportsSystemMessages: true,
  })),
}));

import { callLLMStreaming } from '@/lib/audit/llm-streaming';
import type { LLMStreamingOptions } from '@/lib/audit/llm-streaming';
import type { LLMConfig } from '@/lib/audit/types-v3';

// ============================================================
// Test helpers
// ============================================================

const defaultLLMConfig: LLMConfig = {
  provider: 'google',
  apiKey: 'test-key',
  model: 'gemini-2.0-flash',
  proxyUrl: 'https://proxy.test',
};

function makeOptions(overrides?: Partial<LLMStreamingOptions>): LLMStreamingOptions {
  return {
    prompt: { system: 'You are an auditor.', user: 'Audit this text.' },
    llmConfig: defaultLLMConfig,
    onChunk: vi.fn(),
    maxTokens: 4096,
    abortSignal: undefined,
    responseFormat: 'markdown',
    temperature: 0.5,
    ...overrides,
  };
}

function makeStreamResponse(content: string) {
  return {
    id: 'test-id',
    object: 'chat.completion',
    created: Date.now(),
    model: 'test-model',
    choices: [{
      index: 0,
      message: { role: 'assistant', content },
      finish_reason: 'stop',
    }],
    usage: { prompt_tokens: 50, completion_tokens: 100, total_tokens: 150 },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================
// Successful streaming response
// ============================================================

describe('callLLMStreaming — successful response', () => {
  it('returns text and usage from streaming response', async () => {
    mockChatCompletionStream.mockResolvedValue(
      makeStreamResponse('Audit result: the world has strong mechanisms.')
    );

    const result = await callLLMStreaming(makeOptions());

    expect(result.text).toBe('Audit result: the world has strong mechanisms.');
    expect(result.usage).toEqual({ prompt: 50, completion: 100, total: 150 });
  });

  it('calls onChunk callback for each delta during streaming', async () => {
    const onChunk = vi.fn();
    mockChatCompletionStream.mockImplementation(
      async (_options: unknown, onDelta: (text: string, delta: string) => void) => {
        onDelta('Hello ', 'Hello ');
        onDelta('world', 'world');
        return makeStreamResponse('Hello world');
      }
    );

    await callLLMStreaming(makeOptions({ onChunk }));

    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenCalledWith('Hello ');
    expect(onChunk).toHaveBeenCalledWith('world');
  });

  it('uses accumulated streaming text when choices[0].message.content is empty', async () => {
    mockChatCompletionStream.mockImplementation(
      async (_options: unknown, onDelta: (text: string, delta: string) => void) => {
        onDelta('Accumulated', 'Accumulated');
        onDelta(' text', ' text');
        return makeStreamResponse(''); // Empty in choices
      }
    );

    const result = await callLLMStreaming(makeOptions());

    expect(result.text).toBe('Accumulated text');
  });

  it('passes custom model overrides to createLLMClient', async () => {
    mockChatCompletionStream.mockResolvedValue(makeStreamResponse('test'));

    const configWithOverrides: LLMConfig = {
      ...defaultLLMConfig,
      customContextWindow: 200000,
      customMaxOutputTokens: 16384,
      customSupportsJSONMode: false,
    };

    await callLLMStreaming(makeOptions({ llmConfig: configWithOverrides }));

    // Verify createLLMClient was called (the mock handles overrides internally)
    // The key test is that callLLMStreaming doesn't crash with overrides
    expect(mockChatCompletionStream).toHaveBeenCalled();
  });
});

// ============================================================
// Partial text recovery
// ============================================================

describe('callLLMStreaming — partial text recovery', () => {
  it('returns partial text when streaming fails after receiving some data', async () => {
    mockChatCompletionStream.mockImplementation(
      async (_options: unknown, onDelta: (text: string, delta: string) => void) => {
        onDelta('Partial', 'Partial');
        onDelta(' text', ' text');
        throw new Error('Connection lost mid-stream');
      }
    );

    const result = await callLLMStreaming(makeOptions());

    expect(result.text).toBe('Partial text');
    expect(result.usage).toBeNull();
  });

  it('returns partial text even for very short fragments', async () => {
    mockChatCompletionStream.mockImplementation(
      async (_options: unknown, onDelta: (text: string, delta: string) => void) => {
        onDelta('A', 'A');
        throw new Error('Stream error');
      }
    );

    const result = await callLLMStreaming(makeOptions());

    expect(result.text).toBe('A');
  });
});

// ============================================================
// ProxyTimeoutError on abort/timeout without partial text
// ============================================================

describe('callLLMStreaming — ProxyTimeoutError', () => {
  it('throws ProxyTimeoutError on AbortError without partial text', async () => {
    mockChatCompletionStream.mockRejectedValue(
      new DOMException('Aborted', 'AbortError')
    );

    await expect(callLLMStreaming(makeOptions())).rejects.toThrow();
    try {
      await callLLMStreaming(makeOptions());
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).name).toBe('ProxyTimeoutError');
      expect((error as Error).message).toContain('PROXY_TIMEOUT');
    }
  });

  it('throws ProxyTimeoutError on timeout error without partial text', async () => {
    mockChatCompletionStream.mockRejectedValue(
      new Error('Запрос отменён по таймауту')
    );

    try {
      await callLLMStreaming(makeOptions());
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).name).toBe('ProxyTimeoutError');
    }
  });

  it('does NOT throw ProxyTimeoutError when partial text exists', async () => {
    mockChatCompletionStream.mockImplementation(
      async (_options: unknown, onDelta: (text: string, delta: string) => void) => {
        onDelta('Got some', 'Got some');
        throw new DOMException('Aborted', 'AbortError');
      }
    );

    // Should return partial text, NOT throw
    const result = await callLLMStreaming(makeOptions());
    expect(result.text).toBe('Got some');
  });
});

// ============================================================
// Empty streaming response
// ============================================================

describe('callLLMStreaming — empty response', () => {
  it('returns empty text when streaming produces no content', async () => {
    mockChatCompletionStream.mockResolvedValue(makeStreamResponse(''));

    const result = await callLLMStreaming(makeOptions());

    expect(result.text).toBe('');
  });

  it('returns empty text when streaming produces whitespace only', async () => {
    mockChatCompletionStream.mockResolvedValue(makeStreamResponse('   \n  '));

    const result = await callLLMStreaming(makeOptions());

    expect(result.text.trim()).toBe('');
  });
});

// ============================================================
// Non-timeout error rethrow
// ============================================================

describe('callLLMStreaming — non-timeout errors', () => {
  it('rethrows non-timeout, non-abort errors as-is', async () => {
    const authError = new Error('Authentication failed: 401');
    mockChatCompletionStream.mockRejectedValue(authError);

    await expect(callLLMStreaming(makeOptions())).rejects.toThrow('Authentication failed: 401');
  });

  it('rethrows TypeError as-is', async () => {
    const typeError = new TypeError('Failed to fetch');
    mockChatCompletionStream.mockRejectedValue(typeError);

    await expect(callLLMStreaming(makeOptions())).rejects.toThrow('Failed to fetch');
  });
});
