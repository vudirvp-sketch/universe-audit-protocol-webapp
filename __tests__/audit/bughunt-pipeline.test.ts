/**
 * Regression tests for the pipeline bug-hunt fixes.
 *
 * Each test in this file fails on the pre-fix code:
 *   1. audit mode was only what the model happened to write in Block 1 —
 *      now `detectAuditMode(input)` derives it from the submission and the
 *      pipeline makes it authoritative;
 *   2. a single supplied artefact was announced with multi-artefact
 *      reconciliation rules ("несколько артефактов" that do not exist);
 *   3. `finish_reason: 'length'` (truncation) was dropped by the streaming
 *      wrapper, so `BlockMeta.completionStatus: 'partial'` was unreachable and
 *      a cut-off block was reported as complete;
 *   4. `BlockResult.weaknessesSummary` stayed '' although the type contract
 *      says it holds the extracted summary used as context by later blocks.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LLMStreamingResult } from '@/lib/audit/llm-streaming';

vi.mock('@/lib/llm-client', () => ({
  createLLMClient: vi.fn(() => ({
    chatCompletionStream: vi.fn(),
    chatCompletion: vi.fn(),
  })),
  getModelCapabilities: vi.fn(() => ({
    contextWindow: 128000,
    maxOutputTokens: 16384,
    supportsJSONMode: true,
    supportsSystemMessages: true,
  })),
  getEffectiveModelCapabilities: vi.fn(() => ({
    contextWindow: 128000,
    maxOutputTokens: 16384,
    supportsJSONMode: true,
    supportsSystemMessages: true,
  })),
}));

vi.mock('@/lib/audit/llm-streaming', () => ({
  callLLMStreaming: vi.fn(),
}));

import {
  buildBlock1Prompt,
  buildExtraContextBlock,
  buildMaterialsBlock,
  detectAuditMode,
} from '@/lib/audit/prompts-v3';
import { runAuditPipelineV3 } from '@/lib/audit/pipeline-v3';
import { callLLMStreaming } from '@/lib/audit/llm-streaming';
import type { AuditInput, BlockResult, LLMConfig } from '@/lib/audit/types-v3';

// ============================================================
// Fixtures
// ============================================================

const TEXT = 'Город, где память можно извлекать и продавать.';

const MATERIALS: AuditInput['materials'] = [
  { label: 'Лор-библия', text: 'Город-архив хранит долговые книги.' },
  { label: 'Карта', text: 'Районы названы по типам памяти.' },
];

const BLOCK1_MARKDOWN = `РЕЖИМ АУДИТА: lazy
ДВИЖОК НАРРАТИВА: конфликтный
ГИПОТЕЗА АВТОРСТВА: персонажи действуют за пределами сцен`;

const BLOCK2_MARKDOWN = `## 7.1 Целостность пространства возможностей

Цена сделки не прослежена (DERIVED, средняя).

РЕЗЮМЕ СЛАБЫХ МЕСТ: цена памяти заявлена, но не прослежена до быта.`;

const BLOCK3_MARKDOWN = `## 8.1 Распространение информации

Слухи идут через рынок (INFERRED, средняя).

РЕЗЮМЕ СЛАБЫХ МЕСТ: процесс сокрытия не показан.`;

const BLOCK4_MARKDOWN = `## 13.1 Тест человеческой поверхности

Поверхность — рутина обмена (DERIVED, средняя).

РЕЗЮМЕ СЛАБЫХ МЕСТ: сенсорное воплощение отсутствует.`;

const BLOCK5_MARKDOWN = `## 26.S Итоговый вердикт

ОСНОВА МИРА: coherent
УВЕРЕННОСТЬ: mixed.`;

const RESPONSES = [
  BLOCK1_MARKDOWN, // block 1
  BLOCK2_MARKDOWN, // block 2 ×4
  BLOCK2_MARKDOWN,
  BLOCK2_MARKDOWN,
  BLOCK2_MARKDOWN,
  BLOCK3_MARKDOWN, // block 3 ×3
  BLOCK3_MARKDOWN,
  BLOCK3_MARKDOWN,
  BLOCK4_MARKDOWN, // block 4 ×3
  BLOCK4_MARKDOWN,
  BLOCK4_MARKDOWN,
  BLOCK5_MARKDOWN, // block 5 ×2
  BLOCK5_MARKDOWN,
];

const LLM_CONFIG: LLMConfig = {
  provider: 'google',
  apiKey: 'test-key',
  model: 'gemini-2.5-flash',
  rpmLimit: 60,
};

const callbacks = {
  onBlockStart: vi.fn(),
  onChunk: vi.fn(),
  onBlockComplete: vi.fn(),
  onError: vi.fn(),
};

function mockResponses(finishReason: string | null) {
  let callIndex = 0;
  vi.mocked(callLLMStreaming).mockImplementation(() => {
    const markdown = RESPONSES[callIndex] ?? '';
    callIndex += 1;
    const result: LLMStreamingResult = {
      text: markdown,
      usage: { prompt: 10, completion: 10, total: 20 },
      finishReason,
    };
    return Promise.resolve(result);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================
// 1. Mode detection is derived from the submission, not guessed
// ============================================================

describe('detectAuditMode — mode comes from what was submitted', () => {
  it('is lazy when nothing but the concept was supplied', () => {
    expect(detectAuditMode({})).toBe('lazy');
    expect(detectAuditMode({ guided: {}, materials: [] })).toBe('lazy');
  });

  it('ignores whitespace-only guided fields and empty artefacts', () => {
    expect(detectAuditMode({ guided: { genre: '   ', knownConcerns: '\n\t' } })).toBe('lazy');
    expect(detectAuditMode({ materials: [{ label: 'Пусто', text: '   ' }] })).toBe('lazy');
  });

  it('is guided when any guided field carries text, and trims it', () => {
    expect(detectAuditMode({ guided: { genre: '  фэнтези  ' } })).toBe('guided');
    expect(detectAuditMode({ guided: { excludedConcerns: 'не трогать религию' } })).toBe('guided');
  });

  it('is not material_aware for a single artefact (protocol §2: multiple artefacts)', () => {
    expect(detectAuditMode({ materials: [MATERIALS![0]] })).toBe('lazy');
    expect(detectAuditMode({ guided: { genre: 'фэнтези' }, materials: [MATERIALS![0]] })).toBe('guided');
    // A second row without text is not an artefact.
    expect(
      detectAuditMode({ materials: [MATERIALS![0], { label: 'Пусто', text: '  ' }] }),
    ).toBe('lazy');
  });

  it('is material_aware for two artefacts with text', () => {
    expect(detectAuditMode({ materials: MATERIALS })).toBe('material_aware');
  });

  it('lets material_aware win over guided framing', () => {
    expect(detectAuditMode({ guided: { genre: 'фэнтези' }, materials: MATERIALS })).toBe('material_aware');
  });
});

describe('Block 1 prompt — the authoritative mode is stated, not re-derived', () => {
  it('tells the model the exact mode line to emit', () => {
    const extra = buildExtraContextBlock({ materials: MATERIALS });
    const prompt = buildBlock1Prompt(TEXT, 'narrative', extra, 'material_aware').user;

    expect(prompt).toContain('«РЕЖИМ АУДИТА: material_aware»');
    expect(prompt).not.toContain('Определяй по факту поданного');
  });

  it('keeps the derivation instruction when the caller has no detected mode', () => {
    const prompt = buildBlock1Prompt(TEXT, 'narrative').user;
    expect(prompt).toContain('Определяй по факту поданного');
  });
});

// ============================================================
// 2. A single artefact is not "several artefacts"
// ============================================================

describe('buildMaterialsBlock — single artefact wording', () => {
  it('does not apply multi-artefact reconciliation rules to one artefact', () => {
    const block = buildMaterialsBlock([MATERIALS![0]]);

    expect(block).toContain('[Артефакт 1: «Лор-библия»]');
    expect(block).toContain('С ЕДИНСТВЕННЫМ АРТЕФАКТОМ');
    expect(block).not.toContain('НЕСКОЛЬКИМИ АРТЕФАКТАМИ');
    expect(block).not.toContain('при расхождении источников');
    expect(block).not.toContain('режим material_aware при двух и более артефактах');
  });

  it('treats a pair of artefacts (second empty) as a single artefact', () => {
    const block = buildMaterialsBlock([MATERIALS![0], { label: 'Пусто', text: '   ' }]);
    expect(block).not.toContain('НЕСКОЛЬКИМИ АРТЕФАКТАМИ');
  });

  it('keeps the multi-artefact reconciliation rules for two artefacts', () => {
    const block = buildMaterialsBlock(MATERIALS);
    expect(block).toContain('НЕСКОЛЬКИМИ АРТЕФАКТАМИ');
    expect(block).toContain('при расхождении источников');
    expect(block).toContain('[Артефакт 2: «Карта»]');
  });
});

// ============================================================
// 3. Pipeline contract: mode, weaknessesSummary, completion status
// ============================================================

describe('runAuditPipelineV3 — mode + weaknesses + completion status', () => {
  it('makes the detected mode authoritative even when Block 1 mislabels it', async () => {
    mockResponses('stop');
    const input: AuditInput = { text: TEXT, mediaType: 'narrative', materials: MATERIALS };

    const result = await runAuditPipelineV3(input, LLM_CONFIG, callbacks);
    expect(result.phase).toBe('done');

    // Block 1 answered "РЕЖИМ АУДИТА: lazy" but two artefacts were submitted.
    expect(result.orientationContext?.auditMode).toBe('material_aware');

    const block1User = vi.mocked(callLLMStreaming).mock.calls[0][0].prompt.user;
    expect(block1User).toContain('«РЕЖИМ АУДИТА: material_aware»');
  });

  it('stores the extracted weaknesses summary on the block result', async () => {
    mockResponses('stop');
    const input: AuditInput = { text: TEXT, mediaType: 'narrative' };

    const result = await runAuditPipelineV3(input, LLM_CONFIG, callbacks);

    expect(result.block2?.weaknessesSummary).toContain('цена памяти заявлена');
    expect(result.block3?.weaknessesSummary).toContain('процесс сокрытия не показан');
    expect(result.block4?.weaknessesSummary).toContain('сенсорное воплощение отсутствует');
    expect(result.block1?.weaknessesSummary).toBe('');
  });

  it('marks a truncated block as partial instead of complete', async () => {
    mockResponses('length');
    const input: AuditInput = { text: TEXT, mediaType: 'narrative' };

    const result = await runAuditPipelineV3(input, LLM_CONFIG, callbacks);
    const blocks: (BlockResult | null)[] = [
      result.block1,
      result.block2,
      result.block3,
      result.block4,
      result.block5,
    ];

    for (const block of blocks) {
      expect(block).not.toBeNull();
      expect(block?.meta.completionStatus).toBe('partial');
    }
  });

  it('keeps complete blocks complete when the stream finished normally', async () => {
    mockResponses('stop');
    const input: AuditInput = { text: TEXT, mediaType: 'narrative' };

    const result = await runAuditPipelineV3(input, LLM_CONFIG, callbacks);
    expect(result.block1?.meta.completionStatus).toBe('complete');
    expect(result.block5?.meta.completionStatus).toBe('complete');
  });
});
