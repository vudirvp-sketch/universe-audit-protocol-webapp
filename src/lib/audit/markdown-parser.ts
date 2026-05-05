/**
 * Markdown-парсер для ответов LLM (Universe Audit Protocol v11.0).
 *
 * Принципы:
 * 1. Извлечение текста между маркерными заголовками ## SECTION_NAME
 * 2. Толерантность к вариациям: лишние пробелы, другой регистр, markdown-форматирование
 * 3. Если секция не найдена → пустой результат (не ошибка)
 * 4. Если значение не парсится → insufficient_data / null
 * 5. Если весь ответ пуст → выбросить ParseError наверх (→ error состояние)
 */

import type {
  Step1Result,
  Step2Result,
  Step3Result,
  AuditModeV2,
  AuthorProfileV2,
  SkeletonV2,
  ScreeningAnswer,
  CriterionAssessment,
  GriefArchitectureMatrixV2,
  GriefStageEntry,
  FixRecommendation,
  ChainResultV2,
  GenerativeOutputV2,
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
// Базовые утилиты
// ============================================================

/** Извлечь текст между ## HEADER и следующим ## заголовком (или концом текста) */
export function extractSection(markdown: string, header: string): string {
  // Case-insensitive, allow extra spaces
  const regex = new RegExp(
    `^##\\s+${escapeRegex(header)}\\s*$`,
    'im'
  );
  const match = regex.exec(markdown);
  if (!match) return '';

  const startIdx = match.index + match[0].length;

  // Find the next ## header (but not ###)
  const nextHeaderRegex = /^##\s+(?!#)/m;
  const rest = markdown.slice(startIdx);
  const nextMatch = nextHeaderRegex.exec(rest);

  if (nextMatch) {
    return rest.slice(0, nextMatch.index).trim();
  }
  return rest.trim();
}

/** Извлечь текст между ### HEADER и следующим ### или ## заголовком */
export function extractSubsection(markdown: string, header: string): string {
  const regex = new RegExp(
    `^###\\s+${escapeRegex(header)}\\s*$`,
    'im'
  );
  const match = regex.exec(markdown);
  if (!match) return '';

  const startIdx = match.index + match[0].length;
  const rest = markdown.slice(startIdx);

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
export function parseAuditMode(section: string): AuditModeV2 {
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
export function parseAuthorProfile(section: string): AuthorProfileV2 {
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
export function parseSkeleton(section: string): SkeletonV2 {
  const extractSub = (name: string): string | null => {
    const sub = extractSubsection(section, name);
    if (!sub) return null;
    const cleaned = sub
      .replace(/^НЕ НАЙДЕНО$/im, '')
      .replace(/^не найдено$/im, '')
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
    // Match: "1. ДА — пояснение" or "1. НЕТ — пояснение"
    const match = line.match(/^\s*\d+[\.\)]\s*(ДА|НЕТ|YES|NO)\s*[—\-|:]\s*(.+)/i);
    if (match) {
      const passed = /^ДА|YES$/i.test(match[1].trim());
      const explanation = match[2].trim();
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

/** Распарсить ответ Запроса 2 целиком */
export function parseStep2Response(markdown: string, criteriaIds: string[]): Step2Result {
  if (!markdown || !markdown.trim()) {
    throw new ParseError('Пустой ответ LLM для Запроса 2');
  }

  const l1Section = extractSection(markdown, 'L1_MECHANISM');
  const l2Section = extractSection(markdown, 'L2_BODY');
  const l3Section = extractSection(markdown, 'L3_PSYCHE');
  const l4Section = extractSection(markdown, 'L4_META');

  const assessments: CriterionAssessment[] = [
    ...parseCriterionAssessments(l1Section, 'L1'),
    ...parseCriterionAssessments(l2Section, 'L2'),
    ...parseCriterionAssessments(l3Section, 'L3'),
    ...parseCriterionAssessments(l4Section, 'L4'),
  ];

  // If we got fewer assessments than expected, fill missing ones with insufficient_data
  const foundIds = new Set(assessments.map(a => a.id));
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
 *   interdependence: СЛАБО — «Элементы не связаны циклом» — Нет замкнутой петли
 *
 * Толерантность:
 * - Вердикт может быть: СИЛЬНО / СЛАБО / НЕДОСТАТОЧНО ДАННЫХ (и в любом регистре)
 * - Разделитель может быть: —, -, |, :
 * - Доказательство может быть в кавычках или без
 */
export function parseSingleCriterion(
  line: string,
  level: 'L1' | 'L2' | 'L3' | 'L4'
): CriterionAssessment | null {
  // Pattern: id: verdict — evidence — explanation
  // or: id: verdict — evidence
  // Also: id: ВЕРДИКТ — "evidence" — explanation
  // Also: [L1] id: ВЕРДИКТ | evidence | explanation

  // Strip leading priority markers like "1. [L1]" or "[L1]"
  const cleaned = line.replace(/^\s*\d+[\.\)]\s*/, '').replace(/^\s*\[L\d[\/L\d]*\]\s*/, '');

  // Extract ID: first token before the first separator
  const idMatch = cleaned.match(/^([A-Z]\d+)\s*[:.\-—]\s*(.+)/i);
  if (!idMatch) return null;

  const id = idMatch[1].toUpperCase();
  const rest = idMatch[2];

  // Extract verdict
  let verdict: CriterionAssessment['verdict'] = 'insufficient_data';
  const lowerRest = rest.toLowerCase();

  if (/сильно|strong/i.test(lowerRest.split(/[—\-|]/)[0])) {
    verdict = 'strong';
  } else if (/слабо|weak/i.test(lowerRest.split(/[—\-|]/)[0])) {
    verdict = 'weak';
  } else if (/недостаточно\s*данн|insufficient/i.test(lowerRest.split(/[—\-|]/)[0])) {
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
export function parseGriefMatrix(section: string): GriefArchitectureMatrixV2 | null {
  if (!section.trim()) return null;

  const lines = extractLines(section);
  const stages: GriefStageEntry[] = [];

  const stageNames = ['denial', 'anger', 'bargaining', 'depression', 'acceptance'];

  for (const line of lines) {
    // Match table rows: | denial | character | location | mechanic | act |
    const cells = line.split('|').map(c => c.trim()).filter(c => c.length > 0);
    if (cells.length < 4) continue;

    // Check if first cell is a grief stage
    const stageCandidate = cells[0].toLowerCase();
    const matchedStage = stageNames.find(s => stageCandidate.includes(s));
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
  const dominantStage = dominantMatch
    ? stageNames.find(s => dominantMatch[1].toLowerCase().includes(s)) || null
    : null;

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

/** Guess level from criterion ID prefix */
function guessLevelFromId(id: string): 'L1' | 'L2' | 'L3' | 'L4' {
  const block = id.charAt(0).toUpperCase();
  switch (block) {
    case 'A': case 'B': case 'E': case 'F': return 'L1';
    case 'C': case 'D': case 'H': return 'L2';
    case 'J': case 'I': return 'L3';
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

/** Распарсить приоритизированный fix-лист */
export function parseFixList(section: string): FixRecommendation[] {
  if (!section.trim()) return [];

  const lines = extractLines(section);
  const fixes: FixRecommendation[] = [];
  let priority = 1;

  for (const line of lines) {
    // Match: "1. [L1] interdependence: Диагноз | Исправление | подход | усилие"
    // or: "- [L1] id: Диагноз | Исправление | подход | усилие"
    const match = line.match(
      /^\s*\d+[\.\)]\s*\[(L\d[\/L\d]*)\]\s*([A-Z]\d+)\s*[:.\-—]\s*(.+)/i
    );
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
export function parseChains(section: string): ChainResultV2[] {
  if (!section.trim()) return [];

  const chains: ChainResultV2[] = [];
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
      // Match: "А чтобы что? → ответ" or "-> answer"
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
export function parseGenerative(section: string): GenerativeOutputV2 {
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
