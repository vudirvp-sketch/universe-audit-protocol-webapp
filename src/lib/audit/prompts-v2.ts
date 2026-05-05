/**
 * Промпты для 3-шагового пайплайна (Universe Audit Protocol v11.0).
 *
 * Каждый промпт возвращает PromptSet { system, user }.
 * Формат ответа — markdown с маркерными секциями, не JSON.
 */

import type {
  MediaType,
  Skeleton,
  ChecklistItem,
  CriterionAssessment,
  PromptSet,
} from './types-v2';

// ============================================================
// Запрос 1: Знакомство + Скелет
// ============================================================

export function buildStep1Prompt(inputText: string, mediaType: MediaType): PromptSet {
  const mediaLabel = getMediaLabel(mediaType);

  const system = `Ты — эксперт-аудитор нарративов по Протоколу Аудита Вселенной v11.0. Ты анализируешь концепты вымышленных миров и определяешь их структурную целостность.`;

  const user = `Проанализируй данный концепт вымышленного мира (тип медиа: ${mediaLabel}).

Определи:
1. Режим аудита (conflict / kishō / hybrid) — по наличию антагониста, направлению истории, типу конфликта
2. Профиль автора (gardener / hybrid / architect) — по методу работы: садовник выращивает органично, архитектор планирует
3. Скелет концепта — 8 структурных элементов
4. Скрининг — 7 быстрых проверок

Формат ответа — markdown со строго следующей структурой заголовков:

## AUDIT_MODE
[conflict | kishō | hybrid] — [обоснование в 1-2 предложениях]

## AUTHOR_PROFILE
[gardener | hybrid | architect] — [процент]% — [confidence: low | medium | high]
Риски: [список через запятую]
Приоритеты аудита: [список через запятую]

## SKELETON
### thematic_law
[значение или НЕ НАЙДЕНО]
### root_trauma
[значение или НЕ НАЙДЕНО]
### hamartia
[значение или НЕ НАЙДЕНО]
### pillars
1. [столп 1]
2. [столп 2]
3. [столп 3]
### emotional_engine
[denial | anger | bargaining | depression | acceptance]
### author_prohibition
[значение или НЕ НАЙДЕНО]
### target_experience
[значение или НЕ НАЙДЕНО]
### central_question
[значение или НЕ НАЙДЕНО]

## SCREENING
1. [ДА/НЕТ] — тематический закон работает как правило: [пояснение]
2. [ДА/НЕТ] — мир существует без протагониста: [пояснение]
3. [ДА/НЕТ] — воплощённость (мир ощущается телесно): [пояснение]
4. [ДА/НЕТ] — хамартия (фатальный изъян): [пояснение]
5. [ДА/НЕТ] — болезненный выбор: [пояснение]
6. [ДА/НЕТ] — логика антагониста: [пояснение]
7. [ДА/НЕТ] — необратимость финала: [пояснение]

КОНЦЕПТ:
${inputText}`;

  return { system, user };
}

// ============================================================
// Запрос 2: Оценка по критериям
// ============================================================

export function buildStep2Prompt(
  skeleton: Skeleton,
  narrativeOrDigest: string,
  criteria: ChecklistItem[],
  griefMatrixHint: boolean,
  compressedMode: boolean
): PromptSet {
  const system = `Ты — эксперт-аудитор. Оцени концепт по критериям Протокола Аудита Вселенной v11.0.${compressedMode ? '\n\nОТВЕЧАЙ КРАТКО: вердикт + 1 предложение обоснования. Цитаты — только для СЛАБО критерия. Доказательство — до 15 слов. Объяснение — 1 предложение.' : ''}`;

  // Format skeleton
  const skeletonText = `Тематический закон: ${skeleton.thematicLaw || 'НЕ НАЙДЕНО'}
Корневая травма: ${skeleton.rootTrauma || 'НЕ НАЙДЕНО'}
Хамартия: ${skeleton.hamartia || 'НЕ НАЙДЕНО'}
Столпы: ${skeleton.pillars.length > 0 ? skeleton.pillars.join('; ') : 'НЕ НАЙДЕНО'}
Эмоциональный двигатель: ${skeleton.emotionalEngine || 'НЕ НАЙДЕНО'}
Авторский запрет: ${skeleton.authorProhibition || 'НЕ НАЙДЕНО'}
Целевой опыт: ${skeleton.targetExperience || 'НЕ НАЙДЕНО'}
Центральный вопрос: ${skeleton.centralQuestion || 'НЕ НАЙДЕНО'}`;

  // Group criteria by level
  const l1Criteria = criteria.filter(c => c.level === 'L1' || c.level.startsWith('L1/'));
  const l2Criteria = criteria.filter(c => c.level === 'L2' || c.level.startsWith('L2/'));
  const l3Criteria = criteria.filter(c => c.level === 'L3' || c.level.startsWith('L3/'));
  const l4Criteria = criteria.filter(c => c.level === 'L4' || c.level.startsWith('L4/'));

  const formatCriteria = (items: ChecklistItem[]) =>
    items.map(c => `${c.id}: ${c.name} — ${c.description}`).join('\n');

  let user = `СКЕЛЕТ:
${skeletonText}

НАРРАТИВ:
${narrativeOrDigest}

Для КАЖДОГО критерия из списка оцени:
- Вердикт: СИЛЬНО / СЛАБО / НЕДОСТАТОЧНО ДАННЫХ
- Доказательство: краткая цитата (до 30 слов) или обоснование
- Объяснение: почему именно так (1-2 предложения)

Формат ответа для каждого критерия:
ID: ВЕРДИКТ — Доказательство — Объяснение

КРИТЕРИИ:

## L1_MECHANISM
${formatCriteria(l1Criteria)}

## L2_BODY
${formatCriteria(l2Criteria)}

## L3_PSYCHE
${formatCriteria(l3Criteria)}`;

  if (griefMatrixHint) {
    user += `

### GRIEF_MATRIX
Заполни матрицу архитектуры горя (5 стадий × 4 уровня материализации):

| Стадия | Персонаж | Локация | Механика/Действие | Акт |
|--------|----------|---------|-------------------|-----|
| denial | ... | ... | ... | ... |
| anger | ... | ... | ... | ... |
| bargaining | ... | ... | ... | ... |
| depression | ... | ... | ... | ... |
| acceptance | ... | ... | ... | ... |

Доминирующая стадия: [стадия] (проявлена на [N] уровнях из 4)`;
  }

  user += `

## L4_META
${formatCriteria(l4Criteria)}`;

  return { system, user };
}

// ============================================================
// Запрос 3: Рекомендации
// ============================================================

export function buildStep3Prompt(
  weakAssessments: CriterionAssessment[],
  skeleton: Skeleton,
  compressedMode: boolean
): PromptSet {
  const system = `Ты — эксперт-аудитор. На основе результатов аудита составь приоритизированный список рекомендаций.${compressedMode ? '\n\nОТВЕЧАЙ КРАТКО: для каждой рекомендации — диагноз 1 предложение, исправление 1 предложение. Цепочки — минимум 3 итерации.' : ''}`;

  // Format skeleton
  const skeletonText = `Тематический закон: ${skeleton.thematicLaw || 'НЕ НАЙДЕНО'}
Корневая травма: ${skeleton.rootTrauma || 'НЕ НАЙДЕНО'}
Хамартия: ${skeleton.hamartia || 'НЕ НАЙДЕНО'}
Столпы: ${skeleton.pillars.length > 0 ? skeleton.pillars.join('; ') : 'НЕ НАЙДЕНО'}
Эмоциональный двигатель: ${skeleton.emotionalEngine || 'НЕ НАЙДЕНО'}
Авторский запрет: ${skeleton.authorProhibition || 'НЕ НАЙДЕНО'}
Целевой опыт: ${skeleton.targetExperience || 'НЕ НАЙДЕНО'}
Центральный вопрос: ${skeleton.centralQuestion || 'НЕ НАЙДЕНО'}`;

  // Format weak assessments
  const weakList = weakAssessments
    .map(a => `${a.id}: [${a.level}] — ${a.verdict} — ${a.evidence}`)
    .join('\n');

  const user = `СКЕЛЕТ:
${skeletonText}

СЛАБЫЕ КРИТЕРИИ:
${weakList || 'Нет слабых критериев — все сильные.'}

Для КАЖДОЙ слабости:
1. Диагноз: что именно не работает
2. Исправление: конкретное действие
3. Подход: [консервативный / компромиссный / радикальный] — выбирай по типу дыры, критичности и риску
4. Усилие: [часы / дни / недели]

Для цепочек «А чтобы что?» — итерируй 3-5 раз, пока не дойдёшь до корневой причины или дилеммы. Обрыв на шаге ≤4 = проблема.

Формат ответа:

## FIX_LIST
1. [L1] interdependence: Диагноз | Исправление | подход | усилие
2. [L2] ...
(priority по убыванию важности)

## WHAT_FOR_CHAINS
### interdependence
А чтобы что? → [ответ1]
А чтобы что? → [ответ2]
А чтобы что? → [ответ3]
Корень: [финальный вывод]

### [следующий критерий]
...

## GENERATIVE
### grief_mapping
Если применимо — опиши, как связать стадии горя с конкретными персонажами и событиями. Если не применимо — напиши НЕ ПРИМЕНИМО.

### dilemma
Сформулируй корнелианскую дилемму для этого концепта: выбор между двумя равнозначными благами, где любое решение несёт цену. Проверь по 4 критериям: (1) ценность vs ценность, не добро vs зло; (2) выбор необратим; (3) определяет бытие, не обладание; (4) победа = предательство одной правды. Если концепт слишком сырой — напиши НЕ ПРИМЕНИМО и предложи 2 варианта дилеммы на выбор.`;

  return { system, user };
}

// ============================================================
// Helpers
// ============================================================

function getMediaLabel(mediaType: MediaType): string {
  switch (mediaType) {
    case 'narrative': return 'Нарратив (роман/литература)';
    case 'game': return 'Игра (RPG/Нарративная)';
    case 'visual': return 'Визуальное (кино/аниме)';
    case 'ttrpg': return 'TTRPG/Настольная';
    default: return 'Нарратив';
  }
}
