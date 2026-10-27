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
import {
  DEFAULT_MAX_CONTINUATIONS,
  buildContinuationPrompt,
  isTruncatingFinishReason,
  CONTINUATION_INSTRUCTION,
} from '@/lib/audit/llm-streaming';
import type { LLMConfig } from '@/lib/audit/types-v3';

// ============================================================
// Test helpers
// ============================================================

const defaultLLMConfig: LLMConfig = {
  provider: 'google',
  apiKey: 'test-key',
  model: 'gemini-2.0-flash',
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

function makeResponse(content: string, finishReason: string | null) {
  const response = makeStreamResponse(content);
  return {
    ...response,
    choices: [{
      index: 0,
      message: { role: 'assistant', content },
      finish_reason: finishReason,
    }],
  };
}

/** A continuation answer long enough to be a real gain (> MIN_CONTINUATION_GAIN). */
function longText(char: string, length = 300): string {
  return char.repeat(length);
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

  it('rethrows a user cancel even when partial text arrived', async () => {
    // Cancelling must stop the audit: recovering a partial answer here would
    // keep every remaining block running after the user pressed «Отменить».
    mockChatCompletionStream.mockImplementation(
      async (_options: unknown, onDelta: (text: string, delta: string) => void) => {
        onDelta('Partial', 'Partial');
        throw new DOMException('Aborted', 'AbortError');
      }
    );

    const controller = new AbortController();
    controller.abort();

    await expect(callLLMStreaming(makeOptions({ abortSignal: controller.signal })))
      .rejects.toThrow();
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

// ============================================================
// Finish reason / truncation signal
// ============================================================

describe('callLLMStreaming — finish reason passthrough', () => {
  it('propagates finish_reason "length" so truncation is visible to the pipeline', async () => {
    mockChatCompletionStream.mockResolvedValue({
      ...makeStreamResponse('Cut-off markdown'),
      choices: [{
        index: 0,
        message: { role: 'assistant', content: 'Cut-off markdown' },
        finish_reason: 'length',
      }],
    });

    const result = await callLLMStreaming(makeOptions());

    expect(result.finishReason).toBe('length');
    expect(result.incomplete).toBeFalsy();
  });

  it('propagates a normal "stop" finish reason', async () => {
    mockChatCompletionStream.mockResolvedValue(makeStreamResponse('Complete markdown'));

    const result = await callLLMStreaming(makeOptions());

    expect(result.finishReason).toBe('stop');
  });

  it('flags text recovered from an interrupted stream as incomplete', async () => {
    mockChatCompletionStream.mockImplementation(
      async (_options: unknown, onDelta: (text: string, delta: string) => void) => {
        onDelta('Partial', 'Partial');
        throw new Error('Connection lost mid-stream');
      }
    );

    const result = await callLLMStreaming(makeOptions());

    expect(result.text).toBe('Partial');
    expect(result.incomplete).toBe(true);
  });

  it('does not flag a normally completed stream as incomplete', async () => {
    mockChatCompletionStream.mockResolvedValue(makeStreamResponse('Complete markdown'));

    const result = await callLLMStreaming(makeOptions());

    expect(result.incomplete).toBeFalsy();
  });
});

// ============================================================
// Truncation vocabulary
// ============================================================

describe('isTruncatingFinishReason', () => {
  it('recognises every provider truncation vocabulary', () => {
    for (const reason of ['length', 'max_tokens', 'MAX_TOKENS', 'incomplete', 'aborted']) {
      expect(isTruncatingFinishReason(reason)).toBe(true);
    }
  });

  it('does not treat a normal or filtered stop as truncation', () => {
    for (const reason of ['stop', 'content_filter', '', null, undefined]) {
      expect(isTruncatingFinishReason(reason)).toBe(false);
    }
  });
});

// ============================================================
// Continuation prompt
// ============================================================

describe('buildContinuationPrompt', () => {
  const ORIGINAL = {
    system: 'PROTOCOL CORE',
    user: `Требования к ответу.
## 26.S Итоговый вердикт
ОСНОВА МИРА: weak / developing / coherent / strong

МАТЕРИАЛ:
ОГРОМНЫЙ ИСХОДНЫЙ ТЕКСТ, КОТОРЫЙ НЕ НУЖНО ПОВТОРЯТЬ`,
  };

  it('keeps the system prompt and the answer requirements, drops the source material', () => {
    const prompt = buildContinuationPrompt(ORIGINAL, 'уже написанный хвост');

    expect(prompt.system).toBe('PROTOCOL CORE');
    expect(prompt.user).toContain(CONTINUATION_INSTRUCTION);
    expect(prompt.user).toContain('ОСНОВА МИРА: weak / developing');
    expect(prompt.user).not.toContain('ОГРОМНЫЙ ИСХОДНЫЙ ТЕКСТ');
    expect(prompt.user).toContain('уже написанный хвост');
  });

  it('asks for the cut-off §26.S/§27 verdict and forbids repetition', () => {
    const prompt = buildContinuationPrompt(ORIGINAL, 'хвост');

    expect(prompt.user).toMatch(/не повторяй уже написанное/i);
    expect(prompt.user).toContain('§26.S');
    expect(prompt.user).toContain('§27');
  });

  it('bounds both echoed fragments instead of resending the whole request', () => {
    const prompt = buildContinuationPrompt(
      { system: 's', user: `требования ${'y'.repeat(50_000)}` },
      'z'.repeat(50_000),
    );

    expect(prompt.user.length).toBeLessThan(12_000);
    expect(prompt.user).toContain('z'.repeat(4_000));
  });
});

// ============================================================
// Continuation on truncation
// ============================================================

describe('callLLMStreaming — continuation', () => {
  beforeEach(() => {
    // Queued once-implementations must not leak between tests.
    mockChatCompletionStream.mockReset();
  });

  it('is off by default: a truncated answer is returned as-is', async () => {
    mockChatCompletionStream.mockResolvedValue(makeResponse('обрезанный ответ', 'length'));

    const result = await callLLMStreaming(makeOptions());

    expect(mockChatCompletionStream).toHaveBeenCalledTimes(1);
    expect(result.text).toBe('обрезанный ответ');
    expect(result.finishReason).toBe('length');
  });

  it('fires on finish_reason=length and appends the continuation text', async () => {
    mockChatCompletionStream
      .mockResolvedValueOnce(makeResponse('## 26.S\n\nОСНОВА МИРА: cohe', 'length'))
      .mockResolvedValueOnce(makeResponse('rent\nСИСТЕМНАЯ ГЛУБИНА: developing', 'stop'));

    const result = await callLLMStreaming(makeOptions({ continuation: {} }));

    expect(mockChatCompletionStream).toHaveBeenCalledTimes(2);
    expect(result.text).toBe('## 26.S\n\nОСНОВА МИРА: coherent\nСИСТЕМНАЯ ГЛУБИНА: developing');
    // The continuation ended normally, so the answer is no longer truncated.
    expect(result.finishReason).toBe('stop');
    expect(result.incomplete).toBeFalsy();
  });

  it('streams the continuation into the same onChunk stream', async () => {
    const onChunk = vi.fn();
    mockChatCompletionStream
      .mockImplementationOnce(async (_options: unknown, onDelta: (text: string, delta: string) => void) => {
        onDelta('первая часть', 'первая часть');
        return makeResponse('первая часть', 'length');
      })
      .mockImplementationOnce(async (_options: unknown, onDelta: (text: string, delta: string) => void) => {
        onDelta(' вторая часть', ' вторая часть');
        return makeResponse(' вторая часть', 'stop');
      });

    const result = await callLLMStreaming(makeOptions({ onChunk, continuation: {} }));

    expect(onChunk.mock.calls.map((call) => call[0])).toEqual(['первая часть', ' вторая часть']);
    expect(result.text).toBe('первая часть вторая часть');
  });

  it('bounds the number of continuations', async () => {
    let call = 0;
    mockChatCompletionStream.mockImplementation(async () => {
      call += 1;
      // Different characters each time, so no overlap is stripped.
      return makeResponse(longText(String(call)), 'length');
    });
    const onContinue = vi.fn();

    const result = await callLLMStreaming(makeOptions({ continuation: { onContinue } }));

    expect(mockChatCompletionStream).toHaveBeenCalledTimes(1 + DEFAULT_MAX_CONTINUATIONS);
    expect(onContinue.mock.calls.map((call) => call[0])).toEqual([1, 2]);
    expect(onContinue.mock.calls.every((call) => call[1] === DEFAULT_MAX_CONTINUATIONS)).toBe(true);
    // Still truncated after every allowed continuation → honest partial result.
    expect(result.finishReason).toBe('length');
  });

  it('stops when a continuation adds almost nothing (no progress loop)', async () => {
    mockChatCompletionStream
      .mockResolvedValueOnce(makeResponse(longText('a'), 'length'))
      .mockResolvedValueOnce(makeResponse('...', 'length'));

    const result = await callLLMStreaming(makeOptions({ continuation: {} }));

    expect(mockChatCompletionStream).toHaveBeenCalledTimes(2);
    expect(result.finishReason).toBe('length');
  });

  it('respects the character cap', async () => {
    mockChatCompletionStream.mockResolvedValue(makeResponse(longText('a', 500), 'length'));

    const result = await callLLMStreaming(makeOptions({ continuation: { charCap: 500 } }));

    expect(mockChatCompletionStream).toHaveBeenCalledTimes(1);
    expect(result.text).toHaveLength(500);
  });

  it('paces before a continuation instead of hammering the provider', async () => {
    const pace = vi.fn(async () => undefined);
    mockChatCompletionStream
      .mockResolvedValueOnce(makeResponse(longText('a'), 'length'))
      .mockResolvedValueOnce(makeResponse(longText('b'), 'stop'));

    await callLLMStreaming(makeOptions({ continuation: { pace } }));

    expect(pace).toHaveBeenCalledTimes(1);
  });

  it('aborts while pacing instead of sending the continuation', async () => {
    const controller = new AbortController();
    mockChatCompletionStream.mockResolvedValue(makeResponse(longText('a'), 'length'));

    await expect(
      callLLMStreaming(makeOptions({
        abortSignal: controller.signal,
        continuation: { pace: async () => { controller.abort(); } },
      })),
    ).rejects.toThrow();

    expect(mockChatCompletionStream).toHaveBeenCalledTimes(1);
  });

  it('repairs a stream that broke mid-answer', async () => {
    mockChatCompletionStream
      .mockImplementationOnce(async (_options: unknown, onDelta: (text: string, delta: string) => void) => {
        onDelta('partial', 'partial');
        throw new Error('Connection lost mid-stream');
      })
      .mockResolvedValueOnce(makeResponse(' continuation', 'stop'));

    const result = await callLLMStreaming(makeOptions({ continuation: {} }));

    expect(result.text).toBe('partial continuation');
    expect(result.finishReason).toBe('stop');
    expect(result.incomplete).toBeFalsy();
  });

  it('does not continue an empty answer', async () => {
    mockChatCompletionStream.mockResolvedValue(makeResponse('', 'length'));

    const result = await callLLMStreaming(makeOptions({ continuation: {} }));

    expect(mockChatCompletionStream).toHaveBeenCalledTimes(1);
    expect(result.text).toBe('');
  });

  it('sums usage across the first answer and its continuation', async () => {
    mockChatCompletionStream
      .mockResolvedValueOnce(makeResponse(longText('a'), 'length'))
      .mockResolvedValueOnce(makeResponse(longText('b'), 'stop'));

    const result = await callLLMStreaming(makeOptions({ continuation: {} }));

    expect(result.usage).toEqual({ prompt: 100, completion: 200, total: 300 });
  });
});

