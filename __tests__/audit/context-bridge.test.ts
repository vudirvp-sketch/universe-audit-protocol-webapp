/**
 * Tests for context-bridge.ts — regex extraction from Block 1 output.
 *
 * This is the most critical test suite because regex extraction is fragile
 * and directly affects pipeline correctness: if extraction fails, subsequent
 * blocks receive degraded context.
 */
import { describe, it, expect } from 'vitest';
import { extractOrientationContext, extractWeaknessesSummary } from '@/lib/audit/context-bridge';

// ============================================================
// extractOrientationContext
// ============================================================

describe('extractOrientationContext', () => {
  it('extracts all fields from valid Block 1 markdown', () => {
    const markdown = `
# ОРИЕНТАЦИЯ

**Режим аудита:** Conflict

**Профиль автора:** Садовник

Профиль автора: Садовник (70%)

## Скелет концепта

- **Тематический Закон:** Память можно продать, но покупатель забывает что-то своё
- **Корневая Травма:** Протагонист потерял все воспоминания о дочери
- **Гамартия:** Неумение отпустить прошлое ведёт к саморазрушению

## Скрининг (7 проверок)

1. Тему мира можно сформулировать как правило → ДА
2. Мир продолжит жить без протагониста → НЕТ
3. Есть сцена с телесностью → ДА
`;
    const ctx = extractOrientationContext(markdown);
    expect(ctx.auditMode).toBe('conflict');
    expect(ctx.authorProfileType).toBe('gardener');
    expect(ctx.authorProfilePercentage).toBe(70);
    expect(ctx.skeletonSummary).not.toBeNull();
    expect(ctx.skeletonSummary).toContain('Тематический Закон');
  });

  it('extracts kisho audit mode', () => {
    const markdown = `Режим аудита: Kishō`;
    const ctx = extractOrientationContext(markdown);
    expect(ctx.auditMode).toBe('kishō');
  });

  it('extracts hybrid audit mode in Russian', () => {
    const markdown = `Режим аудита: гибрид`;
    const ctx = extractOrientationContext(markdown);
    expect(ctx.auditMode).toBe('hybrid');
  });

  it('extracts architect author profile', () => {
    const markdown = `Профиль автора: Архитектор (85%)`;
    const ctx = extractOrientationContext(markdown);
    expect(ctx.authorProfileType).toBe('architect');
    expect(ctx.authorProfilePercentage).toBe(85);
  });

  it('extracts hybrid author profile in English', () => {
    const markdown = `Профиль автора: Hybrid (50%)`;
    const ctx = extractOrientationContext(markdown);
    expect(ctx.authorProfileType).toBe('hybrid');
    expect(ctx.authorProfilePercentage).toBe(50);
  });

  it('returns null for empty string', () => {
    const ctx = extractOrientationContext('');
    expect(ctx.auditMode).toBeNull();
    expect(ctx.authorProfileType).toBeNull();
    expect(ctx.authorProfilePercentage).toBeNull();
    expect(ctx.skeletonSummary).toBeNull();
    expect(ctx.screeningResults).toBeNull();
  });

  it('returns null fields for markdown without expected sections', () => {
    const markdown = `Это просто какой-то текст без структурированных секций.`;
    const ctx = extractOrientationContext(markdown);
    expect(ctx.auditMode).toBeNull();
    expect(ctx.authorProfileType).toBeNull();
  });

  it('handles markdown with non-standard formatting (table rows)', () => {
    const markdown = `
| Элемент | Значение |
|---------|----------|
| **Тематический Закон** | Память — валюта |
| **Корневая Травма** | Потеря идентичности |
`;
    const ctx = extractOrientationContext(markdown);
    expect(ctx.skeletonSummary).not.toBeNull();
    expect(ctx.skeletonSummary).toContain('Память — валюта');
  });

  it('extracts audit mode from standalone keyword fallback', () => {
    const markdown = `Анализ показывает, что режим Conflict наиболее подходит для данного мира.`;
    const ctx = extractOrientationContext(markdown);
    expect(ctx.auditMode).toBe('conflict');
  });
});

// ============================================================
// extractWeaknessesSummary
// ============================================================

describe('extractWeaknessesSummary', () => {
  it('extracts weaknesses from Russian marker', () => {
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

  it('extracts weaknesses from English marker', () => {
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

  it('returns keyword-matching paragraphs when no markers found', () => {
    const markdown = `
Анализ.

Основная проблема: мир не имеет внутренней логики.
Слабые стороны включают отсутствие конфликтов между фракциями.
Нарушение правила трёх рукопожатий.
`;
    const result = extractWeaknessesSummary(markdown);
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns last 500 chars as absolute fallback', () => {
    const markdown = `Простой текст без каких-либо маркеров или ключевых слов. Просто описание.`;
    const result = extractWeaknessesSummary(markdown);
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles very long weaknesses text', () => {
    const longWeakness = 'А'.repeat(2000);
    const markdown = `РЕЗЮМЕ СЛАБЫХ МЕСТ:\n${longWeakness}`;
    const result = extractWeaknessesSummary(markdown);
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles empty string', () => {
    const result = extractWeaknessesSummary('');
    expect(result).toBe('');
  });
});
