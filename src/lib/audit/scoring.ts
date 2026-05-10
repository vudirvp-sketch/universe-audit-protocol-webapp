/**
 * Scoring Module — evaluates the 52-item MASTER_CHECKLIST against audit results.
 *
 * After Block 5 completes, this module:
 * 1. Filters applicable items by media type
 * 2. Builds a scoring prompt asking the LLM to evaluate each criterion
 * 3. Parses the LLM's JSON response into a ChecklistScoreResult
 *
 * The scoring is non-blocking — if it fails, the audit still completes.
 */

import type { MediaType, ChecklistScoreResult, ChecklistScoreItem, LLMConfig } from './types-v3';
import { MASTER_CHECKLIST, type LegacyChecklistItem } from './protocol-data';
import { callLLMStreaming } from './llm-streaming';
import type { LLMStreamingResult } from './llm-streaming';

// ============================================================
// Public API
// ============================================================

/**
 * Get checklist items applicable to the given media type.
 * Uses the applicableMedia field on each item (populated from v10.0 Part VI matrix).
 */
export function getApplicableItems(mediaType: MediaType): LegacyChecklistItem[] {
  return MASTER_CHECKLIST.filter(item => {
    if (!item.applicable) return false;
    return item.applicableMedia.includes('all') || item.applicableMedia.includes(mediaType);
  });
}

/**
 * Build the scoring prompt — asks the LLM to evaluate each checklist criterion
 * against the audit results and return a JSON array of scores.
 */
export function buildScoringPrompt(
  allBlockMarkdowns: string[],
  mediaType: MediaType,
): { system: string; user: string } {
  const applicableItems = getApplicableItems(mediaType);
  const itemList = applicableItems.map(item =>
    `- ${item.id}: ${item.text} [Уровень: ${item.level}]`
  ).join('\n');

  return {
    system: 'Ты — аудитор-оценщик. Отвечай ТОЛЬКО валидным JSON массивом. Никакого другого текста.',
    user: `Оцени каждый критерий чеклиста по результатам аудита.

ТИП МЕДИА: ${mediaType}

Для каждого критерия определи статус:
- PASS: аудит прямо подтверждает выполнение с конкретными примерами
- FAIL: аудит выявил проблему или дыру
- INSUFFICIENT_DATA: критерий не упомянут или недостаточно информации

Также укажи краткую цитату из аудита как доказательство (evidence).

КРИТЕРИИ:
${itemList}

Ответь СТРОГО в формате JSON массива:
[
  {"id": "A1", "status": "PASS", "evidence": "цитата из аудита"},
  {"id": "A2", "status": "FAIL", "evidence": "цитата из аудита"},
  ...
]

АУДИТ:
${allBlockMarkdowns.join('\n\n---\n\n')}`,
  };
}

/**
 * Run the checklist scoring after all 5 blocks complete.
 * Calls the LLM with the scoring prompt and parses the JSON response.
 * Returns null on any error (non-blocking — audit still completes).
 */
export async function runChecklistScoring(
  allBlockMarkdowns: string[],
  mediaType: MediaType,
  llmConfig: LLMConfig,
  abortSignal?: AbortSignal,
): Promise<ChecklistScoreResult | null> {
  try {
    const prompt = buildScoringPrompt(allBlockMarkdowns, mediaType);
    const applicableItems = getApplicableItems(mediaType);

    const result: LLMStreamingResult = await callLLMStreaming({
      prompt,
      llmConfig,
      onChunk: () => {}, // No streaming display needed for scoring
      maxTokens: 4096,
      abortSignal,
      responseFormat: 'json',
      temperature: 0.1, // Low temperature for structured output
    });

    const rawText = typeof result === 'string' ? result : result.text;
    if (!rawText) return null;

    // Parse JSON from the response (handle markdown code blocks)
    let jsonText = rawText.trim();
    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }

    // Try to find JSON array in the text
    const arrayStart = jsonText.indexOf('[');
    const arrayEnd = jsonText.lastIndexOf(']');
    if (arrayStart === -1 || arrayEnd === -1) return null;
    jsonText = jsonText.slice(arrayStart, arrayEnd + 1);

    const parsed = JSON.parse(jsonText);
    if (!Array.isArray(parsed)) return null;

    // Build score items from parsed response + checklist metadata
    const itemMap = new Map(applicableItems.map(item => [item.id, item]));
    const scoreItems: ChecklistScoreItem[] = parsed
      .filter((entry: { id?: string }) => entry.id && itemMap.has(entry.id))
      .map((entry: { id: string; status?: string; evidence?: string }) => {
        const checklistItem = itemMap.get(entry.id)!;
        const status = normalizeStatus(entry.status);
        return {
          id: entry.id,
          block: checklistItem.block,
          text: checklistItem.text,
          level: checklistItem.level,
          status,
          evidence: entry.evidence || '',
          applicable: true,
        };
      });

    // Add items that weren't in the LLM response as INSUFFICIENT_DATA
    const scoredIds = new Set(scoreItems.map(item => item.id));
    for (const item of applicableItems) {
      if (!scoredIds.has(item.id)) {
        scoreItems.push({
          id: item.id,
          block: item.block,
          text: item.text,
          level: item.level,
          status: 'INSUFFICIENT_DATA',
          evidence: '',
          applicable: true,
        });
      }
    }

    // Calculate aggregate scores
    return calculateScoreResult(scoreItems);
  } catch (error) {
    console.warn('Checklist scoring failed (non-blocking):', error);
    return null;
  }
}

// ============================================================
// Internal helpers
// ============================================================

function normalizeStatus(status: string | undefined): 'PASS' | 'FAIL' | 'INSUFFICIENT_DATA' {
  if (!status) return 'INSUFFICIENT_DATA';
  const upper = status.toUpperCase().trim();
  if (upper === 'PASS' || upper === 'ДА' || upper === 'YES') return 'PASS';
  if (upper === 'FAIL' || upper === 'НЕТ' || upper === 'NO') return 'FAIL';
  return 'INSUFFICIENT_DATA';
}

function calculateScoreResult(items: ChecklistScoreItem[]): ChecklistScoreResult {
  const applicableItems = items.filter(item => item.applicable);
  const fulfilled = applicableItems.filter(item => item.status === 'PASS').length;
  const totalApplicable = applicableItems.length;
  const scorePercent = totalApplicable > 0 ? Math.round((fulfilled / totalApplicable) * 100) : 0;

  // Calculate per-level breakdown
  const levelMap = new Map<string, { applicable: number; fulfilled: number }>();
  for (const item of applicableItems) {
    // Normalize level: "L1/L2" -> use first level for grouping
    const level = item.level.split('/')[0];
    const current = levelMap.get(level) || { applicable: 0, fulfilled: 0 };
    current.applicable++;
    if (item.status === 'PASS') current.fulfilled++;
    levelMap.set(level, current);
  }

  const byLevel: Record<string, { applicable: number; fulfilled: number; percent: number }> = {};
  for (const [level, counts] of levelMap) {
    byLevel[level] = {
      ...counts,
      percent: counts.applicable > 0 ? Math.round((counts.fulfilled / counts.applicable) * 100) : 0,
    };
  }

  return {
    items,
    totalApplicable,
    fulfilled,
    scorePercent,
    byLevel,
  };
}
