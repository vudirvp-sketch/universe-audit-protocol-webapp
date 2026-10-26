/**
 * Pipeline V3 — 5-block sequential pipeline for UNIVERSE AUDIT PROTOCOL
 * Ultimate Edition v16 (Causal / Human / Experiential World Audit).
 *
 * Each block = one or more focused LLM calls (chunked for free-plan compatibility).
 * 13 requests total: 1 + 4 + 3 + 3 + 2.
 * Output = free-form markdown report; Block 5 also emits the v16 §27 JSON block,
 * which `extractAuditVerdict` parses into the qualitative verdict (no numeric score).
 *
 * v2 (F3): Blocks 2-5 are split into sub-requests (chunks) that each
 * complete within the 300s proxy timeout on Cloudflare Workers free plan.
 * RPM-based delay between sub-requests avoids rate limits on free-tier models.
 */

import type {
  AuditInput,
  LLMConfig,
  StreamingCallbacksV3,
  PipelineStateV3,
  BlockResult,
  SubBlockResult,
  OrientationContext,
} from './types-v3';
import { BLOCK_TEMPERATURES } from './types-v3';
import { getModelCapabilities, getEffectiveModelCapabilities } from '../llm-client';
import type { ModelCapabilities } from '../llm-client';
import type { LLMStreamingResult } from './llm-streaming';
import { callLLMStreaming } from './llm-streaming';
import {
  buildBlock1Prompt,
  buildBlock2SubPrompts,
  buildBlock3SubPrompts,
  buildBlock4SubPrompts,
  buildBlock5SubPrompts,
  buildExtraContextBlock,
} from './prompts-v3';
import {
  extractOrientationContext,
  extractWeaknessesSummary,
} from './context-bridge';
import { classifyLLMError } from './error-handler';
import { extractAuditVerdict } from './verdict';

// Re-export for consumers
export type { StreamingCallbacksV3 } from './types-v3';

// ============================================================
// Desired max_tokens per block
// ============================================================

const DESIRED_MAX_TOKENS: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 8192,
  2: 16384,
  3: 16384,
  4: 16384,
  5: 16384,
};

function resolveBlockMaxTokens(block: 1 | 2 | 3 | 4 | 5, modelCaps: ModelCapabilities): number {
  return Math.min(DESIRED_MAX_TOKENS[block], modelCaps.maxOutputTokens);
}

// ============================================================
// Main pipeline
// ============================================================

export async function runAuditPipelineV3(
  input: AuditInput,
  llmConfig: LLMConfig,
  callbacks: StreamingCallbacksV3,
  abortSignal?: AbortSignal,
): Promise<PipelineStateV3> {
  const pipelineStart = Date.now();
  const state: PipelineStateV3 = {
    phase: 'running',
    currentBlock: 0,
    block1: null,
    block2: null,
    block3: null,
    block4: null,
    block5: null,
    orientationContext: null,
    accumulatedWeaknesses: [],
    verdict: null,
    meta: {
      inputText: input.text,
      mediaType: input.mediaType,
      elapsedMs: 0,
      tokensUsed: { prompt: 0, completion: 0, total: 0 },
    },
    error: null,
  };

  try {
    const modelCaps = getEffectiveModelCapabilities(
      llmConfig.provider as Parameters<typeof getModelCapabilities>[0],
      llmConfig.model,
      {
        customContextWindow: llmConfig.customContextWindow,
        customMaxOutputTokens: llmConfig.customMaxOutputTokens,
        customSupportsJSONMode: llmConfig.customSupportsJSONMode,
      },
    );

    // Calculate RPM-based delay between chunks (FIX-07)
    // Default: 3 RPM → 20s delay; 60 RPM → 1s delay; minimum 1 second
    const rpmDelayMs = Math.max(1_000, Math.floor(60_000 / (llmConfig.rpmLimit || 3)));

    // v16 §2 — author framing (guided mode) and additional artefacts
    // (material-aware mode). Rendered once and injected into every request.
    const extraContext = buildExtraContextBlock(input);

    // ============================================================
    // Block 1: Context and intent, world skeleton, fast screen (v16 §4-6)
    // ============================================================
    const block1Result = await executeChunkedBlock(
      1,
      state,
      input,
      llmConfig,
      modelCaps,
      callbacks,
      abortSignal,
      () => [buildBlock1Prompt(input.text, input.mediaType, extraContext)],
      rpmDelayMs,
    );
    state.block1 = block1Result;

    // Extract orientation context
    state.orientationContext = extractOrientationContext(block1Result.markdown);

    // ============================================================
    // Block 2: Level 1 — world mechanism (v16 §7.1-7.12) — 4 sub-requests
    // ============================================================
    const block2Result = await executeChunkedBlock(
      2,
      state,
      input,
      llmConfig,
      modelCaps,
      callbacks,
      abortSignal,
      () => buildBlock2SubPrompts(input.text, input.mediaType, state.orientationContext!, state.block1?.markdown, extraContext),
      rpmDelayMs,
    );
    state.block2 = block2Result;
    state.accumulatedWeaknesses.push(extractWeaknessesSummary(block2Result.markdown));

    // ============================================================
    // Block 3: Levels 1B-3 — epistemic, human, cultural, characters, psyche (v16 §8-12) — 3 sub-requests
    // ============================================================
    const block3Result = await executeChunkedBlock(
      3,
      state,
      input,
      llmConfig,
      modelCaps,
      callbacks,
      abortSignal,
      () => buildBlock3SubPrompts(
        input.text,
        input.mediaType,
        state.orientationContext!,
        state.accumulatedWeaknesses[0], // Block 2 weaknesses
        state.block1?.markdown,
        extraContext,
      ),
      rpmDelayMs,
    );
    state.block3 = block3Result;
    state.accumulatedWeaknesses.push(extractWeaknessesSummary(block3Result.markdown));

    // ============================================================
    // Block 4: Levels 4-8 — experience, story capacity, theme, medium, memorability (v16 §13-17) — 3 sub-requests
    // ============================================================
    const block4Result = await executeChunkedBlock(
      4,
      state,
      input,
      llmConfig,
      modelCaps,
      callbacks,
      abortSignal,
      () => buildBlock4SubPrompts(
        input.text,
        input.mediaType,
        state.orientationContext!,
        state.accumulatedWeaknesses[0], // Block 2 weaknesses
        state.accumulatedWeaknesses[1], // Block 3 weaknesses
        state.block1?.markdown,
        extraContext,
      ),
      rpmDelayMs,
    );
    state.block4 = block4Result;
    state.accumulatedWeaknesses.push(extractWeaknessesSummary(block4Result.markdown));

    // ============================================================
    // Block 5: Level 9 + synthesis — failure classes, root issues, recommendations,
    // capability frontier, verdict (v16 §18-27) — 2 sub-requests
    // ============================================================
    const block5Result = await executeChunkedBlock(
      5,
      state,
      input,
      llmConfig,
      modelCaps,
      callbacks,
      abortSignal,
      () => buildBlock5SubPrompts(
        input.text,
        input.mediaType,
        state.orientationContext!,
        state.accumulatedWeaknesses[0], // Block 2
        state.accumulatedWeaknesses[1], // Block 3
        state.accumulatedWeaknesses[2], // Block 4
        state.block1?.markdown,
        input.referenceComparison,
        extraContext,
      ),
      rpmDelayMs,
    );
    state.block5 = block5Result;

    // ============================================================
    // Extract the machine-readable verdict (v16 §26.S / §27)
    // Non-blocking — a malformed JSON block never breaks the audit.
    // ============================================================
    const finalMarkdown = state.block5?.markdown ?? '';

    try {
      state.verdict = extractAuditVerdict(finalMarkdown);
    } catch (verdictError) {
      // Verdict extraction failure must not break the pipeline
      console.warn('Verdict extraction failed (non-blocking):', verdictError);
      state.verdict = null;
    }

    // ============================================================
    // Done
    // ============================================================
    state.meta.elapsedMs = Date.now() - pipelineStart;
    state.phase = 'done';
    return state;

  } catch (error: unknown) {
    // User cancellation — do NOT call onError, let page.tsx handle the reset
    if (abortSignal?.aborted) {
      state.phase = 'idle';
      state.currentBlock = 0;
      return state;
    }
    const classified = classifyLLMError(error);
    state.phase = 'error';
    state.error = classified.userMessage;
    callbacks.onError(classified.userMessage);
    return state;
  }
}

// ============================================================
// Chunked block executor (F3)
// ============================================================

type BlockNumber = 1 | 2 | 3 | 4 | 5;

/**
 * Execute a block, potentially split into multiple sub-requests (chunks).
 * Each sub-request is a separate LLM call with its own streaming callback.
 * Results are concatenated with `---` separators.
 */
async function executeChunkedBlock(
  blockNumber: BlockNumber,
  state: PipelineStateV3,
  input: AuditInput,
  llmConfig: LLMConfig,
  modelCaps: ModelCapabilities,
  callbacks: StreamingCallbacksV3,
  abortSignal: AbortSignal | undefined,
  buildSubPrompts: () => Array<{ system: string; user: string }>,
  rpmDelayMs: number = 3_000,
): Promise<BlockResult> {
  state.currentBlock = blockNumber;
  const subPrompts = buildSubPrompts();

  // Notify UI about the block starting (with total chunks for progress display)
  callbacks.onBlockStart(blockNumber, subPrompts.length > 1 ? subPrompts.length : undefined, 0);

  const blockStart = Date.now();
  const subResults: SubBlockResult[] = [];
  let fullMarkdown = '';

  for (let i = 0; i < subPrompts.length; i++) {
    // Notify UI about current chunk progress (for multi-chunk blocks)
    if (i > 0 && subPrompts.length > 1) {
      callbacks.onBlockStart(blockNumber, subPrompts.length, i);
    }

    const prompt = subPrompts[i];
    const maxTokens = subPrompts.length > 1
      ? Math.min(
          Math.floor(resolveBlockMaxTokens(blockNumber, modelCaps) / subPrompts.length) + 2048, // slight overhead per chunk
          modelCaps.maxOutputTokens
        )
      : resolveBlockMaxTokens(blockNumber, modelCaps);
    const temperature = BLOCK_TEMPERATURES[blockNumber];

    let accumulatedText = '';

    const result = await callWithRetry(
      () => callLLMStreaming({
        prompt,
        llmConfig,
        onChunk: (text) => {
          accumulatedText += text;
          callbacks.onChunk(blockNumber, text);
        },
        maxTokens,
        abortSignal,
        responseFormat: 'markdown',
        temperature,
      }),
      () => accumulatedText,
      blockNumber,
      abortSignal,
    );

    const raw = typeof result === 'string' ? result : result.text;
    const usage = typeof result === 'string' ? null : result.usage;

    if (usage) {
      state.meta.tokensUsed.prompt += usage.prompt;
      state.meta.tokensUsed.completion += usage.completion;
      state.meta.tokensUsed.total += usage.total;
    }

    const subResult: SubBlockResult = {
      subIndex: i,
      markdown: raw || accumulatedText || '',
      elapsedMs: Date.now() - blockStart,
    };
    subResults.push(subResult);
    fullMarkdown += (fullMarkdown ? '\n\n---\n\n' : '') + subResult.markdown;

    // Delay between sub-requests to avoid rate limits on free models
    if (i < subPrompts.length - 1) {
      await abortAwareSleep(rpmDelayMs, abortSignal); // RPM-based pause between chunks
    }

    // Check abort between sub-requests
    if (abortSignal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
  }

  const blockResult: BlockResult = {
    blockNumber,
    markdown: fullMarkdown,
    weaknessesSummary: '', // Will be set by caller via extractWeaknessesSummary
    meta: {
      elapsedMs: Date.now() - blockStart,
      tokensUsed: null, // Aggregated per sub-request above
      model: llmConfig.model,
      temperature: BLOCK_TEMPERATURES[blockNumber],
      completionStatus: fullMarkdown ? 'complete' : 'error',
    },
  };

  callbacks.onBlockComplete(blockNumber, blockResult);
  return blockResult;
}

// ============================================================
// Retry logic
// ============================================================

async function callWithRetry(
  fn: () => Promise<LLMStreamingResult>,
  getAccumulatedText: () => string,
  blockNumber: BlockNumber,
  abortSignal?: AbortSignal,
): Promise<LLMStreamingResult> {
  try {
    return await fn();
  } catch (error: unknown) {
    const partial = getAccumulatedText();
    if (partial.trim().length > 0) {
      console.warn(`Block ${blockNumber}: error after streaming, using partial text (${partial.length} chars)`);
      return { text: partial, usage: null };
    }

    // Handle ProxyTimeoutError — do NOT retry with the same chunk size
    if (error instanceof Error && error.name === 'ProxyTimeoutError') {
      // Throw immediately — the pipeline should handle this by reducing chunk size
      // or reporting a clear error to the user
      throw error;
    }

    if (isTransientError(error)) {
      console.warn(`Block ${blockNumber}: transient error, retrying in 5s...`);
      await abortAwareSleep(5_000, abortSignal);
      try {
        return await fn();
      } catch (retryError) {
        const partialAfterRetry = getAccumulatedText();
        if (partialAfterRetry.trim().length > 0) {
          return { text: partialAfterRetry, usage: null };
        }
        throw new Error(`LLM не ответил на блоке ${blockNumber} после повторной попытки`);
      }
    }

    throw error;
  }
}

function isTransientError(error: unknown): boolean {
  const classified = classifyLLMError(error);
  return classified.retryable && classified.type === 'transient_error';
}

function abortAwareSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}
