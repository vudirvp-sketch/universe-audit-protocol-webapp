/**
 * Pipeline V3 — 5-block sequential pipeline for Universe Audit Protocol v3.
 *
 * Each block = one or more focused LLM calls (chunked for free-plan compatibility).
 * Output = free-form markdown.
 * No structured parsing. Minimal context bridge between blocks.
 *
 * v2 (F3): Blocks 2-3 are split into sub-requests (chunks) that each
 * complete within the 25s proxy timeout on Cloudflare Workers free plan.
 * Block 1, 4, 5 remain single requests.
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
import { getModelCapabilities } from '../llm-client';
import type { ModelCapabilities } from '../llm-client';
import type { LLMStreamingResult } from './llm-streaming';
import { callLLMStreaming } from './llm-streaming';
import {
  buildBlock1Prompt,
  buildBlock2SubPrompts,
  buildBlock3SubPrompts,
  buildBlock4SubPrompts,
  buildBlock5SubPrompts,
} from './prompts-v3';
import {
  extractOrientationContext,
  extractWeaknessesSummary,
} from './context-bridge';
import { classifyLLMError } from './error-handler';

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
    meta: {
      inputText: input.text,
      mediaType: input.mediaType,
      elapsedMs: 0,
      tokensUsed: { prompt: 0, completion: 0, total: 0 },
    },
    error: null,
  };

  try {
    const modelCaps = getModelCapabilities(
      llmConfig.provider as Parameters<typeof getModelCapabilities>[0],
      llmConfig.model,
    );

    // ============================================================
    // Block 1: Orientation (single request)
    // ============================================================
    const block1Result = await executeChunkedBlock(
      1,
      state,
      input,
      llmConfig,
      modelCaps,
      callbacks,
      abortSignal,
      () => [buildBlock1Prompt(input.text, input.mediaType)],
    );
    state.block1 = block1Result;

    // Extract orientation context
    state.orientationContext = extractOrientationContext(block1Result.markdown);

    // ============================================================
    // Block 2: Mechanism (L1) — chunked into 4 sub-requests
    // ============================================================
    const block2Result = await executeChunkedBlock(
      2,
      state,
      input,
      llmConfig,
      modelCaps,
      callbacks,
      abortSignal,
      () => buildBlock2SubPrompts(input.text, input.mediaType, state.orientationContext!, state.block1?.markdown),
    );
    state.block2 = block2Result;
    state.accumulatedWeaknesses.push(extractWeaknessesSummary(block2Result.markdown));

    // ============================================================
    // Block 3: Body + Psyche (L2+L3) — chunked into 2 sub-requests
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
      ),
    );
    state.block3 = block3Result;
    state.accumulatedWeaknesses.push(extractWeaknessesSummary(block3Result.markdown));

    // ============================================================
    // Block 4: Meta (L4) — single request
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
      ),
    );
    state.block4 = block4Result;
    state.accumulatedWeaknesses.push(extractWeaknessesSummary(block4Result.markdown));

    // ============================================================
    // Block 5: Synthesis + Recommendations — single request
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
      ),
    );
    state.block5 = block5Result;

    // ============================================================
    // Done
    // ============================================================
    state.meta.elapsedMs = Date.now() - pipelineStart;
    state.phase = 'done';
    return state;

  } catch (error: unknown) {
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
): Promise<BlockResult> {
  state.currentBlock = blockNumber;
  const subPrompts = buildSubPrompts();

  // Notify UI about the block starting (with total chunks for progress display)
  callbacks.onBlockStart(blockNumber, subPrompts.length > 1 ? subPrompts.length : undefined);

  const blockStart = Date.now();
  const subResults: SubBlockResult[] = [];
  let fullMarkdown = '';

  for (let i = 0; i < subPrompts.length; i++) {
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
