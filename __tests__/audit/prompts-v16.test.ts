/**
 * Contract tests for the v16 prompt layer (prompts-v3.ts).
 *
 * These tests do not judge prompt quality — they assert that the machine-readable
 * markers consumed by context-bridge.ts / verdict.ts are actually emitted, and that
 * the legacy v10.0 checklist vocabulary is gone.
 */
import { describe, it, expect } from 'vitest';
import {
  buildBlock1Prompt,
  buildBlock2SubPrompts,
  buildBlock3SubPrompts,
  buildBlock4SubPrompts,
  buildBlock5SubPrompts,
  buildExtraContextBlock,
  buildGuidedContextBlock,
  buildMaterialsBlock,
} from '@/lib/audit/prompts-v3';
import type { OrientationContext } from '@/lib/audit/types-v3';

const CONTEXT: OrientationContext = {
  auditMode: 'lazy',
  narrativeEngine: 'конфликтный',
  authorshipHypothesis: 'поведение персонажей не выходит за пределы показанных сцен',
  skeletonSummary: 'Различие: память можно продавать (статус: explicit)',
  foundationLimited: false,
  fastScreen: [
    { question: 'Продолжается ли мир независимо от протагониста?', answer: 'YES' },
    { question: 'Есть ли давление с последствиями?', answer: 'PARTIAL' },
  ],
};

const TEXT = 'Тестовый концепт мира, где память можно извлекать и продавать.';

function allPromptText(prompts: Array<{ system: string; user: string }>): string {
  return prompts.map(p => `${p.system}\n${p.user}`).join('\n\n');
}

describe('Block 1 — context, skeleton, fast screen', () => {
  const prompt = buildBlock1Prompt(TEXT, 'narrative');

  it('emits the machine-readable audit mode marker', () => {
    expect(prompt.user).toContain('РЕЖИМ АУДИТА:');
  });

  it('emits the narrative engine and authorship hypothesis markers', () => {
    expect(prompt.user).toContain('ДВИЖОК НАРРАТИВА:');
    expect(prompt.user).toContain('ГИПОТЕЗА АВТОРСТВА:');
  });

  it('requests the 11-row skeleton table with all extractor labels', () => {
    const labels = [
      'Различие', 'Ключевые давления', 'Ключевые ограничения', 'Ключевые возможности',
      'Столпы', 'Исторический разлом', 'Человеческий двигатель', 'Культурная идентичность',
      'Центральный вопрос', 'Целевой опыт', 'Авторские запреты',
    ];
    expect(prompt.user.toLowerCase()).toContain('скелет концепта');
    for (const label of labels) {
      expect(prompt.user).toContain(label);
    }
    expect(prompt.user).toContain('| Элемент | Значение | Статус |');
  });

  it('declares FOUNDATION-LIMITED and the five answer tokens', () => {
    expect(prompt.user).toContain('FOUNDATION-LIMITED');
    for (const token of ['YES', 'PARTIAL', 'NO', 'UNKNOWN', 'N/A']) {
      expect(prompt.user).toContain(token);
    }
    expect(prompt.user).toContain('БЫСТРЫЙ СКРИН');
  });

  it('keeps the seven v16 fast-screen questions', () => {
    const numbered = prompt.user.split('\n').filter(line => /^\d+\.\s/.test(line));
    expect(numbered.length).toBeGreaterThanOrEqual(7);
  });

  it('carries the v16 language lock and no-chain-of-thought rule', () => {
    expect(prompt.system).toContain('ЯЗЫК ОТЧЁТА');
    expect(prompt.system).toContain('приватную цепочку рассуждений');
    expect(prompt.system).toContain('EXPLICIT');
    expect(prompt.system).toContain('HYPOTHESIS');
  });

  it('forbids false precision instead of prescribing numeric thresholds', () => {
    expect(prompt.system).toContain('Никакой ложной точности');
    expect(prompt.system).toContain('Произвольные пороги');
  });
});

describe('Block 2 — world mechanism', () => {
  const prompts = buildBlock2SubPrompts(TEXT, 'game', CONTEXT, 'raw block 1');

  it('is split into four focused requests', () => {
    expect(prompts).toHaveLength(4);
  });

  it('covers every level 1 operation 7.1-7.12 across the chunks', () => {
    const text = allPromptText(prompts);
    for (const marker of [
      '7.1', '7.2', '7.3', '7.4', '7.5', '7.6',
      '7.7', '7.8', '7.9', '7.10', '7.11', '7.12',
    ]) {
      expect(text).toContain(`## ${marker}`);
    }
  });

  it('includes the selective diagnostic operator kit', () => {
    const text = allPromptText(prompts);
    expect(text).toContain('УДАЛЕНИЕ');
    expect(text).toContain('ВОЗМУЩЕНИЕ');
    expect(text).toContain('применяй выборочно');
  });

  it('injects the previous-stage context and the weaknesses tail', () => {
    for (const prompt of prompts) {
      expect(prompt.user).toContain('КОНТЕКСТ ПРЕДЫДУЩЕГО ЭТАПА');
      expect(prompt.user).toContain('РЕЗЮМЕ СЛАБЫХ МЕСТ:');
    }
  });
});

describe('Block 3 — epistemic, human, cultural, character, psyche', () => {
  const prompts = buildBlock3SubPrompts(TEXT, 'visual', CONTEXT, 'block 2 weaknesses', 'raw block 1');

  it('is split into three focused requests', () => {
    expect(prompts).toHaveLength(3);
  });

  it('covers levels 1B, 1C, 1D, 2 and 3', () => {
    const text = allPromptText(prompts);
    for (const marker of ['8.1', '8.2', '8.3', '9.1', '9.2', '9.3', '10.1', '10.4', '11.2', '12.2']) {
      expect(text).toContain(`## ${marker}`);
    }
  });

  it('does not force grief as the default psychological engine', () => {
    expect(allPromptText(prompts)).toContain('Не предполагай, что двигатель — горе');
  });
});

describe('Block 4 — experience, story, theme, medium, memorability', () => {
  const prompts = buildBlock4SubPrompts(TEXT, 'ttrpg', CONTEXT, 'w2', 'w3', 'raw block 1');

  it('is split into three focused requests', () => {
    expect(prompts).toHaveLength(3);
  });

  it('covers levels 4-8', () => {
    const text = allPromptText(prompts);
    for (const marker of ['13.1', '13.4', '14.0', '15.1', '15.6', '17.1']) {
      expect(text).toContain(`## ${marker}`);
    }
    expect(text).toContain('Уровень 7');
    expect(text).toContain('Уровень 8');
  });

  it('carries the medium-specific frame for the requested media type', () => {
    expect(allPromptText(prompts)).toContain('настольная RPG');
  });
});

describe('Block 5 — risk classes, recommendations, frontier, verdict', () => {
  const prompts = buildBlock5SubPrompts(TEXT, 'narrative', CONTEXT, 'w2', 'w3', 'w4', 'raw block 1', false);

  it('is split into two requests', () => {
    expect(prompts).toHaveLength(2);
  });

  it('classifies failures with the v16 failure-class taxonomy', () => {
    const text = allPromptText(prompts);
    expect(text).toContain('ISSUE-ID');
    for (const code of ['CAUSAL', 'MOTIVATION', 'RESOURCE', 'INSTITUTIONAL', 'EXPERIENTIAL']) {
      expect(text).toContain(code);
    }
  });

  it('requires the JSON block with the verdict, issues, recommendations and frontier', () => {
    const text = allPromptText(prompts);
    expect(text).toContain('"final_verdict"');
    expect(text).toContain('"capability_frontier"');
    expect(text).toContain('"intervention_class"');
    expect(text).toContain('world_foundation');
    expect(text).toContain('overall_state');
  });

  it('caps recommendations at five and forbids double-counting', () => {
    const text = allPromptText(prompts);
    expect(text).toContain('не более 5');
    expect(text).toContain('Не считай одно и то же дважды');
  });

  it('includes the patch strength classes', () => {
    const text = allPromptText(prompts);
    for (const cls of ['LOCAL', 'CONNECTIVE', 'STRUCTURAL', 'EXPERIMENTAL']) {
      expect(text).toContain(cls);
    }
  });

  it('omits the reference-calibration section unless requested', () => {
    expect(allPromptText(prompts)).not.toContain('Калибровка по референсам');

    const withReferences = buildBlock5SubPrompts(
      TEXT, 'narrative', CONTEXT, 'w2', 'w3', 'w4', 'raw block 1', true,
    );
    expect(allPromptText(withReferences)).toContain('Калибровка по референсам');
  });
});

describe('guided framing and material-aware artefacts (v16 §2)', () => {
  const GUIDED = {
    genre: 'тёмное фэнтези',
    targetAudience: 'взрослые читатели',
    targetExperience: 'неловкое узнавание',
    nonNegotiables: 'магия всегда имеет цену',
    knownConcerns: 'экономика описана слабо',
    excludedConcerns: 'вопросы религии не рассматривать',
  };
  const MATERIALS = [
    { label: 'Дизайн-документ', text: 'Документ об экономике памяти.' },
    { label: 'Карта', text: 'Карта города-архива.' },
  ];

  it('renders all six guided fields with their Russian labels', () => {
    const block = buildGuidedContextBlock(GUIDED);
    expect(block).toContain('РАМКИ АВТОРА');
    expect(block).toContain('тёмное фэнтези');
    expect(block).toContain('Целевая аудитория: взрослые читатели');
    expect(block).toContain('Непреложные элементы');
    expect(block).toContain('Исключённые вопросы');
    expect(block).toContain('не снижают причинный стандарт');
  });

  it('omits empty guided fields and empty artefacts', () => {
    expect(buildGuidedContextBlock({})).toBe('');
    expect(buildGuidedContextBlock(undefined)).toBe('');
    expect(buildGuidedContextBlock({ genre: '   ' })).toBe('');
    expect(buildMaterialsBlock([])).toBe('');
    expect(buildMaterialsBlock([{ label: 'Пусто', text: '   ' }])).toBe('');
    expect(buildExtraContextBlock({})).toBe('');
  });

  it('renders numbered artefacts with their labels and disagreement rules', () => {
    const block = buildMaterialsBlock(MATERIALS);
    expect(block).toContain('[Артефакт 1: «Дизайн-документ»]');
    expect(block).toContain('[Артефакт 2: «Карта»]');
    expect(block).toContain('Документ об экономике памяти.');
    expect(block).toContain('зафиксируй расхождение');
  });

  it('injects framing and artefacts into every block', () => {
    const extra = buildExtraContextBlock({ guided: GUIDED, materials: MATERIALS });
    const prompts = [
      buildBlock1Prompt(TEXT, 'narrative', extra),
      ...buildBlock2SubPrompts(TEXT, 'narrative', CONTEXT, undefined, extra),
      ...buildBlock3SubPrompts(TEXT, 'narrative', CONTEXT, 'w2', undefined, extra),
      ...buildBlock4SubPrompts(TEXT, 'narrative', CONTEXT, 'w2', 'w3', undefined, extra),
      ...buildBlock5SubPrompts(TEXT, 'narrative', CONTEXT, 'w2', 'w3', 'w4', undefined, false, extra),
    ];

    for (const prompt of prompts) {
      expect(prompt.user).toContain('РАМКИ АВТОРА — РЕЖИМ guided');
      expect(prompt.user).toContain('[Артефакт 2: «Карта»]');
    }

    // Block 1 must derive the mode from what was actually supplied.
    const block1 = buildBlock1Prompt(TEXT, 'narrative', extra).user;
    expect(block1).toContain('ДОПОЛНИТЕЛЬНЫЕ МАТЕРИАЛЫ — слои доказательств');
    expect(block1).toContain('material_aware');
  });

  it('keeps lazy-mode prompts unchanged when nothing extra is supplied', () => {
    const lazy = buildBlock1Prompt(TEXT, 'narrative');
    expect(lazy.user).not.toContain('РАМКИ АВТОРА — РЕЖИМ guided');
    expect(lazy.user).not.toContain('ДОПОЛНИТЕЛЬНЫЕ МАТЕРИАЛЫ — слои доказательств');
    expect(lazy.user).toContain('РЕЖИМ АУДИТА');
  });
});

describe('legacy v10.0 vocabulary is removed', () => {
  const text = allPromptText([
    buildBlock1Prompt(TEXT, 'narrative'),
    ...buildBlock2SubPrompts(TEXT, 'narrative', CONTEXT),
    ...buildBlock3SubPrompts(TEXT, 'narrative', CONTEXT, 'w2'),
    ...buildBlock4SubPrompts(TEXT, 'narrative', CONTEXT, 'w2', 'w3'),
    ...buildBlock5SubPrompts(TEXT, 'narrative', CONTEXT, 'w2', 'w3', 'w4'),
  ]);

  it('no numeric checklist scores or vitality thresholds', () => {
    expect(text).not.toContain('13/17');
    expect(text).not.toContain('X/52');
    expect(text).not.toContain('17 критериев');
    expect(text).not.toContain('Мэри Сью');
    expect(text).not.toContain('MDA+OT');
  });

  it('no forced author-profile verdict', () => {
    expect(text).not.toContain('Профиль автора:');
    expect(text).not.toContain('CONFLICT / KISHŌ / Гибрид');
  });
});
