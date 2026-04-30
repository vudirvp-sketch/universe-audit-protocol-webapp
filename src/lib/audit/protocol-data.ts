// Universe Audit Protocol v10.0 - Protocol Data
import type { 
  ChecklistItem, 
  GlossaryTerm, 
  GriefStage, 
  AuthorQuestion,
  VitalityCriteria,
  MediaTag,
  MediaType
} from './types';

// Master Checklist - 52 items with media tags
export const MASTER_CHECKLIST: ChecklistItem[] = [
  // Block A: Structure (7) - L1
  { id: 'A1', block: 'A', text: 'Тематический закон сформулирован как физическое правило, влияет на физику/экономику', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'A2', block: 'A', text: 'Корневая травма определена и объясняет все идеологии', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'A3', block: 'A', text: 'Гамартия — финал вытекает из природы протагониста', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'A4', block: 'A', text: '3 столпа — замкнутый цикл', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'A5', block: 'A', text: 'Авторский запрет зафиксирован', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'A6', block: 'A', text: 'Целевой опыт — конфликт эмоций, не одна эмоция', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'A7', block: 'A', text: 'Центральный вопрос — один, на протяжении всей истории', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },

  // Block B: Connectedness (8) - L1
  { id: 'B1', block: 'B', text: 'Матрица N×N: нет пустых ячеек', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'B2', block: 'B', text: 'Матрица фракций: заполнена глаголами', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'B3', block: 'B', text: 'Каждая фракция ≥4/6 критериев жизнеспособности', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'B4', block: 'B', text: 'Каждый элемент: эффект ряби ≥2', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'B5', block: 'B', text: 'Пространственная память: след без объяснения', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'B6', block: 'B', text: 'Правило трёх рукопожатий', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'B7', block: 'B', text: 'Нет висячего контента', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'B8', block: 'B', text: 'Экономическая стрелка для всех явлений', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },

  // Block C: Vitality (7) - L1/L2
  { id: 'C1', block: 'C', text: '13/17 критериев жизнеспособности', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true },
  { id: 'C2', block: 'C', text: 'NPC спорят, не объясняют', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true },
  { id: 'C3', block: 'C', text: 'Повседневная жизнь, экономика, суеверия присутствуют', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true },
  { id: 'C4', block: 'C', text: '5 уровней MDA+OT выстроены', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true },
  { id: 'C5', block: 'C', text: 'Телесный якорь в каждой ключевой сцене', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true },
  { id: 'C6', block: 'C', text: 'Момент тишины/замедленного времени', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true },
  { id: 'C7', block: 'C', text: 'Необъяснённые детали для атмосферы', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true },

  // Block D: Characters (7) - L1/L2
  { id: 'D1', block: 'D', text: 'Каждый ключевой персонаж: системный изъян + гамартия', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true },
  { id: 'D2', block: 'D', text: 'Протагонист: ≤3 провалов теста Мэри Сью', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true },
  { id: 'D3', block: 'D', text: 'Цена величия бьёт по идентичности', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true },
  { id: 'D4', block: 'D', text: 'Антагонист: внутренняя логика без злодейской мотивации', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true },
  { id: 'D5', block: 'D', text: 'Телесность и псих-правдоподобие 5/5', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true },
  { id: 'D6', block: 'D', text: 'Убеждения как фильтр восприятия', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true },
  { id: 'D7', block: 'D', text: 'Ни одного из трёх антипаттернов', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true },

  // Block E: Systems and Logic (6) - L1
  { id: 'E1', block: 'E', text: 'Магия прошла тест Сандерсона + Бритва Оккама', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'E2', block: 'E', text: 'Эквивалентный обмен', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'E3', block: 'E', text: 'Система связана с историей, политикой, повседневной жизнью', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'E4', block: 'E', text: '7 типов логических дыр проверены', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'E5', block: 'E', text: 'Иммунитет короля — пройден', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'E6', block: 'E', text: 'Злодей умнее — пройдено', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },

  // Block F: New Elements (2) - L1
  { id: 'F1', block: 'F', text: '5 проверок при добавлении', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'F2', block: 'F', text: '5 уровней касания', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },

  // Block G: Cult Status (1) - L4
  { id: 'G1', block: 'G', text: '8+/11 критериев культовости', tag: 'CORE', level: 'L4', status: 'PENDING', applicable: true },

  // Block H: Scenes (1) - L2
  { id: 'H1', block: 'H', text: 'Тест сцены: ≥9/12, включая Мисдирекшн для начал', tag: 'CORE', level: 'L2', status: 'PENDING', applicable: true },

  // Block I: Thematic Physics (2) - L1/L3
  { id: 'I1', block: 'I', text: 'Тема влияет на физику/магию/экономику', tag: 'CORE', level: 'L1/L3', status: 'PENDING', applicable: true },
  { id: 'I2', block: 'I', text: 'Ключевые механики — уровень онтологического кодирования', tag: 'GAME', level: 'L1/L3', status: 'PENDING', applicable: true },

  // Block J: Grief Architecture (3) - L3
  { id: 'J1', block: 'J', text: 'Все 5 стадий материализованы × 4 уровня', tag: 'CORE', level: 'L3', status: 'PENDING', applicable: true },
  { id: 'J2', block: 'J', text: 'Доминантная стадия определена', tag: 'CORE', level: 'L3', status: 'PENDING', applicable: true },
  { id: 'J3', block: 'J', text: 'Психотипы персонажей — нет дублирования стадий', tag: 'CORE', level: 'L3', status: 'PENDING', applicable: true },

  // Block K: Meta-integration (4) - L4
  { id: 'K1', block: 'K', text: 'Три слоя прошли тест разрушения', tag: 'CORE', level: 'L4', status: 'PENDING', applicable: true },
  { id: 'K2', block: 'K', text: 'Автор в лоре имеет цену', tag: 'CORE', level: 'L4', status: 'PENDING', applicable: true },
  { id: 'K3', block: 'K', text: 'Корнелианский финал: ценность против ценности', tag: 'CORE', level: 'L4', status: 'PENDING', applicable: true },
  { id: 'K4', block: 'K', text: 'Зеркало агента интегрировано', tag: 'CORE', level: 'L4', status: 'PENDING', applicable: true },

  // Block L: Narrative Infrastructure (3) - L2/L3
  { id: 'L1', block: 'L', text: 'Все 4 типа нарративного долга оплачены', tag: 'CORE', level: 'L2/L3', status: 'PENDING', applicable: true },
  { id: 'L2', block: 'L', text: 'Диегетические нарушения — осознанные с обоснованием', tag: 'GAME|VISUAL', level: 'L2/L3', status: 'PENDING', applicable: true },
  { id: 'L3', block: 'L', text: 'Мисдирекшн: ложная экспозиция + аномалии + крючок', tag: 'CORE', level: 'L2/L3', status: 'PENDING', applicable: true },

  // Block M: Finale and Authorship (3) - L4
  { id: 'M1', block: 'M', text: 'Финальный выбор физически меняет мир', tag: 'CORE', level: 'L4', status: 'PENDING', applicable: true },
  { id: 'M2', block: 'M', text: 'Авторский самоаудит пройден', tag: 'CORE', level: 'L4', status: 'PENDING', applicable: true },
  { id: 'M3', block: 'M', text: 'История знает свой финал и не продолжается ради продолжения', tag: 'CORE', level: 'L4', status: 'PENDING', applicable: true },
];

// Glossary with key terms
export const GLOSSARY: GlossaryTerm[] = [
  {
    termRu: 'Гамартия',
    termEn: 'Hamartia',
    definition: 'Роковой изъян, являющийся одновременно силой персонажа и причиной его падения',
    operationalCheck: 'Позволяет ли изъян достичь успеха И приводит ли к финалу?'
  },
  {
    termRu: 'Садовник',
    termEn: 'Gardener',
    definition: 'Профиль автора: персонажи ведут сюжет, письмо-открытие',
    operationalCheck: 'Могут ли персонажи изменить концовку своими выборами?'
  },
  {
    termRu: 'Архитектор',
    termEn: 'Architect',
    definition: 'Профиль автора: сюжет ведёт персонажей, структурированное планирование',
    operationalCheck: 'Обслуживают ли персонажи заранее определённые сюжетные точки?'
  },
  {
    termRu: 'Архитектура Горя',
    termEn: 'Grief Architecture',
    definition: '5 стадий горя как структурный каркас (Отрицание→Гнев→Торг→Депрессия→Принятие)',
    operationalCheck: 'Материализована ли каждая стадия на 4 уровнях (Персонаж+Локация+Механика+Акт)?'
  },
  {
    termRu: 'Тематический Закон',
    termEn: 'Thematic Law',
    definition: 'Тема, выраженная как физический закон мира',
    operationalCheck: 'Нарушает ли удаление темы физику/экономику мира (а не только сюжет)?'
  },
  {
    termRu: 'Корнелианская дилемма',
    termEn: 'Cornelian Dilemma',
    definition: 'Выбор между двумя ценностями, где оба варианта обоснованы и необратимы',
    operationalCheck: 'Оба варианта логически обоснованы? Есть ли третий путь?'
  },
  {
    termRu: 'Телесность',
    termEn: 'Embodiment/Corporeality',
    definition: 'Физические ощущения, ограничения, логистика, заземляющие нарратив',
    operationalCheck: 'Есть ли усталость, боль, запах или деньги в ключевых сценах?'
  },
  {
    termRu: 'Мэри Сью',
    termEn: 'Mary Sue',
    definition: 'Персонаж без значимых изъянов или последствий',
    operationalCheck: 'Балл ≤3/8 по тесту Мэри Сью?'
  },
  {
    termRu: 'Корневая Травма',
    termEn: 'Root Trauma',
    definition: 'Событие, разрушившее прежний порядок и создавшее текущее состояние мира',
    operationalCheck: 'Объясняет ли травма все основные идеологии и конфликты?'
  },
  {
    termRu: 'Зеркало агента',
    termEn: 'Agent Mirror',
    definition: 'Нарративный приём, заставляющий аудиторию задуматься о собственной жизни',
    operationalCheck: 'Заставляет ли финал зрителя задавать себе вопрос через месяц?'
  },
  {
    termRu: 'MDA+OT',
    termEn: 'MDA+OT Framework',
    definition: 'Механика, Динамика, Эстетика + Онтология, Телос (5 уровней нарратива)',
    operationalCheck: 'Все ли 5 уровней присутствуют и согласованы друг с другом?'
  },
  {
    termRu: 'Ripple Effect',
    termEn: 'Ripple Effect',
    definition: 'Сколько других элементов ломается при удалении одного элемента',
    operationalCheck: 'Ломает ли удаление элемента ≥2 других элементов?'
  },
];

// Grief Stage Definitions
export const GRIEF_STAGES: Record<GriefStage, {
  nameRu: string;
  nameEn: string;
  materialization: string;
  fourLevels: string;
  verificationQuestion: string;
}> = {
  denial: {
    nameRu: 'Отрицание',
    nameEn: 'Denial',
    materialization: 'Альтернативная реальность / ложный рай',
    fourLevels: 'Персонаж + Локация + Механика + Акт',
    verificationQuestion: 'Есть ли «красота», которую агент изначально любит?'
  },
  anger: {
    nameRu: 'Гнев',
    nameEn: 'Anger',
    materialization: 'Агрессивная система защиты / ярость как физика',
    fourLevels: 'Персонаж + Локация + Механика + Акт',
    verificationQuestion: 'Есть ли механика, где ярость меняет реальность?'
  },
  bargaining: {
    nameRu: 'Торг',
    nameEn: 'Bargaining',
    materialization: 'Жертвенные ритуалы / контракты',
    fourLevels: 'Персонаж + Локация + Механика + Акт',
    verificationQuestion: 'Есть ли «сделка», которую агент заключает с собой?'
  },
  depression: {
    nameRu: 'Депрессия',
    nameEn: 'Depression',
    materialization: 'Паралич / мёртвые циклы / застывшее время',
    fourLevels: 'Персонаж + Локация + Механика + Акт',
    verificationQuestion: 'Есть ли место, где время буквально останавливается?'
  },
  acceptance: {
    nameRu: 'Принятие',
    nameEn: 'Acceptance',
    materialization: 'Финальный выбор без победы — только трансформация',
    fourLevels: 'Персонаж + Локация + Механика + Акт',
    verificationQuestion: 'Меняет ли выбор не мир, а то, кем остаётся агент?'
  }
};

// Logic Hole Types (7 types)
export const LOGIC_HOLE_TYPES = [
  { type: 'motivation', nameRu: 'Дыра мотивации', nameEn: 'Motivation Hole', symptom: 'Антагонист не сделал очевидного раньше', quickFix: 'Он не знал / ждал условий' },
  { type: 'competence', nameRu: 'Дыра компетентности', nameEn: 'Competence Hole', symptom: 'Умный персонаж глупеет ради сюжета', quickFix: 'Информационный барьер' },
  { type: 'scale', nameRu: 'Дыра масштаба', nameEn: 'Scale Hole', symptom: 'Малое событие → несоразмерные последствия', quickFix: 'Промежуточные звенья' },
  { type: 'resources', nameRu: 'Дыра ресурсов', nameEn: 'Resources Hole', symptom: 'Армия без снабжения', quickFix: 'Логистическая проблема' },
  { type: 'memory', nameRu: 'Дыра памяти', nameEn: 'Memory Hole', symptom: 'Мир забыл ключевое событие', quickFix: 'Механизм умалчивания' },
  { type: 'ideology', nameRu: 'Идеологическая дыра', nameEn: 'Ideology Hole', symptom: 'Фракция противоречит своей идеологии', quickFix: 'Внутренний раскол' },
  { type: 'time', nameRu: 'Дыра времени', nameEn: 'Time Hole', symptom: 'Хронология не сходится', quickFix: 'Пересмотреть темп' },
] as const;

// Vitality Criteria (17 criteria)
export const VITALITY_CRITERIA: VitalityCriteria[] = [
  { id: 1, name: 'Взаимозависимость', test: 'Удалить → ломается ≥2 других', passed: null },
  { id: 2, name: 'Живые NPC', test: 'Защищают позицию, не пересказывают лор', passed: null },
  { id: 3, name: 'Обязательный выбор', test: 'Молчание тоже выбор с ценой', passed: null },
  { id: 4, name: 'Запрещённая стратегия', test: 'Агент может «сломать» систему по логике', passed: null },
  { id: 5, name: 'Бесплатного не бывает', test: 'Каждая сила имеет болезненную цену', passed: null },
  { id: 6, name: 'Мир без агента', test: 'Существовал до и продолжает после', passed: null },
  { id: 7, name: 'Сопротивление мира', test: 'Сопротивляется даже правильным выборам', passed: null },
  { id: 8, name: 'Память мира', test: 'Последствия видны позже в другом контексте', passed: null },
  { id: 9, name: 'Новостной цикл', test: 'Уйти на год — войны без героя', passed: null },
  { id: 10, name: 'Случайный прохожий', test: 'NPC имеют жизнь вне протагониста', passed: null },
  { id: 11, name: 'Иммунитет короля', test: 'Сильнейшая структура имеет уязвимость', passed: null },
  { id: 12, name: 'Бритва Оккама', test: 'Объяснено, почему люди пользуются лопатами', passed: null },
  { id: 13, name: 'Эквивалентный обмен', test: 'Победа без цены невозможна', passed: null },
  { id: 14, name: 'Трагедия без злодея', test: 'Несовместимые истины, а не злой умысел', passed: null },
  { id: 15, name: 'Телесность', test: 'Тело: усталость, пот, болезнь', passed: null },
  { id: 16, name: 'Время вне сюжета', test: 'Вчера и завтра без героя', passed: null },
  { id: 17, name: 'Необъяснённая деталь', test: 'Элементы без объяснения работают на атмосферу', passed: null },
];

// Author Profile Questions (7 questions with weights)
export const AUTHOR_QUESTIONS: AuthorQuestion[] = [
  { id: 'Q1', text: 'Когда персонаж «должен» сделать что-то глупое ради сюжета — вы ищете способ сделать это органичным, а не просто пишете сцену?', weight: 1.0, isKeySignal: false },
  { id: 'Q2', text: 'Знаете ли вы, как персонажи ведут себя в ситуациях, не описанных в нарративе?', weight: 1.0, isKeySignal: false },
  { id: 'Q3', text: 'Возникали ли сюжетные повороты потому, что персонажи к ним пришли, а не потому что вы запланировали их заранее?', weight: 1.5, isKeySignal: true },
  { id: 'Q4', text: 'Был ли вы когда-нибудь удивлены действием собственного персонажа?', weight: 1.0, isKeySignal: false },
  { id: 'Q5', text: 'Могла ли финальная сцена измениться, если бы один ключевой персонаж принял другое решение в середине?', weight: 1.5, isKeySignal: true },
  { id: 'Q6', text: 'Делает ли антагонист правильные вещи в ваших глазах — по собственной логике?', weight: 1.0, isKeySignal: false },
  { id: 'Q7', text: 'Выросла ли трагедия из природы персонажа, а не из сюжетной необходимости?', weight: 1.5, isKeySignal: true },
];

// Cult Status Criteria (11 criteria)
export const CULT_CRITERIA = [
  { id: 1, name: 'Лор-айсберг', description: 'Поверхность + 3-4 скрытых слоя', weight: 'required' },
  { id: 2, name: 'Сопротивление пониманию', description: 'Всегда остаётся «дно»', weight: 'required' },
  { id: 3, name: 'Провокация интерпретации', description: 'Разные люди — разные смыслы', weight: 'high' },
  { id: 4, name: 'Эстетическая уникальность', description: 'Узнаваем по фрагменту', weight: 'high' },
  { id: 5, name: 'Антагонист/Фракция, за которую хочется играть', description: 'Игроки хотят пережить другую сторону', weight: 'high' },
  { id: 6, name: 'Финал переосмысляет начало', description: 'Начало обретает новый смысл', weight: 'medium' },
  { id: 7, name: 'Неудобная правда', description: 'Без моральной снисходительности', weight: 'medium' },
  { id: 8, name: 'Мир расширяется логично', description: 'Новый контент вписывается естественно', weight: 'medium' },
  { id: 9, name: 'Запоминающийся символ', description: 'Артефакт/место запоминается без объяснения', weight: 'medium' },
  { id: 10, name: 'Тема остаётся актуальной', description: 'Тема значима вне нарратива', weight: 'low' },
  { id: 11, name: 'Необъяснённая глубина усиливает', description: 'Тайна помогает, а не раздражает', weight: 'medium' },
] as const;

// Screening Questions (7 questions)
export const SCREENING_QUESTIONS = [
  { id: 1, question: 'Можно ли сформулировать тему мира как правило («В этом мире [X] всегда ведёт к [Y]»)?', flagOnNo: 'Полный аудит §0, §1.4' },
  { id: 2, question: 'Если убрать протагониста — мир продолжает жить (рутина, история, конфликты без героя)?', flagOnNo: 'Критично §3, §4' },
  { id: 3, question: 'Есть ли хотя бы одна сцена, где персонаж устал, платил деньги или чувствовал запах?', flagOnNo: 'Обязательно §1.5, §5' },
  { id: 4, question: 'Несёт ли ключевой персонаж черту, которая одновременно является его силой и его гибелью?', flagOnNo: 'Критично §6' },
  { id: 5, question: 'Есть ли момент, где «правильный» выбор тоже имеет болезненную цену?', flagOnNo: 'Обязательно §2, §16' },
  { id: 6, question: 'Действует ли антагонист (или главная угроза) по логике, которую можно понять и даже принять?', flagOnNo: '§6, §8' },
  { id: 7, question: 'Невозможно ли переписать финал на «счастливый конец» без разрушения смысла всей истории?', flagOnNo: 'Критично §16' },
] as const;

// Media type display names
export const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  game: 'Игра (RPG/Нарративная)',
  novel: 'Роман/Литература',
  film: 'Фильм',
  anime: 'Аниме',
  series: 'Сериал',
  ttrpg: 'TTRPG/Настольная'
};

// Audit mode descriptions
export const AUDIT_MODE_DESCRIPTIONS = {
  conflict: {
    name: 'Режим Конфликта',
    nameRu: 'Режим Конфликта',
    description: 'Западная структура, Путешествие героя, конфликт как драйвер. Антагонист существует, история движется к победе/поражению.',
    questions: 'Преимущественно ДА: внешний антагонист?, траектория победы/поражения?, внешний конфликт?'
  },
  kishō: {
    name: 'Режим Кишō',
    nameRu: 'Режим Кишō',
    description: 'Структура без конфликта, сдвиг перспективы как драйвер. Ки: погружение в состояние. Сё: углубление через детали. Тэн: когнитивный сдвиг. Кэцу: резонанс, а не развязка.',
    questions: 'Преимущественно НЕТ: антагонист?, траектория победы?, внешний конфликт?'
  },
  hybrid: {
    name: 'Гибридный Режим',
    nameRu: 'Гибридный Режим',
    description: 'Архитектура Горя как основа, антагонист как симптом, а не причина. Смешивает внешний и внутренний конфликт.',
    questions: 'Смешанные ответы: есть элементы конфликта, есть фокус на внутреннем.'
  }
};

// Thresholds
export const GATE_THRESHOLD = 60; // 60% required to pass each gate
export const VITALITY_THRESHOLD = 13; // 13/17 = living world
export const CULT_THRESHOLD = 8; // 8/11 = cult potential
export const MARY_SUE_THRESHOLD = 3; // ≤3/8 = acceptable

// Helper function to get level from block
export function getLevelFromBlock(block: string): 'L1' | 'L2' | 'L3' | 'L4' | 'L1/L2' | 'L1/L3' | 'L2/L3' | 'L2/L4' {
  const item = MASTER_CHECKLIST.find(i => i.block === block);
  const level = item?.level;
  if (level && level !== 'L0') {
    return level as 'L1' | 'L2' | 'L3' | 'L4' | 'L1/L2' | 'L1/L3' | 'L2/L3' | 'L2/L4';
  }
  return 'L1';
}

// Helper to check if tag is applicable to media type
export function isTagApplicable(tag: MediaTag | `${MediaTag}|${MediaTag}`, mediaType: MediaType): boolean {
  if (tag === 'CORE') return true;
  
  if (tag.includes('|')) {
    const tags = tag.split('|') as MediaTag[];
    return tags.includes('CORE') || isTagInMediaType(tags, mediaType);
  }
  
  return isTagInMediaType([tag as MediaTag], mediaType);
}

function isTagInMediaType(tags: MediaTag[], mediaType: MediaType): boolean {
  if (tags.includes('GAME') && mediaType === 'game') return true;
  if (tags.includes('VISUAL') && ['film', 'anime', 'series'].includes(mediaType)) return true;
  return false;
}

// Filter checklist by media type
export function filterChecklistByMedia(checklist: ChecklistItem[], mediaType: MediaType): ChecklistItem[] {
  return checklist.map(item => ({
    ...item,
    applicable: isTagApplicable(item.tag, mediaType)
  }));
}
