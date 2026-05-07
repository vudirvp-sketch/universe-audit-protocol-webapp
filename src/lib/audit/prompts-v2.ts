/**
 * Промпты для 3-шагового пайплайна (Universe Audit Protocol v11.0).
 *
 * Каждый промпт возвращает PromptSet { system, user }.
 * Формат ответа — markdown с маркерными секциями, не JSON.
 *
 * v11.0-fix: жёсткая инструкция по заголовкам + few-shot примеры,
 * чтобы LLM строго соблюдала формат с подчёркиваниями.
 */

import type {
  MediaType,
  Skeleton,
  ChecklistItem,
  CriterionAssessment,
  PromptSet,
} from './types-v2';

// ============================================================
// Общая инструкция по формату (вставляется в system prompt)
// ============================================================

const FORMAT_INSTRUCTION = `

КРИТИЧЕСКОЕ ПРАВИЛО ФОРМАТА:
1. Заголовки секций пиши ТОЧНО как указано: ## AUDIT_MODE (с подчёркиванием, НЕ пробел).
2. НЕ переводи заголовки секций на русский — пиши AUDIT_MODE, а не «Режим аудита».
3. Подзаголовки пиши ТОЧНО как указано: ### thematic_law (с подчёркиванием, НЕ пробел).
4. НЕ добавляй **, * или другие markdown-обёртки вокруг заголовков.
5. Структура заголовков должна быть строго: ## для секций, ### для подсекций.
6. НЕ добавляй лишних секций или заголовков, которых нет в шаблоне.`;

// ============================================================
// Запрос 1: Знакомство + Скелет
// ============================================================

export function buildStep1Prompt(inputText: string, mediaType: MediaType): PromptSet {
  const mediaLabel = getMediaLabel(mediaType);

  const system = `Ты — эксперт-аудитор нарративов по Протоколу Аудита Вселенной v11.0. Ты анализируешь концепты вымышленных миров и определяешь их структурную целостность.${FORMAT_INSTRUCTION}`;

  const user = `Проанализируй данный концепт вымышленного мира (тип медиа: ${mediaLabel}).

Определи:
1. Режим аудита (conflict / kishō / hybrid) — по наличию антагониста, направлению истории, типу конфликта
2. Профиль автора (gardener / hybrid / architect) — по методу работы: садовник выращивает органично, архитектор планирует
3. Скелет концепта — 8 структурных элементов
4. Скрининг — 7 быстрых проверок

Формат ответа — markdown со СТРОГО следующей структурой заголовков (копируй заголовки один-в-один):

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
1. ДА — тематический закон работает как правило: [пояснение]
2. НЕТ — мир существует без протагониста: [пояснение]
3. ДА — воплощённость (мир ощущается телесно): [пояснение]
4. НЕТ — хамартия (фатальный изъян): [пояснение]
5. ДА — болезненный выбор: [пояснение]
6. НЕТ — логика антагониста: [пояснение]
7. ДА — необратимость финала: [пояснение]

ПРИМЕР правильного формата скрининга:
1. ДА — тематический закон: Закон сохранения боли работает как физическое правило
2. НЕТ — мир без протагониста: Мир рушится без главного героя

КОНЦЕПТ:
${inputText}`;

  return { system, user };
}

// ============================================================
// Запрос 2: Оценка по критериям
// ============================================================

/**
 * Обёртка для обратной совместимости — вызывает buildStep2ChunkPrompt
 * с chunkIndex=1, chunkTotal=1 (один чанк = весь список).
 */
export function buildStep2Prompt(
  skeleton: Skeleton,
  narrativeOrDigest: string,
  criteria: ChecklistItem[],
  griefMatrixHint: boolean,
  compressedMode: boolean
): PromptSet {
  return buildStep2ChunkPrompt(skeleton, narrativeOrDigest, criteria, griefMatrixHint, compressedMode, 1, 1);
}

/**
 * Построить промпт для одной части (чанка) критериев Step 2.
 *
 * Пайплайн разбивает 52+ критерия на 2-3 чанка, каждый из которых
 * отправляется отдельным LLM-запросом. Это позволяет уложиться
 * в 30-секундный лимит Cloudflare Workers (бесплатный план):
 * вместо одного запроса на 52 критерия (~90-120с) делаем 3 запроса
 * по ~17 критериев (~15-25с каждый).
 *
 * @param chunkIndex  Номер чанка (1-based)
 * @param chunkTotal  Общее количество чанков
 */
export function buildStep2ChunkPrompt(
  skeleton: Skeleton,
  narrativeOrDigest: string,
  criteria: ChecklistItem[],
  griefMatrixHint: boolean,
  compressedMode: boolean,
  chunkIndex: number,
  chunkTotal: number,
): PromptSet {
  const chunkLabel = chunkTotal > 1
    ? `\nЭто часть ${chunkIndex} из ${chunkTotal}. Оцени ТОЛЬКО критерии из списка ниже. НЕ добавляй критерии, которых нет в списке.`
    : '';

  const system = `Ты — эксперт-аудитор. Оцени концепт по критериям Протокола Аудита Вселенной v11.0.${chunkLabel}${compressedMode ? '\n\nОТВЕЧАЙ КРАТКО: вердикт + 1 предложение обоснования. Цитаты — только для СЛАБО критерия. Доказательство — до 15 слов. Объяснение — 1 предложение.' : ''}${FORMAT_INSTRUCTION}`;

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

Формат ответа для каждого критерия (ОБЯЗАТЕЛЬНО):
ID: ВЕРДИКТ — Доказательство — Объяснение

ПРИМЕР правильного формата:
A1: СИЛЬНО — «Закон сохранения боли сформулирован как физическое правило» — Закон определяет экономику мира
B3: СЛАБО — «Только 2 из 6 критериев жизнеспособности для фракции Альфа» — Фракция не проходит порог

КРИТЕРИИ (заголовки секций пиши ТОЧНО как указано — с подчёркиваниями):`;

  // Only include sections that have criteria in this chunk
  if (l1Criteria.length > 0) {
    user += `\n\n## L1_MECHANISM\n${formatCriteria(l1Criteria)}`;
  }
  if (l2Criteria.length > 0) {
    user += `\n\n## L2_BODY\n${formatCriteria(l2Criteria)}`;
  }
  if (l3Criteria.length > 0) {
    user += `\n\n## L3_PSYCHE\n${formatCriteria(l3Criteria)}`;
  }

  if (griefMatrixHint && l3Criteria.length > 0) {
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

  if (l4Criteria.length > 0) {
    user += `\n\n## L4_META\n${formatCriteria(l4Criteria)}`;
  }

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
  const system = `Ты — эксперт-аудитор. На основе результатов аудита составь приоритизированный список рекомендаций.${compressedMode ? '\n\nОТВЕЧАЙ КРАТКО: для каждой рекомендации — диагноз 1 предложение, исправление 1 предложение. Цепочки — минимум 3 итерации.' : ''}${FORMAT_INSTRUCTION}`;

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

Формат ответа (заголовки пиши ТОЧНО — с подчёркиваниями):

## FIX_LIST
1. [L1] A1: Диагноз | Исправление | подход | усилие
2. [L2] C3: Диагноз | Исправление | подход | усилие

ПРИМЕР:
1. [L1] A1: Нет замкнутого цикла столпов | Добавить обратную связь от столпа 3 к столпу 1 | компромиссный | дни
2. [L2] C3: Отсутствуют суеверия | Добавить ритуал связывания перед битвой | консервативный | часы

## WHAT_FOR_CHAINS
### A1
А чтобы что? → Чтобы столпы влияли друг на друга
А чтобы что? → Чтобы мир ощущался саморегулирующимся
А чтобы что? → Чтобы читатель чувствовал законы мира, а не произвол автора
Корень: Мир не имеет внутренней логики — автор управляет им напрямую

### C3
А чтобы что? → ...
Корень: ...

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
