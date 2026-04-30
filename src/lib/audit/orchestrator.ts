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
    { id: 'A_structure', tags: ['L1', 'CORE'], content: 'Structure analysis', level: 'L1' },
    { id: 'B_thematic_law', tags: ['L1', 'CORE'], content: 'Thematic law validation', level: 'L1' },
    { id: 'C_root_trauma', tags: ['L1', 'CORE'], content: 'Root trauma analysis', level: 'L1' },
    { id: 'D_hamartia', tags: ['L1', 'CORE'], content: 'Hamartia validation', level: 'L1' },
    { id: 'E_world_law', tags: ['L1', 'CORE'], content: 'World law integration', level: 'L1' },
    { id: 'F_skeleton', tags: ['L1', 'CORE'], content: 'Skeleton completeness', level: 'L1' },
    
    // L2 sections - Secondary validation
    { id: '1.1_mechanics', tags: ['L2'], content: 'Mechanism analysis', level: 'L2' },
    { id: '1.3_aesthetic', tags: ['L2', 'VISUAL'], content: 'Aesthetic experience', level: 'L2' },
    { id: '1.5_limitation', tags: ['L2'], content: 'Physical limitation', level: 'L2' },
    { id: '1.6_routine', tags: ['L2'], content: 'Body routine', level: 'L2' },
    { id: 'character_arcs', tags: ['L2'], content: 'Character development', level: 'L2' },
    { id: 'dialogue', tags: ['L2'], content: 'Dialogue quality', level: 'L2' },
    { id: 'world_consistency', tags: ['L2'], content: 'World logic consistency', level: 'L2' },
    
    // L3 sections - Grief architecture
    { id: '2.1_grief', tags: ['L3'], content: 'Grief architecture', level: 'L3' },
    { id: '2.2_trauma', tags: ['L3'], content: 'Trauma analysis', level: 'L3' },
    { id: '3.1_mda', tags: ['L3'], content: 'MDA analysis', level: 'L3' },
    
    // L4 sections - Final synthesis
    { id: '4.1_cult', tags: ['L4'], content: 'Cult potential', level: 'L4' },
    { id: '4.2_mirror', tags: ['L4'], content: 'Mirror test', level: 'L4' },
    { id: 'final_synthesis', tags: ['L4'], content: 'Final integration', level: 'L4' },
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
    state.error = 'Input validation failed';
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
      mainRisks: ['Unknown profile — using defaults'],
      auditPriorities: defaultPriorityArray,
      priority_array: defaultPriorityArray,
      risk_flags: ['Unknown profile — using defaults']
    };
  }

  // === PREREQUISITE CHECK ===
  const prereqCheck = validatePrerequisites('GATE-1', []);
  if (!prereqCheck.canProceed && prereqCheck.blockedBy) {
    state.phase = 'blocked';
    state.error = prereqCheck.reason || 'Prerequisites not met';
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
    state.error = 'Skeleton extraction failed weakness tests';
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
    state.error = 'Screening failed: too many NO answers';
    return state; // TERMINATE
  }

  // === APPLY MEDIA TRANSFORMATION (RULE_4) ===
  state.media_transformation = applyMediaTransformation(input.media_type);

  // === STEP 5: GATE L1 ===
  state.phase = 'L1_evaluation';
  
  const l1Sections = getAuditSections().filter(s => s.level === 'L1');
  state.gate_L1 = executeGateWithBreakdown('L1', l1Sections, 60);

  // RULE_5: If gate fails, STOP and output fixes for that level ONLY
  if (state.gate_L1.halt) {
    state.issues = generateIssuesFromGate(state.gate_L1, 'L1');
    return state; // TERMINATE
  }

  // === STEP 6: GATE L2 ===
  state.phase = 'L2_evaluation';
  
  const l2Sections = getAuditSections().filter(s => s.level === 'L2');
  state.gate_L2 = executeGateWithBreakdown('L2', l2Sections, 60);

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
      gateName: 'Grief Architecture',
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
  // PHASE_2_TODO: Implement actual ten-repainting test via LLM prompt.
  if (state.audit_mode_config?.requireTenRepaintingTest) {
    // Ten-repainting test is not yet implemented via LLM.
    // Skipping for now — Phase 2 will add the real test.
  }

  const l3Sections = getAuditSections().filter(s => s.level === 'L3');
  state.gate_L3 = executeGateWithBreakdown('L3', l3Sections, 60);

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
    state.error = 'Cult Potential mandatory criteria failed';
    state.issues = generateIssuesFromCultPotential(state.cult_potential);
    return state; // TERMINATE
  }

  // === STEP 8: GATE L4 ===
  state.phase = 'L4_evaluation';
  
  const l4Sections = getAuditSections().filter(s => s.level === 'L4');
  state.gate_L4 = executeGateWithBreakdown('L4', l4Sections, 60);

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
  // PHASE_2_TODO: Replace keyword matching with LLM-based screening.
  // Current implementation uses Russian keywords per Language Contract (Finding 1):
  // English keyword matching (includes('theme'), includes('character')) is FORBIDDEN.
  const lowerConcept = concept.toLowerCase();
  let no_count = 0;
  const flags: string[] = [];

  // Check for key structural elements using Russian keywords
  // (user narrative is in Russian per Language Contract)
  const q1 = lowerConcept.includes('закон') || lowerConcept.includes('правило') || lowerConcept.includes('тематическ');
  if (!q1) {
    no_count++;
    flags.push('§0: Тематический закон не обнаружен');
  }

  const q3 = lowerConcept.includes('персонаж') || lowerConcept.includes('герой') || lowerConcept.includes('протагонист');
  if (!q3) {
    no_count++;
    flags.push('§3: Нет явного протагониста');
  }

  const q6 = lowerConcept.includes('конфликт') || lowerConcept.includes('борьба') || lowerConcept.includes('противост');
  if (!q6) {
    no_count++;
    flags.push('§6: Нет явного конфликта');
  }

  return {
    question1_thematicLaw: q1,
    question2_worldWithoutProtagonist: q3,
    question3_embodiment: false, // PHASE_2_STUB: Requires LLM-based analysis
    question4_hamartia: false, // PHASE_2_STUB: Requires LLM-based analysis
    question5_painfulChoice: false, // PHASE_2_STUB: Requires LLM-based analysis
    question6_antagonistLogic: q6,
    question7_finalIrreversible: false, // PHASE_2_STUB: Requires LLM-based analysis
    flags,
    recommendation: no_count >= 4 ? 'stop_return_to_skeleton' : no_count >= 2 ? 'requires_sections' : 'ready_for_audit',
    no_count,
    sections_for_deep_audit: flags,
    proceed_normally: no_count < 4
  };
}

function executeGateWithBreakdown(
  level: string,
  sections: AuditSection[],
  threshold: number
): GateResult {
  // PHASE_2_STUB: This function always returns 100% (all sections pass).
  // Phase 2 will replace this with real LLM-based gate evaluation.
  // The score is artificially 100% because keyword matching cannot evaluate
  // whether a narrative section actually satisfies protocol criteria.
  //
  // IMPORTANT: This means ALL gates currently pass. Once Phase 2 implements
  // real LLM evaluation, gates will start producing meaningful scores.
  const score = 100;

  // RULE_8: Build block-level breakdown
  const breakdown: Record<string, string> = {};
  for (const section of sections) {
    breakdown[section.id] = 'PASS'; // PHASE_2_STUB: Always PASS until LLM integration
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
        diagnosis: `${criterion.name} failed — обязательный критерий`,
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
  // PHASE_2_TODO: Replace keyword matching with LLM-based grief analysis.
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
  // PHASE_2_TODO: Replace keyword matching with LLM-based element extraction.
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
  // PHASE_2_TODO: Replace keyword matching with LLM-based grief derivation.
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
  // PHASE_2_TODO: Replace with LLM-based dilemma generation.
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
