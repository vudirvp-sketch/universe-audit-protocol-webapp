/**
 * T3.1-T3.4 — Diagnostics Layer
 * Universe Audit Protocol v10.0
 * 
 * Implements:
 * - T3.1: Gate Breakdown + Explicit Status
 * - T3.2: Structured Comparative Gap Format
 * - T3.3: Self-Audit Dialogic Pause
 * - T3.4: Protocol Limitations Auto-Disclosure
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// T3.1 — Gate Breakdown
export interface BlockBreakdown {
  blockId: string;
  blockName: string;
  score: number;
  passed: boolean;
  details: string;
}

export interface GateBreakdown {
  gateId: string;
  gateName: string;
  totalScore: number;
  blocks: BlockBreakdown[];
  status: 'passed' | 'failed' | 'blocked';
  haltReason?: string;
}

// T3.2 — Comparative Gap Format
export interface ComparativeEntry {
  referenceId: string;
  referenceName: string;
  strength: string;
  weakness: string;
  applicable: boolean;
}

export interface ReferenceWork {
  id: string;
  name: string;
  type: 'novel' | 'film' | 'game' | 'series' | 'anime';
  themes: string[];
  quality: 'masterpiece' | 'excellent' | 'good' | 'notable';
}

// T3.3 — Self-Audit Dialogic Pause
export interface SelfAuditQuestion {
  id: string;
  question: string;
  category: 'bias' | 'consistency' | 'depth' | 'assumption';
  guidance: string;
}

export interface SelfAuditResult {
  questions: SelfAuditQuestion[];
  responses: Record<string, string>;
  passed: boolean;
  issues: string[];
}

// T3.4 — Protocol Limitations
export type LimitationType =
  | 'unreliable_narrator_handling'
  | 'humor_as_defense_mechanism'
  | 'failure_as_canon_endings'
  | 'non_linear_timeline'
  | 'multiple_perspective_narratives'
  | 'meta_fictional_elements'
  | 'experimental_structure'
  | 'audience_participation';

export interface ProtocolLimitation {
  type: LimitationType;
  detected: boolean;
  confidence: number;
  description: string;
  impactAssessment: string;
  recommendedApproach: string;
}

// ============================================================================
// T3.1 — GATE BREAKDOWN + EXPLICIT STATUS
// ============================================================================

/**
 * Creates a gate breakdown with block-level detail
 * 
 * NON-NEGOTIABLE: Never output aggregate percentage alone
 * Must include block-level breakdown
 */
export function createGateBreakdown(
  gateId: string,
  gateName: string,
  blocks: BlockBreakdown[]
): GateBreakdown {
  const totalScore = blocks.reduce((sum, b) => sum + b.score, 0) / Math.max(1, blocks.length);
  const allPassed = blocks.every(b => b.passed);
  const anyCriticalFailed = blocks.some(b => !b.passed && b.score < 50);

  let status: GateBreakdown['status'];
  let haltReason: string | undefined;

  if (anyCriticalFailed) {
    status = 'blocked';
    haltReason = 'Критический сбой блока — требуется остановка';
  } else if (!allPassed) {
    status = 'failed';
  } else {
    status = 'passed';
  }

  return {
    gateId,
    gateName,
    totalScore,
    blocks,
    status,
    haltReason
  };
}

/**
 * Formats gate breakdown for display
 */
export function formatGateBreakdown(breakdown: GateBreakdown): string {
  const lines: string[] = [];
  
  lines.push(`## ${breakdown.gateName} (${breakdown.gateId})`);
  lines.push(`**Статус:** ${breakdown.status.toUpperCase()}`);
  lines.push(`**Общий балл:** ${breakdown.totalScore.toFixed(1)}%`);
  lines.push('');

  lines.push('### Детализация по блокам:');
  for (const block of breakdown.blocks) {
    const icon = block.passed ? '✓' : '✗';
    lines.push(`- ${icon} **${block.blockName}**: ${block.score.toFixed(1)}%`);
    lines.push(`  ${block.details}`);
  }

  if (breakdown.haltReason) {
    lines.push('');
    lines.push(`⚠️ **ОСТАНОВКА:** ${breakdown.haltReason}`);
  }

  return lines.join('\n');
}

// ============================================================================
// T3.2 — STRUCTURED COMPARATIVE GAP FORMAT
// ============================================================================

/**
 * Reference works database for comparison
 */
const REFERENCE_WORKS: ReferenceWork[] = [
  { id: 'ref_001', name: 'The Lord of the Rings', type: 'novel', themes: ['sacrifice', 'power', 'friendship'], quality: 'masterpiece' },
  { id: 'ref_002', name: 'Breaking Bad', type: 'series', themes: ['transformation', 'consequences', 'pride'], quality: 'masterpiece' },
  { id: 'ref_003', name: 'The Witcher 3', type: 'game', themes: ['choice', 'consequence', 'destiny'], quality: 'excellent' },
  { id: 'ref_004', name: 'Neon Genesis Evangelion', type: 'anime', themes: ['identity', 'connection', 'trauma'], quality: 'masterpiece' },
  { id: 'ref_005', name: 'The Dark Knight', type: 'film', themes: ['chaos', 'order', 'sacrifice'], quality: 'excellent' },
  { id: 'ref_006', name: 'Dune', type: 'novel', themes: ['destiny', 'power', 'ecology'], quality: 'masterpiece' },
  { id: 'ref_007', name: 'Chronicles of Amber', type: 'novel', themes: ['family', 'reality', 'power'], quality: 'excellent' },
  { id: 'ref_008', name: 'Planescape: Torment', type: 'game', themes: ['identity', 'regret', 'redemption'], quality: 'excellent' }
];

/**
 * Validates a comparative entry
 * 
 * NON-NEGOTIABLE: Exactly one strength + one weakness per reference
 */
export function validateComparativeEntry(entry: ComparativeEntry): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (!entry.strength || entry.strength.trim() === '') {
    issues.push('Отсутствует достоинство — для каждого произведения должно быть указано ровно одно достоинство');
  }

  if (!entry.weakness || entry.weakness.trim() === '') {
    issues.push('Отсутствует недостаток — для каждого произведения должен быть указан ровно один недостаток');
  }

  if (entry.strength && entry.strength.length > 500) {
    issues.push('Достоинство слишком длинное — будьте кратки');
  }

  if (entry.weakness && entry.weakness.length > 500) {
    issues.push('Недостаток слишком длинный — будьте кратки');
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Creates a comparative entry for a reference work
 */
export function createComparativeEntry(
  referenceId: string,
  strength: string,
  weakness: string
): ComparativeEntry {
  const reference = REFERENCE_WORKS.find(r => r.id === referenceId);
  
  return {
    referenceId,
    referenceName: reference?.name || 'Unknown Reference',
    strength,
    weakness,
    applicable: !!reference
  };
}

/**
 * Gets reference works for a given theme
 */
export function getReferencesForTheme(theme: string): ReferenceWork[] {
  const lowerTheme = theme.toLowerCase();
  return REFERENCE_WORKS.filter(ref => 
    ref.themes.some(t => t.toLowerCase().includes(lowerTheme) || lowerTheme.includes(t.toLowerCase()))
  );
}

// ============================================================================
// T3.3 — SELF-AUDIT DIALOGIC PAUSE
// ============================================================================

const SELF_AUDIT_QUESTIONS: SelfAuditQuestion[] = [
  {
    id: 'sa_1',
    question: 'Не нахожусь ли я под чрезмерным влиянием одного яркого элемента?',
    category: 'bias',
    guidance: 'Проверьте, не искажена ли общая оценка одним выдающимся аспектом'
  },
  {
    id: 'sa_2',
    question: 'Применяю ли я одни и те же стандарты последовательно ко всем разделам?',
    category: 'consistency',
    guidance: 'Удостоверьтесь в последовательном применении критериев оценки'
  },
  {
    id: 'sa_3',
    question: 'Есть ли более глубокая проблема, которую я могу упускать за поверхностными симптомами?',
    category: 'depth',
    guidance: 'Ищите корневые причины, а не симптомы'
  },
  {
    id: 'sa_4',
    question: 'Есть ли у меня допущения, которые следует проверить?',
    category: 'assumption',
    guidance: 'Выявите и подвергните сомнению неявные допущения в анализе'
  },
  {
    id: 'sa_5',
    question: 'Пришёл бы другой интерпретатор к тем же выводам?',
    category: 'consistency',
    guidance: 'Проверьте наличие субъективной предвзятости в интерпретациях'
  },
  {
    id: 'sa_6',
    question: 'Уделяю ли я достаточное внимание ожиданиям жанра и средства?',
    category: 'bias',
    guidance: 'Обеспечьте оценку, соответствующую контексту'
  }
];

/**
 * Initializes a self-audit session
 * 
 * NON-NEGOTIABLE: 
 * - interactive=true → pause, wait for input
 * - interactive=false → output questions + proceed
 */
export function initializeSelfAudit(interactive: boolean = false): {
  interactive: boolean;
  questions: SelfAuditQuestion[];
  instruction: string;
} {
  const instruction = interactive
    ? 'Самоаудит инициирован. Пожалуйста, ответьте на каждый вопрос перед продолжением.'
    : 'Вопросы самоаудита сгенерированы. Просмотрите и устраните выявленные проблемы.';

  return {
    interactive,
    questions: SELF_AUDIT_QUESTIONS,
    instruction
  };
}

/**
 * Processes self-audit responses
 */
export function processSelfAuditResponse(
  responses: Record<string, string>
): SelfAuditResult {
  const issues: string[] = [];
  const passed = true;

  for (const question of SELF_AUDIT_QUESTIONS) {
    const response = responses[question.id];
    
    if (!response || response.trim() === '') {
      issues.push(`Отсутствует ответ на: ${question.question}`);
    } else if ((response.toLowerCase().includes('да') || response.toLowerCase().includes('yes')) && 
               question.category === 'bias') {
      // Flag potential bias acknowledgments
      issues.push(`Требуется проверка: ${question.question} — признана потенциальная проблема`);
    }
  }

  return {
    questions: SELF_AUDIT_QUESTIONS,
    responses,
    passed: issues.length === 0,
    issues
  };
}

// ============================================================================
// T3.4 — PROTOCOL LIMITATIONS AUTO-DISCLOSURE
// ============================================================================

const LIMITATION_TRIGGERS: Record<LimitationType, {
  triggers: string[];
  description: string;
  impact: string;
  approach: string;
}> = {
  unreliable_narrator_handling: {
    triggers: ['ненадёжный', 'обманывающий рассказчик', 'лживый', 'обманывает читателя', 'ложное воспоминание', 'unreliable', 'deceptive narrator'],
    description: 'Протокол может не корректно распознать ненадёжное повествование',
    impact: 'Анализ может принимать утверждения повествования за чистую монету, хотя их следует подвергать сомнению',
    approach: 'Отметить потенциальную ненадёжность и рекомендовать ручную проверку достоверности рассказчика'
  },
  humor_as_defense_mechanism: {
    triggers: ['комедия', 'юмор', 'шутка', 'сатира', 'пародия', 'абсурд', 'comedy', 'humor', 'satire'],
    description: 'Юмор может скрывать лежащие в основе проблемы, которые протокол не обнаружит',
    impact: 'Серьёзные структурные проблемы могут быть скрыты под комедийной формой подачи',
    approach: 'Применять более глубокий структурный анализ независимо от комедийной поверхности'
  },
  failure_as_canon_endings: {
    triggers: ['плохая концовка', 'провал', 'трагический финал', 'грустный финал', 'протагонист терпит неудачу', 'bad ending', 'tragic ending', 'downer ending'],
    description: 'Протокол может отметить правомерные финалы с неудачей как структурные проблемы',
    impact: 'Намеренные трагические концовки могут быть ошибочно определены как несостоятельные повествования',
    approach: 'Различать несостоятельное повествование и намеренный финал с неудачей'
  },
  non_linear_timeline: {
    triggers: ['нелинейный', 'флешбэк', 'флешфорвард', 'скачок во времени', 'не по порядку', 'анахронический', 'non-linear', 'flashback', 'time jump'],
    description: 'Нелинейная структура требует особой обработки',
    impact: 'Анализ причинно-следственной цепочки может быть нарушен манипуляциями с хронологией',
    approach: 'Восстановить линейную хронологию для анализа, затем отобразить обратно на структуру'
  },
  multiple_perspective_narratives: {
    triggers: ['несколько точек зрения', 'разные перспективы', 'несколько рассказчиков', 'множество ракурсов', 'multiple pov', 'different perspectives'],
    description: 'Множественные точки зрения создают сложность в анализе согласованности',
    impact: 'Несоответствия между перспективами могут быть отмечены ошибочно',
    approach: 'Отслеживать каждую перспективу отдельно перед синтезом'
  },
  meta_fictional_elements: {
    triggers: ['мета', 'разрушение четвёртой стены', 'самоосознание', 'метафункция', 'отсылка на самого себя', 'meta', 'breaking fourth wall', 'self-aware', 'metafiction'],
    description: 'Метафикциональные элементы бросают вызов стандартному анализу',
    impact: 'Намеренные разрывы могут быть отмечены как несогласованности',
    approach: 'Выявить метаэлементы и применить модифицированную рамку анализа'
  },
  experimental_structure: {
    triggers: ['экспериментальный', 'авангард', 'нетрадиционный', 'нестандартный', 'абстрактный', 'experimental', 'avant-garde', 'unconventional'],
    description: 'Экспериментальные произведения могут не соответствовать стандартным структурным ожиданиям',
    impact: 'Правомерные экспериментальные решения могут быть отмечены как проблемы',
    approach: 'Применить жанрово-соответствующую рамку экспериментального анализа'
  },
  audience_participation: {
    triggers: ['интерактивный', 'выбор зрителей', 'голосование', 'коллаборативный', 'участие аудитории', 'interactive', 'audience choice', 'voting', 'participatory'],
    description: 'Участие аудитории создаёт вариативные повествовательные исходы',
    impact: 'Анализ может не охватить все возможные повествовательные пути',
    approach: 'Анализировать базовую структуру плюс механизмы вариативности'
  }
};

/**
 * Auto-populates protocol limitations based on narrative traits
 */
export function autoPopulateLimitations(
  narrativeTraits: string[]
): ProtocolLimitation[] {
  const limitations: ProtocolLimitation[] = [];
  const lowerTraits = narrativeTraits.map(t => t.toLowerCase());

  for (const [type, config] of Object.entries(LIMITATION_TRIGGERS)) {
    let detected = false;
    let confidence = 0;

    for (const trigger of config.triggers) {
      for (const trait of lowerTraits) {
        if (trait.includes(trigger)) {
          detected = true;
          confidence = Math.max(confidence, 0.8);
        }
      }
    }

    if (detected) {
      limitations.push({
        type: type as LimitationType,
        detected: true,
        confidence,
        description: config.description,
        impactAssessment: config.impact,
        recommendedApproach: config.approach
      });
    }
  }

  return limitations;
}

/**
 * Gets all potential limitations (for comprehensive disclosure)
 */
export function getAllPotentialLimitations(): ProtocolLimitation[] {
  return Object.entries(LIMITATION_TRIGGERS).map(([type, config]) => ({
    type: type as LimitationType,
    detected: false,
    confidence: 0,
    description: config.description,
    impactAssessment: config.impact,
    recommendedApproach: config.approach
  }));
}

// ============================================================================
// DIAGNOSTICS OUTPUT FORMATTER
// ============================================================================

/**
 * Formats complete diagnostics report
 */
export function formatDiagnosticsReport(data: {
  gateBreakdowns: GateBreakdown[];
  comparativeEntries: ComparativeEntry[];
  selfAuditResult?: SelfAuditResult;
  limitations: ProtocolLimitation[];
}): string {
  const lines: string[] = [];

  lines.push('# Отчёт по диагностике аудита');
  lines.push('');

  // Gate Breakdowns
  lines.push('## Разбивка по шлюзам');
  for (const breakdown of data.gateBreakdowns) {
    lines.push(formatGateBreakdown(breakdown));
    lines.push('');
  }

  // Comparative Analysis
  lines.push('## Сравнительный анализ');
  for (const entry of data.comparativeEntries) {
    lines.push(`### ${entry.referenceName}`);
    lines.push(`- **Достоинство:** ${entry.strength}`);
    lines.push(`- **Недостаток:** ${entry.weakness}`);
    lines.push('');
  }

  // Self-Audit
  if (data.selfAuditResult) {
    lines.push('## Результаты самоаудита');
    lines.push(`**Статус:** ${data.selfAuditResult.passed ? 'ПРОЙДЕНО' : 'ОБНАРУЖЕНЫ ПРОБЛЕМЫ'}`);
    if (data.selfAuditResult.issues.length > 0) {
      lines.push('### Проблемы:');
      for (const issue of data.selfAuditResult.issues) {
        lines.push(`- ${issue}`);
      }
    }
    lines.push('');
  }

  // Limitations
  lines.push('## Ограничения протокола');
  for (const limitation of data.limitations) {
    if (limitation.detected) {
      lines.push(`### ${limitation.type}`);
      lines.push(`- **Описание:** ${limitation.description}`);
      lines.push(`- **Влияние:** ${limitation.impactAssessment}`);
      lines.push(`- **Рекомендуемый подход:** ${limitation.recommendedApproach}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ============================================================================
// DIAGNOSTICS GENERATOR (for orchestrator)
// ============================================================================

/**
 * Result type for generateDiagnostics function
 */
export interface DiagnosticResult {
  protocolHealth: 'healthy' | 'degraded' | 'critical';
  issues: DiagnosticIssue[];
  recommendations: string[];
  metrics: {
    gatesPassed: number;
    gatesTotal: number;
    issuesFound: number;
    criticalIssues: number;
  };
}

export interface DiagnosticIssue {
  id: string;
  type: 'logic' | 'schema' | 'integration' | 'performance';
  severity: 'critical' | 'major' | 'minor' | 'cosmetic';
  description: string;
  location: string;
  suggestedFix: string;
}

/**
 * Generates diagnostics from audit state
 * Used by orchestrator to produce diagnostic results
 */
export function generateDiagnostics(state: unknown): DiagnosticResult {
  const auditState = state as Record<string, unknown>;
  
  const issues: DiagnosticIssue[] = [];
  const recommendations: string[] = [];
  
  // Count gates
  let gatesPassed = 0;
  let gatesTotal = 4;
  
  const gates = auditState.gateResults || auditState;
  if (typeof gates === 'object' && gates !== null) {
    const gateObj = gates as Record<string, unknown>;
    if (gateObj.gate_L1 && typeof gateObj.gate_L1 === 'object') {
      const g1 = gateObj.gate_L1 as Record<string, unknown>;
      if (g1.status === 'passed') gatesPassed++;
    }
    if (gateObj.gate_L2 && typeof gateObj.gate_L2 === 'object') {
      const g2 = gateObj.gate_L2 as Record<string, unknown>;
      if (g2.status === 'passed') gatesPassed++;
    }
    if (gateObj.gate_L3 && typeof gateObj.gate_L3 === 'object') {
      const g3 = gateObj.gate_L3 as Record<string, unknown>;
      if (g3.status === 'passed') gatesPassed++;
    }
    if (gateObj.gate_L4 && typeof gateObj.gate_L4 === 'object') {
      const g4 = gateObj.gate_L4 as Record<string, unknown>;
      if (g4.status === 'passed') gatesPassed++;
    }
  }
  
  // Count issues
  const stateIssues = auditState.issues;
  let issuesFound = 0;
  let criticalIssues = 0;
  
  if (Array.isArray(stateIssues)) {
    issuesFound = stateIssues.length;
    criticalIssues = stateIssues.filter((i: Record<string, unknown>) => 
      i.severity === 'critical'
    ).length;
  }
  
  // Determine health
  let protocolHealth: DiagnosticResult['protocolHealth'];
  if (criticalIssues > 0 || gatesPassed < 2) {
    protocolHealth = 'critical';
    recommendations.push('Устраните критические проблемы перед продолжением');
  } else if (gatesPassed < 4 || issuesFound > 5) {
    protocolHealth = 'degraded';
    recommendations.push('Просмотрите отмеченные проблемы для повышения качества');
  } else {
    protocolHealth = 'healthy';
    recommendations.push('Аудит завершён — произведение демонстрирует сильную структуру');
  }
  
  // Add generic recommendations
  if (issuesFound > 0) {
    recommendations.push(`Просмотрите ${issuesFound} выявленных проблем`);
  }
  if (criticalIssues > 0) {
    recommendations.push(`Приоритет: ${criticalIssues} критических проблем`);
  }
  
  return {
    protocolHealth,
    issues,
    recommendations,
    metrics: {
      gatesPassed,
      gatesTotal,
      issuesFound,
      criticalIssues
    }
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { REFERENCE_WORKS, SELF_AUDIT_QUESTIONS, LIMITATION_TRIGGERS };
