/**
 * UNIVERSE AUDIT PROTOCOL v10.0 - Type Definitions
 * 
 * Complete type definitions for all audit modules.
 * 
 * NON-NEGOTIABLE RULES IMPLEMENTED:
 * - RULE_8: GateResult includes block-level breakdown
 * - RULE_9: Issue includes full schema with axes and patches
 */

// ============================================================================
// BASE TYPES
// ============================================================================

export type AuditMode = 'conflict' | 'kishō' | 'hybrid';

export type MediaType = 'game' | 'novel' | 'film' | 'anime' | 'series' | 'ttrpg';

export type MediaTag = 'CORE' | 'GAME' | 'VISUAL' | 'AUDIO' | 'INTERACTIVE';

export type ChecklistItemStatus = 'PASS' | 'FAIL' | 'INSUFFICIENT_DATA' | 'PENDING';

export type GriefStage = 'denial' | 'anger' | 'bargaining' | 'depression' | 'acceptance';

// The 4 canonical grief materialization levels used in the matrix and scoring.
// The protocol mentions 7 levels in theory (character, location, mechanic, act,
// world, society, scene), but the 5×4 matrix uses these 4 standard columns.
export type GriefLevel = 'character' | 'location' | 'mechanic' | 'act';

/** Extended grief levels for reference — not used in the standard matrix */
export type GriefLevelExtended = GriefLevel | 'world' | 'society' | 'scene';

export type AuthorProfileType = 'gardener' | 'hybrid' | 'architect';

export type AuditLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';

export type AuditPhase =
  | 'idle'
  | 'input_validation'
  | 'mode_detection'
  | 'author_profile'
  | 'skeleton_extraction'
  | 'screening'
  | 'L1_evaluation'
  | 'L2_evaluation'
  | 'L3_evaluation'
  | 'L4_evaluation'
  | 'issue_generation'
  | 'generative_modules'
  | 'final_output'
  | 'complete'
  | 'failed'
  | 'blocked'
  | 'cancelled';

export type Severity = 'critical' | 'major' | 'minor' | 'cosmetic';

export type PatchType = 'conservative' | 'compromise' | 'radical';

// ============================================================================
// ISSUE SCHEMA (RULE_9)
// ============================================================================

export interface IssuePatch {
  type: PatchType;
  description: string;
  snippet?: string;
  impact?: string;
  risks?: string[];
  tests?: string[];
  sideEffects?: string[];
}

export interface Axes {
  criticality: number;  // 1-10: How central to the narrative (canonical scale per issue-schema validation)
  risk: number;         // 1-10
  time_cost: number;    // 1-10
}

export interface Issue {
  id: string;              // Format: "ISSUE-XX"
  location: string;        // Format: "§section + level"
  severity: Severity;
  axes: Axes;
  diagnosis: string;
  patches: {
    conservative: IssuePatch;
    compromise: IssuePatch;
    radical: IssuePatch;
  };
  recommended: PatchType;
  reasoning?: string;
}

// ============================================================================
// GATE RESULT (RULE_8)
// ============================================================================

export interface GateResult {
  gateId: string;
  gateName: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'blocked' | 'skipped';
  score: number;          // 0-100
  passed: boolean;         // Deterministic: code decides gate pass/fail, never LLM
  conditions: {
    id: string;
    passed: boolean;
    message: string;
  }[];
  halt: boolean;          // true = STOP execution
  fixes: string[];
  metadata: {
    breakdown?: Record<string, string>;  // RULE_8: Block-level breakdown
    level?: string;
    [key: string]: unknown;
  };
  // Legacy properties for UI compatibility
  level?: 'L1' | 'L2' | 'L3' | 'L4';
  applicableItems?: number;
  passedItems?: number;
  failedItems?: number;
  insufficientDataItems?: number;
  fixList?: FixItem[];
}

// ============================================================================
// GRIEF VALIDATION TYPES
// ============================================================================

export interface GriefStagePresence {
  stage: GriefStage;
  levels_present: GriefLevel[];
  valid: boolean;
}

export interface GriefValidationResult {
  valid: boolean;
  dominantStage: GriefStage | null;
  stageDistribution: Record<GriefStage, GriefLevel[]>;
  errors: GriefValidationError[];
  warnings: GriefValidationWarning[];
  structuralHoles: StructuralHole[];
  dominantIncomplete: boolean;
  all_stages_valid?: boolean;
  dominant_valid?: boolean;
  invalid_stages?: string[];
  flags?: string[];
}

export interface GriefValidationError {
  code: string;
  message: string;
  stage?: GriefStage;
  level?: GriefLevel;
}

export interface GriefValidationWarning {
  code: string;
  message: string;
  stage?: GriefStage;
  level?: GriefLevel;
}

export interface StructuralHole {
  stage: GriefStage;
  missingLevels: GriefLevel[];
  severity: Severity;
}

export interface GriefPresence {
  stage: GriefStage;
  level: GriefLevel;
  present: boolean;
  description?: string;
  evidence?: string;
}

// ============================================================================
// CULT POTENTIAL TYPES
// ============================================================================

export interface CultCriterion {
  id: string;
  name: string;
  description: string;
  weight: number;
  mandatory: boolean;
  category: 'philosophical' | 'narrative' | 'character' | 'world';
}

export interface CultEvaluationInput {
  hasRootTrauma: boolean;
  rootTraumaDepth: number;
  ideologicalSystem: boolean;
  hasThematicLaw: boolean;
  thematicLawIntegration: number;
  themeUniversality: boolean;
  characterComplexity: number;
  moralAmbiguity: boolean;
  worldConsistency: number;
  transformativePotential: boolean;
  ritualizableElements: boolean;
  communalExperience: boolean;
  interpretiveDepth: number;
  rewatchValue: boolean;
  memeticPotential: boolean;
}

export interface CultEvaluationResult {
  passed: boolean;
  phase1Result: {
    passed: boolean;
    criteria: {
      id: string;
      name: string;
      passed: boolean;
      blocking: boolean;
    }[];
  };
  phase2Result: {
    score: number;
    maxScore: number;
    percentage: number;
    passed: boolean;
    criteria: {
      id: string;
      name: string;
      passed: boolean;
      score: number;
      maxScore: number;
    }[];
  };
  classification: CultClassification;
  recommendations: string[];
}

export type CultClassification = 
  | 'high_cult_potential'
  | 'moderate_cult_potential'
  | 'limited_cult_potential'
  | 'standard_work'
  | 'cult_failed';

// ============================================================================
// SKELETON TYPES
// ============================================================================

export interface SkeletonElement {
  id: string;
  name: string;
  value: string | null;
  extracted?: string;
  status: 'complete' | 'partial' | 'missing' | 'incomplete';
  weakness_test?: {
    question: string;
    passed: boolean | null;
    failureAction: string;
    severity: Severity;
  };
  note?: string;
}

export interface Skeleton {
  status: 'COMPLETE' | 'INCOMPLETE';
  elements: SkeletonElement[];
  fixes: string[];
  overallStatus?: 'complete' | 'incomplete' | 'partial';
  weaknesses?: WeaknessResult[];
  blockers?: string[];
  canProceedToL1?: boolean;
}

// Legacy skeleton format for API compatibility
export interface LegacySkeleton {
  thematicLaw: string | null;
  rootTrauma: string | null;
  hamartia: string | null;
  pillars: [string | null, string | null, string | null];
  emotionalEngine: GriefStage | null;
  authorProhibition: string | null;
  targetExperience: string | null;
  centralQuestion: string | null;
}

export interface WeaknessResult {
  element: string;
  testQuestion: string;
  passed: boolean;
  action: string;
  severity: Severity;
}

// ============================================================================
// WHAT-FOR CHAIN TYPES (RULE_2)
// ============================================================================

export interface ChainIteration {
  step: number;
  question: string;
  answer: string;
  analysis?: string;
}

export interface ChainResult {
  terminal_type: 'BREAK' | 'DILEMMA' | null;  // Legacy field — prefer `terminal`
  terminal?: 'BREAK' | 'DILEMMA' | 'UNCLASSIFIED';  // Canonical field
  terminalStep?: number;
  step_reached: number;  // Legacy field — prefer `terminalStep`
  action: 'bind_to_law' | 'keep' | 'remove' | 'bind_to_law_or_remove' | 'retry_analysis' | null;
  iterations: ChainIteration[];  // Legacy field — prefer `chain`
  valid: boolean;
  chain?: ChainIteration[];  // Canonical field
  reasoning?: string;
}

// ============================================================================
// FIVE CHECKS & TOUCHES
// ============================================================================

export interface FiveChecksResult {
  pillars_enhanced: number;
  creates_dilemma: boolean;
  visible_cost: boolean;
  ripple_effect: number;
  dual_level: boolean;
  passed: boolean;
  failed_checks: string[];
}

export interface FiveTouchesResult {
  dialogue: 1 | 2 | 3 | 4 | 5;
  choice: 1 | 2 | 3 | 4 | 5;
  texture: 1 | 2 | 3 | 4 | 5;
  shadow: 1 | 2 | 3 | 4 | 5;
  metaphor: 1 | 2 | 3 | 4 | 5;
  total_score: number;
  status: 'underdeveloped' | 'functional' | 'complete';
}

// ============================================================================
// GENERATIVE OUTPUT TYPES (RULE_10)
// ============================================================================

export interface GriefMappingResult {
  law: string;
  derived_stage: GriefStage;
  justification_chain: string[];  // Legacy field — prefer `justification`
  justification?: string[];  // Canonical field
}

export interface DilemmaResult {
  value_A: string;
  value_B: string;
  criteria_met: {
    type_choice: boolean;
    irreversibility: boolean;
    identity: boolean;
    victory_price: boolean;
  };
  post_final_world: string;
  conflict_description?: string;
}

export interface GenerativeOutput {
  grief_mapping?: GriefMappingResult;
  dilemma?: DilemmaResult;
}

// ============================================================================
// AUTHOR PROFILE TYPES
// ============================================================================

export interface AuthorProfileAnswers {
  Q1: boolean; // Make character stupidity organic
  Q2: boolean; // Know character behavior outside narrative
  Q3: boolean; // Plot twists from character choices
  Q4: boolean; // Surprised by own character
  Q5: boolean; // Finale could change from mid-point decision
  Q6: boolean; // Antagonist logic defensible
  Q7: boolean; // Tragedy from character nature
  q1_organic_stupidity?: boolean;
  q2_knows_off_screen_behavior?: boolean;
  q3_plot_from_characters?: boolean;
  q4_surprised_by_character?: boolean;
  q5_finale_can_change?: boolean;
  q6_antagonist_right_by_logic?: boolean;
  q7_tragedy_from_nature?: boolean;
}

export interface AuthorProfile {
  type: AuthorProfileType;
  percentage: number;
  confidence: 'high' | 'medium' | 'low';
  mainRisks: string[];
  auditPriorities: string[];
  risk_flags?: string[];      // Legacy alias for mainRisks
  priority_array?: string[];  // Legacy alias for auditPriorities
}

// ============================================================================
// SCREENING TYPES
// ============================================================================

export interface ScreeningResult {
  question1_thematicLaw: boolean;
  question2_worldWithoutProtagonist: boolean;
  question3_embodiment: boolean;
  question4_hamartia: boolean;
  question5_painfulChoice: boolean;
  question6_antagonistLogic: boolean;
  question7_finalIrreversible: boolean;
  flags: string[];
  recommendation: 'ready_for_audit' | 'requires_sections' | 'stop_return_to_skeleton';
  no_count?: number;
  sections_for_deep_audit?: string[];
  proceed_normally?: boolean;
}

// ============================================================================
// CHECKLIST TYPES
// ============================================================================

export interface ChecklistItem {
  id: string;
  block: string;
  text: string;
  tag: MediaTag | `${MediaTag}|${MediaTag}`;
  level: AuditLevel | 'L1/L2' | 'L1/L3' | 'L2/L3' | 'L2/L4';
  status: ChecklistItemStatus;
  evidence?: string;
  functionalRole?: string;
  applicable: boolean;
}

// ============================================================================
// GRIEF MATRIX TYPES
// ============================================================================

export interface GriefMatrixCell {
  stage: GriefStage;
  level: GriefLevel;
  character?: string;
  evidence?: string;
  confidence: 'high' | 'medium' | 'low' | 'absent';
}

export interface GriefArchitectureMatrix {
  dominantStage: GriefStage | null;
  cells: GriefMatrixCell[];
}

// ============================================================================
// SCORES & FIXES
// ============================================================================

export interface Scores {
  connectedness: number; // 0-5
  vitality: number; // 0-5
  characters: number; // 0-5
  theme: number; // 0-5
  embodiment: number; // 0-5
}

export interface FixItem {
  id: string;
  description: string;
  severity: Severity;
  type: 'motivation' | 'competence' | 'scale' | 'resources' | 'memory' | 'ideology' | 'time';
  recommendedApproach: PatchType;
}

// ============================================================================
// LOGIC HOLE TYPES
// ============================================================================

export interface LogicHole {
  id: string;
  type: 'motivation' | 'competence' | 'scale' | 'resources' | 'memory' | 'ideology' | 'time';
  description: string;
  severity: Severity;
  suggestedFix: string;
}

// ============================================================================
// AUDIT REPORT TYPES
// ============================================================================

export interface AuditReport {
  protocolVersion: string;
  auditMode: AuditMode;
  authorProfile: AuthorProfile | null;
  skeleton: Skeleton | null;
  screeningResult: ScreeningResult | null;
  gateResults: {
    L1: GateResult | null;
    L2: GateResult | null;
    L3: GateResult | null;
    L4: GateResult | null;
  };
  checklist: ChecklistItem[];
  griefMatrix: GriefArchitectureMatrix | null;
  issues: Issue[];
  whatForChains: ChainResult[];
  generativeOutput: GenerativeOutput | null;
  finalScore: { total: string; percentage: number; by_level: Record<string, number> } | null;
  scores: Record<string, number>;
  generatedAt: string;
}

export interface AuditJSONOutput {
  audit_meta: {
    mode: AuditMode;
    media_type: MediaType;
    applicable_items: number;
  };
  author_profile: {
    type: AuthorProfileType;
    percentage: number;
    confidence: 'high' | 'medium' | 'low';
  };
  skeleton: {
    thematic_law: string | null;
    root_trauma: string | null;
    hamartia: string | null;
    dominant_grief_stage: GriefStage | null;
  };
  gate_results: {
    L1_score: string;
    L1_passed: boolean;
    L2_score: string;
    L2_passed: boolean;
    L3_score: string;
    L3_passed: boolean;
    L4_score: string;
    L4_passed: boolean;
  };
  overall_score: {
    checklist: string;
    percentage: string;
    classification: 'cult_masterpiece' | 'powerful' | 'living_weak_soul' | 'decoration';
  };
  critical_issues: Array<{
    id: string;
    level: AuditLevel;
    severity: Severity;
    narrative_justification: string;
  }>;
  priority_actions: [string, string, string];
}

// ============================================================================
// FULL OUTPUT SCHEMA
// ============================================================================

export interface FullAuditOutput {
  audit_meta: {
    protocol_version: string;
    audit_mode: AuditMode;
    media_type: MediaType;
    author_profile: {
      type: AuthorProfileType;
      priority_override: string[];
    };
  };
  gating: {
    L1?: GateResult;
    L2?: GateResult;
    L3?: GateResult;
    L4?: GateResult;
  };
  skeleton: Skeleton;
  grief_architecture: {
    dominant_stage: string;
    validation: GriefValidationResult;
    stages: GriefStagePresence[];
  };
  cult_potential: CultEvaluationResult;
  issues: Issue[];
  generative_output: GenerativeOutput;
  protocol_limitations: string[];
  author_questions: string[];
  comparative: ComparativeResult[];
  final_score: {
    total: string;
    percentage: number;
    by_level: Record<AuditLevel, number>;
  };
  next_actions: NextAction[];
}

export interface ComparativeResult {
  reference: string;
  concept_stronger_in: string[];
  concept_weaker_in: string[];
  evidence: string;
}

export interface NextAction {
  priority: number;
  action: string;
  rationale: string;
  estimated_effort: 'hours' | 'days' | 'weeks';
}

// ============================================================================
// AUDIT STATE (HOOKS)
// ============================================================================

export interface AuditState {
  phase: AuditPhase;
  inputText: string;
  mediaType: MediaType;
  auditMode: AuditMode | null;
  authorAnswers: AuthorProfileAnswers | null;
  authorProfile: AuthorProfile | null;
  skeleton: Skeleton | null;
  screeningResult: ScreeningResult | null;
  gateResults: {
    L1: GateResult | null;
    L2: GateResult | null;
    L3: GateResult | null;
    L4: GateResult | null;
  };
  checklist: ChecklistItem[];
  griefMatrix: GriefArchitectureMatrix | null;
  report: AuditReport | null;
  // New state for v10.0 integration
  issues: Issue[];
  whatForChains: ChainResult[];
  generativeOutput: GenerativeOutput | null;
  nextActions: NextAction[];
  finalScore: { total: string; percentage: number; by_level: Record<string, number> } | null;
  isLoading: boolean;
  error: string | null;
  // Timing & resume fields
  blockedAt: string | null;
  elapsedMs: number;
  stepTimings: Partial<Record<AuditPhase, number>>;

  // Actions
  setPhase: (phase: AuditPhase) => void;
  setInputText: (text: string) => void;
  setMediaType: (type: MediaType) => void;
  setAuditMode: (mode: AuditMode | null) => void;
  setAuthorAnswers: (answers: AuthorProfileAnswers | null) => void;
  setAuthorProfile: (profile: AuthorProfile | null) => void;
  setSkeleton: (skeleton: Skeleton | null) => void;
  setScreeningResult: (result: ScreeningResult | null) => void;
  setGateResult: (level: 'L1' | 'L2' | 'L3' | 'L4', result: GateResult) => void;
  setChecklist: (checklist: ChecklistItem[]) => void;
  updateChecklistItem: (id: string, updates: Partial<ChecklistItem>) => void;
  setGriefMatrix: (matrix: GriefArchitectureMatrix | null) => void;
  setReport: (report: AuditReport | null) => void;
  // New actions for v10.0 integration
  setIssues: (issues: Issue[]) => void;
  addIssue: (issue: Issue) => void;
  setWhatForChains: (chains: ChainResult[]) => void;
  setGenerativeOutput: (output: GenerativeOutput | null) => void;
  setNextActions: (actions: NextAction[]) => void;
  setFinalScore: (score: { total: string; percentage: number; by_level: Record<string, number> } | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setBlockedAt: (blockedAt: string | null) => void;
  setElapsedMs: (ms: number) => void;
  setStepTimings: (timings: Partial<Record<AuditPhase, number>>) => void;
  reset: () => void;
}

// ============================================================================
// GLOSSARY
// ============================================================================

export interface GlossaryTerm {
  termRu: string;
  termEn: string;
  definition: string;
  operationalCheck: string;
}

export interface AuthorQuestion {
  id: keyof AuthorProfileAnswers;
  text: string;
  weight: number;
  isKeySignal: boolean;
}

// Vitality Criteria for living world assessment
export interface VitalityCriteria {
  id: number;
  name: string;
  test: string;
  passed: boolean | null;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

export interface ValidationRule {
  field: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  pattern?: RegExp;
  customValidator?: (value: unknown) => boolean;
  errorMessage?: string;
}

// StepValidationResult is defined in audit-step.ts (canonical location).
// It is re-exported from here for backward compatibility with existing imports.
export type { StepValidationResult } from './audit-step';

// Full input validation result with typed errors/warnings
export interface InputValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  normalizedInput?: Record<string, unknown>;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'error';
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  severity: 'warning';
}

// ============================================================================
// DIAGNOSTIC TYPES
// ============================================================================

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
  severity: Severity;
  description: string;
  location: string;
  suggestedFix: string;
}

// ============================================================================
// PROTOCOL LIMITATION TYPES
// ============================================================================

export interface ProtocolLimitation {
  id: string;
  type: 'structural' | 'conceptual' | 'scope';
  description: string;
  impact: 'low' | 'medium' | 'high';
  mitigation?: string;
}

// ============================================================================
// SCREENING RECOMMENDATION TYPE
// ============================================================================

/** Per Section 0.6 — count-based screening recommendation */
export type ScreeningRecommendation =
  | 'ready_for_audit'
  | 'requires_sections'
  | 'stop_return_to_skeleton';

// ============================================================================
// GATE THRESHOLDS (Section 0.7 — mode-specific)
// ============================================================================

/** Thresholds per audit mode, per gate level */
export interface GateThresholds {
  conflict: { L1: number; L2: number; L3: number; L4: number };
  kishō:    { L1: number; L2: number; L3: number; L4: number };
  hybrid:   { L1: number; L2: number; L3: number; L4: number };
}

/** Default gate thresholds per COMPLETION_PLAN Section 0.7 */
export const DEFAULT_THRESHOLDS: GateThresholds = {
  conflict: { L1: 60, L2: 60, L3: 60, L4: 60 },
  kishō:    { L1: 50, L2: 50, L3: 50, L4: 50 },
  hybrid:   { L1: 55, L2: 55, L3: 55, L4: 55 },
};

/**
 * Get the gate threshold for a given audit mode and level.
 * Falls back to conflict mode defaults for unknown modes.
 */
export function getGateThreshold(
  mode: AuditMode,
  level: 'L1' | 'L2' | 'L3' | 'L4',
): number {
  const thresholds = DEFAULT_THRESHOLDS[mode] ?? DEFAULT_THRESHOLDS.conflict;
  return thresholds[level];
}
