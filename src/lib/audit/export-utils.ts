/**
 * Export utilities for the Universe Audit Protocol (v16).
 *
 * Exports the five block markdowns, the qualitative verdict (§26.S),
 * the capability frontier (§22) and session metadata.
 * No checklist score, no percentages (§1.4, §29).
 */

import type {
  AuditMaterial,
  AuditVerdict,
  BlockResult,
  GuidedContext,
  PipelineStateV3,
} from './types-v3';
import { bandValueLabel, formatCount } from './verdict-display';
import { t } from '@/lib/i18n/ru';

/** Protocol identity carried by every export. */
export const PROTOCOL_NAME = 'UNIVERSE AUDIT PROTOCOL ULTIMATE v16';

/**
 * Author-supplied extras that are not part of PipelineStateV3.
 * They switch the audit to guided (§2) or material-aware (§2) mode.
 */
export interface AuditInputExtras {
  guided?: GuidedContext;
  materials?: AuditMaterial[];
}

// ============================================================
// Block labels for export
// ============================================================

const BLOCK_LABELS: Record<number, string> = {
  1: t.app.block1Label,
  2: t.app.block2Label,
  3: t.app.block3Label,
  4: t.app.block4Label,
  5: t.app.block5Label,
};

const FRONTIER_KEYS = [
  'demonstrated',
  'under_proven',
  'latent',
  'new_primitive_required',
  'experimental',
  'deferred',
  'contradicted_or_should_not_add',
] as const;

function blockHeading(index: number): string {
  const label = BLOCK_LABELS[index] ?? `Блок ${index}`;
  return `Блок ${index}: ${label.toUpperCase()}`;
}

// ============================================================
// Shared verdict helpers
// ============================================================

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function problemCount(verdict: AuditVerdict): string {
  return formatCount(verdict.issues.length, t.verdict.counts.problems);
}

function recommendationCount(verdict: AuditVerdict): string {
  return formatCount(verdict.recommendations.length, t.verdict.counts.recommendations);
}

// ============================================================
// Input framing (guided / material-aware) — v16 §2
// ============================================================

const GUIDED_EXPORT_FIELDS: ReadonlyArray<{ key: keyof GuidedContext; label: string }> = [
  { key: 'genre', label: t.form.guidedGenre },
  { key: 'targetAudience', label: t.form.guidedAudience },
  { key: 'targetExperience', label: t.form.guidedExperience },
  { key: 'nonNegotiables', label: t.form.guidedNonNegotiables },
  { key: 'knownConcerns', label: t.form.guidedKnownConcerns },
  { key: 'excludedConcerns', label: t.form.guidedExcludedConcerns },
];

function exportableGuided(
  guided?: GuidedContext,
): Array<{ key: keyof GuidedContext; label: string; value: string }> {
  if (!guided) return [];
  const fields: Array<{ key: keyof GuidedContext; label: string; value: string }> = [];
  for (const field of GUIDED_EXPORT_FIELDS) {
    const value = guided[field.key]?.trim();
    if (value) fields.push({ key: field.key, label: field.label, value });
  }
  return fields;
}

/**
 * Author text is user input, not report structure: a newline inside a list item
 * would start a new markdown block (fake heading, escaped list item). Fold it
 * into a single line — the exported item stays one item.
 */
function inlineMarkdownValue(value: string): string {
  return value.replace(/\s*\r?\n\s*/g, ' ').trim();
}

function exportableMaterials(materials?: AuditMaterial[]): AuditMaterial[] {
  return (materials ?? [])
    .filter((material) => material.text.trim().length > 0)
    .map((material, index) => ({
      label:
        material.label.trim() ||
        t.form.materialFallbackLabel.replace('{n}', String(index + 1)),
      text: material.text.trim(),
    }));
}

function hasFraming(extras?: AuditInputExtras): boolean {
  return (
    exportableGuided(extras?.guided).length > 0 ||
    exportableMaterials(extras?.materials).length > 0
  );
}

// ============================================================
// Markdown Export
// ============================================================

/** Short author-framing sections — guided fields and artefact labels with text length. */
function framingToMarkdown(extras?: AuditInputExtras): string[] {
  if (!hasFraming(extras)) return [];

  const guided = exportableGuided(extras?.guided);
  const materials = exportableMaterials(extras?.materials);
  const lines: string[] = [];

  if (guided.length > 0) {
    lines.push(`## ${t.report.framing}`, '');
    for (const field of guided) {
      lines.push(`- ${field.label}: ${inlineMarkdownValue(field.value)}`);
    }
    lines.push('');
  }

  if (materials.length > 0) {
    lines.push(`## ${t.report.artefacts}`, '');
    for (const material of materials) {
      lines.push(
        `- ${inlineMarkdownValue(material.label)} — ${t.report.artefactChars.replace('{count}', String(material.text.length))}`,
      );
    }
    lines.push('');
  }

  return lines;
}

/** Verdict section as markdown — bands, confidence, counts, frontier, closing statement. */
function verdictToMarkdown(verdict: AuditVerdict | null): string[] {
  const lines: string[] = [];
  lines.push(`## ${t.verdict.title}`);
  lines.push('');

  if (!verdict || verdict.bands.length === 0) {
    lines.push(`*${t.verdict.fallback}*`);
    lines.push('');
    return lines;
  }

  lines.push(`| ${t.verdict.indicator} | ${t.verdict.valueCol} |`);
  lines.push('|---|---|');
  for (const band of verdict.bands) {
    const label = t.verdict.bands[band.key] ?? band.label;
    lines.push(`| ${label} | ${bandValueLabel(band.value)} |`);
  }
  lines.push('');

  if (verdict.confidence) {
    lines.push(`${t.verdict.confidence}: ${bandValueLabel(verdict.confidence)}`);
  }
  lines.push(`${t.verdict.issues}: ${problemCount(verdict)}`);
  lines.push(`${t.verdict.recommendations}: ${recommendationCount(verdict)}`);
  lines.push('');

  if (verdict.frontier) {
    lines.push(`### ${t.verdict.frontier}`);
    lines.push('');
    for (const key of FRONTIER_KEYS) {
      lines.push(`- ${t.verdict.frontierLabels[key]}: ${verdict.frontier[key]}`);
    }
    lines.push('');
  }

  if (verdict.closingStatement) {
    // A multi-line closing statement must stay inside the quote block.
    for (const line of verdict.closingStatement.split(/\r?\n/)) {
      lines.push(`> ${line}`);
    }
    lines.push('');
  }

  return lines;
}

/**
 * Generate a markdown report: header, optional author framing, qualitative
 * verdict, then all five block markdowns and session metadata.
 */
export function exportV3ToMarkdown(
  state: PipelineStateV3,
  extras?: AuditInputExtras,
): string {
  const lines: string[] = [];

  lines.push('# Universe Audit Protocol — Отчёт');
  lines.push('');
  lines.push(`Протокол: ${PROTOCOL_NAME}`);
  lines.push('');

  lines.push(...framingToMarkdown(extras));
  lines.push(...verdictToMarkdown(state.verdict));

  const blocks: (BlockResult | null)[] = [
    null,
    state.block1,
    state.block2,
    state.block3,
    state.block4,
    state.block5,
  ];

  for (let i = 1; i <= 5; i++) {
    const block = blocks[i];

    lines.push(`## ${blockHeading(i)}`);
    lines.push('');

    if (block?.markdown) {
      lines.push(block.markdown);
    } else {
      lines.push('*(данные отсутствуют)*');
    }

    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // Footer metadata: block-level model, run-level elapsed time and token totals.
  // (Per-block tokensUsed is intentionally null — usage is aggregated in state.meta.)
  const lastBlock = state.block5 || state.block4 || state.block3 || state.block2 || state.block1;
  lines.push(`Сгенерировано: ${new Date().toISOString()}`);
  if (lastBlock?.meta?.model) {
    lines.push(`Модель: ${lastBlock.meta.model}`);
  }
  if (state.meta?.elapsedMs) {
    lines.push(`Время аудита: ${(state.meta.elapsedMs / 1000).toFixed(1)}с`);
  }
  if (state.meta?.tokensUsed && state.meta.tokensUsed.total > 0) {
    lines.push(`Токены: prompt=${state.meta.tokensUsed.prompt}, completion=${state.meta.tokensUsed.completion}, total=${state.meta.tokensUsed.total}`);
  }

  return lines.join('\n');
}

// ============================================================
// JSON Export
// ============================================================

/**
 * Export audit results as structured JSON: protocol identity, session meta,
 * author framing / artefacts (§2), orientation context, five block markdowns
 * and the qualitative verdict.
 */
export function exportAuditJSON(
  state: PipelineStateV3,
  extras?: AuditInputExtras,
): string {
  const guided = exportableGuided(extras?.guided);
  const materials = exportableMaterials(extras?.materials);
  // `meta` is only written when the pipeline finishes, but the Inspector drawer
  // allows exporting while a run is still in flight. Do not crash on it.
  const meta = state.meta ?? null;

  const input = {
    ...(meta ? { text: meta.inputText, mediaType: meta.mediaType } : {}),
    ...(guided.length > 0
      ? { guided: Object.fromEntries(guided.map((field) => [field.key, field.value])) }
      : {}),
    ...(materials.length > 0 ? { materials } : {}),
  };

  return JSON.stringify({
    protocol: PROTOCOL_NAME,
    input,
    meta,
    orientationContext: state.orientationContext,
    verdict: state.verdict,
    blocks: {
      1: state.block1?.markdown,
      2: state.block2?.markdown,
      3: state.block3?.markdown,
      4: state.block4?.markdown,
      5: state.block5?.markdown,
    },
  }, null, 2);
}

// ============================================================
// HTML Export
// ============================================================

function framingSectionHtml(extras?: AuditInputExtras): string {
  if (!hasFraming(extras)) return '';

  const guided = exportableGuided(extras?.guided);
  const materials = exportableMaterials(extras?.materials);

  const guidedItems = guided
    .map((field) => `<li><strong>${escapeHtml(field.label)}:</strong> ${escapeHtml(field.value)}</li>`)
    .join('');

  const materialItems = materials
    .map((material) =>
      `<li>${escapeHtml(material.label)} — ${escapeHtml(t.report.artefactChars.replace('{count}', String(material.text.length)))}</li>`,
    )
    .join('');

  const guidedSection = guided.length > 0
    ? `<h2>${escapeHtml(t.report.framing)}</h2><ul>${guidedItems}</ul>`
    : '';
  const materialsSection = materials.length > 0
    ? `<h2>${escapeHtml(t.report.artefacts)}</h2><ul>${materialItems}</ul>`
    : '';

  return `${guidedSection}
    ${materialsSection}`;
}

function verdictSectionHtml(verdict: AuditVerdict | null): string {
  if (!verdict || verdict.bands.length === 0) {
    return `<h2>${escapeHtml(t.verdict.title)}</h2><p><em>${escapeHtml(t.verdict.fallback)}</em></p>`;
  }

  const bandRows = verdict.bands
    .map((band) => `<tr>
        <td style="padding:6px;border:1px solid #e5e7eb;font-size:13px;">${escapeHtml(t.verdict.bands[band.key] ?? band.label)}</td>
        <td style="padding:6px;border:1px solid #e5e7eb;font-size:13px;font-weight:600;">${escapeHtml(bandValueLabel(band.value))}</td>
      </tr>`)
    .join('');

  const frontierRows = verdict.frontier
    ? `<h3>${escapeHtml(t.verdict.frontier)}</h3><ul>${FRONTIER_KEYS
        .map((key) => `<li>${escapeHtml(t.verdict.frontierLabels[key])}: ${verdict.frontier?.[key] ?? 0}</li>`)
        .join('')}</ul>`
    : '';

  const closing = verdict.closingStatement
    ? `<blockquote style="border-left:4px solid #e5e7eb;margin:16px 0;padding-left:12px;color:#374151;">${escapeHtml(verdict.closingStatement)}</blockquote>`
    : '';

  const confidence = verdict.confidence
    ? `<p style="font-size:13px;"><strong>${escapeHtml(t.verdict.confidence)}:</strong> ${escapeHtml(bandValueLabel(verdict.confidence))}</p>`
    : '';

  return `<h2>${escapeHtml(t.verdict.title)}</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
      <tbody>${bandRows}</tbody>
    </table>
    ${confidence}
    <p style="font-size:13px;">${escapeHtml(t.verdict.issues)}: ${escapeHtml(problemCount(verdict))} · ${escapeHtml(t.verdict.recommendations)}: ${escapeHtml(recommendationCount(verdict))}</p>
    ${frontierRows}
    ${closing}`;
}

/**
 * Export audit results as a printable HTML page with the author framing,
 * the qualitative verdict and the five block markdowns.
 */
export function exportAuditHTML(
  state: PipelineStateV3,
  extras?: AuditInputExtras,
): string {
  const blockMap: Record<number, BlockResult | null> = {
    1: state.block1,
    2: state.block2,
    3: state.block3,
    4: state.block4,
    5: state.block5,
  };

  const blockSections = [1, 2, 3, 4, 5].map(i => {
    const block = blockMap[i];
    const content = block?.markdown
      ? escapeHtml(block.markdown)
      : '<em>(данные отсутствуют)</em>';
    return `<h2>${escapeHtml(blockHeading(i))}</h2><div style="white-space:pre-wrap;font-size:14px;line-height:1.6;margin-bottom:24px;">${content}</div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Universe Audit Protocol — Отчёт</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 960px; margin: 0 auto; padding: 24px; color: #111827; }
    h1 { font-size: 24px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
    h2 { font-size: 18px; margin-top: 24px; color: #374151; }
    h3 { font-size: 15px; margin-top: 16px; color: #374151; }
    table { font-size: 13px; }
  </style>
</head>
<body>
  <h1>Universe Audit Protocol — Отчёт</h1>
  <p style="font-size:13px;color:#6b7280;">Протокол: ${escapeHtml(PROTOCOL_NAME)}</p>
  ${framingSectionHtml(extras)}
  ${verdictSectionHtml(state.verdict)}
  ${blockSections}
  <p style="color:#9ca3af;font-size:12px;margin-top:32px;">Сгенерировано: ${new Date().toISOString()}</p>
</body>
</html>`;
}
