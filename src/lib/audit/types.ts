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
  overallStatus?: 'COMPLETE' | 'INCOMPLETE' | 'PARTIAL';
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
// FIXES
// ============================================================================

export interface FixItem {
  id: string;
  description: string;
  severity: Severity;
  type: 'motivation' | 'competence' | 'scale' | 'resources' | 'memory' | 'ideology' | 'time';
  recommendedApproach: PatchType;
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
  narrativeDigest: string | null;
  isLoading: boolean;
  error: string | null;
  // Timing & resume fields
  blockedAt: string | null;
  elapsedMs: number;
  stepTimings: Partial<Record<AuditPhase, number>>;

  // Streaming & chunking — NOT persisted (session-only)
  streamingText: string;
  chunkingInfo: { current: number; total: number } | null;

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
  setNarrativeDigest: (digest: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setBlockedAt: (blockedAt: string | null) => void;
  setElapsedMs: (ms: number) => void;
  setStepTimings: (timings: Partial<Record<AuditPhase, number>>) => void;
  setStreamingText: (text: string) => void;
  appendStreamingText: (chunk: string) => void;
  clearStreamingText: () => void;
  setChunkingInfo: (info: { current: number; total: number } | null) => void;
  reset: () => void;
  editAndReset: () => void;
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

// StepValidationResult is defined in audit-step.ts (canonical location).
// It is re-exported from here for backward compatibility with existing imports.
export type { StepValidationResult } from './audit-step';

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
