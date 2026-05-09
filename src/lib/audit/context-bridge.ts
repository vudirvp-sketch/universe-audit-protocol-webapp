/**
 * Context Bridge — minimal regex-based extraction for passing context
 * between pipeline blocks.
 *
 * Design principle: if extraction fails, use raw markdown as fallback.
 * This bridge NEVER breaks the UI. It only enriches subsequent prompts.
 */

import type { OrientationContext } from './types-v3';

// ============================================================
// Block 1 → Blocks 2-5: Orientation context extraction
// ============================================================

/**
 * Extract orientation context from Block 1 markdown output.
 * Returns null fields for anything not found — callers should
 * fall back to raw markdown if critical fields are missing.
 */
export function extractOrientationContext(block1Markdown: string): OrientationContext {
  return {
    auditMode: extractAuditMode(block1Markdown),
    authorProfileType: extractAuthorProfileType(block1Markdown),
    authorProfilePercentage: extractAuthorProfilePercentage(block1Markdown),
    skeletonSummary: extractSkeletonSummary(block1Markdown),
  };
}

/** Extract audit mode from first 1500 characters of Block 1 output */
function extractAuditMode(text: string): OrientationContext['auditMode'] {
  const head = text.slice(0, 1500);
  // Check for explicit mode declaration first
  const explicitMatch = head.match(/режим\s+аудита\s*:\s*(conflict|kishō|kisho|hybrid|конфликт|кишо|гибрид)/i);
  if (explicitMatch) {
    const raw = explicitMatch[1].toLowerCase();
    if (raw === 'конфликт' || raw === 'conflict') return 'conflict';
    if (raw === 'кишо' || raw === 'kisho' || raw === 'kishō') return 'kishō';
    if (raw === 'гибрид' || raw === 'hybrid') return 'hybrid';
  }
  // Fallback: look for standalone mode words
  if (/\bconflict\b/i.test(head)) return 'conflict';
  if (/\bkish[ōo]\b/i.test(head)) return 'kishō';
  if (/\bhybrid\b/i.test(head)) return 'hybrid';
  return null;
}

/** Extract author profile type */
function extractAuthorProfileType(text: string): OrientationContext['authorProfileType'] {
  const head = text.slice(0, 2000);
  const match = head.match(/профиль\s+автора\s*:\s*(садовник|gardener|архитектор|architect|гибрид|hybrid)/i);
  if (match) {
    const raw = match[1].toLowerCase();
    if (raw === 'садовник' || raw === 'gardener') return 'gardener';
    if (raw === 'архитектор' || raw === 'architect') return 'architect';
    if (raw === 'гибрид' || raw === 'hybrid') return 'hybrid';
  }
  return null;
}

/** Extract author profile percentage */
function extractAuthorProfilePercentage(text: string): number | null {
  const head = text.slice(0, 2000);
  const match = head.match(/профиль\s+автора\s*:\s*[^%]*?(\d+)\s*%/i);
  if (match) return parseInt(match[1], 10);
  // Fallback: any percentage near profile keywords
  const fallback = head.match(/(садовник|архитектор|гибрид|gardener|architect|hybrid)[^]*?(\d+)\s*%/i);
  if (fallback) return parseInt(fallback[2], 10);
  return null;
}

/** Extract skeleton as a short key:value summary.
 *  Looks for each of the 8 skeleton elements and captures the text
 *  after the colon until end of line or paragraph. */
function extractSkeletonSummary(text: string): string | null {
  const elements = [
    { keys: ['Тематический Закон', 'Тематический закон', 'Thematic Law'], label: 'Тематический Закон' },
    { keys: ['Корневая Травма', 'Корневая травма', 'Root Trauma'], label: 'Корневая Травма' },
    { keys: ['Хамартия', 'Hamartia'], label: 'Хамартия' },
    { keys: ['Столпы', 'Pillars'], label: 'Столпы' },
    { keys: ['Эмоциональный Двигатель', 'Эмоциональный двигатель', 'Emotional Engine'], label: 'Эмоциональный Двигатель' },
    { keys: ['Авторский Запрет', 'Авторский запрет', 'Author Prohibition'], label: 'Авторский Запрет' },
    { keys: ['Целевой Опыт', 'Целевой опыт', 'Target Experience'], label: 'Целевой Опыт' },
    { keys: ['Центральный Вопрос', 'Центральный вопрос', 'Central Question'], label: 'Центральный Вопрос' },
  ];

  const lines: string[] = [];
  let foundAny = false;

  for (const elem of elements) {
    for (const key of elem.keys) {
      // Match "Key:" or "Key —" or "**Key**:" followed by text to end of line
      const regex = new RegExp(`${escapeRegex(key)}\\s*[:\\—\\-]\\s*(.+?)(?:\\n|$)`, 'i');
      const match = text.match(regex);
      if (match && match[1].trim().length > 0) {
        lines.push(`${elem.label}: ${match[1].trim()}`);
        foundAny = true;
        break; // Found this element, move to next
      }
    }
  }

  return foundAny ? lines.join('\n') : null;
}

// ============================================================
// Blocks 2-4 → Block 5: Weaknesses summary extraction
// ============================================================

/**
 * Extract the weaknesses summary from the end of a block's markdown.
 * The prompt instructs the LLM to start this section with "РЕЗЮМЕ СЛАБЫХ МЕСТ:".
 * If not found, returns the last 500 characters of the text.
 */
export function extractWeaknessesSummary(markdown: string): string {
  const marker = 'РЕЗЮМЕ СЛАБЫХ МЕСТ:';
  const idx = markdown.lastIndexOf(marker);
  if (idx !== -1) {
    return markdown.slice(idx + marker.length).trim();
  }
  // Fallback: try English variant
  const enMarker = 'WEAKNESSES SUMMARY:';
  const enIdx = markdown.lastIndexOf(enMarker);
  if (enIdx !== -1) {
    return markdown.slice(enIdx + enMarker.length).trim();
  }
  // Final fallback: last 500 characters
  return markdown.slice(-500).trim();
}

// ============================================================
// Helpers
// ============================================================

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
