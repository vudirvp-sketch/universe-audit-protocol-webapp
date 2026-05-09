/**
 * Narrative Processor V2 — Adaptive Digest Threshold for Pipeline V3.
 *
 * Provides adaptive digest threshold based on model context window.
 * In v3, the pipeline sends the full concept text to each block,
 * so digest is only needed for models with very small context windows.
 *
 * NOTE: The legacy computeNarrativeDigest() and extractSkeletonKeywords()
 * from narrative-processor.ts have been removed — they relied on v2 structured
 * types that no longer exist. The v3 pipeline uses raw markdown output
 * and context-bridge.ts for context passing, not digest-based chunking.
 */

import type { ModelCapabilities } from '../llm-client';

/**
 * Адаптивный порог digest.
 * Модели с контекстом ≥128K могут вместить ~50-60K символов русского текста
 * — большинству концептов digest не нужен.
 * Модели с малым контекстом — используем существующий порог 15K.
 *
 * In v3 pipeline: Each block prompt includes the full concept text
 * plus context from previous blocks. This threshold determines whether
 * the concept text needs truncation for small-context models.
 */
export function getAdaptiveDigestThreshold(modelCaps: ModelCapabilities): number {
  const contextTokens = modelCaps.contextWindow;
  if (contextTokens >= 128_000) return 60_000;   // ~15K tokens — no digest needed
  if (contextTokens >= 32_000) return 30_000;    // ~7.5K tokens
  return 15_000;                                  // threshold for small models
}

/**
 * Check whether the concept text exceeds the adaptive threshold
 * for the given model's context window.
 */
export function shouldUseDigest(
  textLength: number,
  modelCaps: ModelCapabilities,
): boolean {
  return textLength > getAdaptiveDigestThreshold(modelCaps);
}
