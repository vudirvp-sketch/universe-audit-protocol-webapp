/**
 * Context Bridge — minimal regex-based extraction for passing context
 * between pipeline blocks.
 *
 * Aligned with UNIVERSE_AUDIT_PROTOCOL_ULTIMATE_v16:
 *   §2  audit mode          → РЕЖИМ АУДИТА: lazy | guided | material_aware
 *   §4.1/§4.2 engine +      → ДВИЖОК НАРРАТИВА / ГИПОТЕЗА АВТОРСТВА
 *   §5  11-element skeleton → section СКЕЛЕТ КОНЦЕПТА, table Элемент|Значение|Статус
 *   §5  FOUNDATION-LIMITED   token anywhere in Block 1
 *   §6  fast screen          → section БЫСТРЫЙ СКРИН, 7 numbered YES/PARTIAL/NO/UNKNOWN/N/A
 *
 * Design principle: if extraction fails, use raw markdown as fallback.
 * This bridge NEVER breaks the UI. It only enriches subsequent prompts.
 */

import type {
  AuditMode,
  FastScreenAnswer,
  FastScreenResult,
  OrientationContext,
} from './types-v3';

// ============================================================
// Block 1 → Blocks 2-5: Orientation context extraction
// ============================================================

/**
 * Extract orientation context from Block 1 markdown output.
 * Every field is null/false when not found — callers should
 * fall back to raw markdown if critical fields are missing.
 */
export function extractOrientationContext(block1Markdown: string): OrientationContext {
  const text = normalizeText(block1Markdown);

  return {
    auditMode: extractAuditMode(text),
    narrativeEngine: extractFreeTextLine(text, NARRATIVE_ENGINE_MARKERS),
    authorshipHypothesis: extractFreeTextLine(text, AUTHORSHIP_MARKERS),
    skeletonSummary: extractSkeletonSummary(text),
    foundationLimited: text.includes('FOUNDATION-LIMITED'),
    fastScreen: extractFastScreen(text),
  };
}

// ============================================================
// §2 — audit mode
// ============================================================

const AUDIT_MODE_MARKERS = ['РЕЖИМ\\s+АУДИТА', 'AUDIT\\s+MODE'];

function extractAuditMode(text: string): AuditMode | null {
  const declared = extractFreeTextLine(text, AUDIT_MODE_MARKERS);
  const fromDeclared = declared ? normalizeAuditMode(declared) : null;
  if (fromDeclared) return fromDeclared;

  // Tolerant fallback: mode word anywhere near the "audit mode" label,
  // including inline prose and bold pseudo-headings.
  const loose = text.match(
    /(?:РЕЖИМ\s+АУДИТА|AUDIT\s+MODE)[^A-Za-zА-Яа-яЁё]{0,12}(lazy|guided|material[\s_-]*aware|ленив\w*|направленн\w*|управляем\w*|мульти[\s-]*материальн\w*)/i,
  );
  if (!loose) return null;
  return normalizeAuditMode(loose[1]);
}

/** Map a raw mode token to the v16 §2 audit mode. */
function normalizeAuditMode(raw: string): AuditMode | null {
  const v = stripMd(raw).toLowerCase().replace(/[«»"']/g, ' ').trim();
  if (!v) return null;
  if (v.startsWith('lazy') || v.includes('ленив')) return 'lazy';
  if (/material[\s_-]*aware/.test(v) || (v.includes('мульти') && v.includes('материальн'))) {
    return 'material_aware';
  }
  if (v.startsWith('guided') || v.includes('направленн') || v.includes('управляем')) return 'guided';
  return null;
}

// ============================================================
// §4.1 / §4.2 — narrative engine + authorship hypothesis
// ============================================================

const NARRATIVE_ENGINE_MARKERS = ['ДВИЖОК\\s+НАРРАТИВА', 'NARRATIVE\\s+ENGINE'];
const AUTHORSHIP_MARKERS = ['ГИПОТЕЗА\\s+АВТОРСТВА', 'AUTHORSHIP\\s+HYPOTHESIS'];

/** Extract the free text after a `LABEL: value` line. */
function extractFreeTextLine(text: string, markerSources: string[]): string | null {
  for (const line of text.split('\n')) {
    const cleaned = cleanMarkerLine(line);
    if (!cleaned) continue;
    for (const marker of markerSources) {
      const match = new RegExp(`^${marker}\\s*[:：]\\s*(.*)$`, 'i').exec(cleaned);
      if (!match) continue;
      const value = stripTrailingEmphasis(match[1]);
      if (value) return value;
    }
  }
  return null;
}

// ============================================================
// §5 — world skeleton (11 elements)
// ============================================================

/** Skeleton element labels in the canonical v16 §5 order. */
const SKELETON_LABELS = [
  'Различие',
  'Ключевые давления',
  'Ключевые ограничения',
  'Ключевые возможности',
  'Столпы',
  'Исторический разлом',
  'Человеческий двигатель',
  'Культурная идентичность',
  'Центральный вопрос',
  'Целевой опыт',
  'Авторские запреты',
] as const;

const SKELETON_HEADINGS = ['СКЕЛЕТ КОНЦЕПТА', 'WORLD SKELETON', 'SKELETON'];

function extractSkeletonSummary(text: string): string | null {
  const section = extractSection(text, SKELETON_HEADINGS) ?? text;

  const rows = extractSkeletonRows(section);
  if (rows.length > 0) {
    return rows
      .map((row) => `${row.label}: ${row.value} (статус: ${row.status})`)
      .join('\n');
  }

  // Fallback: `- **Label:** value` / `Label: value` line forms.
  const lineRows = extractSkeletonLines(section);
  if (lineRows.length === 0) return null;
  return lineRows
    .map((row) =>
      row.status ? `${row.label}: ${row.value} (статус: ${row.status})` : `${row.label}: ${row.value}`,
    )
    .join('\n');
}

interface SkeletonRow {
  label: string;
  value: string;
  status?: string;
}

/** Parse the §5 markdown table (`| Элемент | Значение | Статус |`). */
function extractSkeletonRows(section: string): SkeletonRow[] {
  const found = new Map<string, SkeletonRow>();

  for (const line of section.split('\n')) {
    if (!/^\s*\|/.test(line)) continue;
    const cells = line
      .replace(/^\s*\|/, '')
      .replace(/\|\s*$/, '')
      .split('|')
      .map((cell) => stripMd(cell).trim());
    if (cells.length < 2) continue;
    // Skip the `|---|---|---|` separator row.
    if (cells.every((cell) => /^:?-{2,}:?$/.test(cell))) continue;

    const labelCell = cells[0];
    const canonical = matchSkeletonLabel(labelCell);
    if (!canonical || found.has(canonical)) continue;

    const value = cells[1].trim();
    if (!value) continue;

    found.set(canonical, {
      label: canonical,
      value,
      status: normalizeSkeletonStatus(cells[2]),
    });
  }

  return SKELETON_LABELS.filter((label) => found.has(label)).map(
    (label) => found.get(label) as SkeletonRow,
  );
}

/** Fallback for `- **Label:** value` / `Label: value` line forms. */
function extractSkeletonLines(section: string): SkeletonRow[] {
  const found = new Map<string, SkeletonRow>();

  for (const line of section.split('\n')) {
    const cleaned = cleanMarkerLine(line);
    if (!cleaned) continue;
    for (const label of SKELETON_LABELS) {
      if (found.has(label)) continue;
      const match = new RegExp(`^${label.replace(/\s+/g, '\\s+')}\\s*[:：—-]\\s*(.+)$`, 'i').exec(cleaned);
      if (!match) continue;
      const value = stripTrailingEmphasis(match[1]);
      if (!value) continue;
      const statusInValue = /^(.*?)\s*\((?:статус|status)?\s*[:—-]?\s*(explicit|derived|inferred|unknown|явно|выведено|предположено|неизвестно)\s*\)\s*$/i.exec(
        value,
      );
      found.set(label, {
        label,
        value: statusInValue ? stripTrailingEmphasis(statusInValue[1]) : value,
        status: statusInValue ? normalizeSkeletonStatus(statusInValue[2]) : undefined,
      });
    }
  }

  return SKELETON_LABELS.filter((label) => found.has(label)).map(
    (label) => found.get(label) as SkeletonRow,
  );
}

/** Match a table label cell against the canonical §5 element labels. */
function matchSkeletonLabel(cell: string): string | null {
  const normalized = cell.toLowerCase().trim();
  if (!normalized) return null;
  // Longest match first so a verbose label picks its most specific element.
  const candidates = [...SKELETON_LABELS]
    .sort((a, b) => b.length - a.length)
    .filter((label) => normalized.includes(label.toLowerCase()));
  return candidates[0] ?? null;
}

/** Map §5 status words (EN or RU) to the canonical lowercase status. */
function normalizeSkeletonStatus(raw: string | undefined): string {
  const v = stripMd(raw ?? '').toLowerCase().trim();
  if (!v) return 'unknown';
  if (v.includes('explicit') || v.includes('явно')) return 'explicit';
  if (v.includes('derived') || v.includes('выведено') || v.includes('производн')) return 'derived';
  if (v.includes('inferred') || v.includes('предположено')) return 'inferred';
  if (v.includes('unknown') || v.includes('неизвестно')) return 'unknown';
  return v;
}

// ============================================================
// §6 — fast screen (7 questions)
// ============================================================

const FAST_SCREEN_HEADINGS = ['БЫСТРЫЙ СКРИН', 'FAST SCREEN'];

const FAST_SCREEN_ANSWERS: Record<string, FastScreenAnswer> = {
  yes: 'YES',
  да: 'YES',
  y: 'YES',
  '✓': 'YES',
  '✔': 'YES',
  partial: 'PARTIAL',
  частично: 'PARTIAL',
  partly: 'PARTIAL',
  partially: 'PARTIAL',
  no: 'NO',
  нет: 'NO',
  n: 'NO',
  '✗': 'NO',
  '✘': 'NO',
  unknown: 'UNKNOWN',
  неизвестно: 'UNKNOWN',
  'n/a': 'NA',
  'n/a.': 'NA',
  na: 'NA',
  'н/п': 'NA',
  'н/д': 'NA',
  'n/d': 'NA',
  'not applicable': 'NA',
};

/**
 * Parse the §6 fast-screen section into up to 7 entries.
 * Returns null when the section is absent (answers are then simply unknown).
 */
function extractFastScreen(text: string): FastScreenResult[] | null {
  const section = extractSection(text, FAST_SCREEN_HEADINGS);
  if (section === null) return null;

  const byNumber = new Map<number, FastScreenResult>();
  for (const line of section.split('\n')) {
    const numbered = /^\s*(\d{1,2})\s*[.)]\s+(.+)$/.exec(line);
    if (!numbered) continue;
    const index = Number(numbered[1]);
    if (index < 1 || index > 7 || byNumber.has(index)) continue;

    const content = stripMd(numbered[2]).trim();
    if (!content) continue;
    const parsed = splitQuestionAnswer(content);
    byNumber.set(index, parsed);
  }

  return [...byNumber.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, result]) => result);
}

/** Split `<question> — <ANSWER>` into its parts. */
function splitQuestionAnswer(content: string): FastScreenResult {
  const match = /^(.*?)\s*(?:[—–→]|\s-\s|:)\s*([^—–→:]{1,24})$/.exec(content);
  if (match) {
    const question = stripTrailingEmphasis(match[1]);
    const answer = normalizeFastScreenAnswer(match[2]);
    if (answer && question) return { question, answer };
  }
  return {
    question: content.replace(/[\s—–→:.\-]+$/, '').trim(),
    answer: null,
  };
}

function normalizeFastScreenAnswer(raw: string): FastScreenAnswer | null {
  const key = stripMd(raw)
    .toLowerCase()
    .replace(/[()"'«»]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.,;:]+$/, '');
  return FAST_SCREEN_ANSWERS[key] ?? null;
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
  const text = normalizeText(markdown);
  const marker = 'РЕЗЮМЕ СЛАБЫХ МЕСТ:';
  const enMarker = 'WEAKNESSES SUMMARY:';

  // Collect all weakness summary sections from chunked output
  const summaries: string[] = [];

  // Find all occurrences of the RU marker
  let searchFrom = 0;
  while (searchFrom < text.length) {
    const idx = text.indexOf(marker, searchFrom);
    if (idx === -1) break;

    // Extract text from this marker to the next `---` separator or end of text
    const afterMarker = idx + marker.length;
    const nextSeparator = text.indexOf('\n---\n', afterMarker);
    const sectionEnd = nextSeparator !== -1 ? nextSeparator : text.length;
    const summaryText = text.slice(afterMarker, sectionEnd).trim();
    if (summaryText) {
      summaries.push(summaryText);
    }
    searchFrom = sectionEnd + 1;
  }

  // If no RU markers found, try EN markers
  if (summaries.length === 0) {
    searchFrom = 0;
    while (searchFrom < text.length) {
      const idx = text.indexOf(enMarker, searchFrom);
      if (idx === -1) break;

      const afterMarker = idx + enMarker.length;
      const nextSeparator = text.indexOf('\n---\n', afterMarker);
      const sectionEnd = nextSeparator !== -1 ? nextSeparator : text.length;
      const summaryText = text.slice(afterMarker, sectionEnd).trim();
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
  const paragraphs = text.split(/\n\n+/);
  const weakParagraphs = paragraphs.filter(p =>
    weaknessKeywords.some(kw => p.toLowerCase().includes(kw))
  );
  if (weakParagraphs.length > 0) {
    // Return last 2-3 weak paragraphs (up to 800 chars)
    const selected = weakParagraphs.slice(-3).join('\n\n');
    return selected.length > 800 ? selected.slice(-800).trim() : selected.trim();
  }

  // Absolute fallback: last 500 characters
  return text.slice(-500).trim();
}

// ============================================================
// Helpers
// ============================================================

const BOM = /^\uFEFF/;

/** Normalize BOM + line endings so marker matching is stable. */
function normalizeText(text: string): string {
  return (text ?? '').replace(BOM, '').replace(/\r\n?/g, '\n');
}

/** Strip bold / italic-strong / code emphasis markers. */
function stripMd(text: string): string {
  return text.replace(/\*\*|__|`/g, '');
}

/** Strip leading bullets/quotes/heading marks and all emphasis markers. */
function cleanMarkerLine(line: string): string {
  return line
    .replace(/^\s*[>\-•]+\s*/, '')
    .replace(/^#{1,6}\s*/, '')
    .replace(/^\s*[>\-•]+\s*/, '')
    .replace(/\*\*|__|`/g, '')
    .trim();
}

/** Trim a free-text value and drop trailing markdown emphasis. */
function stripTrailingEmphasis(value: string): string {
  return stripMd(value)
    .replace(/^[\s*_`"'«»]+/, '')
    .replace(/[\s*_`"'«»]+$/, '')
    .trim();
}

/**
 * Return the body of the first section whose heading starts with one of the
 * given labels. Headings may be markdown (`## …`), pseudo-headings (`**…**`)
 * or bare uppercase lines. Returns null when no heading matches.
 */
function extractSection(text: string, headingLabels: string[]): string | null {
  const lines = text.split('\n');
  let start = -1;

  for (let i = 0; i < lines.length; i++) {
    const heading = headingText(lines[i]);
    if (!heading) continue;
    if (headingLabels.some((label) => heading.startsWith(label))) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return null;

  const body: string[] = [];
  for (let i = start; i < lines.length; i++) {
    if (headingText(lines[i])) break;
    if (/^\s*---+\s*$/.test(lines[i])) break;
    body.push(lines[i]);
  }
  return body.join('\n');
}

/** Uppercase heading text for a markdown heading / bold pseudo-heading / bare caps line. */
function headingText(line: string): string | null {
  const raw = line.trim();
  if (!raw) return null;
  if (raw.startsWith('|')) return null;
  if (/^\d{1,2}\s*[.)]\s/.test(raw)) return null;

  const mdHeading = /^#{1,6}\s+(.+)$/.exec(raw);
  if (mdHeading) return cleanHeading(mdHeading[1]);

  const boldHeading = /^(?:\*\*|__)\s*(.+?)\s*(?:\*\*|__)\s*:?$/.exec(raw);
  if (boldHeading) return cleanHeading(boldHeading[1]);

  // Bare uppercase line used as a heading (e.g. "СКЕЛЕТ КОНЦЕПТА").
  const plain = stripMd(raw).replace(/[:—\-\s]+$/, '');
  if (
    plain.length > 0 &&
    plain.length <= 80 &&
    plain === plain.toUpperCase() &&
    /[А-ЯЁA-Z]/.test(plain) &&
    !/[.!?]/.test(plain)
  ) {
    return cleanHeading(raw);
  }
  return null;
}

function cleanHeading(text: string): string {
  return stripMd(text)
    .replace(/^\s*[>\-•*]+\s*/, '')
    .replace(/^\s*\d{1,2}\s*[.)]\s*/, '')
    .replace(/[:\s]+$/, '')
    .trim()
    .toUpperCase();
}
