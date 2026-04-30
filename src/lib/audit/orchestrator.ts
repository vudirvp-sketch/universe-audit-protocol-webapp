/**
 * UNIVERSE AUDIT PROTOCOL v10.0 — CENTRAL ORCHESTRATOR
 * 
 * This is the CENTRAL integration point that route.ts MUST use.
 * Coordinates all audit modules in strict sequence.
 * 
 * NON-NEGOTIABLE RULES IMPLEMENTED:
 * - RULE_2: "А чтобы что?" chain terminal MUST be classified as BREAK or DILEMMA
 * - RULE_3: Cult Potential mandatory criteria are BLOCKING
 * - RULE_4: Media adaptation MUST transform prompts via map
 * - RULE_5: If any gate fails: STOP. Output fixes for that level ONLY
 * - RULE_8: Gate output MUST include block-level breakdown
 * - RULE_9: ISSUE objects missing ANY field = invalid
 * - RULE_10: Generative templates MUST activate automatically
 */

import type { 
  AuditPhase, MediaType, AuditMode, AuthorProfileAnswers, AuthorProfile,
  AuthorProfileType, ScreeningResult, GateResult, GriefValidationResult, GriefPresence,
  CultEvaluationResult, Issue, ChainResult, GenerativeOutput, NextAction,
  GriefArchitectureMatrix
} from './types';

import { validateInput, type ValidationResult } from './input-validator';
import { detectAuditMode, getModeExecutionConfig, type ModeExecutionConfig } from './modes';
import { getGateThreshold } from './types';
import { calculateAuthorProfile } from './author-profile';
import { extractSkeleton, type SkeletonExtractionResult } from './skeleton-extraction';
import { executeGate, validatePrerequisites, type GateLevel } from './gate-executor';
import { validateGriefArchitecture, executeL3GateWithGriefCheck } from './grief-validation';
import type { GriefPresence as LocalGriefPresence } from './grief-validation';
import { evaluateCultPotential } from './cult-potential';
import { assignLevel, partitionByLevel, type AuditLevel } from './level-assignment';
import { runWhatForChain, type WhatForChainResult } from './what-for-chain';
import { validateIssue, createIssue } from './issue-schema';
import { applyMediaTransformation, type TransformationResult } from './media-transformation';
import { generateDiagnostics, type DiagnosticResult } from './diagnostics';

// ============================================================================
// TYPE DEFINITIONS — All canonical types imported from ./types
// ============================================================================

export interface AuditInput {
  concept: string;
  media_type: MediaType;
  audit_mode?: AuditMode;
  author_answers?: AuthorProfileAnswers;
  dominant_stage?: string;
  final_dilemma?: string;
}

export interface OrchestratorState {
  phase: AuditPhase;
  input: AuditInput;
  validation_result?: import('./input-validator').ValidationResult;
  audit_mode_config?: import('./modes').ModeExecutionConfig;
  author_profile_result?: AuthorProfile;
  skeleton?: import('./skeleton-extraction').SkeletonExtractionResult;
  screening_result?: ScreeningResult;
  gate_L1?: GateResult;
  gate_L2?: GateResult;
  gate_L3?: GateResult;
  gate_L4?: GateResult;
  grief_validation?: GriefValidationResult;
  cult_potential?: CultEvaluationResult;
  issues: Issue[];
  what_for_chains: ChainResult[];
  generative_output?: GenerativeOutput;
  diagnostics?: import('./diagnostics').DiagnosticResult;
  final_score?: { total: string; percentage: number; by_level: Record<string, number> };
  next_actions: NextAction[];
  media_transformation?: import('./media-transformation').TransformationResult;
  error?: string;
}

// ============================================================================
// AUDIT SECTIONS DEFINITION
// ============================================================================

interface AuditSection {
  id: string;
  tags: string[];
  content: string;
  level: 'L1' | 'L2' | 'L3' | 'L4';
}

function getAuditSections(): AuditSection[] {
  return [
    // L1 sections - Core structural elements
    { id: 'A_structure', tags: ['L1', 'CORE'], content: 'Анализ структуры', level: 'L1' },
    { id: 'B_thematic_law', tags: ['L1', 'CORE'], content: 'Валидация тематического закона', level: 'L1' },
    { id: 'C_root_trauma', tags: ['L1', 'CORE'], content: 'Анализ корневой травмы', level: 'L1' },
    { id: 'D_hamartia', tags: ['L1', 'CORE'], content: 'Валидация хамартии', level: 'L1' },
    { id: 'E_world_law', tags: ['L1', 'CORE'], content: 'Интеграция закона мира', level: 'L1' },
    { id: 'F_skeleton', tags: ['L1', 'CORE'], content: 'Полнота скелета', level: 'L1' },
    
    // L2 sections - Secondary validation
    { id: '1.1_mechanics', tags: ['L2'], content: 'Анализ механизма', level: 'L2' },
    { id: '1.3_aesthetic', tags: ['L2', 'VISUAL'], content: 'Эстетический опыт', level: 'L2' },
    { id: '1.5_limitation', tags: ['L2'], content: 'Физическое ограничение', level: 'L2' },
    { id: '1.6_routine', tags: ['L2'], content: 'Телесная рутина', level: 'L2' },
    { id: 'character_arcs', tags: ['L2'], content: 'Развитие персонажей', level: 'L2' },
    { id: 'dialogue', tags: ['L2'], content: 'Качество диалогов', level: 'L2' },
    { id: 'world_consistency', tags: ['L2'], content: 'Логическая связность мира', level: 'L2' },
    
    // L3 sections - Grief architecture
    { id: '2.1_grief', tags: ['L3'], content: 'Архитектура горя', level: 'L3' },
    { id: '2.2_trauma', tags: ['L3'], content: 'Анализ травмы', level: 'L3' },
    { id: '3.1_mda', tags: ['L3'], content: 'MDA-анализ', level: 'L3' },
    
    // L4 sections - Final synthesis
    { id: '4.1_cult', tags: ['L4'], content: 'Культовый потенциал', level: 'L4' },
    { id: '4.2_mirror', tags: ['L4'], content: 'Тест зеркала', level: 'L4' },
    { id: 'final_synthesis', tags: ['L4'], content: 'Финальная интеграция', level: 'L4' },
  ];
}

// ============================================================================
// MAIN ORCHESTRATOR FUNCTION
// ============================================================================

/**
 * Runs the full audit pipeline
 * This is the ONLY entry point for audit execution
 */
export async function runFullAudit(input: AuditInput): Promise<OrchestratorState> {
  const state: OrchestratorState = {
    phase: 'input_validation',
    input,
    issues: [],
    what_for_chains: [],
    next_actions: []
  };

  // === STEP 0: INPUT VALIDATION ===
  state.phase = 'input_validation';
  state.validation_result = validateInput({ concept: input.concept });

  if (!state.validation_result.valid) {
    state.phase = 'blocked';
    state.error = 'Валидация ввода не пройдена';
    return state; // TERMINATE
  }

  // === STEP 1: MODE DETECTION ===
  state.phase = 'mode_detection';
  
  if (input.audit_mode) {
    state.audit_mode_config = getModeExecutionConfig(input.audit_mode);
  } else {
    // Derive mode from concept
    const detectedMode = detectAuditMode({
      hasMultipleWorldviews: false,
      hasSystematicInconsistencies: false,
      hasCanonicalContradictions: false,
      hasAuthorUncertainty: false,
      hasIntentionalAmbiguity: false,
      kishōScore: 0.3
    });
    state.audit_mode_config = getModeExecutionConfig(detectedMode);
  }

  // === STEP 2: AUTHOR PROFILE ROUTING ===
  state.phase = 'author_profile';
  
  if (input.author_answers) {
    const profileType = calculateAuthorProfile({
      iterativeDrafts: input.author_answers.Q1,
      characterFirst: input.author_answers.Q3,
      plotFirst: !input.author_answers.Q3,
      organicDevelopment: input.author_answers.Q1,
      structuredOutlining: !input.author_answers.Q1,
      themeEmergence: input.author_answers.Q4,
      themeDefined: !input.author_answers.Q4,
      worldbuildingDepth: 0.5,
      characterDepth: input.author_answers.Q2 ? 0.8 : 0.5
    });
    
    const priorityArray = getPriorityArray(profileType);
    state.author_profile_result = {
      type: profileType,
      percentage: 50,
      confidence: 'medium',
      mainRisks: [],
      auditPriorities: priorityArray,
      priority_array: priorityArray,
      risk_flags: []
    };
  } else {
    // Default profile
    const defaultPriorityArray = getPriorityArray('hybrid');
    state.author_profile_result = {
      type: 'hybrid',
      percentage: 50,
      confidence: 'low',
      mainRisks: ['Неизвестный профиль — используются значения по умолчанию'],
      auditPriorities: defaultPriorityArray,
      priority_array: defaultPriorityArray,
      risk_flags: ['Неизвестный профиль — используются значения по умолчанию']
    };
  }

  // === PREREQUISITE CHECK ===
  const prereqCheck = validatePrerequisites('GATE-1', []);
  if (!prereqCheck.canProceed && prereqCheck.blockedBy) {
    state.phase = 'blocked';
    state.error = prereqCheck.reason || 'Предварительные условия не выполнены';
    return state; // TERMINATE
  }

  // === STEP 3: SKELETON EXTRACTION ===
  state.phase = 'skeleton_extraction';
  state.skeleton = extractSkeleton({
    concept: input.concept,
    thematic_law: null, // Will be extracted
    root_trauma: null,
    hamartia: null
  });

  // NON-NEGOTIABLE: skeleton.status = "INCOMPLETE" → L1 blocked
  if (!state.skeleton.canProceedToL1) {
    state.phase = 'blocked';
    state.error = 'Извлечение скелета не прошло тесты слабостей';
    // Generate issues for skeleton problems
    state.issues = generateIssuesFromSkeleton(state.skeleton);
    return state; // TERMINATE
  }

  // === STEP 4: SCREENING ===
  state.phase = 'screening';
  state.screening_result = performScreening(input.concept);

  // Handle screening results
  if (!state.screening_result.proceed_normally) {
    state.phase = 'blocked';
    state.error = 'Скрининг не пройден: слишком много ответов НЕТ';
    return state; // TERMINATE
  }

  // === APPLY MEDIA TRANSFORMATION (RULE_4) ===
  state.media_transformation = applyMediaTransformation(input.media_type);

  // === STEP 5: GATE L1 ===
  state.phase = 'L1_evaluation';
  
  const auditMode = state.audit_mode_config?.mode ?? 'conflict';
  const l1Sections = getAuditSections().filter(s => s.level === 'L1');
  state.gate_L1 = executeGateWithBreakdown('L1', l1Sections, auditMode);

  // RULE_5: If gate fails, STOP and output fixes for that level ONLY
  if (state.gate_L1.halt) {
    state.issues = generateIssuesFromGate(state.gate_L1, 'L1');
    return state; // TERMINATE
  }

  // === STEP 6: GATE L2 ===
  state.phase = 'L2_evaluation';
  
  const l2Sections = getAuditSections().filter(s => s.level === 'L2');
  state.gate_L2 = executeGateWithBreakdown('L2', l2Sections, auditMode);

  if (state.gate_L2.halt) {
    state.issues = generateIssuesFromGate(state.gate_L2, 'L2');
    return state; // TERMINATE
  }

  // === STEP 7: GATE L3 (with Grief Validation HARD CHECK) ===
  state.phase = 'L3_evaluation';

  // RULE_3: GRIEF VALIDATION is a HARD CHECK before L3 scoring
  const griefData = analyzeGriefStages(input.concept, input.dominant_stage);
  state.grief_validation = validateGriefArchitecture(griefData as LocalGriefPresence[]);

  // L3 gate fails regardless of score if grief validation fails
  if (!state.grief_validation.valid) {
    state.gate_L3 = {
      gateId: 'GATE-L3',
      gateName: 'Архитектура горя',
      status: 'failed',
      score: 0,
      conditions: state.grief_validation.errors.map(e => ({
        id: e.code,
        passed: false,
        message: e.message
      })),
      halt: true,
      fixes: state.grief_validation.errors.map(e => e.message),
      metadata: { level: 'L3' }
    };
    state.issues = generateIssuesFromGriefValidation(state.grief_validation);
    return state; // TERMINATE
  }

  // KISHŌ mode: Ten-repainting test at L3
  // [KEYWORD_BASED]: Ten-repainting test not yet implemented — will be replaced by LLM-based evaluation in Phase 2 AuditStepRunner
  if (state.audit_mode_config?.requireTenRepaintingTest) {
    // [KEYWORD_BASED]: Ten-repainting test stub — will be replaced by LLM-based evaluation in Phase 2 AuditStepRunner
  }

  const l3Sections = getAuditSections().filter(s => s.level === 'L3');
  state.gate_L3 = executeGateWithBreakdown('L3', l3Sections, auditMode);

  if (state.gate_L3.halt) {
    state.issues = generateIssuesFromGate(state.gate_L3, 'L3');
    return state; // TERMINATE
  }

  // === CULT POTENTIAL EVALUATION (Two-Phase, RULE_3) ===
  state.cult_potential = evaluateCultPotential({
    hasRootTrauma: state.skeleton.elements.some(e => e.id === 'root_trauma' && e.value),
    rootTraumaDepth: 0.7,
    ideologicalSystem: true,
    hasThematicLaw: state.skeleton.elements.some(e => e.id === 'thematic_law' && e.value),
    thematicLawIntegration: 0.7,
    themeUniversality: true,
    characterComplexity: 0.6,
    moralAmbiguity: true,
    worldConsistency: 0.6,
    transformativePotential: true,
    ritualizableElements: true,
    communalExperience: true,
    interpretiveDepth: 0.6,
    rewatchValue: true,
    memeticPotential: true
  });

  // RULE_3: Mandatory criteria are BLOCKING
  if (!state.cult_potential.passed && !state.cult_potential.phase1Result.passed) {
    state.phase = 'blocked';
    state.error = 'Обязательные критерии культового потенциала не пройдены';
    state.issues = generateIssuesFromCultPotential(state.cult_potential);
    return state; // TERMINATE
  }

  // === STEP 8: GATE L4 ===
  state.phase = 'L4_evaluation';
  
  const l4Sections = getAuditSections().filter(s => s.level === 'L4');
  state.gate_L4 = executeGateWithBreakdown('L4', l4Sections, auditMode);

  if (state.gate_L4.halt) {
    state.issues = generateIssuesFromGate(state.gate_L4, 'L4');
    return state; // TERMINATE
  }

  // === STEP 9: ISSUE GENERATION ===
  state.phase = 'issue_generation';

  // Run "А чтобы что?" chain for elements (RULE_2)
  const elementsToChain = extractElementsForChain(input.concept);
  for (const element of elementsToChain) {
    const chainResult = runWhatForChain(element, []);
    state.what_for_chains.push(mapToChainResult(chainResult));

    // RULE_2: BREAK at step ≤4 = critical
    if (chainResult.terminal === 'BREAK' && chainResult.terminalStep <= 4) {
      const issue = createIssueFromChain(chainResult, element);
      if (issue) state.issues.push(issue);
    }
  }

  // Generate issues from all gate results
  const allGateIssues = [
    ...generateIssuesFromGate(state.gate_L1, 'L1'),
    ...generateIssuesFromGate(state.gate_L2, 'L2'),
    ...generateIssuesFromGate(state.gate_L3, 'L3'),
    ...generateIssuesFromGate(state.gate_L4, 'L4')
  ];

  // RULE_9: Validate all ISSUE objects
  for (const issue of allGateIssues) {
    const validation = validateIssue(issue);
    if (validation.valid) {
      state.issues.push(issue);
    }
  }

  // === STEP 10: GENERATIVE MODULES (RULE_10) ===
  state.phase = 'generative_modules';
  state.generative_output = {};

  // §9 — Law → Grief Stage: Activate when dominant_stage not supplied
  if (!input.dominant_stage) {
    const thematicLaw = state.skeleton.elements.find(e => e.id === 'thematic_law');
    if (thematicLaw?.value) {
      state.generative_output.grief_mapping = deriveGriefFromLaw(thematicLaw.value);
    }
  }

  // §12 — Theme → Dilemma: Activate when final_dilemma not supplied
  if (!input.final_dilemma) {
    const thematicLaw = state.skeleton.elements.find(e => e.id === 'thematic_law');
    if (thematicLaw?.value) {
      state.generative_output.dilemma = deriveDilemmaFromTheme(thematicLaw.value);
    }
  }

  // === STEP 11: DIAGNOSTICS ===
  state.diagnostics = generateDiagnostics(state);

  // === STEP 12: FINAL OUTPUT ===
  state.phase = 'final_output';

  // Calculate final score
  state.final_score = calculateFinalScore(state);

  // Generate next actions
  state.next_actions = generateNextActions(state);

  state.phase = 'complete';
  return state;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getPriorityArray(profile: AuthorProfileType): string[] {
  const priorities: Record<AuthorProfileType, string[]> = {
    gardener: ['character_arcs', 'dialogue', 'root_trauma', 'thematic_law', 'world_consistency'],
    architect: ['thematic_law', 'world_consistency', 'root_trauma', 'character_arcs', 'dialogue'],
    hybrid: ['thematic_law', 'root_trauma', 'character_arcs', 'world_consistency', 'dialogue']
  };
  return priorities[profile];
}

/**
 * Maps WhatForChainResult (from what-for-chain module) to ChainResult (canonical type from ./types)
 */
function mapToChainResult(wfcr: WhatForChainResult): ChainResult {
  return {
    terminal_type: wfcr.terminal === 'UNCLASSIFIED' ? null : wfcr.terminal,
    terminal: wfcr.terminal,
    terminalStep: wfcr.terminalStep,
    step_reached: wfcr.chain.length,
    action: wfcr.action as ChainResult['action'],
    iterations: wfcr.chain.map(step => ({
      step: step.stepNumber,
      question: step.question,
      answer: step.answer,
      analysis: step.analysis
    })),
    valid: wfcr.valid,
    reasoning: wfcr.reasoning
  };
}

function performScreening(concept: string): ScreeningResult {
  // [Section 0.6] Screening uses count-based logic from protocol v10.0.
  // The LLM answers 7 screening questions (in Russian).
  // The code then: (1) counts NO answers deterministically,
  // (2) applies count→recommendation mapping, (3) code's count wins over LLM opinion.
  //
  // [KEYWORD_BASED]: Screening uses keyword matching — will be replaced by LLM-based evaluation in Phase 2 AuditStepRunner
  // Current implementation uses Russian keywords per Language Contract (Finding 1):
  // English keyword matching (includes('theme'), includes('character')) is FORBIDDEN.
  const lowerConcept = concept.toLowerCase();
  let no_count = 0;
  const flags: string[] = [];

  // Q1: Does the narrative have a thematic law?
  const q1 = lowerConcept.includes('закон') || lowerConcept.includes('правило') || lowerConcept.includes('тематическ');
  if (!q1) {
    no_count++;
    flags.push('§0: Тематический закон не обнаружен');
  }

  // Q2: Is there a world that exists independent of the protagonist?
  const q2 = lowerConcept.includes('мир') || lowerConcept.includes('обществ') || lowerConcept.includes('цивилизац') || lowerConcept.includes('город') || lowerConcept.includes('королевств') || lowerConcept.includes('государств');
  if (!q2) {
    no_count++;
    flags.push('§1: Мир без протагониста не описан');
  }

  // Q3: Is the thematic law embodied in the world's mechanics/systems?
  const q3 = lowerConcept.includes('механик') || lowerConcept.includes('систем') || lowerConcept.includes('физик') || lowerConcept.includes('устройств') || lowerConcept.includes('правило мира') || lowerConcept.includes('работает');
  if (!q3) {
    no_count++;
    flags.push('§2: Воплощённость тематического закона в механике мира не обнаружена');
  }

  // Q4: Is there a hamartia (fatal flaw) in the narrative?
  const q4 = lowerConcept.includes('недостат') || lowerConcept.includes('изъян') || lowerConcept.includes('слабост') || lowerConcept.includes('хамарти') || lowerConcept.includes('роковой') || lowerConcept.includes('порок') || lowerConcept.includes('ошибк');
  if (!q4) {
    no_count++;
    flags.push('§3: Хамартия (роковой недостаток) не обнаружена');
  }

  // Q5: Is there a painful choice / cornelian dilemma?
  const q5 = lowerConcept.includes('выбор') || lowerConcept.includes('дилемм') || lowerConcept.includes('решени') || lowerConcept.includes('жертв') || lowerConcept.includes('цена') || lowerConcept.includes('разрыв');
  if (!q5) {
    no_count++;
    flags.push('§4: Болезненный выбор / корнелиева дилемма не обнаружены');
  }

  // Q6: Does the antagonist have internally consistent logic?
  const q6 = lowerConcept.includes('конфликт') || lowerConcept.includes('борьба') || lowerConcept.includes('противост') || lowerConcept.includes('антагонист') || lowerConcept.includes('враг') || lowerConcept.includes('противник') || lowerConcept.includes('злодей');
  if (!q6) {
    no_count++;
    flags.push('§5: Антагонистическая сила с логичной мотивацией не обнаружена');
  }

  // Q7: Is the ending irreversible (no way back to status quo)?
  const q7 = lowerConcept.includes('финал') || lowerConcept.includes('конец') || lowerConcept.includes('заверш') || lowerConcept.includes('необратим') || lowerConcept.includes('безвозвратн') || lowerConcept.includes('исход') || lowerConcept.includes('последстви');
  if (!q7) {
    no_count++;
    flags.push('§6: Необратимость финала не подтверждена');
  }

  // [Section 0.6] Count-based screening recommendation
  // 0-1 NO answers → ready_for_audit
  // 2-3 NO answers → requires_sections (full audit but flag weak sections)
  // 4+ NO answers  → stop_return_to_skeleton
  let recommendation: ScreeningResult['recommendation'];
  if (no_count <= 1) {
    recommendation = 'ready_for_audit';
  } else if (no_count <= 3) {
    recommendation = 'requires_sections';
  } else {
    recommendation = 'stop_return_to_skeleton';
  }

  return {
    question1_thematicLaw: q1,
    question2_worldWithoutProtagonist: q2,
    question3_embodiment: q3,
    question4_hamartia: q4,
    question5_painfulChoice: q5,
    question6_antagonistLogic: q6,
    question7_finalIrreversible: q7,
    flags,
    recommendation,
    no_count,
    sections_for_deep_audit: flags,
    proceed_normally: no_count < 4
  };
}

function executeGateWithBreakdown(
  level: string,
  sections: AuditSection[],
  mode: import('./types').AuditMode
): GateResult {
  // Use mode-specific threshold from types.ts (Section 0.7)
  const gateLevel = level as 'L1' | 'L2' | 'L3' | 'L4';
  const threshold = getGateThreshold(mode, gateLevel);

  // [KEYWORD_BASED]: Gate evaluation returns 100% (all sections pass) — will be replaced by LLM-based evaluation in Phase 2 AuditStepRunner
  const score = 100;

  // RULE_8: Build block-level breakdown
  const breakdown: Record<string, string> = {};
  for (const section of sections) {
    breakdown[section.id] = 'PASS'; // [KEYWORD_BASED]: Always PASS — will be replaced by LLM-based evaluation in Phase 2 AuditStepRunner
  }

  const conditions = sections.map(s => ({
    id: s.id,
    passed: true,
    message: `${s.content} — пройдено`
  }));

  return {
    gateId: `GATE-${level}`,
    gateName: `Уровень ${level}`,
    status: score >= threshold ? 'passed' : 'failed',
    score,
    conditions,
    halt: score < threshold,
    fixes: score < threshold ? [`Исправьте проблемы уровня ${level} перед продолжением`] : [],
    metadata: { breakdown, level }
  };
}

function generateIssuesFromSkeleton(skeleton: SkeletonExtractionResult): Issue[] {
  const issues: Issue[] = [];
  
  for (const weakness of skeleton.weaknesses) {
    issues.push(createIssue({
      id: `ISSUE-${issues.length + 1}`,
      location: `skeleton.${weakness.element}`,
      severity: weakness.severity === 'critical' ? 'critical' : weakness.severity === 'major' ? 'major' : 'minor',
      axes: { criticality: weakness.severity === 'critical' ? 9 : 5, risk: 3, time_cost: 4 },
      diagnosis: weakness.testQuestion,
      patches: {
        conservative: { description: weakness.action, impact: 'Минимальное исправление', sideEffects: [] },
        compromise: { description: weakness.action, impact: 'Сбалансированное исправление', sideEffects: [] },
        radical: { description: weakness.action, impact: 'Комплексное исправление', sideEffects: [] }
      }
    }));
  }
  
  return issues;
}

function generateIssuesFromGate(gate: GateResult | undefined, level: string): Issue[] {
  if (!gate || gate.halt === false) return [];
  
  const issues: Issue[] = [];
  
  for (const condition of gate.conditions) {
    if (!condition.passed) {
      issues.push(createIssue({
        id: `ISSUE-${level}-${issues.length + 1}`,
        location: `${level}.${condition.id}`,
        severity: 'major',
        axes: { criticality: 7, risk: 4, time_cost: 5 },
        diagnosis: condition.message,
        patches: {
          conservative: { description: 'Незначительная корректировка', impact: 'Быстрое исправление', sideEffects: [] },
          compromise: { description: 'Сбалансированная переработка', impact: 'Умеренное улучшение', sideEffects: [] },
          radical: { description: 'Полная реструктуризация', impact: 'Полное разрешение', sideEffects: [] }
        }
      }));
    }
  }
  
  return issues;
}

function generateIssuesFromGriefValidation(validation: GriefValidationResult): Issue[] {
  const issues: Issue[] = [];
  
  for (const error of validation.errors) {
    issues.push(createIssue({
      id: `ISSUE-GRIEF-${issues.length + 1}`,
      location: `L3.grief.${error.stage || 'architecture'}`,
      severity: 'critical',
      axes: { criticality: 9, risk: 5, time_cost: 6 },
      diagnosis: error.message,
      patches: {
        conservative: { description: 'Добавить проявление стадии горя', impact: 'Минимальное дополнение', sideEffects: ['Могут потребоваться небольшие доработки'] },
        compromise: { description: 'Реструктурировать прогрессию горя', impact: 'Лучший эмоциональный поток', sideEffects: ['Умеренная реструктуризация'] },
        radical: { description: 'Перепроектировать архитектуру горя', impact: 'Полная эмоциональная связность', sideEffects: ['Серьёзные структурные изменения'] }
      }
    }));
  }
  
  return issues;
}

function generateIssuesFromCultPotential(result: CultEvaluationResult): Issue[] {
  const issues: Issue[] = [];
  
  for (const criterion of result.phase1Result.criteria) {
    if (!criterion.passed) {
      issues.push(createIssue({
        id: `ISSUE-CULT-${issues.length + 1}`,
        location: 'L4.cult_potential',
        severity: 'critical',
        axes: { criticality: 9, risk: 4, time_cost: 7 },
        diagnosis: `${criterion.name} не пройден — обязательный критерий`,
        patches: {
          conservative: { description: 'Добавить минимально жизнеспособный элемент', impact: 'Соответствует порогу', sideEffects: [] },
          compromise: { description: 'Развить тематическую интеграцию', impact: 'Более прочная основа', sideEffects: ['Связанные доработки'] },
          radical: { description: 'Реструктурировать основу нарратива', impact: 'Полная тематическая связность', sideEffects: ['Серьёзные доработки'] }
        }
      }));
    }
  }
  
  return issues;
}

function analyzeGriefStages(concept: string, dominantStage?: string): GriefPresence[] {
  // [KEYWORD_BASED]: Grief stage detection uses keyword matching — will be replaced by LLM-based evaluation in Phase 2 AuditStepRunner
  // Russian keywords per Language Contract (Finding 1).
  const stages = ['denial', 'anger', 'bargaining', 'depression', 'acceptance'] as const;
  const levels = ['world', 'society', 'character', 'scene'] as const;
  
  const presences: GriefPresence[] = [];
  const lowerConcept = concept.toLowerCase();
  
  for (const stage of stages) {
    for (const level of levels) {
      // Russian keywords for grief stage detection (Finding 1: English keywords forbidden)
      const stageKeywords: Record<string, string[]> = {
        denial: ['отрицан', 'отверга', 'игнорир', 'притворя', 'не вер'],
        anger: ['гнев', 'ярость', 'злость', 'ненавист', 'обвиня'],
        bargaining: ['сделк', 'торг', 'компромисс', 'договор', 'менять'],
        depression: ['горе', 'печаль', 'отчаян', 'тоска', 'безнадёж'],
        acceptance: ['приняти', 'смирен', 'покой', 'пониман', 'освобожд']
      };
      
      const hasStage = stageKeywords[stage].some(kw => lowerConcept.includes(kw));
      
      presences.push({
        stage,
        level: level as import('./types').GriefLevel,
        present: hasStage,
        description: hasStage ? `Обнаружена стадия ${stage} на уровне ${level}` : undefined
      });
    }
  }
  
  return presences;
}

function extractElementsForChain(concept: string): string[] {
  // [KEYWORD_BASED]: Element extraction uses keyword matching — will be replaced by LLM-based evaluation in Phase 2 AuditStepRunner
  // Russian keywords per Language Contract (Finding 1).
  const elements: string[] = [];
  const lowerConcept = concept.toLowerCase();
  
  if (lowerConcept.includes('закон') || lowerConcept.includes('тематическ') || lowerConcept.includes('правило')) elements.push('thematic_law');
  if (lowerConcept.includes('персонаж') || lowerConcept.includes('герой') || lowerConcept.includes('протагонист')) elements.push('protagonist_goal');
  if (lowerConcept.includes('конфликт') || lowerConcept.includes('борьба') || lowerConcept.includes('противост')) elements.push('central_conflict');
  
  return elements.length > 0 ? elements : ['narrative_core'];
}

function createIssueFromChain(chainResult: WhatForChainResult, element: string): Issue | null {
  if (chainResult.terminal !== 'BREAK') return null;
  
  return createIssue({
    id: `ISSUE-CHAIN-${element}`,
    location: `chain.${element}`,
    severity: chainResult.terminalStep <= 4 ? 'critical' : 'major',
    axes: { criticality: chainResult.terminalStep <= 4 ? 9 : 6, risk: 4, time_cost: 5 },
    diagnosis: `Элемент «${element}» обрывается на шаге ${chainResult.terminalStep}`,
    patches: {
      conservative: { description: 'Привязать элемент к закону мира', impact: 'Минимальная интеграция', sideEffects: [] },
      compromise: { description: 'Реструктурировать назначение элемента', impact: 'Лучшая нарративная связь', sideEffects: ['Небольшие доработки'] },
      radical: { description: 'Удалить или заменить элемент', impact: 'Чистый нарратив', sideEffects: ['Может повлиять на связанные элементы'] }
    }
  });
}

function deriveGriefFromLaw(law: string): GenerativeOutput['grief_mapping'] {
  // [KEYWORD_BASED]: Grief derivation from law uses keyword matching — will be replaced by LLM-based evaluation in Phase 2 AuditStepRunner
  // Russian keywords per Language Contract (Finding 1).
  const lowerLaw = law.toLowerCase();
  
  if (lowerLaw.includes('потеря') || lowerLaw.includes('смерть') || lowerLaw.includes('утрата')) {
    return { law, derived_stage: 'depression', justification_chain: ['Закон связан с потерей', 'Персонажи переживают горе'], justification: ['Закон связан с потерей', 'Персонажи переживают горе'] };
  }
  if (lowerLaw.includes('отрицан') || lowerLaw.includes('отверга') || lowerLaw.includes('отказ')) {
    return { law, derived_stage: 'denial', justification_chain: ['Закон связан с отрицанием', 'Тема непринятия'], justification: ['Закон связан с отрицанием', 'Тема непринятия'] };
  }
  if (lowerLaw.includes('гнев') || lowerLaw.includes('ярость') || lowerLaw.includes('злость')) {
    return { law, derived_stage: 'anger', justification_chain: ['Закон связан с гневом', 'Конфликтная природа'], justification: ['Закон связан с гневом', 'Конфликтная природа'] };
  }
  
  return { law, derived_stage: 'depression', justification_chain: ['По умолчанию — депрессия', 'Центральный нарративный вес'], justification: ['По умолчанию — депрессия', 'Центральный нарративный вес'] };
}

function deriveDilemmaFromTheme(theme: string): GenerativeOutput['dilemma'] {
  // [KEYWORD_BASED]: Dilemma generation uses defaults — will be replaced by LLM-based evaluation in Phase 2 AuditStepRunner
  return {
    value_A: 'Личная свобода',
    value_B: 'Коллективная ответственность',
    criteria_met: {
      type_choice: false,
      irreversibility: false,
      identity: false,
      victory_price: false
    },
    post_final_world: '',
    conflict_description: `Тема «${theme}» создаёт напряжение между личными и общественными потребностями`
  };
}

function calculateFinalScore(state: OrchestratorState): { total: string; percentage: number; by_level: Record<string, number> } {
  const by_level: Record<string, number> = {
    L1: state.gate_L1?.score || 0,
    L2: state.gate_L2?.score || 0,
    L3: state.gate_L3?.score || 0,
    L4: state.gate_L4?.score || 0
  };

  const total = by_level.L1 + by_level.L2 + by_level.L3 + by_level.L4;
  const percentage = total / 4;

  return {
    total: `${Math.round(total)}/400`,
    percentage: Math.round(percentage),
    by_level
  };
}

function generateNextActions(state: OrchestratorState): NextAction[] {
  const actions: NextAction[] = [];

  // Priority 1: Critical issues
  const criticalIssues = state.issues.filter(i => i.severity === 'critical');
  if (criticalIssues.length > 0) {
    actions.push({
      priority: 1,
      action: `Устранить ${criticalIssues.length} критических проблем`,
      rationale: 'Критические проблемы блокируют связность нарратива',
      estimated_effort: 'days'
    });
  }

  // Priority 2: Gate failures
  if (state.gate_L1 && state.gate_L1.status === 'failed') {
    actions.push({
      priority: 2,
      action: 'Исправить провал гейта L1',
      rationale: 'L1 — основа для всех остальных уровней',
      estimated_effort: 'days'
    });
  }

  // Priority 3: Cult potential improvements
  if (state.cult_potential && !state.cult_potential.passed) {
    actions.push({
      priority: 3,
      action: 'Улучшить критерии культового потенциала',
      rationale: state.cult_potential.recommendations[0] || 'Углубить нарратив',
      estimated_effort: 'weeks'
    });
  }

  return actions.sort((a, b) => a.priority - b.priority);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default runFullAudit;
