// Universe Audit Protocol v10.0 - Protocol Data

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
interface LegacyChecklistItem {
  id: string;
  block: string;
  text: string;
  tag: MediaTag | `${MediaTag}|${MediaTag}`;
  level: string;
  status: ChecklistItemStatus;
  evidence?: string;
  functionalRole?: string;
  applicable: boolean;
}

// ============================================================
// Master Checklist - 52 items with media tags
// ============================================================

export const MASTER_CHECKLIST: LegacyChecklistItem[] = [
  // Block A: Structure (7) - L1
  { id: 'A1', block: 'A', text: 'Тематический закон сформулирован как физическое правило, влияет на физику/экономику', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'A2', block: 'A', text: 'Корневая травма определена и объясняет все идеологии', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'A3', block: 'A', text: 'Хамартия — финал вытекает из природы протагониста', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
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
  { id: 'D1', block: 'D', text: 'Каждый ключевой персонаж: системный изъян + хамартия', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true },
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
