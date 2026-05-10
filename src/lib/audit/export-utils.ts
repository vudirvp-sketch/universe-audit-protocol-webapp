/**
 * Export utilities for Universe Audit Protocol v3.
 *
 * Provides v3 block-based markdown, JSON, and HTML export.
 * Legacy v2 exports are removed.
 */

import type { BlockResult, PipelineStateV3, ChecklistScoreResult } from './types-v3';

// ============================================================
// Block labels for export
// ============================================================

const BLOCK_LABELS: Record<number, string> = {
  1: 'ОРИЕНТАЦИЯ',
  2: 'МЕХАНИЗМ (L1)',
  3: 'ТЕЛО + ПСИХИКА (L2+L3)',
  4: 'МЕТА (L4)',
  5: 'СИНТЕЗ + РЕКОМЕНДАЦИИ',
};

// ============================================================
// Markdown Export (v3)
// ============================================================

/**
 * Generate a markdown report from v3 block results.
 * Concatenates all 5 block markdowns with section headers.
 */
export function exportV3ToMarkdown(blocks: (BlockResult | null)[]): string {
  const lines: string[] = [];

  lines.push('# Universe Audit Protocol — Отчёт');
  lines.push('');

  for (let i = 1; i <= 5; i++) {
    const block = blocks[i];
    const label = BLOCK_LABELS[i] || `Блок ${i}`;

    lines.push(`## Блок ${i}: ${label}`);
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

  // Footer metadata from the last available block
  const lastBlock = blocks[5] || blocks[4] || blocks[3] || blocks[2] || blocks[1];
  if (lastBlock) {
    lines.push(`Сгенерировано: ${new Date().toISOString()}`);
    if (lastBlock.meta?.model) {
      lines.push(`Модель: ${lastBlock.meta.model}`);
    }
    if (lastBlock.meta?.elapsedMs) {
      lines.push(`Время последнего блока: ${(lastBlock.meta.elapsedMs / 1000).toFixed(1)}с`);
    }
    if (lastBlock.meta?.tokensUsed) {
      lines.push(`Токены: prompt=${lastBlock.meta.tokensUsed.prompt}, completion=${lastBlock.meta.tokensUsed.completion}, total=${lastBlock.meta.tokensUsed.total}`);
    }
  }

  return lines.join('\n');
}

// ============================================================
// JSON Export (v3) — STEP 11.1
// ============================================================

/**
 * Export audit results as structured JSON.
 * Includes all block markdowns, orientation context, and checklist score.
 */
export function exportAuditJSON(
  state: PipelineStateV3,
  checklistScore: ChecklistScoreResult | null,
): string {
  return JSON.stringify({
    meta: state.meta,
    orientationContext: state.orientationContext,
    checklistScore,
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
// HTML Export (v3) — STEP 11.2
// ============================================================

/**
 * Export audit results as a printable HTML page with styled checklist table.
 */
export function exportAuditHTML(
  state: PipelineStateV3,
  checklistScore: ChecklistScoreResult | null,
): string {
  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      PASS: 'background:#dcfce7;color:#166534;padding:2px 8px;border-radius:4px;font-size:12px;',
      FAIL: 'background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:4px;font-size:12px;',
      INSUFFICIENT_DATA: 'background:#f3f4f6;color:#6b7280;padding:2px 8px;border-radius:4px;font-size:12px;',
    };
    return `<span style="${colors[status] || colors.INSUFFICIENT_DATA}">${status}</span>`;
  };

  let checklistSection = '';
  if (checklistScore) {
    const rows = checklistScore.items
      .filter(item => item.applicable)
      .map(item => `<tr>
        <td style="padding:6px;border:1px solid #e5e7eb;font-family:monospace;font-size:12px;">${item.id}</td>
        <td style="padding:6px;border:1px solid #e5e7eb;font-size:13px;">${item.text}</td>
        <td style="padding:6px;border:1px solid #e5e7eb;font-size:12px;text-align:center;">${item.level}</td>
        <td style="padding:6px;border:1px solid #e5e7eb;text-align:center;">${statusBadge(item.status)}</td>
        <td style="padding:6px;border:1px solid #e5e7eb;font-size:12px;color:#6b7280;">${item.evidence}</td>
      </tr>`)
      .join('');

    checklistSection = `
      <h2>Оценка чеклиста: ${checklistScore.fulfilled}/${checklistScore.totalApplicable} (${checklistScore.scorePercent}%)</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;font-size:12px;">ID</th>
            <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;font-size:12px;">Критерий</th>
            <th style="padding:8px;border:1px solid #e5e7eb;text-align:center;font-size:12px;">Уровень</th>
            <th style="padding:8px;border:1px solid #e5e7eb;text-align:center;font-size:12px;">Статус</th>
            <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;font-size:12px;">Доказательство</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  const blockMap: Record<number, BlockResult | null> = {
    1: state.block1,
    2: state.block2,
    3: state.block3,
    4: state.block4,
    5: state.block5,
  };
  const blockSections = [1, 2, 3, 4, 5].map(i => {
    const block = blockMap[i];
    const label = BLOCK_LABELS[i];
    const content = block?.markdown
      ? block.markdown.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      : '<em>(данные отсутствуют)</em>';
    return `<h2>Блок ${i}: ${label}</h2><div style="white-space:pre-wrap;font-size:14px;line-height:1.6;margin-bottom:24px;">${content}</div>`;
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
    table { font-size: 13px; }
  </style>
</head>
<body>
  <h1>Universe Audit Protocol — Отчёт</h1>
  ${checklistSection}
  ${blockSections}
  <p style="color:#9ca3af;font-size:12px;margin-top:32px;">Сгенерировано: ${new Date().toISOString()}</p>
</body>
</html>`;
}
