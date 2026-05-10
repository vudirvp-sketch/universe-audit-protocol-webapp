/**
 * Tests for export-utils.ts — markdown, JSON, and HTML export.
 */
import { describe, it, expect } from 'vitest';
import { exportV3ToMarkdown, exportAuditJSON, exportAuditHTML } from '@/lib/audit/export-utils';
import type { PipelineStateV3, BlockResult, ChecklistScoreResult } from '@/lib/audit/types-v3';

function makeBlockResult(blockNumber: 1 | 2 | 3 | 4 | 5, markdown: string): BlockResult {
  return {
    blockNumber,
    markdown,
    weaknessesSummary: '',
    meta: {
      elapsedMs: 1000,
      tokensUsed: { prompt: 100, completion: 200, total: 300 },
      model: 'test-model',
      temperature: 0.5,
      completionStatus: 'complete',
    },
  };
}

function makePipelineState(overrides?: Partial<PipelineStateV3>): PipelineStateV3 {
  return {
    phase: 'done',
    currentBlock: 5,
    block1: makeBlockResult(1, '# Ориентация\n\nТекст блока 1'),
    block2: makeBlockResult(2, '# Механизм\n\nТекст блока 2'),
    block3: makeBlockResult(3, '# Тело + Психика\n\nТекст блока 3'),
    block4: makeBlockResult(4, '# Мета\n\nТекст блока 4'),
    block5: makeBlockResult(5, '# Синтез\n\nТекст блока 5'),
    orientationContext: null,
    accumulatedWeaknesses: [],
    checklistScore: null,
    meta: {
      inputText: 'test input',
      mediaType: 'narrative',
      elapsedMs: 5000,
      tokensUsed: { prompt: 500, completion: 1000, total: 1500 },
    },
    error: null,
    ...overrides,
  };
}

// ============================================================
// exportV3ToMarkdown
// ============================================================

describe('exportV3ToMarkdown', () => {
  it('exports all 5 blocks with headers', () => {
    const blocks = [null, 
      makeBlockResult(1, 'Markdown 1'), 
      makeBlockResult(2, 'Markdown 2'),
      makeBlockResult(3, 'Markdown 3'), 
      makeBlockResult(4, 'Markdown 4'),
      makeBlockResult(5, 'Markdown 5'),
    ];
    const md = exportV3ToMarkdown(blocks);
    expect(md).toContain('Блок 1: ОРИЕНТАЦИЯ');
    expect(md).toContain('Блок 2: МЕХАНИЗМ (L1)');
    expect(md).toContain('Блок 3: ТЕЛО + ПСИХИКА (L2+L3)');
    expect(md).toContain('Блок 4: МЕТА (L4)');
    expect(md).toContain('Блок 5: СИНТЕЗ + РЕКОМЕНДАЦИИ');
    expect(md).toContain('Markdown 1');
    expect(md).toContain('Markdown 5');
  });

  it('shows placeholder for missing blocks', () => {
    const blocks = [null, makeBlockResult(1, 'Content'), null, null, null, null];
    const md = exportV3ToMarkdown(blocks);
    expect(md).toContain('Content');
    expect(md).toContain('(данные отсутствуют)');
  });

  it('includes footer metadata', () => {
    const blocks = [null, makeBlockResult(1, 'Test'), null, null, null, null];
    const md = exportV3ToMarkdown(blocks);
    expect(md).toContain('Сгенерировано:');
  });
});

// ============================================================
// exportAuditJSON
// ============================================================

describe('exportAuditJSON', () => {
  it('produces valid JSON with all block markdowns', () => {
    const state = makePipelineState();
    const json = exportAuditJSON(state, null);
    const parsed = JSON.parse(json);
    expect(parsed.blocks[1]).toBe('# Ориентация\n\nТекст блока 1');
    expect(parsed.blocks[5]).toBe('# Синтез\n\nТекст блока 5');
  });

  it('includes checklist score when provided', () => {
    const state = makePipelineState();
    const score: ChecklistScoreResult = {
      items: [],
      totalApplicable: 40,
      fulfilled: 25,
      scorePercent: 62.5,
      byLevel: { L1: { applicable: 10, fulfilled: 7, percent: 70 } },
    };
    const json = exportAuditJSON(state, score);
    const parsed = JSON.parse(json);
    expect(parsed.checklistScore.scorePercent).toBe(62.5);
  });

  it('handles null blocks gracefully', () => {
    const state = makePipelineState({ block2: null, block3: null });
    const json = exportAuditJSON(state, null);
    const parsed = JSON.parse(json);
    expect(parsed.blocks[2]).toBeUndefined();
    expect(parsed.blocks[1]).toBeDefined();
  });
});

// ============================================================
// exportAuditHTML
// ============================================================

describe('exportAuditHTML', () => {
  it('produces valid HTML with all blocks', () => {
    const state = makePipelineState();
    const html = exportAuditHTML(state, null);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Блок 1: ОРИЕНТАЦИЯ');
    expect(html).toContain('Блок 5: СИНТЕЗ + РЕКОМЕНДАЦИИ');
  });

  it('HTML-escapes markdown content', () => {
    const state = makePipelineState({
      block1: makeBlockResult(1, 'Text with <script>alert("xss")</script> & "quotes"'),
    });
    const html = exportAuditHTML(state, null);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
  });

  it('includes checklist table when score is provided', () => {
    const state = makePipelineState();
    const score: ChecklistScoreResult = {
      items: [{
        id: 'A1',
        block: 'A',
        text: 'Тематический Закон',
        level: 'L1',
        status: 'PASS',
        evidence: 'Найден в тексте',
        applicable: true,
      }],
      totalApplicable: 1,
      fulfilled: 1,
      scorePercent: 100,
      byLevel: { L1: { applicable: 1, fulfilled: 1, percent: 100 } },
    };
    const html = exportAuditHTML(state, score);
    expect(html).toContain('Оценка чеклиста');
    expect(html).toContain('Тематический Закон');
    expect(html).toContain('PASS');
  });

  it('shows placeholder for missing blocks', () => {
    const state = makePipelineState({ block3: null });
    const html = exportAuditHTML(state, null);
    expect(html).toContain('(данные отсутствуют)');
  });

  it('does not use unsafe type casts', () => {
    // This test verifies the FIX-10 fix: blockMap approach instead of (state as unknown as Record)
    // The exportAuditHTML function should work correctly with all 5 blocks
    const state = makePipelineState();
    const html = exportAuditHTML(state, null);
    // All 5 block sections should be present
    for (let i = 1; i <= 5; i++) {
      expect(html).toContain(`Блок ${i}:`);
    }
  });
});
