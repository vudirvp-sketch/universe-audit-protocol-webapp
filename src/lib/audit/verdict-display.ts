/**
 * Pure presentation helpers for the v16 §26.S qualitative verdict.
 *
 * No React imports — safe to use from the verdict card, the inspector drawer
 * and the export utilities (JSON / Markdown / HTML) alike.
 *
 * Bands are diagnostic descriptors, not scores (§1.4, §29). Severity is used
 * only to pick an existing `severity-*` token for colour.
 */

import type { VerdictBand, VerdictBandKey } from '@/lib/audit/types-v3';
import { t } from '@/lib/i18n/ru';

// ============================================================
// Severity → semantic token classes
// ============================================================

export type Severity = 'critical' | 'warning' | 'success' | 'neutral';

const SEVERITY_TEXT: Record<Severity, string> = {
  critical: 'text-severity-critical',
  warning: 'text-severity-warning',
  success: 'text-severity-success',
  neutral: 'text-muted-foreground',
};

const SEVERITY_CHIP: Record<Severity, string> = {
  critical: 'bg-severity-critical/10 text-severity-critical',
  warning: 'bg-severity-warning/10 text-severity-warning',
  success: 'bg-severity-success/10 text-severity-success',
  neutral: 'bg-muted text-muted-foreground',
};

/** Text colour class for a verdict severity. */
export function severityTextClass(severity: Severity): string {
  return SEVERITY_TEXT[severity];
}

/** Chip colour class for a verdict severity. */
export function severityChipClass(severity: Severity): string {
  return SEVERITY_CHIP[severity];
}

// ============================================================
// Value wording
// ============================================================

/** Normalise an LLM value word: "highly generative" / "highly-generative" → "highly_generative". */
export function normalizeVerdictValue(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/** Russian display word for a verdict value (falls back to the raw value). */
export function bandValueLabel(value: string): string {
  const key = normalizeVerdictValue(value) as keyof typeof t.verdict.values;
  return t.verdict.values[key] ?? value;
}

const BAND_SEVERITY: Record<VerdictBandKey, Record<string, Severity>> = {
  world_foundation: { weak: 'critical', developing: 'warning', coherent: 'success', strong: 'success' },
  systemic_depth: { weak: 'critical', developing: 'warning', coherent: 'success', strong: 'success' },
  human_integration: { weak: 'critical', developing: 'warning', coherent: 'success', strong: 'success' },
  experiential_integration: { weak: 'critical', developing: 'warning', coherent: 'success', strong: 'success' },
  story_capacity: { narrow: 'warning', focused: 'success', broad: 'success', highly_generative: 'success' },
  identity: { diffuse: 'critical', emerging: 'warning', distinct: 'success', highly_distinct: 'success' },
  overall_state: { fragile: 'critical', viable: 'warning', robust: 'success', unusually_generative: 'success' },
};

/** Severity for one band value (neutral when the value is unknown). */
export function bandSeverity(band: Pick<VerdictBand, 'key' | 'value'>): Severity {
  const table = BAND_SEVERITY[band.key];
  if (!table) return 'neutral';
  return table[normalizeVerdictValue(band.value)] ?? 'neutral';
}

/** Severity for the §26.S confidence word. */
export function confidenceSeverity(confidence: string | null): Severity {
  if (!confidence) return 'neutral';
  switch (normalizeVerdictValue(confidence)) {
    case 'high':
      return 'success';
    case 'mixed':
      return 'warning';
    case 'low':
      return 'critical';
    default:
      return 'neutral';
  }
}

// ============================================================
// Russian counts
// ============================================================

export type PluralForms = readonly [string, string, string];

/** Russian plural form for a count: 1 проблема / 2 проблемы / 5 проблем. */
export function pluralForm(count: number, forms: PluralForms): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

/** "3 корневых проблем" */
export function formatCount(count: number, forms: PluralForms): string {
  return `${count}\u00A0${pluralForm(count, forms)}`;
}
