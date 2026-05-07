/**
 * Markdown-парсер для ответов LLM (Universe Audit Protocol v11.0).
 *
 * Принципы:
 * 1. Извлечение текста между маркерными заголовками ## SECTION_NAME
 * 2. ТОЛЕРАНТНОСТЬ К ВАРИАЦИЯМ LLM: пробелы вместо подчёркиваний,
 *    русские заголовки, bold-обёртки, разные разделители, emoji
 * 3. Если секция не найдена → пустой результат (не ошибка)
 * 4. Если значение не парсится → insufficient_data / null
 * 5. Если весь ответ пуст → выбросить ParseError наверх (→ error состояние)
 *
 * v11.1-fix:
 * - BUGFIX: Fuzzy matching теперь использует includes() вместо точного совпадения
 *   нормализованных строк. Раньше «l1: механизм» не совпадало с алиасом «l1 механизм»
 *   из-за двоеточия. Теперь алиас считается совпавшим, если нормализованный
 *   заголовок содержит нормализованный алиас (или наоборот).
 * - BUGFIX: parseSingleCriterion — конфликт ID блока L (L1, L2, L3) с
 *   уровнями L1/L2/L3. Теперь regex требует, чтобы после ID шёл разделитель
 *   и вердикт, а не просто любой текст. Также добавлен fallback-парсинг
 *   для строк, где LLM пишет формат «- **ID** Вердикт — ...» без двоеточия.
 * - BUGFIX: extractSection/extractSubsection — убран дублирующий расчёт offset.
 * - RELAX: parseSingleCriterion — добавлена поддержка формата без разделителя
 *   между ID и вердиктом (LLM иногда пишет «A1 СИЛЬНО — ...»).
 * - DIAG: Добавлено console.warn при пустых секциях и нулевых assessments.
 */

import type {
  Step1Result,
  Step2Result,
  Step3Result,
  AuditMode,
  AuthorProfile,
  Skeleton,
  ScreeningAnswer,
  CriterionAssessment,
  GriefArchitectureMatrix,
  GriefStageEntry,
  FixRecommendation,
  ChainResult,
  GenerativeOutput,
} from './types-v2';

// ============================================================
// Ошибка парсинга
// ============================================================

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

// ============================================================
// Fuzzy header matching — алиасы заголовков
// ============================================================

/**
 * Маппинг: каноническое имя секции → массив альтернативных написаний,
 * которые LLM может выдать. Каждое имя нормализуется перед сравнением
 * (lowercase + replace _ с пробелом).
 */
const SECTION_ALIASES: Record<string, string[]> = {
  // Step 1 sections (## level)
  'AUDIT_MODE':       ['режим аудита', 'audit mode', 'режим', 'mode'],
  'AUTHOR_PROFILE':   ['профиль автора', 'author profile', 'профиль', 'author'],
  'SKELETON':         ['скелет', 'skeleton', 'скелет концепта', 'скелетона'],
  'SCREENING':        ['скрининг', 'screening', 'скрининг проверок', 'проверки'],

  // Step 2 sections (## level)
  // ВНИМАНИЕ: алиасы не должны быть слишком короткими (например просто «l1»),
  // иначе они совпадут с заголовками типа «## L1: Механизм» из блока L.
  // Порядок: самые специфичные алиасы — первыми.
  'L1_MECHANISM':     ['l1 mechanism', 'l1 механизм', 'уровень 1 механизм', 'l1: механизм', 'уровень 1: механизм', 'l1 механизм (структура)', 'механизм'],
  'L2_BODY':          ['l2 body', 'l2 тело', 'уровень 2 тело', 'l2: тело', 'уровень 2: тело', 'l2 тело (воплощённость)', 'тело'],
  'L3_PSYCHE':        ['l3 psyche', 'l3 психика', 'уровень 3 психика', 'l3: психика', 'уровень 3: психика', 'l3 психика (горе)', 'психика'],
  'L4_META':          ['l4 meta', 'l4 мета', 'уровень 4 мета', 'l4: мета', 'уровень 4: мета', 'l4 мета (интеграция)', 'мета'],

  // Step 3 sections (## level)
  'FIX_LIST':         ['fix list', 'список исправлений', 'исправления', 'фикс-лист', 'фикс лист', 'рекомендации'],
  'WHAT_FOR_CHAINS':  ['what for chains', 'цепочки', 'цепочки а чтобы что', 'chains', 'а чтобы что'],
  'GENERATIVE':       ['generative', 'генеративные', 'генеративные модули', 'генеративное'],

  // Skeleton subsections (### level)
  'thematic_law':       ['тематический закон', 'thematic law', 'закон', 'тема закон'],
  'root_trauma':        ['корневая травма', 'root trauma', 'травма', 'корень травма'],
  'hamartia':           ['хамартия', 'hamartia', 'фатальный изъян', 'изъян'],
  'pillars':            ['столпы', 'pillars', 'опоры', 'столп'],
  'emotional_engine':   ['эмоциональный двигатель', 'emotional engine', 'эмоциональный мотор', 'эмоция двигатель', 'эмоциональный движок'],
  'author_prohibition': ['авторский запрет', 'author prohibition', 'запрет', 'автор запрет'],
  'target_experience':  ['целевой опыт', 'target experience', 'опыт', 'целевой'],
  'central_question':   ['центральный вопрос', 'central question', 'вопрос', 'главный вопрос'],

  // Generative subsections (### level)
  'grief_mapping':    ['карта горя', 'grief mapping', 'маппинг горя', 'привязка горя'],
  'dilemma':          ['дилемма', 'dilemma', 'корнелианская дилемма'],
  'GRIEF_MATRIX':     ['матрица горя', 'grief matrix', 'архитектура горя', 'матрица архитектуры горя'],
};

/**
 * Нормализовать строку для fuzzy-сравнения:
 * - lowercase
 * - заменить _ на пробел
 * - убрать : (двоеточия) — LLM часто пишет «L1: Механизм»
 * - убрать лишние пробелы
 * - убрать markdown bold/italic маркеры (**, *, __)
 */
function normalizeHeader(str: string): string {
  return str
    .toLowerCase()
    .replace(/[_\-:]/g, ' ')      // underscore, dash, colon → пробел
    .replace(/[*_]{1,2}/g, '')    // убрать **, *, __, _
    .replace(/\s+/g, ' ')         // схлопнуть пробелы
    .trim();
}

/**
 * Проверить, совпадает ли заголовок с одним из алиасов.
 * v11.1-fix: Используем substring matching вместо точного совпадения.
 * Если нормализованный заголовок содержит нормализованный алиас
 * (или наоборот), считаем совпадение.
 *
 * Это решает проблему, когда LLM пишет:
 *   ## L1: Механизм (структура и связи)
 * а алиас «l1 механизм» — нормализуется в «l1 механизм».
 * Точное сравнение не сработало из-за скобок и доп. текста.
 */
function headerMatchesAlias(headerText: string, normalizedTargets: string[]): boolean {
  const normalizedHeader = normalizeHeader(headerText);

  for (const target of normalizedTargets) {
    // Точное совпадение (быстрый путь)
    if (normalizedHeader === target) return true;

    // Заголовок содержит алиас (LLM добавила пояснение)
    if (normalizedHeader.includes(target)) return true;

    // Алиас содержит заголовок (маловероятно, но для симметрии)
    if (target.includes(normalizedHeader) && normalizedHeader.length >= 3) return true;
  }

  return false;
}

// ============================================================
// Базовые утилиты (fuzzy)
// ============================================================

/** Извлечь текст между ## HEADER и следующим ## заголовком (или концом текста).
 *  Поддерживает fuzzy matching по алиасам (v11.1: substring matching). */
export function extractSection(markdown: string, header: string): string {
  const aliases = SECTION_ALIASES[header] || [];
  const allHeaders = [header, ...aliases];
  const normalizedTargets = allHeaders.map(normalizeHeader);

  // Ищем первый ## заголовок, который совпадает с одним из алиасов
  const lines = markdown.split('\n');
  let sectionStartIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match ## header (but not ###)
    const headerMatch = line.match(/^##\s+(?!#)\s*(.+?)\s*$/);
    if (!headerMatch) continue;

    if (headerMatchesAlias(headerMatch[1], normalizedTargets)) {
      // Calculate the actual offset in the original string
      let offset = 0;
      for (let j = 0; j < i; j++) {
        offset += lines[j].length + 1; // +1 for \n
      }
      sectionStartIdx = offset + line.length + 1;
      break;
    }
  }

  if (sectionStartIdx === -1) return '';

  // Find the next ## header (but not ###)
  const rest = markdown.slice(sectionStartIdx);
  const nextHeaderRegex = /^##\s+(?!#)/m;
  const nextMatch = nextHeaderRegex.exec(rest);

  if (nextMatch) {
    return rest.slice(0, nextMatch.index).trim();
  }
  return rest.trim();
}

/** Извлечь текст между ### HEADER и следующим ### или ## заголовком.
 *  Поддерживает fuzzy matching по алиасам (v11.1: substring matching). */
export function extractSubsection(markdown: string, header: string): string {
  const aliases = SECTION_ALIASES[header] || [];
  const allHeaders = [header, ...aliases];
  const normalizedTargets = allHeaders.map(normalizeHeader);

  const lines = markdown.split('\n');
  let sectionStartIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match ### header (but not ####)
    const headerMatch = line.match(/^###\s+(?!#)\s*(.+?)\s*$/);
    if (!headerMatch) continue;

    if (headerMatchesAlias(headerMatch[1], normalizedTargets)) {
      let offset = 0;
      for (let j = 0; j < i; j++) {
        offset += lines[j].length + 1;
      }
      sectionStartIdx = offset + line.length + 1;
      break;
    }
  }

  if (sectionStartIdx === -1) return '';

  const rest = markdown.slice(sectionStartIdx);

  // Next ### or ## header
  const nextRegex = /^#{2,3}\s+(?!#)/m;
  const nextMatch = nextRegex.exec(rest);

  if (nextMatch) {
    return rest.slice(0, nextMatch.index).trim();
  }
  return rest.trim();
}

/** Извлечь текст после маркера до конца строки */
export function extractValue(text: string, marker: string): string | null {
  const regex = new RegExp(`${escapeRegex(marker)}\\s*(.+)`, 'i');
  const match = regex.exec(text);
  return match ? match[1].trim() : null;
}

/** Разбить текст на строки, отфильтровать пустые */
export function extractLines(text: string): string[] {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);
}

// ============================================================
// Парсинг Запроса 1: Знакомство + Скелет
// ============================================================

/** Распарсить ответ Запроса 1 целиком */
export function parseStep1Response(markdown: string): Step1Result {
  if (!markdown || !markdown.trim()) {
    throw new ParseError('Пустой ответ LLM для Запроса 1');
  }

  const auditModeSection = extractSection(markdown, 'AUDIT_MODE');
  const authorProfileSection = extractSection(markdown, 'AUTHOR_PROFILE');
  const skeletonSection = extractSection(markdown, 'SKELETON');
  const screeningSection = extractSection(markdown, 'SCREENING');

  // DIAG: логируем пустые секции
  if (!auditModeSection) console.warn('[Parser] Step 1: секция AUDIT_MODE не найдена');
  if (!authorProfileSection) console.warn('[Parser] Step 1: секция AUTHOR_PROFILE не найдена');
  if (!skeletonSection) console.warn('[Parser] Step 1: секция SKELETON не найдена');
  if (!screeningSection) console.warn('[Parser] Step 1: секция SCREENING не найдена');

  const auditMode = parseAuditMode(auditModeSection);
  const authorProfile = parseAuthorProfile(authorProfileSection);
  const skeleton = parseSkeleton(skeletonSection);
  const screeningAnswers = parseScreeningAnswers(screeningSection);
  const screeningFlags = screeningAnswers
    .filter(a => !a.passed)
    .map(a => a.question);

  return {
    auditMode,
    modeRationale: extractModeRationale(auditModeSection),
    authorProfile,
    skeleton,
    screeningAnswers,
    screeningFlags,
  };
}

/** Распарсить секцию AUDIT_MODE */
export function parseAuditMode(section: string): AuditMode {
  const lower = section.toLowerCase();
  if (lower.includes('kishō') || lower.includes('kisho') || lower.includes('ки-сё') || lower.includes('кишо')) {
    return 'kishō';
  }
  if (lower.includes('hybrid') || lower.includes('гибрид')) {
    return 'hybrid';
  }
  // Default to conflict
  return 'conflict';
}

/** Извлечь обоснование режима */
function extractModeRationale(section: string): string {
  // Format: "conflict — обоснование"
  const parts = section.split(/[—\-|]/);
  if (parts.length > 1) {
    return parts.slice(1).join('—').trim();
  }
  return section.trim();
}

/** Распарсить секцию AUTHOR_PROFILE */
export function parseAuthorProfile(section: string): AuthorProfile {
  const lines = extractLines(section);
  if (lines.length === 0) {
    return {
      type: 'hybrid',
      percentage: 50,
      confidence: 0,
      risks: [],
      auditPriorities: [],
    };
  }

  // First line: "gardener — 70% — confidence: high"
  const firstLine = lines[0].toLowerCase();
  let type: 'gardener' | 'hybrid' | 'architect' = 'hybrid';
  if (firstLine.includes('gardener') || firstLine.includes('садовник')) {
    type = 'gardener';
  } else if (firstLine.includes('architect') || firstLine.includes('архитектор')) {
    type = 'architect';
  }

  // Extract percentage
  const pctMatch = section.match(/(\d+)\s*%/);
  const percentage = pctMatch ? parseInt(pctMatch[1], 10) : 50;

  // Extract confidence
  let confidence = 0.5;
  if (/high|высок/i.test(section)) confidence = 1.0;
  else if (/medium|средн/i.test(section)) confidence = 0.5;
  else if (/low|низк/i.test(section)) confidence = 0.2;

  // Extract risks
  const risksLine = extractValue(section, 'Риски:') || extractValue(section, 'risks:') || '';
  const risks = risksLine
    ? risksLine.split(/[,;]/).map(r => r.trim()).filter(r => r.length > 0)
    : [];

  // Extract audit priorities
  const prioritiesLine = extractValue(section, 'Приоритеты аудита:') || extractValue(section, 'audit priorities:') || '';
  const auditPriorities = prioritiesLine
    ? prioritiesLine.split(/[,;]/).map(p => p.trim()).filter(p => p.length > 0)
    : [];

  return { type, percentage, confidence, risks, auditPriorities };
}

/** Распарсить секцию SKELETON */
export function parseSkeleton(section: string): Skeleton {
  const extractSub = (name: string): string | null => {
    const sub = extractSubsection(section, name);
    if (!sub) return null;
    const cleaned = sub
      .replace(/^НЕ НАЙДЕНО$/im, '')
      .replace(/^не найдено$/im, '')
      .replace(/^NOT FOUND$/im, '')
      .replace(/^не найдено\s*\(?/im, '')
      .trim();
    return cleaned || null;
  };

  const thematicLaw = extractSub('thematic_law');
  const rootTrauma = extractSub('root_trauma');
  const hamartia = extractSub('hamartia');
  const emotionalEngine = extractSub('emotional_engine');
  const authorProhibition = extractSub('author_prohibition');
  const targetExperience = extractSub('target_experience');
  const centralQuestion = extractSub('central_question');

  // Parse pillars (numbered list)
  const pillarsSection = extractSubsection(section, 'pillars');
  const pillars: string[] = [];
  if (pillarsSection) {
    const pillarLines = extractLines(pillarsSection);
    for (const line of pillarLines) {
      // Match "1. pillar text" or "- pillar text" or "* pillar text"
      const m = line.match(/^\s*(?:\d+[\.\)]\s*|[-*]\s*)(.+)/);
      if (m && m[1].trim()) {
        pillars.push(m[1].trim());
      }
    }
  }

  return {
    thematicLaw,
    rootTrauma,
    hamartia,
    pillars,
    emotionalEngine,
    authorProhibition,
    targetExperience,
    centralQuestion,
  };
}

/** Распарсить секцию SCREENING (7 ответов ДА/НЕТ + пояснения) */
export function parseScreeningAnswers(section: string): ScreeningAnswer[] {
  const lines = extractLines(section);
  const answers: ScreeningAnswer[] = [];

  const questions = [
    'Тематический закон работает как правило',
    'Мир существует без протагониста',
    'Воплощённость (мир ощущается телесно)',
    'Хамартия (фатальный изъян)',
    'Болезненный выбор',
    'Логика антагониста',
    'Необратимость финала',
  ];

  for (let i = 0; i < lines.length && answers.length < 7; i++) {
    const line = lines[i];

    // Убираем emoji и markdown-обёртки в начале
    const cleaned = line
      .replace(/\s*[✅❌⚪🔴🟢🟡]\s*/g, ' ')  // убрать emoji
      .replace(/\*{1,2}/g, '')                  // убрать bold/italic
      .trim();

    // Match multiple formats:
    // "1. ДА — пояснение" or "1. НЕТ — пояснение"
    // "1. Да, пояснение" (запятая вместо тире)
    // "1) ДА: пояснение"
    // "- ДА — пояснение"
    const match = cleaned.match(
      /^\s*(?:\d+[\.\)]\s*|[-*]\s*)(ДА|НЕТ|YES|NO)\s*[—\-|:,]\s*(.+)/i
    );
    if (match) {
      const passed = /^(ДА|YES)$/i.test(match[1].trim());
      const explanation = match[2].trim();
      const idx = answers.length;
      answers.push({
        question: idx < questions.length ? questions[idx] : `Скрининг ${idx + 1}`,
        passed,
        explanation,
      });
      continue;
    }

    // Fallback: пробуем найти ДА/НЕТ в начале строки без номера
    const fallbackMatch = cleaned.match(
      /^\s*(ДА|НЕТ|YES|NO)\s*[—\-|:,]?\s*(.*)/i
    );
    if (fallbackMatch && answers.length < 7) {
      const passed = /^(ДА|YES)$/i.test(fallbackMatch[1].trim());
      const explanation = fallbackMatch[2].trim() || 'Без пояснения';
      const idx = answers.length;
      answers.push({
        question: idx < questions.length ? questions[idx] : `Скрининг ${idx + 1}`,
        passed,
        explanation,
      });
    }
  }

  // If we couldn't parse any answers, fill with insufficient_data
  while (answers.length < 7) {
    answers.push({
      question: questions[answers.length] || `Скрининг ${answers.length + 1}`,
      passed: false,
      explanation: 'Не удалось распарсить ответ',
    });
  }

  return answers;
}

// ============================================================
// Парсинг Запроса 2: Оценка по критериям
// ============================================================

/**
 * Известные ID критериев из MASTER_CHECKLIST.
 * Используется для валидации распарсенных ID и предотвращения
 * ложных срабатываний (например, L1 как ID блока L vs уровень L1).
 *
 * Критерии блока L имеют id: L1, L2, L3 — их НЕ нужно путать
 * с уровнями L1/L2/L3/L4.
 */
const KNOWN_CRITERIA_IDS = new Set([
  // Block A
  'A1','A2','A3','A4','A5','A6','A7',
  // Block B
  'B1','B2','B3','B4','B5','B6','B7','B8',
  // Block C
  'C1','C2','C3','C4','C5','C6','C7',
  // Block D
  'D1','D2','D3','D4','D5','D6','D7',
  // Block E
  'E1','E2','E3','E4','E5','E6',
  // Block F
  'F1','F2',
  // Block G
  'G1',
  // Block H
  'H1',
  // Block I
  'I1','I2',
  // Block J
  'J1','J2','J3',
  // Block K
  'K1','K2','K3','K4',
  // Block L — ВНИМАНИЕ: L1, L2, L3 — это ID критериев, не уровни!
  'L1','L2','L3',
  // Block M
  'M1','M2','M3',
]);

/** Распарсить ответ Запроса 2 целиком */
export function parseStep2Response(markdown: string, criteriaIds: string[]): Step2Result {
  if (!markdown || !markdown.trim()) {
    throw new ParseError('Пустой ответ LLM для Запроса 2');
  }

  // DIAG: логируем первые 200 символов ответа для диагностики
  console.log('[Parser] Step 2: ответ LLM, первые 200 символов:', markdown.slice(0, 200));

  const l1Section = extractSection(markdown, 'L1_MECHANISM');
  const l2Section = extractSection(markdown, 'L2_BODY');
  const l3Section = extractSection(markdown, 'L3_PSYCHE');
  const l4Section = extractSection(markdown, 'L4_META');

  // DIAG: логируем найденные секции
  console.log(`[Parser] Step 2: L1=${l1Section.length}ch, L2=${l2Section.length}ch, L3=${l3Section.length}ch, L4=${l4Section.length}ch`);

  const assessments: CriterionAssessment[] = [
    ...parseCriterionAssessments(l1Section, 'L1'),
    ...parseCriterionAssessments(l2Section, 'L2'),
    ...parseCriterionAssessments(l3Section, 'L3'),
    ...parseCriterionAssessments(l4Section, 'L4'),
  ];

  // DIAG: логируем сколько критериев распарсилось
  console.log(`[Parser] Step 2: распарсено ${assessments.length} из ${criteriaIds.length} критериев`);

  // If we got fewer assessments than expected, fill missing ones with insufficient_data
  const foundIds = new Set(assessments.map(a => a.id));
  const missingIds = criteriaIds.filter(id => !foundIds.has(id));
  if (missingIds.length > 0) {
    console.warn(`[Parser] Step 2: не найдены критерии: ${missingIds.join(', ')}`);
  }

  for (const id of criteriaIds) {
    if (!foundIds.has(id)) {
      assessments.push({
        id,
        level: guessLevelFromId(id),
        verdict: 'insufficient_data',
        evidence: '',
        explanation: 'Секция не найдена в ответе LLM',
      });
    }
  }

  // Parse grief matrix from L3 section
  const griefSubsection = extractSubsection(l3Section, 'GRIEF_MATRIX');
  const griefMatrix = griefSubsection ? parseGriefMatrix(griefSubsection) : null;

  return { assessments, griefMatrix };
}

/** Распарсить оценки критериев из секции уровня (L1/L2/L3/L4) */
export function parseCriterionAssessments(
  section: string,
  level: 'L1' | 'L2' | 'L3' | 'L4'
): CriterionAssessment[] {
  if (!section.trim()) return [];

  const lines = extractLines(section);
  const assessments: CriterionAssessment[] = [];

  for (const line of lines) {
    // Skip lines that are clearly headers or the GRIEF_MATRIX marker
    if (line.startsWith('###') || line.startsWith('##')) continue;
    if (/^GRIEF_MATRIX/i.test(line)) continue;
    // Skip table dividers
    if (/^\|?[-:\s|]+\|?$/.test(line)) continue;
    // Skip table header rows
    if (/^\|?\s*(стадия|stage|персонаж|character)/i.test(line)) continue;
    // Skip lines that look like narrative text (too long, no ID pattern)
    if (line.length > 300 && !/[A-Z]\d+/i.test(line)) continue;

    const parsed = parseSingleCriterion(line, level);
    if (parsed) {
      assessments.push(parsed);
    }
  }

  return assessments;
}

/**
 * Парсинг отдельного критерия. Ожидаемый формат в markdown:
 *
 *   A1: СИЛЬНО — «Элементы не связаны циклом» — Нет замкнутой петли
 *
 * v11.1-fix — дальнейшая релаксация:
 * - Поддержка формата без разделителя: «A1 СИЛЬНО — ...»
 * - Поддержка формата с дефисом: «- A1: СИЛЬНО — ...»
 * - Валидация ID по KNOWN_CRITERIA_IDS (предотвращает ложные срабатывания)
 * - Fallback: если ID не распознан, пробуем найти вердикт в строке
 * - Block L (L1, L2, L3) корректно обрабатывается — это ID критериев, не уровни
 */
export function parseSingleCriterion(
  line: string,
  level: 'L1' | 'L2' | 'L3' | 'L4'
): CriterionAssessment | null {
  // Strip leading priority markers like "1. [L1]" or "[L1]" or "1."
  let cleaned = line
    .replace(/^\s*\d+[\.\)]\s*/, '')      // "1. " или "1) "
    .replace(/^\s*\[L\d[\/L\d]*\]\s*/, '') // "[L1]" или "[L1/L2]"
    .replace(/^[-*]\s+/, '')                // "- " или "* " в начале
    .replace(/\*{1,2}/g, '')               // убрать **bold** и *italic*
    .trim();

  // Вариант 1: ID с разделителем (: — - |)
  // Match: "A1: СИЛЬНО — ..." or "A1 — СИЛЬНО — ..." or "A1 СИЛЬНО — ..."
  const idWithSepMatch = cleaned.match(/^([A-Z]\d+)\s*[:.\-—|,]?\s*(.+)/i);
  if (idWithSepMatch) {
    const rawId = idWithSepMatch[1].toUpperCase();
    const rest = idWithSepMatch[2];

    // Валидация: известный ли это ID критерия?
    if (KNOWN_CRITERIA_IDS.has(rawId)) {
      return parseCriterionRest(rawId, rest, level);
    }

    // Если ID не из известных — возможно это ложное срабатывание
    // (например «L1» из уровня, а не из блока L).
    // Пробуем дальше — может быть, это просто мусорная строка.
  }

  // Вариант 2: Попытка найти ID критерия в любом месте строки
  // LLM иногда пишет: "1. **A1** СИЛЬНО — ..." или "- A1 СИЛЬНО — ..."
  const idAnywhereMatch = cleaned.match(/\b([A-Z]\d+)\b/i);
  if (idAnywhereMatch) {
    const rawId = idAnywhereMatch[1].toUpperCase();
    if (KNOWN_CRITERIA_IDS.has(rawId)) {
      // Извлекаем текст после ID
      const afterId = cleaned.slice(cleaned.indexOf(idAnywhereMatch[0]) + idAnywhereMatch[0].length).trim();
      // Убираем ведущий разделитель
      const rest = afterId.replace(/^[:.\-—|,]\s*/, '');
      return parseCriterionRest(rawId, rest, level);
    }
  }

  // Не распарсилось — возвращаем null
  return null;
}

/**
 * Распарсить вердикт, evidence и explanation из текста после ID критерия.
 * Вынесено в отдельную функцию для переиспользования из parseSingleCriterion.
 */
function parseCriterionRest(id: string, rest: string, level: 'L1' | 'L2' | 'L3' | 'L4'): CriterionAssessment | null {
  if (!rest.trim()) {
    return {
      id,
      level,
      verdict: 'insufficient_data',
      evidence: '',
      explanation: '',
    };
  }

  // Extract verdict — ищем в первой части до разделителя
  let verdict: CriterionAssessment['verdict'] = 'insufficient_data';
  const lowerRest = rest.toLowerCase();
  const firstPart = lowerRest.split(/[—\-|,]/)[0];

  if (/сильно|strong/i.test(firstPart)) {
    verdict = 'strong';
  } else if (/слабо|weak/i.test(firstPart)) {
    verdict = 'weak';
  } else if (/недостаточно\s*данн|insufficient|н\/д|н\.д/i.test(firstPart)) {
    verdict = 'insufficient_data';
  }

  // Split remaining text by separators
  const parts = rest.split(/[—\-|]/).map(p => p.trim()).filter(p => p.length > 0);

  // First part is verdict text (already extracted), rest is evidence + explanation
  const verdictIdx = parts.findIndex(p =>
    /сильно|слабо|недостаточно|strong|weak|insufficient/i.test(p)
  );

  let evidence = '';
  let explanation = '';

  if (verdictIdx >= 0 && parts.length > verdictIdx + 1) {
    evidence = parts[verdictIdx + 1].replace(/^["«]|["»]$/g, '').trim();
    if (parts.length > verdictIdx + 2) {
      explanation = parts.slice(verdictIdx + 2).join(' — ').replace(/^["«]|["»]$/g, '').trim();
    }
  } else if (parts.length > 1) {
    evidence = parts[1].replace(/^["«]|["»]$/g, '').trim();
    if (parts.length > 2) {
      explanation = parts.slice(2).join(' — ').replace(/^["«]|["»]$/g, '').trim();
    }
  }

  return {
    id,
    level,
    verdict,
    evidence,
    explanation,
  };
}

/** Распарсить grief matrix из подсекции L3 */
export function parseGriefMatrix(section: string): GriefArchitectureMatrix | null {
  if (!section.trim()) return null;

  const lines = extractLines(section);
  const stages: GriefStageEntry[] = [];

  const stageNames = ['denial', 'anger', 'bargaining', 'depression', 'acceptance'];
  const stageNamesRu: Record<string, string> = {
    'отрицание': 'denial',
    'гнев': 'anger',
    'торг': 'bargaining',
    'депрессия': 'depression',
    'принятие': 'acceptance',
  };

  for (const line of lines) {
    // Match table rows: | denial | character | location | mechanic | act |
    const cells = line.split('|').map(c => c.trim()).filter(c => c.length > 0);
    if (cells.length < 4) continue;

    // Check if first cell is a grief stage
    const stageCandidate = cells[0].toLowerCase();
    let matchedStage = stageNames.find(s => stageCandidate.includes(s));
    if (!matchedStage) {
      // Try Russian stage names
      for (const [ru, en] of Object.entries(stageNamesRu)) {
        if (stageCandidate.includes(ru)) {
          matchedStage = en;
          break;
        }
      }
    }
    if (!matchedStage) continue;

    stages.push({
      stage: matchedStage,
      levels: {
        character: cells[1] || '',
        location: cells[2] || '',
        mechanic: cells[3] || '',
        act: cells[4] || '',
      },
    });
  }

  if (stages.length === 0) return null;

  // Extract dominant stage
  const dominantMatch = section.match(/доминирующ\w+\s+стади\w*:\s*(\w+)/i) ||
    section.match(/dominant\s+stage:\s*(\w+)/i);
  let dominantStage: string | null = null;
  if (dominantMatch) {
    const candidate = dominantMatch[1].toLowerCase();
    dominantStage = stageNames.find(s => candidate.includes(s)) || null;
    if (!dominantStage) {
      // Try Russian
      for (const [ru, en] of Object.entries(stageNamesRu)) {
        if (candidate.includes(ru)) {
          dominantStage = en;
          break;
        }
      }
    }
  }

  // Calculate acrossLevels for dominant stage
  let acrossLevels = 0;
  if (dominantStage) {
    const dom = stages.find(s => s.stage === dominantStage);
    if (dom) {
      acrossLevels = Object.values(dom.levels).filter(v => v && v.trim().length > 0).length;
    }
  }

  return { stages, dominantStage, acrossLevels };
}

/**
 * Guess level from criterion ID prefix.
 * v11.1-fix: Block L (L1, L2, L3) — эти ID совпадают с именами уровней,
 * но это критерии из блока L (Narrative Infrastructure), их уровень — L2/L3.
 * Берём L2 как дефолт для блока L (по данным MASTER_CHECKLIST).
 */
export function guessLevelFromId(id: string): 'L1' | 'L2' | 'L3' | 'L4' {
  const block = id.charAt(0).toUpperCase();
  switch (block) {
    case 'A': case 'B': case 'E': case 'F': return 'L1';
    case 'C': case 'D': case 'H': return 'L2';
    case 'I': return 'L3';       // I1/I2 → L1/L3 → берём L3 (тематическая физика = психика)
    case 'J': return 'L3';
    case 'L': return 'L2';       // Block L (L1, L2, L3) → L2 (нарративная инфраструктура = тело)
    case 'G': case 'K': case 'M': return 'L4';
    default: return 'L1';
  }
}

// ============================================================
// Парсинг Запроса 3: Рекомендации
// ============================================================

/** Распарсить ответ Запроса 3 целиком */
export function parseStep3Response(markdown: string): Step3Result {
  if (!markdown || !markdown.trim()) {
    throw new ParseError('Пустой ответ LLM для Запроса 3');
  }

  const fixListSection = extractSection(markdown, 'FIX_LIST');
  const chainsSection = extractSection(markdown, 'WHAT_FOR_CHAINS');
  const generativeSection = extractSection(markdown, 'GENERATIVE');

  return {
    fixList: parseFixList(fixListSection),
    whatForChains: parseChains(chainsSection),
    generative: parseGenerative(generativeSection),
  };
}

/**
 * Распарсить приоритизированный fix-лист.
 * v11.1-fix: расслаблена — [L1] тег опционален, разделители гибкие
 */
export function parseFixList(section: string): FixRecommendation[] {
  if (!section.trim()) return [];

  const lines = extractLines(section);
  const fixes: FixRecommendation[] = [];
  let priority = 1;

  for (const line of lines) {
    // Strip bold markers
    const cleaned = line.replace(/\*{1,2}/g, '').trim();

    // Primary pattern: "1. [L1] interdependence: Диагноз | Исправление | подход | усилие"
    let match = cleaned.match(
      /^\s*\d+[\.\)]\s*\[(L\d[\/L\d]*)\]\s*([A-Z]\d+)\s*[:.\-—]\s*(.+)/i
    );

    // Fallback pattern without [Lx] tag: "1. A1: Диагноз | Исправление | подход | усилие"
    if (!match) {
      match = cleaned.match(
        /^\s*\d+[\.\)]\s*([-*]\s*)?([A-Z]\d+)\s*[:.\-—]\s*(.+)/i
      );
      if (match) {
        // Reconstruct: no level tag, guess from ID
        const criterionId = match[2].toUpperCase();
        const rest = match[3];
        const level = guessLevelFromId(criterionId);
        const parts = rest.split(/[|—]/).map(p => p.trim()).filter(p => p.length > 0);

        const diagnosis = parts[0] || '';
        const fix = parts[1] || '';

        let approach: FixRecommendation['approach'] = 'compromise';
        if (parts.length > 2) {
          const aLower = parts[2].toLowerCase();
          if (aLower.includes('консерватив') || aLower.includes('conservative')) approach = 'conservative';
          else if (aLower.includes('радикал') || aLower.includes('radical')) approach = 'radical';
        }

        let effort: FixRecommendation['effort'] = 'days';
        if (parts.length > 3) {
          const eLower = parts[3].toLowerCase();
          if (eLower.includes('час') || eLower.includes('hour')) effort = 'hours';
          else if (eLower.includes('недел') || eLower.includes('week')) effort = 'weeks';
        }

        fixes.push({
          priority: priority++,
          criterionId,
          level,
          diagnosis,
          fix,
          approach,
          effort,
        });
        continue;
      }
    }

    if (!match) continue;

    const levelStr = match[1];
    const criterionId = match[2].toUpperCase();
    const rest = match[3];

    // Determine level
    let level: FixRecommendation['level'] = 'L1';
    if (levelStr.includes('L4')) level = 'L4';
    else if (levelStr.includes('L3')) level = 'L3';
    else if (levelStr.includes('L2')) level = 'L2';

    // Split by | or —
    const parts = rest.split(/[|—]/).map(p => p.trim()).filter(p => p.length > 0);

    const diagnosis = parts[0] || '';
    const fix = parts[1] || '';

    // Parse approach
    let approach: FixRecommendation['approach'] = 'compromise';
    if (parts.length > 2) {
      const aLower = parts[2].toLowerCase();
      if (aLower.includes('консерватив') || aLower.includes('conservative')) approach = 'conservative';
      else if (aLower.includes('радикал') || aLower.includes('radical')) approach = 'radical';
    }

    // Parse effort
    let effort: FixRecommendation['effort'] = 'days';
    if (parts.length > 3) {
      const eLower = parts[3].toLowerCase();
      if (eLower.includes('час') || eLower.includes('hour')) effort = 'hours';
      else if (eLower.includes('недел') || eLower.includes('week')) effort = 'weeks';
    }

    fixes.push({
      priority: priority++,
      criterionId,
      level,
      diagnosis,
      fix,
      approach,
      effort,
    });
  }

  return fixes;
}

/** Распарсить цепочки «А чтобы что?» */
export function parseChains(section: string): ChainResult[] {
  if (!section.trim()) return [];

  const chains: ChainResult[] = [];
  // Split by ### subsections (each chain starts with ### criterionId)
  const subsectionRegex = /###\s+([A-Z]\d+)/gi;
  let match: RegExpExecArray | null;
  const positions: { id: string; start: number }[] = [];

  while ((match = subsectionRegex.exec(section)) !== null) {
    positions.push({ id: match[1].toUpperCase(), start: match.index + match[0].length });
  }

  for (let i = 0; i < positions.length; i++) {
    const id = positions[i].id;
    const start = positions[i].start;
    const end = i + 1 < positions.length ? positions[i + 1].start - 4 : section.length;
    const chainText = section.slice(start, end).trim();

    const chain: string[] = [];
    const lines = extractLines(chainText);

    for (const line of lines) {
      // Match: "А чтобы что? → ответ" or "-> answer" or "→ answer"
      const chainMatch = line.match(/[→\-]>\s*(.+)/);
      if (chainMatch) {
        chain.push(chainMatch[1].trim());
      }
    }

    // Extract root cause
    let rootCause = '';
    const rootMatch = chainText.match(/корень:\s*(.+)/i) || chainText.match(/root:\s*(.+)/i);
    if (rootMatch) {
      rootCause = rootMatch[1].trim();
    }

    if (chain.length > 0 || rootCause) {
      chains.push({
        criterionId: id,
        chain,
        rootCause,
      });
    }
  }

  return chains;
}

/** Распарсить генеративные модули */
export function parseGenerative(section: string): GenerativeOutput {
  const griefMappingSub = extractSubsection(section, 'grief_mapping');
  const dilemmaSub = extractSubsection(section, 'dilemma');

  const griefMapping = griefMappingSub &&
    !/НЕ ПРИМЕНИМО|NOT APPLICABLE/i.test(griefMappingSub)
    ? griefMappingSub.trim()
    : null;

  const dilemma = dilemmaSub &&
    !/НЕ ПРИМЕНИМО|NOT APPLICABLE/i.test(dilemmaSub)
    ? dilemmaSub.trim()
    : null;

  return { griefMapping, dilemma };
}

// ============================================================
// Helpers
// ============================================================

/** Escape special regex characters */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
