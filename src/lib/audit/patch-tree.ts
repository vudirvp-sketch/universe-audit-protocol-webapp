/**
 * Patch Decision Tree — v10.0 Part VII
 *
 * Provides structured data for the patch/fix recommendation system.
 * Each hole type has 3 variants (conservative, compromise, radical)
 * selected by the criticality × risk matrix.
 *
 * This module is used by:
 * - prompts-v3.ts (to inject patch tree instructions into Block 5)
 * - Future UI components (to display patch recommendations)
 */

// ============================================================
// Types
// ============================================================

export type HoleType = 'motivation' | 'competence' | 'scale' | 'resources' | 'memory' | 'ideology' | 'time';
export type Criticality = 'critical' | 'important' | 'cosmetic';
export type Risk = 'high' | 'medium' | 'low';
export type TimeResource = 'hours' | 'days' | 'weeks';
export type PatchVariant = 'conservative' | 'compromise' | 'radical';

export interface PatchRecommendation {
  variant: PatchVariant;
  description: string;
  snippet: string;        // ready-to-use 1-3 paragraph text
  risks: string[];
  tests: string[];
}

export interface HolePatch {
  id: string;
  holeType: HoleType;
  criticality: Criticality;
  risk: Risk;
  timeResource: TimeResource;
  recommendedVariant: PatchVariant;
  conservative: PatchRecommendation;
  compromise: PatchRecommendation;
  radical: PatchRecommendation;
}

// ============================================================
// Decision matrix from v10.0 Part VII
// ============================================================

/** Maps (criticality + risk) → recommended patch variant per hole type */
export const PATCH_MATRIX: Record<HoleType, Record<string, PatchVariant>> = {
  motivation:   { critical_high: 'radical', important_medium: 'compromise', cosmetic_low: 'conservative' },
  competence:   { critical_high: 'compromise', important_medium: 'conservative', cosmetic_low: 'conservative' },
  ideology:     { critical_high: 'radical', important_medium: 'compromise', cosmetic_low: 'conservative' },
  scale:        { critical_high: 'compromise', important_medium: 'conservative', cosmetic_low: 'conservative' },
  memory:       { critical_high: 'radical', important_medium: 'compromise', cosmetic_low: 'conservative' },
  resources:    { critical_high: 'compromise', important_medium: 'conservative', cosmetic_low: 'conservative' },
  time:         { critical_high: 'radical', important_medium: 'compromise', cosmetic_low: 'conservative' },
};

/**
 * Get the recommended patch variant for a hole type given its criticality and risk.
 * Falls back to 'compromise' if no exact match is found.
 */
export function getRecommendedPatch(
  holeType: HoleType,
  criticality: Criticality,
  risk: Risk,
): PatchVariant {
  const key = `${criticality}_${risk}`;
  return PATCH_MATRIX[holeType][key] || 'compromise';
}

// ============================================================
// Hole type labels and quick-fix reference
// ============================================================

export const HOLE_TYPE_LABELS: Record<HoleType, { ru: string; symptom: string; quickFix: string }> = {
  motivation:  { ru: 'Дыра мотивации', symptom: 'Антагонист не делал очевидного раньше', quickFix: 'Он не знал / ждал условия' },
  competence:  { ru: 'Дыра компетентности', symptom: 'Умный персонаж глупеет для сюжета', quickFix: 'Информационный барьер' },
  scale:       { ru: 'Дыра масштаба', symptom: 'Малое событие → несоразмерные последствия', quickFix: 'Промежуточные звенья' },
  resources:   { ru: 'Дыра ресурсов', symptom: 'Армия без снабжения', quickFix: 'Логистическая проблема' },
  memory:      { ru: 'Дыра памяти', symptom: 'Мир забыл ключевое событие', quickFix: 'Механизм замалчивания' },
  ideology:    { ru: 'Идеологическая дыра', symptom: 'Фракция вразрез со своей идеологией', quickFix: 'Внутренний раскол' },
  time:        { ru: 'Дыра времени', symptom: 'Хронология не выдерживает проверки', quickFix: 'Пересмотреть темп' },
};

// ============================================================
// Patch tree instruction text for Block 5 prompt
// ============================================================

export const PATCH_INSTRUCTION = `
ДЕРЕВО РЕШЕНИЙ ДЛЯ ПАТЧЕЙ — для каждой найденной дыры заполни шаблон:

Алгоритм выбора типа исправления:
ШАГ 1: Определи ТИП дыры (из 7 типов):
- Мотивация: антагонист не делал очевидного
- Компетентность: умный персонаж глупеет для сюжета
- Масштаб: малое событие → несоразмерные последствия
- Ресурсы: армия без снабжения / нет логистики
- Память: мир забыл ключевое событие
- Идеология: фракция действует вразрез со своей идеологией
- Время: хронология не выдерживает проверки

ШАГ 2: Определи КРИТИЧНОСТЬ для Тематического Закона
- Критичная (дыра разрушает тему) → склонись к Radical
- Важная (дыра ослабляет тему) → склонись к Compromise
- Косметическая (тема не затронута) → склонись к Conservative

ШАГ 3: Определи РИСК для существующего контента
- Высокий (исправление ломает другие сцены) → Conservative или Compromise
- Средний → Compromise
- Низкий → Radical допустим

ШАГ 4: Заполни шаблон патча:
\`\`\`
ДЫРА: [ID — ISSUE-XX]
Тип: [из семи типов]
Критичность: критичная / важная / косметическая
Риск: высокий / средний / низкий
РЕКОМЕНДОВАННЫЙ ВАРИАНТ: [Conservative / Compromise / Radical]

Conservative:
  Описание: [что делаем]
  Snippet: [готовый текст 1-3 абзаца]
  Риски: [1] [2] [3]
  Тесты: [сценарий проверки 1] [2] [3]

Compromise:
  [аналогично]

Radical:
  [аналогично]
\`\`\`

Матрица рекомендаций:
| Тип дыры | Критичная / Высокий риск | Важная / Средний риск | Косметическая / Низкий риск |
|----------|--------------------------|----------------------|-----------------------------|
| Мотивация | Radical (переписать хронологию) | Compromise (добавить барьер) | Conservative (один барьер) |
| Компетентность | Compromise (информ. барьер) | Conservative (барьер) | Conservative |
| Идеология | Radical (переписать фракцию) | Compromise (раскол) | Conservative (добавить деталь) |
| Масштаб | Compromise (промежут. звенья) | Conservative (звено) | Conservative |
| Память | Radical (механизм замалчивания) | Compromise | Conservative |
| Ресурсы | Compromise (логистика) | Conservative | Conservative |
| Время | Radical (пересмотр темпа) | Compromise | Conservative |
`;
