// Universe Audit Protocol v10.0 — AI Prompts
// ALL LLM prompts are in Russian per Language Contract (Section 0.5):
//   - System prompts: Russian
//   - User prompts: Russian
//   - JSON keys in output: English
//   - JSON values in output: Russian
//   - Enum values in output: English
//   - User narrative is wrapped in <user_input> tags per Section 2.3

import type { MediaType, AuditMode, Skeleton } from './types';
import { wrapUserInput, sanitizeNarrative } from './input-sanitizer';

/**
 * Universal JSON format enforcement — appended to every LLM prompt.
 * Works across all providers and models to maximize structured output reliability.
 * v2: expanded with 10 rules covering markdown, evidence length, and truncation safety.
 */
const JSON_FORMAT_ENFORCEMENT =
  '\n\nКРИТИЧЕСКИЕ ПРАВИЛА ФОРМАТА: ' +
  '1. Ответ должен содержать ТОЛЬКО валидный JSON — никакого текста до или после. ' +
  '2. Никаких markdown-блоков (```json ... ```). ' +
  '3. Все строковые значения в двойных кавычках. ' +
  '4. Используй null (не None) для отсутствующих значений. ' +
  '5. Используй true/false (не True/False) для булевых значений. ' +
  '6. Без trailing commas перед } или ]. ' +
  '7. Все ключи объектов в двойных кавычках. ' +
  '8. НЕ пиши пояснений за пределами JSON — весь анализ ВНУТРИ значений JSON. ' +
  '9. Поле evidence — краткая цитата (максимум 30 слов), не полный абзац. ' +
  '10. Если ответ не помещается — сокращай evidence, а не обрезай JSON.';

/**
 * Compressed instruction for retry scenarios where the previous LLM response
 * was too long, truncated, or produced invalid JSON. Instructs the model
 * to produce the minimal viable JSON structure.
 */
export const COMPRESSED_JSON_INSTRUCTION =
  'СРОЧНО: Твой предыдущий ответ был слишком длинным или невалидным. ' +
  'Ответь МИНИМАЛЬНЫМ JSON: evidence — максимум 10 слов, functionalRole — 5 слов, ' +
  'fixList — максимум 2 элемента. Сокращай описания до минимума. ' +
  'Структура JSON обязательна, но значения должны быть максимально краткими.';

// ============================================================================
// SYSTEM PROMPTS (Russian)
// ============================================================================

/**
 * Main system prompt for the audit AI — Russian per Language Contract
 */
export const AUDIT_SYSTEM_PROMPT = `Ты — эксперт-аудитор нарративов, реализующий Протокол Аудита Вселенной v10.0.

Твоя задача — анализировать вымышленные миры и нарративы через 4 иерархических уровня со строгим гейтингом:
- L1 (Механизм): «Работает ли мир как система?» — базовая связность, логика, экономика
- L2 (Тело): «Есть ли воплощённость и последствия?» — доверие, рутина, пространственная память
- L3 (Психика): «Работает ли как симптом?» — архитектура горя, глубина персонажей
- L4 (Мета): «Спрашивает ли о реальной жизни агента?» — зеркало, культовый статус, этика авторства

КРИТИЧЕСКИЕ ПРАВИЛА:
1. Каждый уровень требует порогового балла для перехода на следующий (60% конфликт, 50% кирё, 55% гибрид)
2. Если L1 < порога, СТОП — предоставь приоритизированный список исправлений. НЕ продолжай на L2
3. Каждый пункт чеклиста имеет три состояния: PASS / FAIL / INSUFFICIENT_DATA
4. Каждый PASS должен включать: прямую цитату + объяснение функциональной роли
5. Пункты, специфичные для медиа, фильтруются до подсчёта балла

ФОРМАТ ВЫВОДА:
JSON с английскими ключами и русскими значениями. Enum-значения на английском.

Будь тщательным, критичным и основывайся на доказательствах. Избегай позитивного смещения.`;

// ============================================================================
// STEP 1: MODE DETECTION PROMPT
// ============================================================================

/**
 * Prompt for determining audit mode — Russian per Language Contract
 */
export function getAuditModePrompt(narrative: string): string {
  const safeNarrative = wrapUserInput(sanitizeNarrative(narrative));
  return `Определи режим аудита для данного нарратива.

${safeNarrative}

Ответь на 3 вопроса:

1. Есть ли в нарративе антагонист (внешняя враждебная сила)?
2. Движется ли история к победе/поражению, а не к осознанию?
3. Конфликт персонажа внешний (они против чего-то) или внутренний (они против самих себя)?

На основе ответов:
- Преимущественно ДА → режим "conflict" (западная структура, Путешествие Героя, конфликт как драйвер)
- Преимущественно НЕТ → режим "kishō" (структура без конфликта, смена перспективы как драйвер)
- Смешанно → режим "hybrid" (Архитектура Горя как основа, антагонист как симптом)

Верни ответ в формате JSON:
{
  "hasAntagonist": true/false,
  "victoryTrajectory": true/false,
  "externalConflict": true/false,
  "mode": "conflict" | "kishō" | "hybrid",
  "reasoning": "краткое обоснование на русском"
}` + JSON_FORMAT_ENFORCEMENT;
}

// ============================================================================
// STEP 2: AUTHOR PROFILE PROMPT
// ============================================================================

/**
 * Prompt for author profile determination — Russian per Language Contract
 */
export function getAuthorProfilePrompt(narrative: string): string {
  const safeNarrative = wrapUserInput(sanitizeNarrative(narrative));
  return `Определи авторский профиль на основе подхода к данному нарративу.

${safeNarrative}

Ответь на 7 вопросов о рабочем методе автора (ДА/НЕТ):

1. Когда персонаж «должен» сделать глупость ради сюжета — ищет ли автор способ сделать это органичным?
2. Знает ли автор, как персонажи ведут себя в ситуациях, не описанных в нарративе?
3. Возникали ли сюжетные повороты потому, что персонажи к ним пришли, а не потому что автор заранее их спланировал? [КЛЮЧЕВОЙ СИГНАЛ — вес 1.5]
4. Был ли автор когда-нибудь удивлён действием собственного персонажа?
5. Могла ли финальная сцена измениться, если бы один ключевой персонаж принял другое решение в середине? [КЛЮЧЕВОЙ СИГНАЛ — вес 1.5]
6. Делает ли антагонист правильные вещи в глазах автора — по собственной логике?
7. Выросла ли трагедия из природы персонажа, а не из сюжетной необходимости? [КЛЮЧЕВОЙ СИГНАЛ — вес 1.5]

Классификация:
- 80-100% ДА → Садовник (органический хаос, логистические/масштабные дыры)
- 50-70% ДА → Гибрид (оптимален для большинства нарративов)
- 0-40% ДА → Архитектор (персонажи служат сюжету, компетентностные дыры)

Верни ответ в формате JSON:
{
  "answers": { "Q1": true/false, "Q2": true/false, "Q3": true/false, "Q4": true/false, "Q5": true/false, "Q6": true/false, "Q7": true/false },
  "weightedScore": число,
  "percentage": число,
  "type": "gardener" | "hybrid" | "architect",
  "confidence": "high" | "medium" | "low",
  "mainRisks": ["риск1 на русском", "риск2 на русском"],
  "auditPriorities": ["приоритет1 на русском", "приоритет2 на русском"]
}` + JSON_FORMAT_ENFORCEMENT;
}

// ============================================================================
// STEP 3: SKELETON EXTRACTION PROMPT
// ============================================================================

/**
 * Prompt for skeleton extraction — Russian per Language Contract
 */
export function getSkeletonExtractionPrompt(narrative: string, mediaType: MediaType): string {
  const safeNarrative = wrapUserInput(sanitizeNarrative(narrative));
  return `Извлеки скелет нарратива из данного концепта (${mediaType}):

${safeNarrative}

Извлеки следующие 8 структурных элементов:

1. **Тематический закон**: Один вопрос, выраженный как физический закон мира
   - Тест: Убрать тему — ломает физику/экономику или только сюжет?

2. **Корневая травма**: Событие, разрушившее прежний порядок
   - Без травмы: мир статичен, идеологии картонные

3. **Хамартия протагониста**: Черта персонажа, неотвратимо ведущая к финалу
   - Вытекает ли финал из хамартии? Если нет, трагедия случайна

4. **3 Несокрушимых столпа**: Цикл A→B→C→A, без которого мир перестаёт быть собой
   - Нецикличный = аморфный мир

5. **Эмоциональный двигатель**: Доминантная стадия горя мира
   - Нет доминанты = эмоционально нейтральный мир

6. **Авторский запрет**: Что концепт явно избегает
   - Защита от «улучшений», уводящих от замысла

7. **Целевой опыт**: Что агент чувствует в финале
   - Одна эмоция = провал; конфликт чувств = успех

8. **Центральный вопрос**: Один вопрос, который протагонист несёт через весь путь
   - Нет вопроса = нет причины следить

Проведи анализ слабостей на русском языке. Все описания, диагнозы и рекомендации должны быть на русском.

Верни ответ в формате JSON:
{
  "thematicLaw": "текст на русском или null",
  "rootTrauma": "текст на русском или null",
  "hamartia": "текст на русском или null",
  "pillars": ["столп1 на русском", "столп2 на русском", "столп3 на русском"],
  "emotionalEngine": "denial" | "anger" | "bargaining" | "depression" | "acceptance",
  "authorProhibition": "текст на русском или null",
  "targetExperience": "текст на русском или null",
  "centralQuestion": "текст на русском или null"
}

Если элемент не удаётся извлечь, используй null для этого поля.` + JSON_FORMAT_ENFORCEMENT;
}

// ============================================================================
// STEP 4: SCREENING PROMPT
// ============================================================================

/**
 * Prompt for quick screening — Russian per Language Contract
 */
export function getScreeningPrompt(narrative: string): string {
  const safeNarrative = wrapUserInput(sanitizeNarrative(narrative));
  return `Проведи быстрый скрининг данного нарратива (отвечай только ДА/НЕТ):

${safeNarrative}

Ответь на 7 вопросов:

1. Можно ли сформулировать тему мира как правило («В этом мире [X] всегда ведёт к [Y]»)?
   - Если НЕТ: отметить для полного аудита §0, §1.4

2. Если убрать протагониста — продолжает ли мир жить (рутина, история, конфликты без героя)?
   - Если НЕТ: критично §3, §4

3. Есть ли хотя бы одна сцена, где персонаж устал, заплатил деньги или почувствовал запах?
   - Если НЕТ: необходимо §1.5, §5

4. Несёт ли ключевой персонаж черту, которая одновременно является его силой и его гибелью?
   - Если НЕТ: критично §6

5. Есть ли момент, когда «правильный» выбор также имеет болезненную цену?
   - Если НЕТ: необходимо §2, §16

6. Действует ли антагонист (или главная угроза) по логике, которую можно понять и даже принять?
   - Если НЕТ: §6, §8

7. Можно ли переписать финал на «счастливый конец», не разрушив смысл всей истории?
   - Если НЕТ (т.е. финал необратим): это правильно
   - Если ДА: критично §16

Верни ответ в формате JSON:
{
  "answers": [true/false для каждого вопроса 1-7],
  "flags": ["список отмеченных секций на русском"],
  "recommendation": "ready_for_audit" | "requires_sections" | "stop_return_to_skeleton"
}

Подсчёт:
- 0-1 НЕТ: "ready_for_audit"
- 2-3 НЕТ: "requires_sections"
- 4+ НЕТ: "stop_return_to_skeleton"` + JSON_FORMAT_ENFORCEMENT;
}

// ============================================================================
// STEP 5: GATE L1 EVALUATION PROMPT
// ============================================================================

/**
 * Prompt for L1 (Mechanism) evaluation — Russian per Language Contract
 * @param useDigest — when true, adds a note that the narrative is provided
 *   in compressed digest form (fragments marked with [...])
 */
export function getL1EvaluationPrompt(
  narrative: string,
  skeleton: Skeleton,
  mediaType: MediaType,
  checklist: string,
  useDigest?: boolean,
): string {
  const safeNarrative = wrapUserInput(sanitizeNarrative(narrative));
  const digestNote = useDigest
    ? '\n\nВНИМАНИЕ: Нарратив предоставлен в сжатой форме (отмечено [...]). Оценивай на основе доступных фрагментов и скелета. Для недоступных фрагментов используй INSUFFICIENT_DATA.\n'
    : '';
  return `Оцени уровень L1 (Механизм) для данного ${mediaType}:${digestNote}
СКЕЛЕТ:
${JSON.stringify(skeleton, null, 2)}

НАРРАТИВ:
${safeNarrative}

ЧЕКЛИСТ L1 (применимые пункты):
${checklist}

Для каждого применимого пункта чеклиста оцени:
- Status: PASS / FAIL / INSUFFICIENT_DATA
- Evidence: Краткая цитата из нарратива (максимум 30 слов, если доступна)
- Functional Role: Как это функционально служит критерию (1-2 предложения)

КРИТИЧЕСКИЕ ПРАВИЛА:
1. НЕ включай пункты INSUFFICIENT_DATA в расчёт пройдено/провалено
2. Если >50% пунктов имеют INSUFFICIENT_DATA, отметь потребность в дополнительном материале
3. Порог гейта зависит от режима аудита (60% конфликт, 50% кирё, 55% гибрид)
4. Балл = (пройдено / (пройдено + провалено)) × 100%

Оценивай ТОЛЬКО пункты, применимые к ${mediaType}:
- CORE: Все медиа
- GAME: Только для игр
- VISUAL: Только для фильм/аниме/сериал

Верни ответ в формате JSON:
{
  "evaluations": [
    {
      "id": "item_id",
      "status": "PASS" | "FAIL" | "INSUFFICIENT_DATA",
      "evidence": "краткая цитата до 30 слов или null",
      "functionalRole": "объяснение на русском (1-2 предложения) или null"
    }
  ],
  "score": число,
  "gatePassed": true/false,
  "fixList": [
    {
      "id": "fix_id",
      "description": "что исправить на русском",
      "severity": "critical" | "major" | "minor",
      "type": "motivation" | "competence" | "scale" | "resources" | "memory" | "ideology" | "time",
      "recommendedApproach": "conservative" | "compromise" | "radical"
    }
  ]
}` + JSON_FORMAT_ENFORCEMENT;
}

// ============================================================================
// STEP 6: GATE L2 EVALUATION PROMPT
// ============================================================================

/**
 * Prompt for L2 (Body) evaluation — Russian per Language Contract
 * @param useDigest — when true, adds a note that the narrative is provided
 *   in compressed digest form (fragments marked with [...])
 */
export function getL2EvaluationPrompt(
  narrative: string,
  skeleton: Skeleton,
  l1Score: number,
  checklist: string,
  useDigest?: boolean,
): string {
  const safeNarrative = wrapUserInput(sanitizeNarrative(narrative));
  const digestNote = useDigest
    ? '\n\nВНИМАНИЕ: Нарратив предоставлен в сжатой форме (отмечено [...]). Оценивай на основе доступных фрагментов и скелета. Для недоступных фрагментов используй INSUFFICIENT_DATA.\n'
    : '';
  return `Оцени уровень L2 (Тело) — только если L1 пройден (балл: ${l1Score}%):${digestNote}
СКЕЛЕТ:
${JSON.stringify(skeleton, null, 2)}

НАРРАТИВ:
${safeNarrative}

ЧЕКЛИСТ L2:
${checklist}

L2 фокусируется на:
- Воплощённость: усталость, боль, запах, деньги в ключевых сценах
- Глубина персонажей: хамартия, тест Мэри Сью, Цена Величия
- Качество сцен: телесный якорь, тишина/медленное время
- Нарративная инфраструктура: долг уплачен, отвлечение внимания

Для каждого применимого пункта оцени с доказательствами:
- Status: PASS / FAIL / INSUFFICIENT_DATA
- Evidence: Краткая цитата из нарратива (максимум 30 слов)
- Functional Role: Как это функционально служит критерию (1-2 предложения)

КРИТИЧЕСКИЕ ПРАВИЛА:
1. НЕ включай пункты INSUFFICIENT_DATA в расчёт пройдено/провалено
2. Если >50% пунктов имеют INSUFFICIENT_DATA, отметь потребность в дополнительном материале
3. Порог гейта зависит от режима аудита (60% конфликт, 50% кирё, 55% гибрид)
4. Балл = (пройдено / (пройдено + провалено)) × 100%

Верни ответ в формате JSON:
{
  "evaluations": [
    {
      "id": "item_id",
      "status": "PASS" | "FAIL" | "INSUFFICIENT_DATA",
      "evidence": "краткая цитата до 30 слов или null",
      "functionalRole": "объяснение на русском (1-2 предложения) или null"
    }
  ],
  "score": число,
  "gatePassed": true/false,
  "fixList": [
    {
      "id": "fix_id",
      "description": "что исправить на русском",
      "severity": "critical" | "major" | "minor",
      "type": "motivation" | "competence" | "scale" | "resources" | "memory" | "ideology" | "time",
      "recommendedApproach": "conservative" | "compromise" | "radical"
    }
  ]
}` + JSON_FORMAT_ENFORCEMENT;
}

// ============================================================================
// STEP 7: GATE L3 EVALUATION PROMPT
// ============================================================================

/**
 * Prompt for L3 (Psyche) evaluation — Russian per Language Contract
 * @param useDigest — when true, adds a note that the narrative is provided
 *   in compressed digest form (fragments marked with [...])
 */
export function getL3EvaluationPrompt(
  narrative: string,
  skeleton: Skeleton,
  l2Score: number,
  griefMatrixContext: string,
  useDigest?: boolean,
): string {
  const safeNarrative = wrapUserInput(sanitizeNarrative(narrative));
  const digestNote = useDigest
    ? '\n\nВНИМАНИЕ: Нарратив предоставлен в сжатой форме (отмечено [...]). Оценивай на основе доступных фрагментов и скелета. Для недоступных фрагментов используй INSUFFICIENT_DATA.\n'
    : '';
  return `Оцени уровень L3 (Психика) — только если L2 пройден (балл: ${l2Score}%):${digestNote}
СКЕЛЕТ:
${JSON.stringify(skeleton, null, 2)}

НАРРАТИВ:
${safeNarrative}

КОНТЕКСТ АРХИТЕКТУРЫ ГОРЯ:
${griefMatrixContext}

L3 фокусируется на:
- Архитектура Горя: Все 5 стадий материализованы на 4 уровнях (Персонаж, Локация, Механика, Акт)
- Определена доминантная стадия горя
- Психотипы персонажей: нет дублирующихся стадий среди ключевых персонажей

Для архитектуры горя соотнеси каждую стадию с:
- Какой персонаж её воплощает
- Какая локация её воплощает
- Какая механика/система её воплощает
- Какой нарративный акт её воплощает

КРИТИЧЕСКИ: Требуется только чтобы доминантная стадия была полностью заполнена. Остальные стадии могут быть частичными/отсутствовать.

Верни ответ в формате JSON:
{
  "evaluations": [...],
  "griefMatrix": {
    "dominantStage": "denial" | "anger" | "bargaining" | "depression" | "acceptance",
    "cells": [
      {
        "stage": "имя_стадии",
        "level": "character" | "location" | "mechanic" | "act",
        "character": "кто/что воплощает это на русском",
        "evidence": "краткая цитата до 30 слов на русском",
        "confidence": "high" | "medium" | "low" | "absent"
      }
    ]
  },
  "score": число,
  "gatePassed": true/false
}` + JSON_FORMAT_ENFORCEMENT;
}

// ============================================================================
// STEP 8: GATE L4 EVALUATION PROMPT (including Cult Potential)
// ============================================================================

/**
 * Prompt for L4 (Meta) evaluation — Russian per Language Contract
 * Cult potential is merged into L4 per Section 0.8
 * @param useDigest — when true, adds a note that the narrative is provided
 *   in compressed digest form (fragments marked with [...])
 */
export function getL4EvaluationPrompt(
  narrative: string,
  skeleton: Skeleton,
  l3Score: number,
  useDigest?: boolean,
): string {
  const safeNarrative = wrapUserInput(sanitizeNarrative(narrative));
  const digestNote = useDigest
    ? '\n\nВНИМАНИЕ: Нарратив предоставлен в сжатой форме (отмечено [...]). Оценивай на основе доступных фрагментов и скелета. Для недоступных фрагментов используй INSUFFICIENT_DATA.\n'
    : '';
  return `Оцени уровень L4 (Мета) — только если L3 пройден (балл: ${l3Score}%):${digestNote}
СКЕЛЕТ:
${JSON.stringify(skeleton, null, 2)}

НАРРАТИВ:
${safeNarrative}

L4 фокусируется на:
1. Три Слоя Реальности (тест разрушения):
   - Личный слой: Чего хочет агент, что бы он делал без этого
   - Сюжетный слой: Почему B следует за A, что происходит без причинности
   - Мета-авторский слой: Какой вопрос финал задаёт аудитории

2. Корнелиева Дилемма:
   - Тип: Ценность vs Ценность (не добро vs зло)
   - Необратимость: Выбор физически меняет мир
   - Идентичность: «Кем ты стал?» а не «что ты получил?»
   - Цена победы: Победа = предательство одной истины

3. Зеркало Агента:
   - Побуждает ли финал к самоанализу у аудитории?
   - Прямой вопрос аудитории: «[Нарратив] спрашивает: способен ли ты на ___?»

4. Культовый Потенциал (11 критериев):
   - Айсберг-лора, сопротивление пониманию, провокация интерпретаций
   - Эстетическая уникальность, играбельный антагонист, финал переосмысляет начало
   - Неудобная истина, логическое расширение, запоминающийся символ
   - Релевантность темы, необъяснимая глубина усиливает

Верни ответ в формате JSON:
{
  "evaluations": [...],
  "threeLayers": {
    "personal": { "stable": true/false, "proof": "доказательство на русском" },
    "plot": { "stable": true/false, "proof": "доказательство на русском" },
    "meta": { "stable": true/false, "proof": "доказательство на русском" }
  },
  "cornelianDilemma": {
    "valid": true/false,
    "valueA": "ценность А на русском",
    "valueB": "ценность Б на русском",
    "irreversible": true/false,
    "thirdPath": "существует или нет на русском"
  },
  "agentMirror": {
    "integrated": true/false,
    "directQuestion": "прямой вопрос аудитории на русском"
  },
  "cultPotential": {
    "score": число,
    "criteria": [true/false для каждого из 11]
  },
  "score": число,
  "gatePassed": true/false
}` + JSON_FORMAT_ENFORCEMENT;
}
