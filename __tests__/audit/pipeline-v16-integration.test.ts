/**
 * Integration test for the v16 pipeline contract.
 *
 * Unlike pipeline-v3.test.ts (which mocks the prompt builders), this test runs the
 * REAL prompts, the REAL context bridge and the REAL verdict extractor, and only
 * fakes the LLM transport. It proves the documented contract end to end:
 *
 *   Block 1 markdown (as the prompt prescribes) → OrientationContext
 *   Block 5 markdown + §27 JSON                → AuditVerdict
 *
 * If a prompt marker and an extractor ever drift apart, this test fails.
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

import { runAuditPipelineV3 } from '@/lib/audit/pipeline-v3';
import { callLLMStreaming } from '@/lib/audit/llm-streaming';
import type { AuditInput, LLMConfig } from '@/lib/audit/types-v3';

// ============================================================
// Fake model output — written exactly in the shape the prompts ask for
// ============================================================

const BLOCK1_MARKDOWN = `## 1. Контекст и замысел

| Параметр | Значение |
|---|---|
| Жанр | городское фэнтези |

РЕЖИМ АУДИТА: lazy
ДВИЖОК НАРРАТИВА: конфликтный — борьба за контроль над торговлей памятью
ГИПОТЕЗА АВТОРСТВА: персонажи обладают поведением за пределами показанных сцен; уверенность средняя

### Скелет концепта

| Элемент | Значение | Статус |
|---|---|---|
| Различие | память можно извлекать и продавать | explicit |
| Ключевые давления | долг и утрата | derived |
| Ключевые ограничения | нельзя вернуть проданное | explicit |
| Ключевые возможности | чужая память как товар | explicit |
| Столпы | торговля памятью, город-архив, долговая зависимость | derived |
| Исторический разлом | запрет на копирование памяти | inferred |
| Человеческий двигатель | страх потерять себя | inferred |
| Культурная идентичность | культ свидетельства | unknown |
| Центральный вопрос | можно ли продать себя и остаться собой | explicit |
| Целевой опыт | неловкое узнавание | inferred |
| Авторские запреты | не показано | unknown |

### Быстрый скрин

1. Продолжается ли мир независимо от протагониста? — YES
2. Есть ли давление с последствиями? — YES
3. Меняет ли различие поведение? — PARTIAL
4. Видно ли следствие для обычной жизни? — YES
5. Оставляют ли события след в настоящем? — YES
6. Различается ли знание действующих лиц? — UNKNOWN
7. Меняет ли действие будущие возможности? — PARTIAL

ГЛУБИНА АУДИТА: полный аудит.`;

const BLOCK2_MARKDOWN = `## 7.1 Целостность пространства возможностей

Торговля памятью меняет доступные действия (EXPLICIT), но цена сделки показана слабо (DERIVED, высокая).

РЕЗЮМЕ СЛАБЫХ МЕСТ: цена памяти заявлена, но не прослежена до быта.`;

const BLOCK3_MARKDOWN = `## 8.1 Распространение информации

Слухи о подделке памяти распространяются через рынок (INFERRED, средняя).

РЕЗЮМЕ СЛАБЫХ МЕСТ: процесс сокрытия информации не показан.`;

const BLOCK4_MARKDOWN = `## 13.1 Тест человеческой поверхности

Поверхность проявления — рутина обмена и запах склада (DERIVED, средняя).

РЕЗЮМЕ СЛАБЫХ МЕСТ: сенсорное воплощение почти отсутствует.`;

const BLOCK5_ISSUES_MARKDOWN = `ISSUE-ID: ISSUE-01
Класс отказа: CAUSAL
Что устанавливает материал: память продаётся (EXPLICIT)
Что выглядит несогласованным: нет звена между продажей и потерей (DERIVED)
Почему это важно: снимает цену с центрального столпа
Уверенность: высокая
Потенциальный размах: экономика, культура, биография`;

const BLOCK5_SYNTHESIS_MARKDOWN = `## Сводный диагноз

Мир держится на одном сильном столпе — торговле памятью (DERIVED, высокая).

## 25. Приоритизация рекомендаций

ПРИОРИТЕТ 1
Проблема: ISSUE-01 — отсутствие цены потери памяти
Почему это важно: без цены столп остаётся декларацией
Класс вмешательства: CONNECTIVE
Ожидаемый причинный эффект: у сделки появляется след в быту
Компромисс: усложняет темп
Проверочный тест: сцена возврата проданной памяти

## 26.S Итоговый вердикт

ОСНОВА МИРА: coherent
СИСТЕМНАЯ ГЛУБИНА: developing
ЧЕЛОВЕЧЕСКАЯ ИНТЕГРАЦИЯ: weak
ОПЫТНАЯ ИНТЕГРАЦИЯ: developing
ЁМКОСТЬ ИСТОРИЙ: focused
ИДЕНТИЧНОСТЬ: emerging
ОБЩЕЕ СОСТОЯНИЕ: viable
УВЕРЕННОСТЬ: mixed

**Что мир уже может, чего он пока надёжно не может, и какое одно изменение яснее всего обозначит эту границу.**

\`\`\`json
{
  "final_verdict": {
    "world_foundation": "coherent",
    "systemic_depth": "developing",
    "human_integration": "weak",
    "experiential_integration": "developing",
    "story_capacity": "focused",
    "identity": "emerging",
    "overall_state": "viable",
    "confidence": "mixed"
  },
  "issues": [
    {"id": "ISSUE-01", "class": "CAUSAL", "diagnosis": "Продажа памяти не имеет цены", "confidence": "high"}
  ],
  "recommendations": [
    {"priority": 1, "problem": "Нет цены потери памяти", "intervention_class": "CONNECTIVE"}
  ],
  "capability_frontier": {
    "demonstrated": ["торговля памятью как экономика"],
    "under_proven": ["культура свидетельства"],
    "latent": ["долговая зависимость как двигатель"],
    "new_primitive_required": [],
    "experimental": [],
    "deferred": [],
    "contradicted_or_should_not_add": []
  }
}
\`\`\``;

/** Deterministic order of the 13 transport calls. */
const RESPONSES = [
  BLOCK1_MARKDOWN,          // block 1
  BLOCK2_MARKDOWN,          // block 2, chunk 1
  BLOCK2_MARKDOWN,          // chunk 2
  BLOCK2_MARKDOWN,          // chunk 3
  BLOCK2_MARKDOWN,          // chunk 4
  BLOCK3_MARKDOWN,          // block 3, chunk 1
  BLOCK3_MARKDOWN,          // chunk 2
  BLOCK3_MARKDOWN,          // chunk 3
  BLOCK4_MARKDOWN,          // block 4, chunk 1
  BLOCK4_MARKDOWN,          // chunk 2
  BLOCK4_MARKDOWN,          // chunk 3
  BLOCK5_ISSUES_MARKDOWN,   // block 5, chunk 1
  BLOCK5_SYNTHESIS_MARKDOWN,// block 5, chunk 2
];

const LLM_CONFIG: LLMConfig = {
  provider: 'google',
  apiKey: 'test-key',
  model: 'gemini-2.5-flash',
  rpmLimit: 60,
};

const INPUT: AuditInput = {
  text: 'Город, где память можно извлекать и продавать; протагонист — торговец памятью.',
  mediaType: 'narrative',
};

const callbacks = {
  onBlockStart: vi.fn(),
  onChunk: vi.fn(),
  onBlockComplete: vi.fn(),
  onError: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  let callIndex = 0;
  vi.mocked(callLLMStreaming).mockImplementation(() => {
    const markdown = RESPONSES[callIndex] ?? '';
    callIndex += 1;
    const result: LLMStreamingResult = {
      text: markdown,
      usage: { prompt: 10, completion: 10, total: 20 },
    };
    return Promise.resolve(result);
  });
});

describe('v16 pipeline contract', () => {
  it('issues 13 transport calls in the 1+4+3+3+2 layout', async () => {
    const result = await runAuditPipelineV3(INPUT, LLM_CONFIG, callbacks);

    expect(result.phase).toBe('done');
    expect(vi.mocked(callLLMStreaming)).toHaveBeenCalledTimes(13);
  });

  it('parses the Block 1 markers into the orientation context', async () => {
    const result = await runAuditPipelineV3(INPUT, LLM_CONFIG, callbacks);
    const context = result.orientationContext;

    expect(context).not.toBeNull();
    expect(context?.auditMode).toBe('lazy');
    expect(context?.foundationLimited).toBe(false);
    expect(context?.narrativeEngine).toContain('конфликтный');
    expect(context?.authorshipHypothesis).toContain('персонажи');

    const skeletonLines = (context?.skeletonSummary ?? '').split('\n').filter(Boolean);
    expect(skeletonLines).toHaveLength(11);
    expect(context?.skeletonSummary).toContain('Различие:');
    expect(context?.skeletonSummary).toContain('(статус: explicit)');

    const answers = context?.fastScreen ?? [];
    expect(answers).toHaveLength(7);
    expect(answers[0].answer).toBe('YES');
    expect(answers[2].answer).toBe('PARTIAL');
    expect(answers[5].answer).toBe('UNKNOWN');
  });

  it('feeds the extracted context and weaknesses into later prompts', async () => {
    await runAuditPipelineV3(INPUT, LLM_CONFIG, callbacks);

    const prompts = vi.mocked(callLLMStreaming).mock.calls.map(call => call[0].prompt.user);
    const laterBlocks = prompts.slice(1);

    for (const user of laterBlocks) {
      expect(user).toContain('КОНТЕКСТ ПРЕДЫДУЩЕГО ЭТАПА');
    }
    // Block 3+ must receive the Block 2 weaknesses summary.
    expect(prompts.slice(5).some(user => user.includes('цена памяти заявлена'))).toBe(true);
  });

  it('extracts the qualitative verdict from the §27 JSON block', async () => {
    const result = await runAuditPipelineV3(INPUT, LLM_CONFIG, callbacks);
    const verdict = result.verdict;

    expect(verdict).not.toBeNull();
    expect(verdict?.source).toBe('json');
    expect(verdict?.confidence).toBe('mixed');
    expect(verdict?.bands).toHaveLength(7);
    expect(verdict?.bands.map(b => b.key)).toEqual([
      'world_foundation',
      'systemic_depth',
      'human_integration',
      'experiential_integration',
      'story_capacity',
      'identity',
      'overall_state',
    ]);
    expect(verdict?.bands[0]).toMatchObject({ label: 'Фундамент мира', value: 'coherent' });
    expect(verdict?.issues).toHaveLength(1);
    expect(verdict?.issues[0]).toMatchObject({
      id: 'ISSUE-01',
      failureClass: 'CAUSAL',
      confidence: 'high',
    });
    expect(verdict?.recommendations[0]).toMatchObject({
      priority: 1,
      interventionClass: 'CONNECTIVE',
    });
    expect(verdict?.frontier).toMatchObject({
      demonstrated: 1,
      under_proven: 1,
      latent: 1,
      new_primitive_required: 0,
      contradicted_or_should_not_add: 0,
    });
    expect(verdict?.closingStatement).toContain('Что мир уже может');
  });

  it('keeps the whole report markdown free of legacy numeric scoring', async () => {
    const result = await runAuditPipelineV3(INPUT, LLM_CONFIG, callbacks);
    const report = [result.block2, result.block3, result.block4, result.block5]
      .map(block => block?.markdown ?? '')
      .join('\n');

    // The prompt must not ask the model for a checklist score any more.
    const prompts = vi.mocked(callLLMStreaming).mock.calls.map(call => call[0].prompt.user).join('\n');
    expect(prompts).not.toContain('X/52');
    expect(prompts).not.toContain('13/17');
    expect(report).not.toContain('X/52');
  });
});

describe('guided and material-aware input (v16 §2)', () => {
  const EXTENDED_INPUT: AuditInput = {
    ...INPUT,
    guided: {
      genre: 'городское фэнтези',
      nonNegotiables: 'память нельзя скопировать',
      excludedConcerns: 'вопросы религии не рассматривать',
    },
    materials: [
      { label: 'Лор-библия', text: 'Город-архив хранит долговые книги.' },
      { label: 'Карта', text: 'Районы названы по типам памяти.' },
    ],
  };

  it('injects the framing and every artefact into all 13 requests', async () => {
    const result = await runAuditPipelineV3(EXTENDED_INPUT, LLM_CONFIG, callbacks);
    expect(result.phase).toBe('done');

    const prompts = vi.mocked(callLLMStreaming).mock.calls.map(call => call[0].prompt.user);
    expect(prompts).toHaveLength(13);
    for (const user of prompts) {
      expect(user).toContain('РАМКИ АВТОРА — РЕЖИМ guided');
      expect(user).toContain('память нельзя скопировать');
      expect(user).toContain('[Артефакт 1: «Лор-библия»]');
      expect(user).toContain('[Артефакт 2: «Карта»]');
    }
  });

  it('still completes when no framing or artefacts are supplied', async () => {
    const result = await runAuditPipelineV3(INPUT, LLM_CONFIG, callbacks);
    const prompts = vi.mocked(callLLMStreaming).mock.calls.map(call => call[0].prompt.user);

    expect(result.phase).toBe('done');
    expect(prompts.some(user => user.includes('РАМКИ АВТОРА — РЕЖИМ guided'))).toBe(false);
    expect(prompts.some(user => user.includes('ДОПОЛНИТЕЛЬНЫЕ МАТЕРИАЛЫ — слои доказательств'))).toBe(false);
  });
});
