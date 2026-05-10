// Universe Audit Protocol v11.0 - Protocol Data
// Synchronised with АУДИТ_ВСЕЛЕННОЙ v10.0

// ============================================================
// Legacy types — previously in types.ts, now defined locally
// ============================================================

/** Legacy media type — used by MASTER_CHECKLIST */
type LegacyMediaType = 'game' | 'novel' | 'film' | 'anime' | 'series' | 'ttrpg';

/** Legacy media tag — used by MASTER_CHECKLIST */
type MediaTag = 'CORE' | 'GAME' | 'VISUAL' | 'AUDIO' | 'INTERACTIVE';

/** Legacy checklist item status — used by MASTER_CHECKLIST */
type ChecklistItemStatus = 'PASS' | 'FAIL' | 'INSUFFICIENT_DATA' | 'PENDING';

/** Legacy checklist item — used by MASTER_CHECKLIST */
export interface LegacyChecklistItem {
  id: string;
  block: string;
  text: string;
  tag: MediaTag | `${MediaTag}|${MediaTag}`;
  level: string;
  status: ChecklistItemStatus;
  evidence?: string;
  functionalRole?: string;
  applicable: boolean;
  /** Which media types this item applies to (based on v10.0 Part VI matrix) */
  applicableMedia: Array<'all' | 'game' | 'visual' | 'ttrpg' | 'narrative'>;
}

// ============================================================
// Master Checklist - 52 items with media tags
// Texts updated to match v10.0 terminology exactly.
// ============================================================

export const MASTER_CHECKLIST: LegacyChecklistItem[] = [
  // Block A: Structure (7) - L1 — ALL media types
  { id: 'A1', block: 'A', text: 'Тематический Закон сформулирован как физическое правило мира, влияет на физику/экономику', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'A2', block: 'A', text: 'Корневая Травма определена и объясняет все идеологии', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'A3', block: 'A', text: 'Гамартия — финал вытекает из природы протагониста', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'A4', block: 'A', text: '3 Неприкасаемых Столпа — замкнутый цикл A→B→C→A', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'A5', block: 'A', text: 'Запрет Автора зафиксирован', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'A6', block: 'A', text: 'Целевой Опыт — противоречивые чувства, не одна эмоция', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'A7', block: 'A', text: 'Центральный Вопрос — один, через всю историю', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true, applicableMedia: ['all'] },

  // Block B: Connectedness (8) - L1 — ALL media types
  { id: 'B1', block: 'B', text: 'Матрица N×N: нет пустых ячеек, глагол-действие в каждой', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'B2', block: 'B', text: 'Матрица фракций: заполнена глаголами (минимум 5×5)', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'B3', block: 'B', text: 'Каждая фракция ≥4/6 критериев живости (внутренний конфликт, экономическое влияние, присоединение закрывает/открывает, NPC спорят, тёмная сторона, идеологическая травма)', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'B4', block: 'B', text: 'Каждый элемент: Ripple Effect ≥2', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'B5', block: 'B', text: 'Пространственная память: след без объяснения (Tarkovsky)', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'B6', block: 'B', text: 'Правило трёх рукопожатий: любые два элемента — через ≤3 шага', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'B7', block: 'B', text: 'Нет висячего контента', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'B8', block: 'B', text: 'Экономическая стрела для всех явлений (откуда/кто контролирует/на что меняют/кто страдает/что едят/суеверия)', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true, applicableMedia: ['all'] },

  // Block C: Vitality (7) - L1/L2 — ALL media types
  { id: 'C1', block: 'C', text: '13/17 критериев живого мира (порог: 13/17=жив, 10-12=доработка, <10=редизайн)', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'C2', block: 'C', text: 'NPC спорят, не объясняют (защищают позицию, не пересказывают лор)', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'C3', block: 'C', text: 'Быт, экономика, суеверия (ритуал без автора) присутствуют', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'C4', block: 'C', text: '5 уровней MDA+OT согласованы (рассинхрон = ирония или исправление)', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'C5', block: 'C', text: 'Телесный якорь в каждой ключевой сцене (запах, боль, усталость, деньги)', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'C6', block: 'C', text: 'Момент тишины/медленного времени (персонаж просто сидит и смотрит в окно)', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'C7', block: 'C', text: 'Необъяснённые детали на атмосферу (убрать элемент → ≥2 артефакта исчезнет)', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true, applicableMedia: ['all'] },

  // Block D: Characters (7) - L1/L2 — ALL media types
  { id: 'D1', block: 'D', text: 'Каждый ключевой персонаж: Мотивация → Гамартия → Недостаток → Арка → Убеждение', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'D2', block: 'D', text: 'Протагонист: ≤3 провала в тесте Мэри Сью (8 пунктов)', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'D3', block: 'D', text: 'Цена Величия бьёт по идентичности, не по ХП (не «болит голова», а «каждое заклинание воскрешает лицо убитого учителя»)', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'D4', block: 'D', text: 'Антагонист: внутренняя логика без «злодейской» мотивации', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'D5', block: 'D', text: 'Психодостоверность 5/5 (убеждение-драйвер, старая привычка, страх в избегании, фраза-щит, диалог-непонимание)', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'D6', block: 'D', text: 'Убеждения как фильтр восприятия (нигилист и идеалист видят разные руины)', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'D7', block: 'D', text: 'Ни одного из трёх антипаттернов: Стагнация / Деградация интеллекта / Физическое решение психологической проблемы', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true, applicableMedia: ['all'] },

  // Block E: Systems and Logic (6) - L1
  { id: 'E1', block: 'E', text: 'Магия прошла тест Сандерсона (5 вопросов) + Бритву Оккама + Жёсткое правило: почему другие не делают то же самое?', tag: 'GAME', level: 'L1', status: 'PENDING', applicable: true, applicableMedia: ['game', 'ttrpg'] },
  { id: 'E2', block: 'E', text: 'Эквивалентный обмен (победа без цены невозможна)', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'E3', block: 'E', text: 'Система связана с историей, политикой, бытом (5 проверок: изменила историю до начала, фракции по-разному, люди относятся обыденно, злоупотребление имело последствия, создаёт неравенство)', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'E4', block: 'E', text: '7 типов логических дыр проверены (мотивация, компетентность, масштаб, ресурсы, память, идеология, время)', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'E5', block: 'E', text: 'Иммунитет Короля — у сильнейшей структуры есть уязвимость', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'E6', block: 'E', text: 'Злодей умнее — антагонист действует по логике, которую можно понять', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true, applicableMedia: ['all'] },

  // Block F: New Elements (2) - L1 — ALL media types
  { id: 'F1', block: 'F', text: '5 проверок при добавлении (усиливает ≥2 столпов / создаёт дилемму / видимая цена / Ripple ≥2 / буквальный + символический уровни)', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'F2', block: 'F', text: '5 уровней касания (Диалог → Выбор → Текстура → Тень → Метафора; 1-2 = недоделан)', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true, applicableMedia: ['all'] },

  // Block G: Cult Status (1) - L4 — ALL media types
  { id: 'G1', block: 'G', text: '8+/11 критериев культовости: айсберг-лор, сопротивление пониманию, провокация интерпретаций, эстетическая уникальность, антагонист за которого хочется играть, финал переосмысляет начало, неудобная правда, логичное расширение, символ без пояснений, актуальность вне нарратива, необъяснённая глубина усиливает', tag: 'CORE', level: 'L4', status: 'PENDING', applicable: true, applicableMedia: ['all'] },

  // Block H: Scenes (1) - L2 — ALL media types
  { id: 'H1', block: 'H', text: 'Тест сцены: Прошлое (что было вчера?) + Настоящее (телесный якорь, противоречие, деталь без объяснения, тишина, NPC без героя) + Будущее (что завтра? цена? кто заплатит?) + Мисдирекшн (для стартовых). ≥3/4 → сцена живая', tag: 'CORE', level: 'L2', status: 'PENDING', applicable: true, applicableMedia: ['all'] },

  // Block I: Thematic Physics (2) - L1/L3
  { id: 'I1', block: 'I', text: 'Тема влияет на физику/магию/экономику (убрать тему — рушится физика, а не только сюжет)', tag: 'CORE', level: 'L1/L3', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'I2', block: 'I', text: 'Ключевые механики — онтологического уровня кодирования (убрать механику = разрушить тему)', tag: 'GAME', level: 'L1/L3', status: 'PENDING', applicable: true, applicableMedia: ['game', 'ttrpg'] },

  // Block J: Grief Architecture (3) - L3 — ALL media types
  { id: 'J1', block: 'J', text: 'Все 5 стадий горя материализованы × 4 уровня (Персонаж + Локация + Механика + Акт). Стадия на одном уровне = структурная дыра', tag: 'CORE', level: 'L3', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'J2', block: 'J', text: 'Доминирующая стадия горя определена через Тематический Закон (лишает иллюзий→Отрицание, контроля→Гнев, любви→Торг, смысла→Депрессия, требует отпустить→Принятие)', tag: 'CORE', level: 'L3', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'J3', block: 'J', text: 'Психотипы персонажей — нет дублирования стадий горя + Тест «Ложный Протагонист» (гибель в Акте 1 меняет жанровый контракт?)', tag: 'CORE', level: 'L3', status: 'PENDING', applicable: true, applicableMedia: ['all'] },

  // Block K: Meta-integration (4) - L4 — ALL media types
  { id: 'K1', block: 'K', text: 'Три слоя реальности прошли тест на разрушение: Личный (убрать желание → нечего делать), Сюжетный (убрать причинность → дыра), Мета-авторский (убрать вопрос → «только хорошая история»)', tag: 'CORE', level: 'L4', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'K2', block: 'K', text: 'Автор в лоре имеет цену (самоаудит: что боюсь показать? какую часть себя убью? вопрос который боюсь задать? уважаю ли читателя?)', tag: 'CORE', level: 'L4', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'K3', block: 'K', text: 'Корнелианский финал: ценность vs ценность (не добро vs зло), необратимость, идентичность («кем стал?»), цена победы = предательство одной правды. Нет «третьего пути»', tag: 'CORE', level: 'L4', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'K4', block: 'K', text: 'Зеркало агента встроено (через месяц агент думает о сделанном выборе применительно к своей жизни). Формула: «Ты способен ___?»', tag: 'CORE', level: 'L4', status: 'PENDING', applicable: true, applicableMedia: ['all'] },

  // Block L: Narrative Infrastructure (3) - L2/L3
  { id: 'L1', block: 'L', text: 'Все 4 типа нарративного долга погашены: Информационный (раскрытие > ожидание), Эмоциональный (последствия видны), Механический (применение в кульминации), Тематический (финал = трагедия/трансценденция)', tag: 'CORE', level: 'L2/L3', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'L2', block: 'L', text: 'Диегетические нарушения осознанные с обоснованием (интерфейс/сохранение/обучение/информация — может ли персонаж объяснить без четвёртой стены?)', tag: 'GAME|VISUAL', level: 'L2/L3', status: 'PENDING', applicable: true, applicableMedia: ['game', 'visual'] },
  { id: 'L3', block: 'L', text: 'Мисдирекшн: ложная экспозиция (15-20 мин любви без понимания правил) + визуальные аномалии (позже = ужас) + эмоциональный крючок (шок до лора) + слоёный лук (каждый слой болезненнее)', tag: 'CORE', level: 'L2/L3', status: 'PENDING', applicable: true, applicableMedia: ['all'] },

  // Block M: Finale and Authorship (3) - L4 — ALL media types
  { id: 'M1', block: 'M', text: 'Финальный выбор физически меняет мир (пост-финальный мир: что исчезает? Мир «сохраняет себя»? → выбор не был необратимым)', tag: 'CORE', level: 'L4', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'M2', block: 'M', text: 'Авторский самоаудит пройден (4 вопроса с честными ответами)', tag: 'CORE', level: 'L4', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
  { id: 'M3', block: 'M', text: 'История знает свой финал и не продолжается ради продолжения (убери последний сезон — финал лучше или хуже?)', tag: 'CORE', level: 'L4', status: 'PENDING', applicable: true, applicableMedia: ['all'] },
];
