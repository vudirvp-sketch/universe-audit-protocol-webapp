/**
 * Verdict extraction — UNIVERSE_AUDIT_PROTOCOL_ULTIMATE_v16 §26.S / §27.
 *
 * Block 5 appends an optional machine-readable JSON object (§27). This module
 * extracts the audit verdict from it, and falls back to the human-readable
 * `ОСНОВА МИРА: coherent` band lines of §26.S when the JSON is absent or broken.
 *
 * Hard rules:
 * - never throw on malformed LLM output;
 * - no numeric scores — only the qualitative §26.S bands and §22 frontier counts.
 */

import type {
  AuditVerdict,
  AuditVerdictIssue,
  AuditVerdictRecommendation,
  CapabilityFrontierCounts,
  VerdictBand,
  VerdictBandKey,
} from './types-v3';

// ============================================================
// §26.S — qualitative bands (fixed order, Russian labels)
// ============================================================

const BAND_SPECS: ReadonlyArray<{ key: VerdictBandKey; label: string }> = [
  { key: 'world_foundation', label: 'Фундамент мира' },
  { key: 'systemic_depth', label: 'Системная глубина' },
  { key: 'human_integration', label: 'Человеческая интеграция' },
  { key: 'experiential_integration', label: 'Опытная интеграция' },
  { key: 'story_capacity', label: 'Ёмкость историй' },
  { key: 'identity', label: 'Идентичность' },
  { key: 'overall_state', label: 'Общее состояние' },
];

/** Human-readable §26.S markers accepted by the markdown fallback. */
const MARKDOWN_BAND_MARKERS: Record<VerdictBandKey, string[]> = {
  world_foundation: ['ОСНОВА МИРА', 'WORLD FOUNDATION'],
  systemic_depth: ['СИСТЕМНАЯ ГЛУБИНА', 'SYSTEMIC DEPTH'],
  human_integration: ['ЧЕЛОВЕЧЕСКАЯ ИНТЕГРАЦИЯ', 'HUMAN INTEGRATION'],
  experiential_integration: ['ОПЫТНАЯ ИНТЕГРАЦИЯ', 'EXPERIENTIAL INTEGRATION'],
  story_capacity: ['ЁМКОСТЬ ИСТОРИЙ', 'ЕМКОСТЬ ИСТОРИЙ', 'STORY CAPACITY'],
  identity: ['ИДЕНТИЧНОСТЬ', 'IDENTITY'],
  overall_state: ['ОБЩЕЕ СОСТОЯНИЕ', 'OVERALL STATE'],
};

const CONFIDENCE_MARKERS = ['УВЕРЕННОСТЬ', 'CONFIDENCE'];

/**
 * Canonical §26.S value tokens. Used as a sanity filter when a band is recognised
 * only by its human label in prose — a table row or a protocol marker needs no
 * such guard, because the structure itself already says "this is the verdict".
 */
const BAND_VALUE_TOKENS = new Set([
  'weak', 'developing', 'coherent', 'strong',
  'narrow', 'focused', 'broad', 'highly generative',
  'diffuse', 'emerging', 'distinct', 'highly distinct',
  'fragile', 'viable', 'robust', 'unusually generative',
]);

// ============================================================
// §22 — capability frontier buckets
// ============================================================

const FRONTIER_KEYS = [
  'demonstrated',
  'under_proven',
  'latent',
  'new_primitive_required',
  'experimental',
  'deferred',
  'contradicted_or_should_not_add',
] as const;

// ============================================================
// Public API
// ============================================================

/**
 * Extract the v16 §26.S verdict from Block 5 markdown.
 * Returns null when neither a §27 JSON block nor §26.S band lines are present.
 */
export function extractAuditVerdict(block5Markdown: string): AuditVerdict | null {
  const text = normalizeText(block5Markdown);
  if (!text.trim()) return null;

  try {
    const json = findVerdictJson(text);
    if (json) {
      return buildVerdictFromJson(json, text);
    }
  } catch {
    // Malformed JSON must never break the audit — fall through to markdown.
  }

  try {
    return buildVerdictFromMarkdown(text);
  } catch {
    return null;
  }
}

// ============================================================
// JSON branch (§27)
// ============================================================

function buildVerdictFromJson(root: Record<string, unknown>, text: string): AuditVerdict {
  const finalVerdict = isPlainObject(root.final_verdict) ? root.final_verdict : {};

  const bands: VerdictBand[] = [];
  for (const spec of BAND_SPECS) {
    const raw = finalVerdict[spec.key];
    if (typeof raw !== 'string') continue;
    const value = raw.trim().toLowerCase();
    if (!value) continue;
    bands.push({ key: spec.key, label: spec.label, value });
  }

  const confidenceRaw = finalVerdict.confidence;
  const confidence =
    typeof confidenceRaw === 'string' && confidenceRaw.trim()
      ? confidenceRaw.trim().toLowerCase()
      : null;

  return {
    bands,
    confidence,
    issues: mapIssues(root.issues),
    recommendations: mapRecommendations(root.recommendations),
    frontier: mapFrontier(root.capability_frontier),
    closingStatement: extractClosingStatement(text),
    source: 'json',
  };
}

/** Locate the last §27 JSON object that carries a `final_verdict` key. */
function findVerdictJson(text: string): Record<string, unknown> | null {
  // 1. Fenced ```json blocks — the last one wins (models may echo the schema first).
  const fenceRe = /```json[ \t]*\n?([\s\S]*?)```/gi;
  const payloads: string[] = [];
  let fence: RegExpExecArray | null;
  while ((fence = fenceRe.exec(text)) !== null) {
    payloads.push(fence[1]);
  }
  for (let i = payloads.length - 1; i >= 0; i--) {
    const parsed = parseJsonCandidate(payloads[i]);
    if (parsed && isPlainObject(parsed.final_verdict)) return parsed;
  }

  // 2. Bare JSON object containing "final_verdict" (no fence).
  const markerRe = /"final_verdict"\s*:/g;
  const markerPositions: number[] = [];
  let marker: RegExpExecArray | null;
  while ((marker = markerRe.exec(text)) !== null) {
    markerPositions.push(marker.index);
  }
  for (let m = markerPositions.length - 1; m >= 0; m--) {
    const markerIdx = markerPositions[m];
    const openBraces: number[] = [];
    for (let i = markerIdx - 1; i >= 0; i--) {
      if (text[i] !== '{') continue;
      openBraces.push(i);
      if (openBraces.length >= 64) break;
    }
    for (const start of openBraces) {
      const candidate = extractBalancedObject(text, start);
      if (!candidate) continue;
      const parsed = parseJsonCandidate(candidate);
      if (parsed && isPlainObject(parsed.final_verdict)) return parsed;
    }
  }

  return null;
}

function parseJsonCandidate(payload: string): Record<string, unknown> | null {
  const trimmed = payload.trim();
  if (!trimmed) return null;

  const direct = tryJsonParse(trimmed);
  if (direct) return direct;

  // Tolerate prose, code fences or trailing commas around the object.
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  return tryJsonParse(trimmed.slice(start, end + 1));
}

function tryJsonParse(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Return the brace-balanced `{...}` substring starting at `start`, if any. */
function extractBalancedObject(text: string, start: number): string | null {
  if (text[start] !== '{') return null;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') depth++;
    else if (char === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

// ============================================================
// Markdown branch (§26.S)
// ============================================================

function buildVerdictFromMarkdown(text: string): AuditVerdict | null {
  const lines = text.split('\n');

  const bands: VerdictBand[] = [];
  for (const spec of BAND_SPECS) {
    // Both the protocol marker (ОСНОВА МИРА) and the human label
    // (Фундамент мира) name the same band — real answers use either.
    const value = findMarkdownBand(lines, MARKDOWN_BAND_MARKERS[spec.key], [spec.label]);
    if (value) bands.push({ key: spec.key, label: spec.label, value });
  }

  // No bands → this block carries no readable verdict at all.
  if (bands.length === 0) return null;

  return {
    bands,
    confidence: findMarkdownBand(lines, CONFIDENCE_MARKERS),
    issues: [],
    recommendations: [],
    frontier: null,
    closingStatement: extractClosingStatement(text),
    source: 'markdown',
  };
}

/**
 * Find one band in the markdown and normalize its value.
 *
 * Real model output is not a single canonical shape, so the same band may arrive as
 *   `ОСНОВА МИРА: coherent`
 *   `**ОСНОВА МИРА** — coherent`
 *   `### ОСНОВА МИРА: coherent`
 *   `| Фундамент мира | coherent |`
 * All four are the same fact and all four must be readable; a wrong answer here is
 * the "Вердикт не сформирован" screen over a report that does contain a verdict.
 */
function findMarkdownBand(lines: string[], markers: string[], labels: string[] = []): string | null {
  for (const line of lines) {
    // Table row: `| label | value |` — labels are the human band names here.
    const cells = splitTableRow(line);
    if (cells) {
      const key = normalizeName(cells[0]);
      if (matchesName(key, markers) || matchesName(key, labels)) {
        const value = normalizeBandValue(cells[1]);
        if (value) return value;
      }
      continue;
    }

    const cleaned = cleanMarkerLine(line);
    if (!cleaned) continue;

    for (const name of [...markers, ...labels]) {
      const match = matchSeparatedValue(cleaned, name);
      if (!match) continue;
      // A protocol marker written in capitals («ОСНОВА МИРА — …») is explicit: the
      // model is naming the band, so its value is taken as written. A label in
      // ordinary casing only counts when it carries a canonical §26.S token —
      // otherwise normal prose («Общее состояние — сложная система») would
      // fabricate a band that the model never stated.
      if (match.uppercase || BAND_VALUE_TOKENS.has(match.value)) return match.value;
    }
  }
  return null;
}

/**
 * Cells of a markdown table row, as `[label, value]`.
 * Returns null for anything that is not a table row, including the `|---|---|`
 * separator and the header row (whose first cell names no band).
 */
function splitTableRow(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) return null;

  const cells = stripMd(trimmed.replace(/^\|+/, '').replace(/\|+$/, ''))
    .split('|')
    .map(cell => cell.trim());
  if (cells.length < 2) return null;

  // The value is the first non-empty cell after the label (models leave gaps).
  const value = cells[1] || cells.slice(1).find(cell => cell.length > 0) || '';
  return [cells[0], value];
}

/** `NAME: value`, `NAME — value`, `NAME – value`, `NAME - value`. */
function matchSeparatedValue(line: string, name: string): { value: string; uppercase: boolean } | null {
  const namePattern = name.split(/\s+/).map(escapeRegExp).join('\\s+');
  const pattern = new RegExp(`^(${namePattern})\\s*(?:[:：]|[—–]|-(?=\\s))\\s*(.+)$`, 'i');
  const match = pattern.exec(line);
  if (!match) return null;
  const value = normalizeBandValue(match[2]);
  if (!value) return null;
  const written = match[1];
  return { value, uppercase: written === written.toUpperCase() && /[A-ZА-ЯЁ]/.test(written) };
}

/** Comparison form of a band name: no markdown, no case, single spaces. */
function normalizeName(raw: string): string {
  return stripMd(raw).replace(/\s+/g, ' ').trim().toLowerCase();
}

function matchesName(normalizedLine: string, names: string[]): boolean {
  return names.some(name => normalizeName(name) === normalizedLine);
}

/** Lowercase a band value, dropping prose after it and any markdown emphasis. */
function normalizeBandValue(raw: string): string | null {
  const cleaned = stripMd(raw).replace(/^[\s"'«»(]+/, '').trim();
  const head = cleaned.split(/[—–;,.(!?…]/)[0].trim();
  const value = head.toLowerCase().replace(/[.\s]+$/, '');
  if (!value) return null;
  if (!/^[a-zа-яё][a-zа-яё _-]{0,40}$/.test(value)) return null;
  return value;
}

// ============================================================
// §26.S closing statement
// ============================================================

const CLOSING_MARKERS = ['Что мир уже может', 'What the world can already do'];

/**
 * Extract the required §26.S closing paragraph:
 * "what the world can already do, what it cannot yet reliably do, and what
 * single change would most clarify that boundary."
 */
function extractClosingStatement(text: string): string | null {
  const lowerText = text.toLowerCase();
  for (const marker of CLOSING_MARKERS) {
    const idx = lowerText.indexOf(marker.toLowerCase());
    if (idx === -1) continue;

    let rest = text.slice(idx);
    // Cut at the end of the paragraph / blockquote / code fence / next heading.
    const stop = rest.search(/\n\s*\n|\n\s*#{1,6}\s|\n```/);
    if (stop !== -1) rest = rest.slice(0, stop);

    const cleaned = stripMd(rest)
      .replace(/^\s*[>\-•]+\s*/, '')
      .replace(/^[\s"'«»]+/, '')
      .replace(/[\s"'«»]+$/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned) return cleaned;
  }
  return null;
}

// ============================================================
// §27 issue / recommendation / frontier mapping
// ============================================================

function mapIssues(raw: unknown): AuditVerdictIssue[] {
  if (!Array.isArray(raw)) return [];
  const issues: AuditVerdictIssue[] = [];
  for (const item of raw) {
    if (!isPlainObject(item)) continue;
    const idRaw = item.id;
    if (typeof idRaw !== 'string' && typeof idRaw !== 'number') continue;
    const id = String(idRaw).trim();
    if (!id) continue;
    issues.push({
      id,
      failureClass: asString(item.class),
      diagnosis: asString(item.diagnosis),
      confidence: asString(item.confidence),
    });
  }
  return issues;
}

function mapRecommendations(raw: unknown): AuditVerdictRecommendation[] {
  if (!Array.isArray(raw)) return [];
  const recommendations: AuditVerdictRecommendation[] = [];
  raw.forEach((item, index) => {
    if (!isPlainObject(item)) return;
    recommendations.push({
      priority: asPriority(item.priority, index + 1),
      problem: asString(item.problem),
      interventionClass: asString(item.intervention_class),
    });
  });
  return recommendations;
}

function mapFrontier(raw: unknown): CapabilityFrontierCounts | null {
  if (!isPlainObject(raw)) return null;
  const counts = {} as CapabilityFrontierCounts;
  for (const key of FRONTIER_KEYS) {
    const bucket = raw[key];
    counts[key] = Array.isArray(bucket) ? bucket.length : 0;
  }
  return counts;
}

function asPriority(raw: unknown, fallback: number): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim() && Number.isFinite(Number(raw))) return Number(raw);
  return fallback;
}

function asString(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : '';
}

// ============================================================
// Helpers
// ============================================================

const BOM = /^\uFEFF/;

function normalizeText(text: string): string {
  return (text ?? '').replace(BOM, '').replace(/\r\n?/g, '\n');
}

function stripMd(text: string): string {
  return text.replace(/\*\*|__|`/g, '');
}

function cleanMarkerLine(line: string): string {
  return line
    .replace(/^\s*[>\-•]+\s*/, '')
    .replace(/^#{1,6}\s*/, '')
    .replace(/^\s*[>\-•]+\s*/, '')
    .replace(/\*\*|__|`/g, '')
    .trim();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
