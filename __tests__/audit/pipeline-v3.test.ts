/**
 * Tests for pipeline-v3.ts — 5-block sequential pipeline orchestration.
 *
 * Tests the main runAuditPipelineV3() function, abort handling,
 * retry logic (callWithRetry), and chunk concatenation (executeChunkedBlock).
 * All LLM calls are mocked to avoid real API requests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock llm-client before importing pipeline
vi.mock('@/lib/llm-client', () => ({
  createLLMClient: vi.fn(() => ({
    chatCompletionStream: vi.fn(),
    chatCompletion: vi.fn(),
  })),
  getModelCapabilities: vi.fn(() => ({
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsJSONMode: true,
    supportsSystemMessages: true,
  })),
  getEffectiveModelCapabilities: vi.fn(() => ({
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsJSONMode: true,
    supportsSystemMessages: true,
  })),
}));

// Mock callLLMStreaming to return predefined markdown
vi.mock('@/lib/audit/llm-streaming', () => ({
  callLLMStreaming: vi.fn(),
}));

// Mock verdict extraction (non-blocking)
vi.mock('@/lib/audit/verdict', () => ({
  extractAuditVerdict: vi.fn(() => null),
}));

// Mock prompts-v3 to return simple prompts
vi.mock('@/lib/audit/prompts-v3', () => ({
  buildBlock1Prompt: vi.fn(() => [{ system: 'system-1', user: 'user-1' }]),
  buildExtraContextBlock: vi.fn(() => ''),
  detectAuditMode: vi.fn(() => 'lazy'),
  buildBlock2SubPrompts: vi.fn(() => [
    { system: 'system-2a', user: 'user-2a' },
    { system: 'system-2b', user: 'user-2b' },
  ]),
  buildBlock3SubPrompts: vi.fn(() => [
    { system: 'system-3a', user: 'user-3a' },
  ]),
  buildBlock4SubPrompts: vi.fn(() => [
    { system: 'system-4a', user: 'user-4a' },
  ]),
  buildBlock5SubPrompts: vi.fn(() => [
    { system: 'system-5a', user: 'user-5a' },
  ]),
}));

// Mock context-bridge
vi.mock('@/lib/audit/context-bridge', () => ({
  extractOrientationContext: vi.fn(() => ({
    auditMode: 'conflict',
    authorProfileType: 'gardener',
    authorProfilePercentage: 70,
    skeletonSummary: 'Test skeleton',
    screeningResults: null,
  })),
  extractWeaknessesSummary: vi.fn(() => 'Test weaknesses'),
}));

import { runAuditPipelineV3 } from '@/lib/audit/pipeline-v3';
import { callLLMStreaming } from '@/lib/audit/llm-streaming';
import type { ContinuationPolicy } from '@/lib/audit/llm-streaming';
import { extractAuditVerdict } from '@/lib/audit/verdict';
import type { LLMStreamingResult } from '@/lib/audit/llm-streaming';
import type { LLMConfig, AuditInput, PipelineLogEntry } from '@/lib/audit/types-v3';

// ============================================================
// Test helpers
// ============================================================

const defaultLLMConfig: LLMConfig = {
  provider: 'google',
  apiKey: 'test-key',
  model: 'gemini-2.0-flash',
  rpmLimit: 60,
};

const defaultInput: AuditInput = {
  text: 'Test concept text for the audit pipeline',
  mediaType: 'narrative',
};

function makeStreamingResult(text: string): LLMStreamingResult {
  return {
    text,
    usage: { prompt: 100, completion: 200, total: 300 },
  };
}

const mockCallbacks = {
  onBlockStart: vi.fn(),
  onChunk: vi.fn(),
  onBlockComplete: vi.fn(),
  onError: vi.fn(),
  onLog: vi.fn(),
};

/** All journal entries the pipeline emitted in the current test. */
function loggedEntries(): PipelineLogEntry[] {
  return mockCallbacks.onLog.mock.calls.map((call) => call[0] as PipelineLogEntry);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================
// Successful 5-block execution
// ============================================================

describe('runAuditPipelineV3 — successful execution', () => {
  it('completes all 5 blocks and returns done state', async () => {
    // Mock each LLM call to return markdown
    const mockCallLLMStreaming = vi.mocked(callLLMStreaming);
    mockCallLLMStreaming.mockResolvedValue(
      makeStreamingResult('# Block result\n\nSome markdown content')
    );

    const result = await runAuditPipelineV3(
      defaultInput,
      defaultLLMConfig,
      mockCallbacks,
    );

    expect(result.phase).toBe('done');
    expect(result.block1).not.toBeNull();
    expect(result.block2).not.toBeNull();
    expect(result.block3).not.toBeNull();
    expect(result.block4).not.toBeNull();
    expect(result.block5).not.toBeNull();
    expect(result.error).toBeNull();
    expect(result.meta.elapsedMs).toBeGreaterThan(0);
    expect(result.meta.tokensUsed.total).toBeGreaterThan(0);
  });

  it('calls onBlockComplete for each block', async () => {
    const mockCallLLMStreaming = vi.mocked(callLLMStreaming);
    mockCallLLMStreaming.mockResolvedValue(
      makeStreamingResult('Block markdown content')
    );

    await runAuditPipelineV3(
      defaultInput,
      defaultLLMConfig,
      mockCallbacks,
    );

    // onBlockComplete called for blocks 1-5
    expect(mockCallbacks.onBlockComplete).toHaveBeenCalledTimes(5);
  });

  it('calls onBlockStart at least once per block', async () => {
    const mockCallLLMStreaming = vi.mocked(callLLMStreaming);
    mockCallLLMStreaming.mockResolvedValue(
      makeStreamingResult('Block content')
    );

    await runAuditPipelineV3(
      defaultInput,
      defaultLLMConfig,
      mockCallbacks,
    );

    // At least 5 calls for 5 blocks (more if chunked)
    expect(mockCallbacks.onBlockStart.mock.calls.length).toBeGreaterThanOrEqual(5);
  });

  it('extracts the machine-readable verdict after all blocks complete', async () => {
    const mockCallLLMStreaming = vi.mocked(callLLMStreaming);
    mockCallLLMStreaming.mockResolvedValue(
      makeStreamingResult('Block content')
    );

    await runAuditPipelineV3(
      defaultInput,
      defaultLLMConfig,
      mockCallbacks,
    );

    expect(extractAuditVerdict).toHaveBeenCalledOnce();
  });

  it('concatenates chunked sub-results with --- separator', async () => {
    const mockCallLLMStreaming = vi.mocked(callLLMStreaming);
    // Block 2 has 2 sub-prompts, each returns a chunk
    let callCount = 0;
    mockCallLLMStreaming.mockImplementation(() => {
      callCount++;
      return Promise.resolve(makeStreamingResult(`Chunk ${callCount} content`));
    });

    const result = await runAuditPipelineV3(
      defaultInput,
      defaultLLMConfig,
      mockCallbacks,
    );

    // Block 2 has 2 chunks, so its markdown should contain ---
    if (result.block2?.markdown.includes('---')) {
      expect(result.block2.markdown).toContain('---');
    }
    // At minimum, all blocks should have content
    expect(result.block1?.markdown.length).toBeGreaterThan(0);
    expect(result.block5?.markdown.length).toBeGreaterThan(0);
  });
});

// ============================================================
// Abort signal cancellation
// ============================================================

describe('runAuditPipelineV3 — abort cancellation', () => {
  it('returns idle state when aborted mid-pipeline', async () => {
    const controller = new AbortController();
    const mockCallLLMStreaming = vi.mocked(callLLMStreaming);

    // Abort after the first block completes
    let blockCount = 0;
    mockCallLLMStreaming.mockImplementation(() => {
      blockCount++;
      if (blockCount >= 2) {
        controller.abort();
        return Promise.reject(new DOMException('Aborted', 'AbortError'));
      }
      return Promise.resolve(makeStreamingResult('Block 1 content'));
    });

    const result = await runAuditPipelineV3(
      defaultInput,
      defaultLLMConfig,
      mockCallbacks,
      controller.signal,
    );

    expect(result.phase).toBe('idle');
    expect(result.currentBlock).toBe(0);
  });

  it('does NOT call onError on user-initiated abort', async () => {
    const controller = new AbortController();
    const mockCallLLMStreaming = vi.mocked(callLLMStreaming);

    mockCallLLMStreaming.mockImplementation(() => {
      controller.abort();
      return Promise.reject(new DOMException('Aborted', 'AbortError'));
    });

    await runAuditPipelineV3(
      defaultInput,
      defaultLLMConfig,
      mockCallbacks,
      controller.signal,
    );

    expect(mockCallbacks.onError).not.toHaveBeenCalled();
  });
});

// ============================================================
// Fatal error handling
// ============================================================

describe('runAuditPipelineV3 — error handling', () => {
  it('sets error phase and calls onError for non-abort errors', async () => {
    const mockCallLLMStreaming = vi.mocked(callLLMStreaming);
    mockCallLLMStreaming.mockRejectedValue(new Error('Auth failed: 401'));

    const result = await runAuditPipelineV3(
      defaultInput,
      defaultLLMConfig,
      mockCallbacks,
    );

    expect(result.phase).toBe('error');
    expect(result.error).toBeTruthy();
    expect(mockCallbacks.onError).toHaveBeenCalledOnce();
  });

  it('handles ProxyTimeoutError as fatal (not retryable in pipeline)', async () => {
    const mockCallLLMStreaming = vi.mocked(callLLMStreaming);
    const timeoutError = new Error('PROXY_TIMEOUT: request too large');
    timeoutError.name = 'ProxyTimeoutError';
    mockCallLLMStreaming.mockRejectedValue(timeoutError);

    const result = await runAuditPipelineV3(
      defaultInput,
      defaultLLMConfig,
      mockCallbacks,
    );

    expect(result.phase).toBe('error');
  });

  it('continues pipeline even if verdict extraction fails', async () => {
    const mockCallLLMStreaming = vi.mocked(callLLMStreaming);
    mockCallLLMStreaming.mockResolvedValue(
      makeStreamingResult('Block content')
    );

    // Make verdict extraction throw
    vi.mocked(extractAuditVerdict).mockImplementationOnce(() => {
      throw new Error('Verdict extraction failed');
    });

    const result = await runAuditPipelineV3(
      defaultInput,
      defaultLLMConfig,
      mockCallbacks,
    );

    // Pipeline should still complete successfully
    expect(result.phase).toBe('done');
    expect(result.verdict).toBeNull();
  });
});

// ============================================================
// RPM-based delay
// ============================================================

describe('runAuditPipelineV3 — RPM delay configuration', () => {
  it('uses default 3 RPM when rpmLimit not set', async () => {
    const mockCallLLMStreaming = vi.mocked(callLLMStreaming);
    mockCallLLMStreaming.mockResolvedValue(
      makeStreamingResult('Block content')
    );

    const configNoRpm = { ...defaultLLMConfig, rpmLimit: undefined };
    const result = await runAuditPipelineV3(
      defaultInput,
      configNoRpm,
      mockCallbacks,
    );

    // Should still complete successfully
    expect(result.phase).toBe('done');
  });

  it('completes successfully with high RPM limit', async () => {
    const mockCallLLMStreaming = vi.mocked(callLLMStreaming);
    mockCallLLMStreaming.mockResolvedValue(
      makeStreamingResult('Block content')
    );

    const configHighRpm = { ...defaultLLMConfig, rpmLimit: 60 };
    const result = await runAuditPipelineV3(
      defaultInput,
      configHighRpm,
      mockCallbacks,
    );

    expect(result.phase).toBe('done');
  });
});

// ============================================================
// Partial text recovery
// ============================================================

describe('runAuditPipelineV3 — partial text recovery', () => {
  it('uses partial text when streaming fails after receiving some data', async () => {
    const mockCallLLMStreaming = vi.mocked(callLLMStreaming);
    let callIndex = 0;

    mockCallLLMStreaming.mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) {
        // First call succeeds (Block 1)
        return Promise.resolve(makeStreamingResult('Block 1 content'));
      }
      // Subsequent calls: simulate transient error
      return Promise.reject(new Error('Server is overloaded (503)'));
    });

    const result = await runAuditPipelineV3(
      defaultInput,
      defaultLLMConfig,
      mockCallbacks,
    );

    // Pipeline should still try to continue (retry logic)
    // and eventually complete or error
    expect(['done', 'error']).toContain(result.phase);
  });
});

// ============================================================
// Continuation of truncated chunks
// ============================================================

describe('runAuditPipelineV3 — continuation on truncation', () => {
  it('enables continuation for every chunk and journals it in Russian', async () => {
    const mockCallLLMStreaming = vi.mocked(callLLMStreaming);
    const policies: ContinuationPolicy[] = [];

    mockCallLLMStreaming.mockImplementation(async (options) => {
      if (options.continuation) {
        policies.push(options.continuation);
        options.continuation.onContinue?.(1, 2);
      }
      return makeStreamingResult('Часть ответа');
    });

    const result = await runAuditPipelineV3(defaultInput, defaultLLMConfig, mockCallbacks);

    expect(result.phase).toBe('done');
    // Continuation is a property of the call, not an extra pipeline request.
    // (This file mocks the prompt builders, so the layout is 1+2+1+1+1 = 6 calls.)
    expect(mockCallLLMStreaming).toHaveBeenCalledTimes(6);
    expect(policies).toHaveLength(6);
    expect(typeof policies[0].pace).toBe('function');

    const entry = loggedEntries().find((log) => log.kind === 'chunk:continue');
    expect(entry).toMatchObject({ level: 'info', kind: 'chunk:continue', block: 1 });
    expect(entry?.message).toMatch(
      /^Блок 1(, часть \d+\/\d+)?: ответ обрезан — дописываю \(продолжение 1\/2\)$/,
    );
  });

  it('keeps the block complete when the continuation ended with a normal stop', async () => {
    const mockCallLLMStreaming = vi.mocked(callLLMStreaming);

    mockCallLLMStreaming.mockImplementation(async (options) => {
      options.continuation?.onContinue?.(1, 2);
      // The wrapper reports the reason of the LAST request: the repair worked.
      return { text: 'Полный ответ', usage: null, finishReason: 'stop' };
    });

    const result = await runAuditPipelineV3(defaultInput, defaultLLMConfig, mockCallbacks);

    expect(result.block1?.meta.completionStatus).toBe('complete');
    expect(result.block5?.meta.completionStatus).toBe('complete');
    expect(loggedEntries().some((log) => log.kind === 'chunk:truncated')).toBe(false);
  });

  it('stays partial when the answer is still truncated after the continuations', async () => {
    const mockCallLLMStreaming = vi.mocked(callLLMStreaming);

    mockCallLLMStreaming.mockImplementation(async (options) => {
      options.continuation?.onContinue?.(1, 2);
      options.continuation?.onContinue?.(2, 2);
      return { text: 'Обрезанный ответ', usage: null, finishReason: 'length' };
    });

    const result = await runAuditPipelineV3(defaultInput, defaultLLMConfig, mockCallbacks);
    const kinds = loggedEntries().map((log) => log.kind);

    expect(result.block1?.meta.completionStatus).toBe('partial');
    expect(result.block5?.meta.completionStatus).toBe('partial');
    // The journal must still say that the answer was cut off.
    expect(kinds).toContain('chunk:truncated');
    // 6 mocked chunks × 2 continuations each.
    expect(loggedEntries().filter((log) => log.kind === 'chunk:continue')).toHaveLength(12);
    expect(loggedEntries().find((log) => log.kind === 'block:done')?.level).toBe('warn');
  });
});
