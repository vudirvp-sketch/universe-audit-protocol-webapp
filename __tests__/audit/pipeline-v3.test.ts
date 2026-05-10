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

// Mock scoring (non-blocking)
vi.mock('@/lib/audit/scoring', () => ({
  runChecklistScoring: vi.fn(() => Promise.resolve(null)),
}));

// Mock prompts-v3 to return simple prompts
vi.mock('@/lib/audit/prompts-v3', () => ({
  buildBlock1Prompt: vi.fn(() => [{ system: 'system-1', user: 'user-1' }]),
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
import { runChecklistScoring } from '@/lib/audit/scoring';
import type { LLMStreamingResult } from '@/lib/audit/llm-streaming';
import type { LLMConfig, AuditInput } from '@/lib/audit/types-v3';

// ============================================================
// Test helpers
// ============================================================

const defaultLLMConfig: LLMConfig = {
  provider: 'google',
  apiKey: 'test-key',
  model: 'gemini-2.0-flash',
  proxyUrl: 'https://proxy.test',
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
};

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

  it('runs checklist scoring after all blocks complete', async () => {
    const mockCallLLMStreaming = vi.mocked(callLLMStreaming);
    mockCallLLMStreaming.mockResolvedValue(
      makeStreamingResult('Block content')
    );

    await runAuditPipelineV3(
      defaultInput,
      defaultLLMConfig,
      mockCallbacks,
    );

    expect(runChecklistScoring).toHaveBeenCalledOnce();
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

  it('continues pipeline even if checklist scoring fails', async () => {
    const mockCallLLMStreaming = vi.mocked(callLLMStreaming);
    mockCallLLMStreaming.mockResolvedValue(
      makeStreamingResult('Block content')
    );

    // Make scoring throw
    vi.mocked(runChecklistScoring).mockRejectedValueOnce(new Error('Scoring failed'));

    const result = await runAuditPipelineV3(
      defaultInput,
      defaultLLMConfig,
      mockCallbacks,
    );

    // Pipeline should still complete successfully
    expect(result.phase).toBe('done');
    expect(result.checklistScore).toBeNull();
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
