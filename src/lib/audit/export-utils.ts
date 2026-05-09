/**
 * Export utilities for Universe Audit Protocol v3.
 *
 * Provides v3 block-based markdown export.
 * Legacy v2 exports are removed.
 */

import type { BlockResult } from './types-v3';

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
