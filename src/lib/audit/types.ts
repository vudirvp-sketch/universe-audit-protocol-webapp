/**
 * UNIVERSE AUDIT PROTOCOL v11.0 — Type Definitions
 *
 * This file re-exports everything from types-v2.ts (the canonical source).
 * Legacy types needed by protocol-data.ts are also re-exported here
 * for backward compatibility.
 */

// Canonical V2 types
export type {
  MediaType,
  AuditMode,
  AuditInput,
  LLMConfig,
  ChecklistItem,
  Step1Result,
  ScreeningAnswer,
  Skeleton,
  AuthorProfile,
  Step2Result,
  CriterionAssessment,
  GriefArchitectureMatrix,
  GriefStageEntry,
  Step3Result,
  FixRecommendation,
  ChainResult,
  GenerativeOutput,
  PipelineStateV2,
  PipelineMeta,
  ExportData,
  AuditReportV2,
  StreamingCallbacks,
  PromptSet,
} from './types-v2';

// ============================================================
// Legacy types — used by protocol-data.ts (transitioning file)
// These support MASTER_CHECKLIST, GLOSSARY, etc. which are still
// consumed by pipeline-v2.ts via MASTER_CHECKLIST.
// ============================================================

/** Legacy media type — used by protocol-data.ts MASTER_CHECKLIST */
export type LegacyMediaType = 'game' | 'novel' | 'film' | 'anime' | 'series' | 'ttrpg';

/** Legacy media tag — used by protocol-data.ts MASTER_CHECKLIST */
export type MediaTag = 'CORE' | 'GAME' | 'VISUAL' | 'AUDIO' | 'INTERACTIVE';

/** Legacy checklist item status — used by protocol-data.ts */
export type ChecklistItemStatus = 'PASS' | 'FAIL' | 'INSUFFICIENT_DATA' | 'PENDING';

/** Grief stage names */
export type GriefStage = 'denial' | 'anger' | 'bargaining' | 'depression' | 'acceptance';

/** Legacy checklist item — used by protocol-data.ts MASTER_CHECKLIST */
export interface LegacyChecklistItem {
  id: string;
  block: string;
  text: string;
  tag: MediaTag | `${MediaTag}|${MediaTag}`;
  level: string;
  status: ChecklistItemStatus;
  evidence?: string;
  functionalRole?: string;
  applicable: boolean;
}

/** Glossary term — used by protocol-data.ts */
export interface GlossaryTerm {
  termRu: string;
  termEn: string;
  definition: string;
  operationalCheck: string;
}

/** Author profile question — used by protocol-data.ts */
export interface AuthorQuestion {
  id: string;
  text: string;
  weight: number;
  isKeySignal: boolean;
}

/** Vitality criteria — used by protocol-data.ts */
export interface VitalityCriteria {
  id: number;
  name: string;
  test: string;
  passed: boolean | null;
}
