/**
 * Universe Audit Protocol v11.0
 * Audit Module Index
 *
 * Central export for all audit modules.
 * The pipeline entry point is pipeline-v2.ts (3-step LLM pipeline).
 */

// TIER 0 — Foundation (types and data)
export * from './types-v2';
export * from './protocol-data';
export * from './error-handler';
export * from './narrative-processor';

// TIER 1 — Pipeline V2 Infrastructure
export * from './pipeline-v2';
export * from './llm-streaming';
export * from './markdown-parser';
export * from './prompts-v2';
export * from './narrative-processor-v2';

// TIER 2 — Supporting utilities
export { estimateTokens, canModelHandleInput, splitIntoChunks, getRecommendedChunkCount, DEFAULT_CHUNKING_CONFIG, type ChunkingConfig, type ChunkResult } from '../chunking';
export { streamChatCompletion, enableStreamingInPayload, parseSSELines, extractDelta, type StreamingChunk, type OnChunkCallback, type StreamingConfig } from '../streaming';
export { readFileAsText, isFileSupported, getSupportedFormatsDescription, type FileInfo, type ReadResult } from '../file-reader';
