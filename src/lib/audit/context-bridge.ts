/**
 * Context Bridge — minimal regex-based extraction for passing context
 * between pipeline blocks.
 *
 * Design principle: if extraction fails, use raw markdown as fallback.
 * This bridge NEVER breaks the UI. It only enriches subsequent prompts.
 */

import type { OrientationContext, ScreeningResult } from './types-v3';

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
    screeningResults: extractScreeningResults(block1Markdown),
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
    { keys: ['Гамартия', 'Хамартия', 'Hamartia'], label: 'Гамартия' },
    { keys: ['Столпы', 'Pillars'], label: 'Столпы' },
    { keys: ['Эмоциональный Двигатель', 'Эмоциональный двигатель', 'Emotional Engine'], label: 'Эмоциональный Двигатель' },
    { keys: ['Авторский Запрет', 'Запрет Автора', 'Авторский запрет', 'Author Prohibition'], label: 'Запрет Автора' },
    { keys: ['Целевой Опыт', 'Целевой опыт', 'Target Experience'], label: 'Целевой Опыт' },
    { keys: ['Центральный Вопрос', 'Центральный вопрос', 'Central Question'], label: 'Центральный Вопрос' },
  ];

  const lines: string[] = [];
  let foundAny = false;

  for (const elem of elements) {
    let found = false;
    for (const key of elem.keys) {
      // Pattern 1: "Key:" or "Key —" or "**Key**:" followed by text
      const regex1 = new RegExp(`${escapeRegex(key)}\\s*[:\\—\\-]\\s*(.+?)(?:\\n|$)`, 'i');
      const match1 = text.match(regex1);
      if (match1 && match1[1].trim().length > 0) {
        lines.push(`${elem.label}: ${match1[1].trim()}`);
        foundAny = true;
        found = true;
        break;
      }

      // Pattern 2: Table row "| **Key** | text |"
      const regex2 = new RegExp(`\\|\\s*\\*\\*${escapeRegex(key)}\\*\\*\\s*\\|\\s*(.+?)\\s*\\|`, 'i');
      const match2 = text.match(regex2);
      if (match2 && match2[1].trim().length > 0) {
        lines.push(`${elem.label}: ${match2[1].trim()}`);
        foundAny = true;
        found = true;
        break;
      }

      // Pattern 3: Bullet point "- **Key**: text"
      const regex3 = new RegExp(`[-•]\\s*\\*\\*${escapeRegex(key)}\\*\\*\\s*[:\\—\\-]?\\s*(.+?)(?:\\n|$)`, 'i');
      const match3 = text.match(regex3);
      if (match3 && match3[1].trim().length > 0) {
        lines.push(`${elem.label}: ${match3[1].trim()}`);
        foundAny = true;
        found = true;
        break;
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
 *
 * With chunked execution (F3), sub-results are concatenated with `---` separators,
 * and each chunk may have its own "РЕЗЮМЕ СЛАБЫХ МЕСТ:" section. This function
 * finds ALL such markers and aggregates their content, so no weaknesses are lost.
 *
 * If no markers are found, returns the last 500 characters of the text.
 */
export function extractWeaknessesSummary(markdown: string): string {
  const marker = 'РЕЗЮМЕ СЛАБЫХ МЕСТ:';
  const enMarker = 'WEAKNESSES SUMMARY:';

  // Collect all weakness summary sections from chunked output
  const summaries: string[] = [];

  // Find all occurrences of the RU marker
  let searchFrom = 0;
  while (searchFrom < markdown.length) {
    const idx = markdown.indexOf(marker, searchFrom);
    if (idx === -1) break;

    // Extract text from this marker to the next `---` separator or end of text
    const afterMarker = idx + marker.length;
    const nextSeparator = markdown.indexOf('\n---\n', afterMarker);
    const sectionEnd = nextSeparator !== -1 ? nextSeparator : markdown.length;
    const summaryText = markdown.slice(afterMarker, sectionEnd).trim();
    if (summaryText) {
      summaries.push(summaryText);
    }
    searchFrom = sectionEnd + 1;
  }

  // If no RU markers found, try EN markers
  if (summaries.length === 0) {
    searchFrom = 0;
    while (searchFrom < markdown.length) {
      const idx = markdown.indexOf(enMarker, searchFrom);
      if (idx === -1) break;

      const afterMarker = idx + enMarker.length;
      const nextSeparator = markdown.indexOf('\n---\n', afterMarker);
      const sectionEnd = nextSeparator !== -1 ? nextSeparator : markdown.length;
      const summaryText = markdown.slice(afterMarker, sectionEnd).trim();
      if (summaryText) {
        summaries.push(summaryText);
      }
      searchFrom = sectionEnd + 1;
    }
  }

  if (summaries.length > 0) {
    return summaries.join('\n\n');
  }

  // Final fallback: look for paragraphs with problem/weakness keywords
  const weaknessKeywords = ['слаб', 'дыр', 'проблем', 'недостат', 'отсутств', 'нарушен', 'провал', 'fail', 'weak', 'hole', 'problem'];
  const paragraphs = markdown.split(/\n\n+/);
  const weakParagraphs = paragraphs.filter(p =>
    weaknessKeywords.some(kw => p.toLowerCase().includes(kw))
  );
  if (weakParagraphs.length > 0) {
    // Return last 2-3 weak paragraphs (up to 800 chars)
    const selected = weakParagraphs.slice(-3).join('\n\n');
    return selected.length > 800 ? selected.slice(-800).trim() : selected.trim();
  }

  // Absolute fallback: last 500 characters
  return markdown.slice(-500).trim();
}

// ============================================================
// Helpers
// ============================================================

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================
// Block 1 screening results extraction (7 YES/NO checks)
// ============================================================

/**
 * Extract screening results from Block 1 quick screening section.
 * Looks for the 7 screening questions and their ДА/НЕТ answers.
 * Returns null if no screening section is found.
 */
export function extractScreeningResults(block1Markdown: string): ScreeningResult[] | null {
  const screeningQuestions = [
    { question: 'Тему мира можно сформулировать как правило', sectionRef: '§0, §1.4' },
    { question: 'Мир продолжит жить без протагониста', sectionRef: '§3, §4' },
    { question: 'Есть сцена с телесностью', sectionRef: '§1.5, §5' },
    { question: 'Ключевая черта = сила и гибель', sectionRef: '§6' },
    { question: 'Правильный выбор имеет цену', sectionRef: '§2, §16' },
    { question: 'Антагонист действует по понятной логике', sectionRef: '§6, §8' },
    { question: 'Финал нельзя переписать на хэппи-энд', sectionRef: '§16' },
  ];

  const results: ScreeningResult[] = [];
  let foundAny = false;

  for (const sq of screeningQuestions) {
    // Look for the screening section — try multiple patterns
    const keywords = sq.question.split(' ').slice(0, 3).join(' ');
    const escapedKeywords = escapeRegex(keywords);

    // Pattern 1: "1. Тему мира... → ДА/НЕТ" or "1) Тему мира... ДА/НЕТ"
    const regex = new RegExp(`\\d[.)]\\s*${escapedKeywords}[^\\n]*(?:ДА|НЕТ|YES|NO|✓|✗)`, 'i');
    const match = block1Markdown.match(regex);
    if (match) {
      const isNo = /НЕТ|NO|✗/i.test(match[0]);
      results.push({ question: sq.question, answer: !isNo, sectionRef: sq.sectionRef });
      foundAny = true;
    }
  }

  return foundAny ? results : null;
}


