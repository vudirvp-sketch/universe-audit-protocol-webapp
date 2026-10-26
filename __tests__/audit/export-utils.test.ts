/**
 * Tests for export-utils.ts — markdown, JSON, and HTML export (v16).
 *
 * The legacy checklist score is gone: every export carries protocol identity,
 * the qualitative verdict (§26.S), the capability frontier (§22) and the five
 * block markdowns.
 */
import { describe, it, expect } from 'vitest';
import {
  PROTOCOL_NAME,
  exportV3ToMarkdown,
  exportAuditJSON,
  exportAuditHTML,
} from '@/lib/audit/export-utils';
import type {
  AuditMaterial,
  AuditVerdict,
  BlockResult,
  GuidedContext,
  PipelineStateV3,
} from '@/lib/audit/types-v3';

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

function makeVerdict(overrides?: Partial<AuditVerdict>): AuditVerdict {
  return {
    bands: [
      { key: 'world_foundation', label: 'ВОЗМОЖНОСТИ МИРА', value: 'coherent' },
      { key: 'systemic_depth', label: 'СИСТЕМНАЯ ГЛУБИНА', value: 'developing' },
      { key: 'human_integration', label: 'ЧЕЛОВЕЧЕСКАЯ ИНТЕГРАЦИЯ', value: 'weak' },
      { key: 'experiential_integration', label: 'ОПЫТНАЯ ИНТЕГРАЦИЯ', value: 'strong' },
      { key: 'story_capacity', label: 'ЁМКОСТЬ ИСТОРИЙ', value: 'broad' },
      { key: 'identity', label: 'ИДЕНТИЧНОСТЬ', value: 'distinct' },
      { key: 'overall_state', label: 'ОБЩЕЕ СОСТОЯНИЕ', value: 'viable' },
    ],
    confidence: 'mixed',
    issues: [
      { id: 'ISSUE-01', failureClass: 'CAUSAL', diagnosis: 'Причинный разрыв', confidence: 'high' },
      { id: 'ISSUE-02', failureClass: 'HUMAN', diagnosis: 'Нет повседневности', confidence: 'medium' },
    ],
    recommendations: [
      { priority: 1, problem: 'Разрыв на мезо-уровне', interventionClass: 'CONNECTIVE' },
    ],
    frontier: {
      demonstrated: 3,
      under_proven: 2,
      latent: 1,
      new_primitive_required: 0,
      experimental: 0,
      deferred: 1,
      contradicted_or_should_not_add: 0,
    },
    closingStatement: 'Мир уже умеет быть системным и пока не умеет быть обжитым.',
    source: 'json',
    ...overrides,
  };
}

function makePipelineState(overrides?: Partial<PipelineStateV3>): PipelineStateV3 {
  return {
    phase: 'done',
    currentBlock: 5,
    block1: makeBlockResult(1, '# Контекст и скелет\n\nТекст блока 1'),
    block2: makeBlockResult(2, '# Механизм мира\n\nТекст блока 2'),
    block3: makeBlockResult(3, '# Эпистемика и человек\n\nТекст блока 3'),
    block4: makeBlockResult(4, '# Опыт, история, тема\n\nТекст блока 4'),
    block5: makeBlockResult(5, '# Корневые проблемы\n\nТекст блока 5'),
    orientationContext: null,
    accumulatedWeaknesses: [],
    verdict: makeVerdict(),
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
  it('exports protocol identity and all 5 block headers', () => {
    const md = exportV3ToMarkdown(makePipelineState());
    expect(md).toContain(`Протокол: ${PROTOCOL_NAME}`);
    expect(md).toContain('Блок 1: КОНТЕКСТ И СКЕЛЕТ');
    expect(md).toContain('Блок 2: МЕХАНИЗМ МИРА');
    expect(md).toContain('Блок 3: ЭПИСТЕМИКА И ЧЕЛОВЕК');
    expect(md).toContain('Блок 4: ОПЫТ, ИСТОРИЯ, ТЕМА');
    expect(md).toContain('Блок 5: КОРНЕВЫЕ ПРОБЛЕМЫ И РЕКОМЕНДАЦИИ');
  });

  it('includes the five block markdowns', () => {
    const md = exportV3ToMarkdown(makePipelineState());
    expect(md).toContain('Текст блока 1');
    expect(md).toContain('Текст блока 5');
  });

  it('includes the qualitative verdict bands, confidence and counts', () => {
    const md = exportV3ToMarkdown(makePipelineState());
    expect(md).toContain('Вердикт аудита');
    expect(md).toContain('| Фундамент мира | связная |');
    expect(md).toContain('| Общее состояние | жизнеспособное |');
    expect(md).toContain('Уверенность: смешанная');
    expect(md).toContain('Корневые проблемы: 2\u00A0корневые проблемы');
    expect(md).toContain('Рекомендации: 1\u00A0рекомендация');
  });

  it('includes the capability frontier and closing statement', () => {
    const md = exportV3ToMarkdown(makePipelineState());
    expect(md).toContain('Граница возможного');
    expect(md).toContain('- Доказано: 3');
    expect(md).toContain('Мир уже умеет быть системным');
  });

  it('shows placeholder for missing blocks', () => {
    const state = makePipelineState({ block2: null, block3: null });
    const md = exportV3ToMarkdown(state);
    expect(md).toContain('Текст блока 1');
    expect(md).toContain('(данные отсутствуют)');
  });

  it('marks a missing verdict instead of inventing a score', () => {
    const md = exportV3ToMarkdown(makePipelineState({ verdict: null }));
    expect(md).toContain('Вердикт не сформирован');
    expect(md).not.toMatch(/\d+\s*%/);
    expect(md).not.toMatch(/\d+\s*\/\s*52/);
  });

  it('includes footer metadata', () => {
    const md = exportV3ToMarkdown(makePipelineState());
    expect(md).toContain('Сгенерировано:');
    expect(md).toContain('Модель: test-model');
  });
});

// ============================================================
// exportAuditJSON
// ============================================================

describe('exportAuditJSON', () => {
  it('carries protocol identity with all block markdowns', () => {
    const parsed = JSON.parse(exportAuditJSON(makePipelineState()));
    expect(parsed.protocol).toBe(PROTOCOL_NAME);
    expect(parsed.blocks[1]).toBe('# Контекст и скелет\n\nТекст блока 1');
    expect(parsed.blocks[5]).toBe('# Корневые проблемы\n\nТекст блока 5');
  });

  it('carries the verdict instead of a checklist score', () => {
    const parsed = JSON.parse(exportAuditJSON(makePipelineState()));
    expect(parsed.verdict.bands).toHaveLength(7);
    expect(parsed.verdict.confidence).toBe('mixed');
    expect(parsed.verdict.issues).toHaveLength(2);
    expect(parsed.verdict.recommendations).toHaveLength(1);
    expect(parsed.verdict.frontier.demonstrated).toBe(3);
    expect(parsed.verdict.closingStatement).toContain('Мир уже умеет');
    expect(parsed.checklistScore).toBeUndefined();
    expect(parsed.score).toBeUndefined();
  });

  it('carries session meta and orientation context', () => {
    const parsed = JSON.parse(exportAuditJSON(makePipelineState()));
    expect(parsed.meta.mediaType).toBe('narrative');
    expect(parsed.orientationContext).toBeNull();
  });

  it('handles a null verdict and null blocks gracefully', () => {
    const state = makePipelineState({ block2: null, block3: null, verdict: null });
    const parsed = JSON.parse(exportAuditJSON(state));
    expect(parsed.verdict).toBeNull();
    expect(parsed.blocks[2]).toBeUndefined();
    expect(parsed.blocks[1]).toBeDefined();
  });
});

// ============================================================
// exportAuditHTML
// ============================================================

describe('exportAuditHTML', () => {
  it('produces valid HTML with the protocol and all blocks', () => {
    const html = exportAuditHTML(makePipelineState());
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain(`Протокол: ${PROTOCOL_NAME}`);
    expect(html).toContain('Блок 1: КОНТЕКСТ И СКЕЛЕТ');
    expect(html).toContain('Блок 5: КОРНЕВЫЕ ПРОБЛЕМЫ И РЕКОМЕНДАЦИИ');
  });

  it('HTML-escapes markdown content', () => {
    const state = makePipelineState({
      block1: makeBlockResult(1, 'Text with <script>alert("xss")</script> & "quotes"'),
    });
    const html = exportAuditHTML(state);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
  });

  it('renders the verdict bands and frontier', () => {
    const html = exportAuditHTML(makePipelineState());
    expect(html).toContain('Вердикт аудита');
    expect(html).toContain('Фундамент мира');
    expect(html).toContain('связная');
    expect(html).toContain('Граница возможного');
    expect(html).toContain('Мир уже умеет быть системным');
  });

  it('contains no percentage or checklist artefact', () => {
    const html = exportAuditHTML(makePipelineState());
    const withoutStyles = html
      .replace(/<style>[\s\S]*?<\/style>/g, '')
      .replace(/style="[^"]*"/g, '');
    expect(html).not.toContain('Оценка чеклиста');
    expect(html).not.toContain('scorePercent');
    expect(html).not.toMatch(/\d+\s*\/\s*52/);
    expect(withoutStyles).not.toMatch(/\d+\s*%/);
  });

  it('shows placeholder for missing blocks and a missing verdict', () => {
    const state = makePipelineState({ block3: null, verdict: null });
    const html = exportAuditHTML(state);
    expect(html).toContain('(данные отсутствуют)');
    expect(html).toContain('Вердикт не сформирован');
  });

  it('escapes verdict text coming from the model', () => {
    const state = makePipelineState({
      verdict: makeVerdict({ closingStatement: '<b>не</b> курсивный текст' }),
    });
    const html = exportAuditHTML(state);
    expect(html).not.toContain('<b>не</b>');
    expect(html).toContain('&lt;b&gt;не&lt;/b&gt;');
  });
});

// ============================================================
// Author framing — guided mode / material-aware mode (v16 §2)
// ============================================================

const GUIDED: GuidedContext = {
  genre: 'тёмное фэнтези',
  targetAudience: 'взрослые читатели',
  targetExperience: '   ', // empty values must be dropped
  nonNegotiables: 'магия требует цены',
  knownConcerns: '',
  excludedConcerns: 'религия',
};

const ARTEFACT_TEXT = 'Текст артефакта';

const MATERIALS: AuditMaterial[] = [
  { label: 'Лор-библия', text: ARTEFACT_TEXT },
  { label: '', text: 'Второй текст' },
  { label: 'Пустой', text: '   ' }, // dropped: no text
];

describe('exportAuditJSON — author framing', () => {
  it('carries guided framing only when guided fields are filled', () => {
    const parsed = JSON.parse(exportAuditJSON(makePipelineState(), { guided: GUIDED }));
    expect(parsed.input.text).toBe('test input');
    expect(parsed.input.mediaType).toBe('narrative');
    expect(parsed.input.guided.genre).toBe('тёмное фэнтези');
    expect(parsed.input.guided.excludedConcerns).toBe('религия');
    expect(parsed.input.guided.targetExperience).toBeUndefined();
    expect(parsed.input.materials).toBeUndefined();
  });

  it('carries full artefact text for materials only', () => {
    const parsed = JSON.parse(exportAuditJSON(makePipelineState(), { materials: MATERIALS }));
    expect(parsed.input.guided).toBeUndefined();
    expect(parsed.input.materials).toHaveLength(2);
    expect(parsed.input.materials[0]).toEqual({ label: 'Лор-библия', text: ARTEFACT_TEXT });
    expect(parsed.input.materials[1].label).toBe('Материал 2');
    expect(parsed.input.materials[1].text).toBe('Второй текст');
  });

  it('carries both guided framing and materials', () => {
    const parsed = JSON.parse(
      exportAuditJSON(makePipelineState(), { guided: GUIDED, materials: MATERIALS }),
    );
    expect(parsed.input.guided.genre).toBe('тёмное фэнтези');
    expect(parsed.input.materials).toHaveLength(2);
  });

  it('keeps input minimal when neither framing nor materials are supplied', () => {
    const parsed = JSON.parse(exportAuditJSON(makePipelineState(), {}));
    expect(parsed.input).toEqual({ text: 'test input', mediaType: 'narrative' });
  });

  it('omits an empty guided object', () => {
    const parsed = JSON.parse(exportAuditJSON(makePipelineState(), { guided: {} }));
    expect(parsed.input.guided).toBeUndefined();
  });
});

describe('exportV3ToMarkdown — author framing', () => {
  it('renders guided framing without an artefact section', () => {
    const md = exportV3ToMarkdown(makePipelineState(), { guided: GUIDED });
    expect(md).toContain('Рамки аудита');
    expect(md).toContain('- Жанр: тёмное фэнтези');
    expect(md).toContain('- Исключённые вопросы: религия');
    expect(md).not.toContain('Дополнительные материалы');
  });

  it('renders artefact labels with text length and never dumps artefact text', () => {
    const md = exportV3ToMarkdown(makePipelineState(), { materials: MATERIALS });
    expect(md).toContain('Дополнительные материалы');
    expect(md).toContain(`- Лор-библия — ${ARTEFACT_TEXT.length} символов`);
    expect(md).toContain('- Материал 2 — 12 символов');
    expect(md).not.toContain(ARTEFACT_TEXT);
    expect(md).not.toContain('Рамки аудита');
  });

  it('renders both sections together', () => {
    const md = exportV3ToMarkdown(makePipelineState(), { guided: GUIDED, materials: MATERIALS });
    expect(md).toContain('Рамки аудита');
    expect(md).toContain('Дополнительные материалы');
  });

  it('renders no framing section without extras', () => {
    const md = exportV3ToMarkdown(makePipelineState());
    expect(md).not.toContain('Рамки аудита');
  });
});

describe('exportAuditHTML — author framing', () => {
  it('renders and escapes guided framing and artefact labels', () => {
    const html = exportAuditHTML(makePipelineState(), {
      guided: { ...GUIDED, genre: '<i>фэнтези</i>' },
      materials: [{ label: '<b>Лор</b>', text: ARTEFACT_TEXT }],
    });
    expect(html).toContain('Рамки аудита');
    expect(html).toContain('Дополнительные материалы');
    expect(html).toContain('&lt;i&gt;фэнтези&lt;/i&gt;');
    expect(html).not.toContain('<i>фэнтези</i>');
    expect(html).toContain('&lt;b&gt;Лор&lt;/b&gt;');
    expect(html).toContain('15 символов');
    expect(html).not.toContain(ARTEFACT_TEXT);
  });

  it('renders no framing section without extras', () => {
    const html = exportAuditHTML(makePipelineState());
    expect(html).not.toContain('Рамки аудита');
  });
});
