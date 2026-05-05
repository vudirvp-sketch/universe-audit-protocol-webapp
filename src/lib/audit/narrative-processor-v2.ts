/**
 * Narrative Processor V2 — Adaptive Digest Threshold for Pipeline V2.
 *
 * Добавляет адаптивный порог digest, учитывающий контекст модели.
 * Переиспользует computeNarrativeDigest() из narrative-processor.ts.
 */

import type { ModelCapabilities } from '../llm-client';
import { computeNarrativeDigest, extractSkeletonKeywords, shouldUseDigestForModel } from './narrative-processor';
import type { Skeleton } from './types-v2';

// Re-export for convenience
export { computeNarrativeDigest, shouldUseDigestForModel };

/**
 * Адаптивный порог digest.
 * Модели с контекстом ≥128K могут вместить ~50-60K символов русского текста
 * — большинству концептов digest не нужен.
 * Модели с малым контекстом — используем существующий порог 15K.
 */
export function getAdaptiveDigestThreshold(modelCaps: ModelCapabilities): number {
  const contextTokens = modelCaps.contextWindow;
  if (contextTokens >= 128_000) return 60_000;   // ~15K токенов — пускаем как есть
  if (contextTokens >= 32_000) return 30_000;    // ~7.5K токенов
  return 15_000;                                  // текущий порог для малых моделей
}

/**
 * Вычислить digest для пайплайна V2.
 * Конвертирует Skeleton в формат, совместимый с narrative-processor.
 */
export function computeDigestForV2(
  text: string,
  skeleton: Skeleton
): string {
  // Convert Skeleton to legacy format for extractSkeletonKeywords
  const legacySkeleton = {
    status: 'COMPLETE' as const,
    elements: [
      { id: 'thematic_law', name: 'thematic_law', value: skeleton.thematicLaw, status: 'complete' as const },
      { id: 'root_trauma', name: 'root_trauma', value: skeleton.rootTrauma, status: 'complete' as const },
      { id: 'hamartia', name: 'hamartia', value: skeleton.hamartia, status: 'complete' as const },
      { id: 'pillars', name: 'pillars', value: skeleton.pillars.join('; '), status: 'complete' as const },
      { id: 'emotional_engine', name: 'emotional_engine', value: skeleton.emotionalEngine, status: 'complete' as const },
      { id: 'author_prohibition', name: 'author_prohibition', value: skeleton.authorProhibition, status: 'complete' as const },
      { id: 'target_experience', name: 'target_experience', value: skeleton.targetExperience, status: 'complete' as const },
      { id: 'central_question', name: 'central_question', value: skeleton.centralQuestion, status: 'complete' as const },
    ],
    fixes: [],
  };

  const keywords = extractSkeletonKeywords(legacySkeleton);
  return computeNarrativeDigest(text, keywords);
}
