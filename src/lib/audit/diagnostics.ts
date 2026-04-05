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
    haltReason = 'Critical block failure - halt required';
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
  lines.push(`**Status:** ${breakdown.status.toUpperCase()}`);
  lines.push(`**Total Score:** ${breakdown.totalScore.toFixed(1)}%`);
  lines.push('');

  lines.push('### Block Breakdown:');
  for (const block of breakdown.blocks) {
    const icon = block.passed ? '✓' : '✗';
    lines.push(`- ${icon} **${block.blockName}**: ${block.score.toFixed(1)}%`);
    lines.push(`  ${block.details}`);
  }

  if (breakdown.haltReason) {
    lines.push('');
    lines.push(`⚠️ **HALT:** ${breakdown.haltReason}`);
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
    issues.push('Missing strength - must have exactly one strength per reference');
  }

  if (!entry.weakness || entry.weakness.trim() === '') {
    issues.push('Missing weakness - must have exactly one weakness per reference');
  }

  if (entry.strength && entry.strength.length > 500) {
    issues.push('Strength too long - keep it concise');
  }

  if (entry.weakness && entry.weakness.length > 500) {
    issues.push('Weakness too long - keep it concise');
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
    question: 'Am I being unduly influenced by a single strong element?',
    category: 'bias',
    guidance: 'Check if overall assessment is skewed by one exceptional aspect'
  },
  {
    id: 'sa_2',
    question: 'Have I applied the same standards consistently across all sections?',
    category: 'consistency',
    guidance: 'Verify consistent application of evaluation criteria'
  },
  {
    id: 'sa_3',
    question: 'Is there a deeper issue I might be missing behind surface problems?',
    category: 'depth',
    guidance: 'Look for root causes rather than symptoms'
  },
  {
    id: 'sa_4',
    question: 'Have I made any assumptions that should be verified?',
    category: 'assumption',
    guidance: 'Identify and challenge implicit assumptions in the analysis'
  },
  {
    id: 'sa_5',
    question: 'Would a different interpreter reach the same conclusions?',
    category: 'consistency',
    guidance: 'Check for subjective bias in interpretations'
  },
  {
    id: 'sa_6',
    question: 'Am I giving adequate weight to genre and medium expectations?',
    category: 'bias',
    guidance: 'Ensure context-appropriate evaluation'
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
    ? 'Self-audit initiated. Please respond to each question before proceeding.'
    : 'Self-audit questions generated. Review and address any issues.';

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
      issues.push(`Missing response for: ${question.question}`);
    } else if (response.toLowerCase().includes('yes') && 
               question.category === 'bias') {
      // Flag potential bias acknowledgments
      issues.push(`Review needed: ${question.question} - acknowledged potential issue`);
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
    triggers: ['unreliable', 'deceptive narrator', 'lies', 'deceives reader', 'false memory'],
    description: 'Protocol may not correctly identify unreliable narration',
    impact: 'Analysis may take narrative claims at face value when they should be questioned',
    approach: 'Flag potential unreliability and recommend manual review of narrator credibility'
  },
  humor_as_defense_mechanism: {
    triggers: ['comedy', 'humor', 'joke', 'satire', 'parody', 'absurd'],
    description: 'Humor can mask underlying issues that protocol may not detect',
    impact: 'Serious structural issues may be hidden beneath comedic presentation',
    approach: 'Apply deeper structural analysis regardless of comedic surface'
  },
  failure_as_canon_endings: {
    triggers: ['bad ending', 'failure', 'tragic ending', 'downer ending', 'protagonist fails'],
    description: 'Protocol may flag legitimate failure endings as structural problems',
    impact: 'Intentional tragic endings may be misidentified as failed narratives',
    approach: 'Distinguish between failed narrative and intentional failure ending'
  },
  non_linear_timeline: {
    triggers: ['non-linear', 'flashback', 'flashforward', 'time jump', 'out of order', 'anachronic'],
    description: 'Non-linear structure requires special handling',
    impact: 'Causal chain analysis may be disrupted by timeline manipulation',
    approach: 'Reconstruct linear timeline for analysis, then map back to structure'
  },
  multiple_perspective_narratives: {
    triggers: ['multiple pov', 'different perspectives', 'several narrators', 'multiple viewpoints'],
    description: 'Multiple POVs create complexity in consistency analysis',
    impact: 'Inconsistencies between perspectives may be flagged incorrectly',
    approach: 'Track each perspective separately before synthesizing'
  },
  meta_fictional_elements: {
    triggers: ['meta', 'breaking fourth wall', 'self-aware', 'metafiction', 'references itself'],
    description: 'Meta-fictional elements challenge standard analysis',
    impact: 'Intentional breaks may be flagged as inconsistencies',
    approach: 'Identify meta-elements and apply modified analysis framework'
  },
  experimental_structure: {
    triggers: ['experimental', 'avant-garde', 'unconventional', 'non-traditional', 'abstract'],
    description: 'Experimental works may not fit standard structural expectations',
    impact: 'Valid experimental choices may be flagged as problems',
    approach: 'Apply genre-appropriate experimental analysis framework'
  },
  audience_participation: {
    triggers: ['interactive', 'audience choice', 'voting', 'collaborative', 'participatory'],
    description: 'Audience participation creates variable narrative outcomes',
    impact: 'Analysis may not cover all possible narrative paths',
    approach: 'Analyze core structure plus variation mechanics'
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

  lines.push('# Audit Diagnostics Report');
  lines.push('');

  // Gate Breakdowns
  lines.push('## Gate Breakdowns');
  for (const breakdown of data.gateBreakdowns) {
    lines.push(formatGateBreakdown(breakdown));
    lines.push('');
  }

  // Comparative Analysis
  lines.push('## Comparative Analysis');
  for (const entry of data.comparativeEntries) {
    lines.push(`### ${entry.referenceName}`);
    lines.push(`- **Strength:** ${entry.strength}`);
    lines.push(`- **Weakness:** ${entry.weakness}`);
    lines.push('');
  }

  // Self-Audit
  if (data.selfAuditResult) {
    lines.push('## Self-Audit Results');
    lines.push(`**Status:** ${data.selfAuditResult.passed ? 'PASSED' : 'ISSUES FOUND'}`);
    if (data.selfAuditResult.issues.length > 0) {
      lines.push('### Issues:');
      for (const issue of data.selfAuditResult.issues) {
        lines.push(`- ${issue}`);
      }
    }
    lines.push('');
  }

  // Limitations
  lines.push('## Protocol Limitations');
  for (const limitation of data.limitations) {
    if (limitation.detected) {
      lines.push(`### ${limitation.type}`);
      lines.push(`- **Description:** ${limitation.description}`);
      lines.push(`- **Impact:** ${limitation.impactAssessment}`);
      lines.push(`- **Recommended Approach:** ${limitation.recommendedApproach}`);
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
    recommendations.push('Address critical issues before proceeding');
  } else if (gatesPassed < 4 || issuesFound > 5) {
    protocolHealth = 'degraded';
    recommendations.push('Review flagged issues for quality improvements');
  } else {
    protocolHealth = 'healthy';
    recommendations.push('Audit complete - narrative shows strong structure');
  }
  
  // Add generic recommendations
  if (issuesFound > 0) {
    recommendations.push(`Review ${issuesFound} identified issues`);
  }
  if (criticalIssues > 0) {
    recommendations.push(`Prioritize ${criticalIssues} critical issues`);
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
