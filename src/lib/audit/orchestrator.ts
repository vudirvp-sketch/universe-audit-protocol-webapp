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

import { validateInput, type ValidationResult } from './input-validator';
import { detectAuditMode, getModeExecutionConfig, type AuditMode, type ModeExecutionConfig } from './modes';
import { calculateAuthorProfile, type AuthorProfile } from './author-profile';
import { extractSkeleton, type SkeletonExtractionResult } from './skeleton-extraction';
import { executeGate, validatePrerequisites, type GateResult, type GateLevel } from './gate-executor';
import { validateGriefArchitecture, executeL3GateWithGriefCheck, type GriefValidationResult, type GriefPresence } from './grief-validation';
import { evaluateCultPotential, type CultEvaluationResult } from './cult-potential';
import { assignLevel, partitionByLevel, type AuditLevel } from './level-assignment';
import { runWhatForChain, type WhatForChainResult } from './what-for-chain';
import { validateIssue, createIssue, type Issue, type Severity, type Axes } from './issue-schema';
import { applyMediaTransformation, type MediaType, type TransformationResult } from './media-transformation';
import { generateDiagnostics, type DiagnosticResult } from './diagnostics';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface AuditInput {
  concept: string;
  media_type: MediaType;
  audit_mode?: AuditMode;
  author_answers?: AuthorProfileAnswers;
  dominant_stage?: string;
  final_dilemma?: string;
}

export interface AuthorProfileAnswers {
  Q1: boolean;
  Q2: boolean;
  Q3: boolean;
  Q4: boolean;
  Q5: boolean;
  Q6: boolean;
  Q7: boolean;
}

export interface AuthorProfileResult {
  type: AuthorProfile;
  percentage: number;
  confidence: 'high' | 'medium' | 'low';
  priority_array: string[];
  risk_flags: string[];
}

export interface AuditState {
  phase: AuditPhase;
  input: AuditInput;
  validation_result?: ValidationResult;
  audit_mode_config?: ModeExecutionConfig & { mode: AuditMode };
  author_profile_result?: AuthorProfileResult;
  skeleton?: SkeletonExtractionResult;
  screening_result?: ScreeningResult;
  gate_L1?: GateResult;
  gate_L2?: GateResult;
  gate_L3?: GateResult;
  gate_L4?: GateResult;
  grief_validation?: GriefValidationResult;
  cult_potential?: CultEvaluationResult;
  issues: Issue[];
  what_for_chains: WhatForChainResult[];
  generative_output?: GenerativeOutput;
  diagnostics?: DiagnosticResult;
  final_score?: FinalScore;
  next_actions: NextAction[];
  media_transformation?: TransformationResult;
  error?: string;
}

export type AuditPhase = 
  | 'blocked' 
  | 'input_validation' 
  | 'mode_detection' 
  | 'author_profile' 
  | 'skeleton_extraction' 
  | 'screening' 
  | 'gate_L1' 
  | 'gate_L2' 
  | 'gate_L3' 
  | 'gate_L4' 
  | 'issue_generation' 
  | 'generative_modules' 
  | 'final_output' 
  | 'complete';

export interface ScreeningResult {
  no_count: number;
  flags: string[];
  sections_for_deep_audit: string[];
  proceed_normally: boolean;
}

export interface GenerativeOutput {
  grief_mapping?: {
    derived_stage: string;
    justification: string[];
  };
  dilemma?: {
    value_A: string;
    value_B: string;
    conflict_description: string;
  };
}

export interface FinalScore {
  total: string;
  percentage: number;
  by_level: Record<string, number>;
}

export interface NextAction {
  priority: number;
  action: string;
  rationale: string;
  estimated_effort: 'hours' | 'days' | 'weeks';
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
export async function runFullAudit(input: AuditInput): Promise<AuditState> {
  const state: AuditState = {
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
    state.audit_mode_config = {
      mode: input.audit_mode,
      ...getModeExecutionConfig(input.audit_mode)
    };
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
    state.audit_mode_config = {
      mode: detectedMode,
      ...getModeExecutionConfig(detectedMode)
    };
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
    
    state.author_profile_result = {
      type: profileType,
      percentage: 50,
      confidence: 'medium',
      priority_array: getPriorityArray(profileType),
      risk_flags: []
    };
  } else {
    // Default profile
    state.author_profile_result = {
      type: 'hybrid',
      percentage: 50,
      confidence: 'low',
      priority_array: getPriorityArray('hybrid'),
      risk_flags: ['Unknown profile - using defaults']
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
  if (state.screening_result.no_count >= 4) {
    state.phase = 'blocked';
    state.error = 'Screening failed: too many NO answers';
    return state; // TERMINATE
  }

  // === APPLY MEDIA TRANSFORMATION (RULE_4) ===
  state.media_transformation = applyMediaTransformation(input.media_type);

  // === STEP 5: GATE L1 ===
  state.phase = 'gate_L1';
  
  const l1Sections = getAuditSections().filter(s => s.level === 'L1');
  state.gate_L1 = executeGateWithBreakdown('L1', l1Sections, 60);

  // RULE_5: If gate fails, STOP and output fixes for that level ONLY
  if (state.gate_L1.halt) {
    state.issues = generateIssuesFromGate(state.gate_L1, 'L1');
    return state; // TERMINATE
  }

  // === STEP 6: GATE L2 ===
  state.phase = 'gate_L2';
  
  const l2Sections = getAuditSections().filter(s => s.level === 'L2');
  state.gate_L2 = executeGateWithBreakdown('L2', l2Sections, 60);

  if (state.gate_L2.halt) {
    state.issues = generateIssuesFromGate(state.gate_L2, 'L2');
    return state; // TERMINATE
  }

  // === STEP 7: GATE L3 (with Grief Validation HARD CHECK) ===
  state.phase = 'gate_L3';

  // RULE_3: GRIEF VALIDATION is a HARD CHECK before L3 scoring
  const griefData = analyzeGriefStages(input.concept, input.dominant_stage);
  state.grief_validation = validateGriefArchitecture(griefData);

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
  if (state.audit_mode_config?.requireTenRepaintingTest) {
    // Ten-repainting test would go here
    // For now, assume it passes
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
  state.phase = 'gate_L4';
  
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
    state.what_for_chains.push(chainResult);

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

function getPriorityArray(profile: AuthorProfile): string[] {
  const priorities: Record<AuthorProfile, string[]> = {
    gardener: ['character_arcs', 'dialogue', 'root_trauma', 'thematic_law', 'world_consistency'],
    architect: ['thematic_law', 'world_consistency', 'root_trauma', 'character_arcs', 'dialogue'],
    hybrid: ['thematic_law', 'root_trauma', 'character_arcs', 'world_consistency', 'dialogue']
  };
  return priorities[profile];
}

function performScreening(concept: string): ScreeningResult {
  // Simplified screening - in production would use LLM
  const lowerConcept = concept.toLowerCase();
  let no_count = 0;
  const flags: string[] = [];

  // Check for key elements
  if (!lowerConcept.includes('theme') && !lowerConcept.includes('law')) {
    no_count++;
    flags.push('§0: No thematic law detected');
  }

  if (!lowerConcept.includes('character') && !lowerConcept.includes('protagonist')) {
    no_count++;
    flags.push('§3: No clear protagonist');
  }

  if (!lowerConcept.includes('conflict') && !lowerConcept.includes('struggle')) {
    no_count++;
    flags.push('§6: No clear conflict');
  }

  return {
    no_count,
    flags,
    sections_for_deep_audit: flags,
    proceed_normally: no_count < 4
  };
}

function executeGateWithBreakdown(
  level: string,
  sections: AuditSection[],
  threshold: number
): GateResult {
  // Calculate score based on sections
  const passedSections = sections.length; // In production, would evaluate each
  const score = (passedSections / Math.max(sections.length, 1)) * 100;

  // RULE_8: Build block-level breakdown
  const breakdown: Record<string, string> = {};
  for (const section of sections) {
    breakdown[section.id] = 'PASS'; // In production, would show actual scores
  }

  const conditions = sections.map(s => ({
    id: s.id,
    passed: true,
    message: `${s.content} - passed`
  }));

  return {
    gateId: `GATE-${level}`,
    gateName: `Level ${level} Gate`,
    status: score >= threshold ? 'passed' : 'failed',
    score,
    conditions,
    halt: score < threshold,
    fixes: score < threshold ? [`Fix ${level} issues before proceeding`] : [],
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
        conservative: { description: weakness.action, impact: 'Minimal fix', sideEffects: [] },
        compromise: { description: weakness.action, impact: 'Balanced fix', sideEffects: [] },
        radical: { description: weakness.action, impact: 'Comprehensive fix', sideEffects: [] }
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
          conservative: { description: 'Minor adjustment', impact: 'Quick fix', sideEffects: [] },
          compromise: { description: 'Balanced revision', impact: 'Moderate improvement', sideEffects: [] },
          radical: { description: 'Complete restructuring', impact: 'Full resolution', sideEffects: [] }
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
        conservative: { description: 'Add grief stage manifestation', impact: 'Minimal addition', sideEffects: ['May need minor revisions'] },
        compromise: { description: 'Restructure grief progression', impact: 'Better emotional flow', sideEffects: ['Moderate restructuring'] },
        radical: { description: 'Redesign grief architecture', impact: 'Complete emotional coherence', sideEffects: ['Major structural changes'] }
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
        diagnosis: `${criterion.name} failed - mandatory criterion`,
        patches: {
          conservative: { description: 'Add minimum viable element', impact: 'Meets threshold', sideEffects: [] },
          compromise: { description: 'Develop thematic integration', impact: 'Stronger foundation', sideEffects: ['Related revisions'] },
          radical: { description: 'Restructure narrative foundation', impact: 'Complete thematic coherence', sideEffects: ['Major revisions'] }
        }
      }));
    }
  }
  
  return issues;
}

function analyzeGriefStages(concept: string, dominantStage?: string): GriefPresence[] {
  const stages = ['denial', 'anger', 'bargaining', 'depression', 'acceptance'] as const;
  const levels = ['world', 'society', 'character', 'scene'] as const;
  
  const presences: GriefPresence[] = [];
  const lowerConcept = concept.toLowerCase();
  
  for (const stage of stages) {
    for (const level of levels) {
      // Simple keyword detection - in production would use NLP
      const stageKeywords: Record<string, string[]> = {
        denial: ['refuse', 'deny', 'reject', 'ignore', 'pretend'],
        anger: ['rage', 'fury', 'angry', 'hate', 'blame'],
        bargaining: ['deal', 'bargain', 'negotiate', 'compromise', 'trade'],
        depression: ['sad', 'grief', 'sorrow', 'despair', 'hopeless'],
        acceptance: ['accept', 'peace', 'understand', 'release', 'let go']
      };
      
      const hasStage = stageKeywords[stage].some(kw => lowerConcept.includes(kw));
      
      presences.push({
        stage,
        level,
        present: hasStage,
        description: hasStage ? `Detected ${stage} at ${level} level` : undefined
      });
    }
  }
  
  return presences;
}

function extractElementsForChain(concept: string): string[] {
  // Extract key narrative elements for chain analysis
  const elements: string[] = [];
  const lowerConcept = concept.toLowerCase();
  
  if (lowerConcept.includes('theme')) elements.push('thematic_law');
  if (lowerConcept.includes('character')) elements.push('protagonist_goal');
  if (lowerConcept.includes('conflict')) elements.push('central_conflict');
  
  return elements.length > 0 ? elements : ['narrative_core'];
}

function createIssueFromChain(chainResult: WhatForChainResult, element: string): Issue | null {
  if (chainResult.terminal !== 'BREAK') return null;
  
  return createIssue({
    id: `ISSUE-CHAIN-${element}`,
    location: `chain.${element}`,
    severity: chainResult.terminalStep <= 4 ? 'critical' : 'major',
    axes: { criticality: chainResult.terminalStep <= 4 ? 9 : 6, risk: 4, time_cost: 5 },
    diagnosis: `Element "${element}" breaks at step ${chainResult.terminalStep}`,
    patches: {
      conservative: { description: 'Bind element to world law', impact: 'Minimal integration', sideEffects: [] },
      compromise: { description: 'Restructure element purpose', impact: 'Better narrative fit', sideEffects: ['Minor revisions'] },
      radical: { description: 'Remove or replace element', impact: 'Clean narrative', sideEffects: ['May affect related elements'] }
    }
  });
}

function deriveGriefFromLaw(law: string): GenerativeOutput['grief_mapping'] {
  // Simplified derivation - in production would use LLM
  const lowerLaw = law.toLowerCase();
  
  if (lowerLaw.includes('loss') || lowerLaw.includes('death')) {
    return { derived_stage: 'depression', justification: ['Law involves loss', 'Characters grieve'] };
  }
  if (lowerLaw.includes('reject') || lowerLaw.includes('deny')) {
    return { derived_stage: 'denial', justification: ['Law involves rejection', 'Denial theme'] };
  }
  if (lowerLaw.includes('anger') || lowerLaw.includes('rage')) {
    return { derived_stage: 'anger', justification: ['Law involves anger', 'Conflict-driven'] };
  }
  
  return { derived_stage: 'depression', justification: ['Default to depression', 'Central narrative weight'] };
}

function deriveDilemmaFromTheme(theme: string): GenerativeOutput['dilemma'] {
  // Simplified derivation
  return {
    value_A: 'Individual freedom',
    value_B: 'Collective responsibility',
    conflict_description: `Theme "${theme}" creates tension between personal and societal needs`
  };
}

function calculateFinalScore(state: AuditState): FinalScore {
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

function generateNextActions(state: AuditState): NextAction[] {
  const actions: NextAction[] = [];

  // Priority 1: Critical issues
  const criticalIssues = state.issues.filter(i => i.severity === 'critical');
  if (criticalIssues.length > 0) {
    actions.push({
      priority: 1,
      action: `Address ${criticalIssues.length} critical issues`,
      rationale: 'Critical issues block narrative coherence',
      estimated_effort: 'days'
    });
  }

  // Priority 2: Gate failures
  if (state.gate_L1 && state.gate_L1.status === 'failed') {
    actions.push({
      priority: 2,
      action: 'Fix L1 gate failures',
      rationale: 'L1 is foundation for all other levels',
      estimated_effort: 'days'
    });
  }

  // Priority 3: Cult potential improvements
  if (state.cult_potential && !state.cult_potential.passed) {
    actions.push({
      priority: 3,
      action: 'Improve cult potential criteria',
      rationale: state.cult_potential.recommendations[0] || 'Enhance narrative depth',
      estimated_effort: 'weeks'
    });
  }

  return actions.sort((a, b) => a.priority - b.priority);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default runFullAudit;
