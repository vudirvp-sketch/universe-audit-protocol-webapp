// Universe Audit Protocol v10.0 - Type Definitions

export type AuditMode = 'conflict' | 'kishō' | 'hybrid';

export type MediaType = 'game' | 'novel' | 'film' | 'anime' | 'series' | 'ttrpg';

export type MediaTag = 'CORE' | 'GAME' | 'VISUAL';

export type ChecklistItemStatus = 'PASS' | 'FAIL' | 'INSUFFICIENT_DATA' | 'PENDING';

export type GriefStage = 'denial' | 'anger' | 'bargaining' | 'depression' | 'acceptance';

export type GriefLevel = 'character' | 'location' | 'mechanic' | 'act';

export type AuthorProfileType = 'gardener' | 'hybrid' | 'architect';

export type AuditPhase = 
  | 'idle' 
  | 'mode_selection' 
  | 'author_profile' 
  | 'skeleton_extraction' 
  | 'screening' 
  | 'L1_evaluation' 
  | 'L2_evaluation' 
  | 'L3_evaluation' 
  | 'L4_evaluation' 
  | 'complete' 
  | 'failed';

export interface ChecklistItem {
  id: string;
  block: string;
  text: string;
  tag: MediaTag | `${MediaTag}|${MediaTag}`;
  level: 'L1' | 'L2' | 'L3' | 'L4' | 'L1/L2' | 'L1/L3' | 'L2/L3' | 'L2/L4';
  status: ChecklistItemStatus;
  evidence?: string;
  functionalRole?: string;
  applicable: boolean;
}

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

export interface Skeleton {
  thematicLaw: string | null;
  rootTrauma: string | null;
  hamartia: string | null;
  pillars: [string, string, string] | [null, null, null];
  emotionalEngine: GriefStage | null;
  authorProhibition: string | null;
  targetExperience: string | null;
  centralQuestion: string | null;
}

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
}

export interface AuthorProfileAnswers {
  Q1: boolean; // Make character stupidity organic
  Q2: boolean; // Know character behavior outside narrative
  Q3: boolean; // Plot twists from character choices
  Q4: boolean; // Surprised by own character
  Q5: boolean; // Finale could change from mid-point decision
  Q6: boolean; // Antagonist logic defensible
  Q7: boolean; // Tragedy from character nature
}

export interface AuthorProfile {
  type: AuthorProfileType;
  percentage: number;
  confidence: 'high' | 'medium' | 'low';
  mainRisks: string[];
  auditPriorities: string[];
}

export interface GateResult {
  level: 'L1' | 'L2' | 'L3' | 'L4';
  score: number;
  passed: boolean;
  applicableItems: number;
  passedItems: number;
  failedItems: number;
  insufficientDataItems: number;
  fixList: FixItem[];
}

export interface FixItem {
  id: string;
  description: string;
  severity: 'critical' | 'major' | 'minor';
  type: 'motivation' | 'competence' | 'scale' | 'resources' | 'memory' | 'ideology' | 'time';
  recommendedApproach: 'conservative' | 'compromise' | 'radical';
}

export interface Scores {
  connectedness: number; // 0-5
  vitality: number; // 0-5
  characters: number; // 0-5
  theme: number; // 0-5
  embodiment: number; // 0-5
}

export interface VitalityCriteria {
  id: number;
  name: string;
  test: string;
  passed: boolean | null;
  evidence?: string;
}

export interface LogicHole {
  id: string;
  type: 'motivation' | 'competence' | 'scale' | 'resources' | 'memory' | 'ideology' | 'time';
  description: string;
  severity: 'critical' | 'major' | 'minor';
  suggestedFix: string;
}

export interface AuditReport {
  // Pass 1: Human-readable
  humanReadable: {
    auditMode: AuditMode;
    authorProfile: AuthorProfile;
    skeleton: Skeleton;
    screening: ScreeningResult;
    gates: {
      L1: GateResult | null;
      L2: GateResult | null;
      L3: GateResult | null;
      L4: GateResult | null;
    };
    scores: Scores;
    criticalHoles: LogicHole[];
    griefArchitecture: GriefArchitectureMatrix;
    cultPotential: number;
    finalScore: number;
    finalPercentage: number;
    classification: 'cult_masterpiece' | 'powerful' | 'living_weak_soul' | 'decoration';
    priorityActions: [string, string, string];
  };
  // Pass 2: JSON
  jsonData: AuditJSONOutput;
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
  };
  overall_score: {
    checklist: string;
    percentage: string;
    classification: 'cult_masterpiece' | 'powerful' | 'living_weak_soul' | 'decoration';
  };
  critical_issues: Array<{
    id: string;
    level: 'L1' | 'L2' | 'L3' | 'L4';
    severity: 'critical' | 'major' | 'minor';
    narrative_justification: string;
  }>;
  priority_actions: [string, string, string];
}

export interface AuditState {
  // Current phase
  phase: AuditPhase;
  
  // Input
  inputText: string;
  mediaType: MediaType;
  
  // Mode
  auditMode: AuditMode | null;
  
  // Author Profile
  authorAnswers: AuthorProfileAnswers | null;
  authorProfile: AuthorProfile | null;
  
  // Skeleton
  skeleton: Skeleton | null;
  
  // Screening
  screeningResult: ScreeningResult | null;
  
  // Gate Results
  gateResults: {
    L1: GateResult | null;
    L2: GateResult | null;
    L3: GateResult | null;
    L4: GateResult | null;
  };
  
  // Checklist
  checklist: ChecklistItem[];
  
  // Grief Architecture
  griefMatrix: GriefArchitectureMatrix | null;
  
  // Final Report
  report: AuditReport | null;
  
  // UI State
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setPhase: (phase: AuditPhase) => void;
  setInputText: (text: string) => void;
  setMediaType: (type: MediaType) => void;
  setAuditMode: (mode: AuditMode) => void;
  setAuthorAnswers: (answers: AuthorProfileAnswers) => void;
  setAuthorProfile: (profile: AuthorProfile) => void;
  setSkeleton: (skeleton: Skeleton) => void;
  setScreeningResult: (result: ScreeningResult) => void;
  setGateResult: (level: 'L1' | 'L2' | 'L3' | 'L4', result: GateResult) => void;
  setChecklist: (checklist: ChecklistItem[]) => void;
  updateChecklistItem: (id: string, updates: Partial<ChecklistItem>) => void;
  setGriefMatrix: (matrix: GriefArchitectureMatrix) => void;
  setReport: (report: AuditReport) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

// Glossary term definition
export interface GlossaryTerm {
  termRu: string;
  termEn: string;
  definition: string;
  operationalCheck: string;
}

// Question definition for author profile
export interface AuthorQuestion {
  id: keyof AuthorProfileAnswers;
  text: string;
  weight: number;
  isKeySignal: boolean;
}
