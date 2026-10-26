/**
 * Tests for context-bridge.ts — Block 1 extraction, aligned with
 * UNIVERSE_AUDIT_PROTOCOL_ULTIMATE_v16 (§2, §4.1/§4.2, §5, §6).
 *
 * This is a critical suite: regex extraction is fragile and directly affects
 * pipeline correctness — if extraction fails, subsequent blocks receive
 * degraded context.
 */
import { describe, it, expect } from 'vitest';
import { extractOrientationContext, extractWeaknessesSummary } from '@/lib/audit/context-bridge';

// ============================================================
// Fixtures
// ============================================================

const SKELETON_TABLE = `| Элемент | Значение | Статус |
|---|---|---|
| Различие | Город, где память можно продать | explicit |
| Ключевые давления | Долг памяти растёт сам | derived |
| Ключевые ограничения | Забыть нельзя по желанию | explicit |
| Ключевые возможности | Обмен воспоминаниями | inferred |
| Столпы | Биржа памяти, Гильдия архивистов, Ритуал возврата | explicit |
| Исторический разлом | Великая амнезия | derived |
| Человеческий двигатель | Страх потерять себя | inferred |
| Культурная идентичность | Культ свидетелей | inferred |
| Центральный вопрос | Кем ты становишься, отдав память? | explicit |
| Целевой опыт | Тревога и узнавание | derived |
| Авторские запреты | Никаких счастливых сбросов памяти | explicit |`;

const FAST_SCREEN = `## БЫСТРЫЙ СКРИН

1. Мир продолжает жить без протагониста — YES
2. Есть давление с последствиями — PARTIAL
3. Различие меняет поведение — ДА
4. Есть обыденное следствие — ЧАСТИЧНО
5. События оставляют осадок — НЕТ
6. Акторы знают разное — НЕИЗВЕСТНО
7. Действие меняет будущее — Н/П`;

const BLOCK_1 = `\uFEFF# ОРИЕНТАЦИЯ

**РЕЖИМ АУДИТА:** guided

**ДВИЖОК НАРРАТИВА:** investigation / revelation-driven**

**ГИПОТЕЗА АВТОРСТВА:** персонажи ведут себя за пределами показанных сцен; мир сопротивляется удобным исходам

## СКЕЛЕТ КОНЦЕПТА

${SKELETON_TABLE}

${FAST_SCREEN}

FOUNDATION-LIMITED: в материалах нет описания обыденной жизни.
`;

// ============================================================
// extractOrientationContext — audit mode (§2)
// ============================================================

describe('extractOrientationContext — auditMode', () => {
  it('extracts all fields from a well-formed v16 Block 1', () => {
    const ctx = extractOrientationContext(BLOCK_1);

    expect(ctx.auditMode).toBe('guided');
    expect(ctx.narrativeEngine).toBe('investigation / revelation-driven');
    expect(ctx.authorshipHypothesis).toContain('персонажи ведут себя за пределами показанных сцен');
    expect(ctx.skeletonSummary).not.toBeNull();
    expect(ctx.fastScreen).not.toBeNull();
    expect(ctx.fastScreen).toHaveLength(7);
    expect(ctx.foundationLimited).toBe(true);
  });

  it.each([
    ['lazy', 'РЕЖИМ АУДИТА: lazy'],
    ['guided', 'РЕЖИМ АУДИТА: guided'],
    ['material_aware', 'РЕЖИМ АУДИТА: material_aware'],
    ['material_aware', 'РЕЖИМ АУДИТА: material-aware'],
    ['lazy', '**РЕЖИМ АУДИТА:** ленивый'],
    ['guided', '**РЕЖИМ АУДИТА:** направленный'],
    ['guided', '**РЕЖИМ АУДИТА:** управляемый'],
    ['material_aware', 'РЕЖИМ АУДИТА: мультиматериальный'],
    ['material_aware', 'РЕЖИМ АУДИТА: мульти-материальный'],
  ])('maps %s from "%s"', (expected, line) => {
    const ctx = extractOrientationContext(`# ОРИЕНТАЦИЯ\n\n${line}\n`);
    expect(ctx.auditMode).toBe(expected);
  });

  it('is case-insensitive for the mode value', () => {
    expect(extractOrientationContext('Режим аудита: LAZY').auditMode).toBe('lazy');
    expect(extractOrientationContext('Режим Аудита: Guided').auditMode).toBe('guided');
  });

  it('supports a heading-style marker line', () => {
    const ctx = extractOrientationContext('### РЕЖИМ АУДИТА: material-aware');
    expect(ctx.auditMode).toBe('material_aware');
  });

  it('falls back to an inline declaration near the mode label', () => {
    const ctx = extractOrientationContext('Режим аудита — guided, так как автор задал рамки.');
    expect(ctx.auditMode).toBe('guided');
  });

  it('returns null when no mode is stated', () => {
    expect(extractOrientationContext('Просто текст без режима.').auditMode).toBeNull();
  });

  it('does not invent a mode from unrelated prose', () => {
    expect(extractOrientationContext('Мир ленивый и сонный, но это не режим.').auditMode).toBeNull();
  });
});

// ============================================================
// extractOrientationContext — narrative engine / authorship (§4)
// ============================================================

describe('extractOrientationContext — engine and authorship', () => {
  it('extracts and trims the narrative engine', () => {
    const ctx = extractOrientationContext('ДВИЖОК НАРРАТИВА:   survival / pressure-driven   ');
    expect(ctx.narrativeEngine).toBe('survival / pressure-driven');
  });

  it('strips trailing markdown emphasis from the engine', () => {
    const ctx = extractOrientationContext('**ДВИЖОК НАРРАТИВА:** transformation-driven**');
    expect(ctx.narrativeEngine).toBe('transformation-driven');
  });

  it('extracts the authorship hypothesis as free text', () => {
    const ctx = extractOrientationContext(
      'ГИПОТЕЗА АВТОРСТВА: исходы зависят от решений персонажей, а не только от авторской последовательности',
    );
    expect(ctx.authorshipHypothesis).toBe(
      'исходы зависят от решений персонажей, а не только от авторской последовательности',
    );
  });

  it('returns null for missing engine / authorship lines', () => {
    const ctx = extractOrientationContext('## Скрининг\n\n1. Вопрос — YES');
    expect(ctx.narrativeEngine).toBeNull();
    expect(ctx.authorshipHypothesis).toBeNull();
  });
});

// ============================================================
// extractOrientationContext — skeleton (§5)
// ============================================================

describe('extractOrientationContext — skeleton', () => {
  it('parses 11 table rows into labelled summary lines with statuses', () => {
    const ctx = extractOrientationContext(BLOCK_1);
    const lines = (ctx.skeletonSummary ?? '').split('\n');

    expect(lines).toHaveLength(11);
    expect(lines[0]).toBe('Различие: Город, где память можно продать (статус: explicit)');
    expect(lines[1]).toBe('Ключевые давления: Долг памяти растёт сам (статус: derived)');
    expect(ctx.skeletonSummary).toContain('Авторские запреты: Никаких счастливых сбросов памяти (статус: explicit)');
  });

  it('keeps the canonical §5 element order regardless of row order', () => {
    const table = `| Элемент | Значение | Статус |
|---|---|---|
| Столпы | Тишина | explicit |
| Различие | Город без звука | explicit |`;
    const ctx = extractOrientationContext(`## СКЕЛЕТ КОНЦЕПТА\n\n${table}`);
    const lines = (ctx.skeletonSummary ?? '').split('\n');
    expect(lines[0].startsWith('Различие:')).toBe(true);
    expect(lines[1].startsWith('Столпы:')).toBe(true);
  });

  it('maps Russian status words', () => {
    const table = `| Элемент | Значение | Статус |
|---|---|---|
| Различие | Город без звука | явно |
| Ключевые давления | Долг | выведено |
| Столпы | Тишина | предположено |
| Центральный вопрос | Кто слышит? | неизвестно |`;
    const ctx = extractOrientationContext(`### СКЕЛЕТ КОНЦЕПТА\n\n${table}`);
    expect(ctx.skeletonSummary).toContain('(статус: explicit)');
    expect(ctx.skeletonSummary).toContain('(статус: derived)');
    expect(ctx.skeletonSummary).toContain('(статус: inferred)');
    expect(ctx.skeletonSummary).toContain('(статус: unknown)');
  });

  it('tolerates bold labels and bold pseudo-headings', () => {
    const table = `| **Элемент** | **Значение** | **Статус** |
|---|---|---|
| **Различие** | **Город без звука** | **explicit** |`;
    const ctx = extractOrientationContext(`**СКЕЛЕТ КОНЦЕПТА**\n\n${table}`);
    expect(ctx.skeletonSummary).toBe('Различие: Город без звука (статус: explicit)');
  });

  it('falls back to bullet line forms when the table is missing', () => {
    const markdown = `## СКЕЛЕТ КОНЦЕПТА

- **Различие:** Город без звука
- **Столпы:** Тишина, Ритуал памяти
`;
    const ctx = extractOrientationContext(markdown);
    expect(ctx.skeletonSummary).toBe('Различие: Город без звука\nСтолпы: Тишина, Ритуал памяти');
  });

  it('falls back to plain line forms and reads trailing status parentheses', () => {
    const markdown = `## СКЕЛЕТ КОНЦЕПТА

Ключевые давления: Долг памяти (explicit)
Центральный вопрос: Кем ты становишься? (выведено)
`;
    const ctx = extractOrientationContext(markdown);
    expect(ctx.skeletonSummary).toContain('Ключевые давления: Долг памяти (статус: explicit)');
    expect(ctx.skeletonSummary).toContain('Центральный вопрос: Кем ты становишься? (статус: derived)');
  });

  it('parses a table even when the section heading is missing', () => {
    const ctx = extractOrientationContext(SKELETON_TABLE);
    expect(ctx.skeletonSummary).not.toBeNull();
    expect(ctx.skeletonSummary).toContain('Различие:');
  });

  it('returns null when no skeleton data exists', () => {
    expect(extractOrientationContext('Только текст, без скелета.').skeletonSummary).toBeNull();
  });
});

// ============================================================
// extractOrientationContext — fast screen (§6)
// ============================================================

describe('extractOrientationContext — fast screen', () => {
  it('parses 7 answers including Russian synonyms', () => {
    const ctx = extractOrientationContext(BLOCK_1);
    expect(ctx.fastScreen?.map((entry) => entry.answer)).toEqual([
      'YES',
      'PARTIAL',
      'YES',
      'PARTIAL',
      'NO',
      'UNKNOWN',
      'NA',
    ]);
    expect(ctx.fastScreen?.[0].question).toBe('Мир продолжает жить без протагониста');
  });

  it.each([
    ['YES', '1. Вопрос — YES'],
    ['PARTIAL', '1. Вопрос — partial'],
    ['NO', '1. Вопрос — NO'],
    ['UNKNOWN', '1. Вопрос — unknown'],
    ['NA', '1. Вопрос — N/A'],
    ['NA', '1. Вопрос — Н/Д'],
    ['NA', '1. Вопрос — н/п'],
    ['YES', '1) Вопрос: ДА'],
  ])('maps answer %s from "%s"', (answer, line) => {
    const ctx = extractOrientationContext(`## БЫСТРЫЙ СКРИН\n\n${line}`);
    expect(ctx.fastScreen).toHaveLength(1);
    expect(ctx.fastScreen?.[0].answer).toBe(answer);
  });

  it('keeps the question and returns null for an unanswered line', () => {
    const ctx = extractOrientationContext(`## БЫСТРЫЙ СКРИН

1. Мир продолжает жить без протагониста
2. Есть давление — YES`);
    expect(ctx.fastScreen?.[0].answer).toBeNull();
    expect(ctx.fastScreen?.[0].question).toBe('Мир продолжает жить без протагониста');
    expect(ctx.fastScreen?.[1].answer).toBe('YES');
  });

  it('orders entries by their number and ignores numbers above 7', () => {
    const ctx = extractOrientationContext(`## БЫСТРЫЙ СКРИН

3. Третий — NO
1. Первый — YES
9. Лишний — YES`);
    expect(ctx.fastScreen?.map((entry) => entry.question)).toEqual(['Первый', 'Третий']);
  });

  it('returns null when the fast-screen section is absent', () => {
    expect(extractOrientationContext('## Скелет\n\nТекст.').fastScreen).toBeNull();
  });

  it('returns an empty array when the section exists but has no numbered lines', () => {
    expect(extractOrientationContext('## БЫСТРЫЙ СКРИН\n\nНет строк.')).toEqual(
      expect.objectContaining({ fastScreen: [] }),
    );
  });
});

// ============================================================
// extractOrientationContext — FOUNDATION-LIMITED (§5)
// ============================================================

describe('extractOrientationContext — foundationLimited', () => {
  it('detects the token in prose', () => {
    expect(extractOrientationContext('Материала мало. FOUNDATION-LIMITED.').foundationLimited).toBe(true);
  });

  it('detects the token inside backticks', () => {
    expect(extractOrientationContext('Статус: `FOUNDATION-LIMITED`').foundationLimited).toBe(true);
  });

  it('is case-sensitive and ignores lowercase', () => {
    expect(extractOrientationContext('статус: foundation-limited').foundationLimited).toBe(false);
  });

  it('is false when the token is absent', () => {
    expect(extractOrientationContext(BLOCK_1.replace('FOUNDATION-LIMITED', 'LIMITED')).foundationLimited).toBe(
      false,
    );
  });
});

// ============================================================
// extractOrientationContext — empty input
// ============================================================

describe('extractOrientationContext — empty input', () => {
  it('returns null fields for empty string', () => {
    const ctx = extractOrientationContext('');
    expect(ctx).toEqual({
      auditMode: null,
      narrativeEngine: null,
      authorshipHypothesis: null,
      skeletonSummary: null,
      foundationLimited: false,
      fastScreen: null,
    });
  });

  it('is pure: calling twice on the same input returns equal results', () => {
    expect(extractOrientationContext(BLOCK_1)).toEqual(extractOrientationContext(BLOCK_1));
  });
});

// ============================================================
// extractWeaknessesSummary — regression suite
// ============================================================

describe('extractWeaknessesSummary', () => {
  it('extracts weaknesses from the Russian marker', () => {
    const markdown = `
## Анализ

Некоторый текст анализа.

РЕЗЮМЕ СЛАБЫХ МЕСТ:
- Нет экономической стрелы
- Пространственная память отсутствует
- Фракции не имеют конфликтов
`;
    const result = extractWeaknessesSummary(markdown);
    expect(result).toContain('Нет экономической стрелы');
    expect(result).toContain('Пространственная память');
  });

  it('extracts weaknesses from the English marker', () => {
    const markdown = `
WEAKNESSES SUMMARY:
- No economic arrow
- Missing spatial memory
`;
    const result = extractWeaknessesSummary(markdown);
    expect(result).toContain('No economic arrow');
  });

  it('aggregates weaknesses from multiple chunks separated by ---', () => {
    const markdown = `
Анализ первой части.
РЕЗЮМЕ СЛАБЫХ МЕСТ:
- Слабость 1
- Слабость 2

---

Анализ второй части.
РЕЗЮМЕ СЛАБЫХ МЕСТ:
- Слабость 3
- Слабость 4
`;
    const result = extractWeaknessesSummary(markdown);
    expect(result).toContain('Слабость 1');
    expect(result).toContain('Слабость 3');
  });

  it('aggregates chunks that use CRLF line endings', () => {
    const markdown =
      'Анализ.\r\nРЕЗЮМЕ СЛАБЫХ МЕСТ:\r\n- Слабость A\r\n\r\n---\r\n\r\nВторая часть.\r\nРЕЗЮМЕ СЛАБЫХ МЕСТ:\r\n- Слабость B\r\n';
    const result = extractWeaknessesSummary(markdown);
    expect(result).toContain('Слабость A');
    expect(result).toContain('Слабость B');
  });

  it('returns keyword-matching paragraphs when no markers are found', () => {
    const markdown = `
Анализ.

Основная проблема: мир не имеет внутренней логики.
Слабые стороны включают отсутствие конфликтов между фракциями.
Нарушение правила трёх рукопожатий.
`;
    const result = extractWeaknessesSummary(markdown);
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('проблем');
  });

  it('returns the last 500 chars as the absolute fallback', () => {
    const markdown = 'Простой текст без каких-либо маркеров или ключевых слов. Просто описание.';
    expect(extractWeaknessesSummary(markdown)).toBe(markdown.trim());
  });

  it('handles very long weaknesses text', () => {
    const longWeakness = 'А'.repeat(2000);
    const result = extractWeaknessesSummary(`РЕЗЮМЕ СЛАБЫХ МЕСТ:\n${longWeakness}`);
    expect(result).toHaveLength(2000);
  });

  it('handles an empty string', () => {
    expect(extractWeaknessesSummary('')).toBe('');
  });
});
