/**
 * Pipeline V3 — 5-block sequential pipeline for Universe Audit Protocol v3.
 *
 * Each block = one focused LLM call. Output = free-form markdown.
 * No structured parsing. Minimal context bridge between blocks.
 */

import type {
  AuditInput,
  LLMConfig,
  StreamingCallbacksV3,
  PipelineStateV3,
  BlockResult,
  OrientationContext,
} from './types-v3';
import { BLOCK_TEMPERATURES } from './types-v3';
import { getModelCapabilities } from '../llm-client';
import type { ModelCapabilities } from '../llm-client';
import type { LLMStreamingResult } from './llm-streaming';
import { callLLMStreaming } from './llm-streaming';
import {
  buildBlock1Prompt,
  buildBlock2Prompt,
  buildBlock3Prompt,
  buildBlock4Prompt,
  buildBlock5Prompt,
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
    // Block 1: Orientation
    // ============================================================
    const block1Result = await executeBlock(
      1,
      state,
      input,
      llmConfig,
      modelCaps,
      callbacks,
      abortSignal,
      () => buildBlock1Prompt(input.text, input.mediaType),
    );
    state.block1 = block1Result;

    // Extract orientation context
    state.orientationContext = extractOrientationContext(block1Result.markdown);

    // ============================================================
    // Block 2: Mechanism (L1)
    // ============================================================
    const block2Result = await executeBlock(
      2,
      state,
      input,
      llmConfig,
      modelCaps,
      callbacks,
      abortSignal,
      () => buildBlock2Prompt(input.text, input.mediaType, state.orientationContext!, state.block1?.markdown),
    );
    state.block2 = block2Result;
    state.accumulatedWeaknesses.push(extractWeaknessesSummary(block2Result.markdown));

    // ============================================================
    // Block 3: Body + Psyche (L2+L3)
    // ============================================================
    const block3Result = await executeBlock(
      3,
      state,
      input,
      llmConfig,
      modelCaps,
      callbacks,
      abortSignal,
      () => buildBlock3Prompt(
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
    // Block 4: Meta (L4)
    // ============================================================
    const block4Result = await executeBlock(
      4,
      state,
      input,
      llmConfig,
      modelCaps,
      callbacks,
      abortSignal,
      () => buildBlock4Prompt(
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
    // Block 5: Synthesis + Recommendations
    // ============================================================
    const block5Result = await executeBlock(
      5,
      state,
      input,
      llmConfig,
      modelCaps,
      callbacks,
      abortSignal,
      () => buildBlock5Prompt(
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
// Block executor
// ============================================================

type BlockNumber = 1 | 2 | 3 | 4 | 5;

async function executeBlock(
  blockNumber: BlockNumber,
  state: PipelineStateV3,
  input: AuditInput,
  llmConfig: LLMConfig,
  modelCaps: ModelCapabilities,
  callbacks: StreamingCallbacksV3,
  abortSignal: AbortSignal | undefined,
  buildPrompt: () => { system: string; user: string },
): Promise<BlockResult> {
  state.currentBlock = blockNumber;
  callbacks.onBlockStart(blockNumber);
  const blockStart = Date.now();

  const prompt = buildPrompt();
  const maxTokens = resolveBlockMaxTokens(blockNumber, modelCaps);
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

  const blockResult: BlockResult = {
    blockNumber,
    markdown: raw || accumulatedText || '',
    weaknessesSummary: '', // Will be set by caller via extractWeaknessesSummary
    meta: {
      elapsedMs: Date.now() - blockStart,
      tokensUsed: usage,
      model: llmConfig.model,
      temperature,
      completionStatus: raw ? 'complete' : (accumulatedText ? 'partial' : 'error'),
    },
  };

  callbacks.onBlockComplete(blockNumber, blockResult);

  // Check abort
  if (abortSignal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  return blockResult;
}

// ============================================================
// Retry logic (adapted from pipeline-v2.ts)
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
