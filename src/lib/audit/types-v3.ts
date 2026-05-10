/**
 * Universe Audit Protocol v3 — Type Definitions
 * 5-block pipeline, free-form markdown output, minimal structured extraction.
 */

// ============================================================
// Core types
// ============================================================

/** Media type — determines prompt framing */
export type MediaType = 'narrative' | 'game' | 'visual' | 'ttrpg';

/** Audit mode — determined in Block 1 */
export type AuditMode = 'conflict' | 'kishō' | 'hybrid';

/** Author profile — determined in Block 1 */
export type AuthorProfileType = 'gardener' | 'hybrid' | 'architect';

/** Pipeline input */
export interface AuditInput {
  text: string;
  mediaType: MediaType;
}

/** LLM client configuration */
export interface LLMConfig {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  proxyUrl?: string;
  customContextWindow?: number;
  customMaxOutputTokens?: number;
}

// ============================================================
// Block results — all share the same shape
// ============================================================

/** Result of a single block — the core unit of v3 */
export interface BlockResult {
  /** Block number (1-5) */
  blockNumber: 1 | 2 | 3 | 4 | 5;
  /** Full raw markdown output from LLM — rendered as-is */
  markdown: string;
  /** Weaknesses summary extracted from end of LLM response (3-5 sentences).
   *  Empty string for Block 1 (no prior context to summarize).
   *  Used as context input for subsequent blocks. */
  weaknessesSummary: string;
  /** Metadata about this block's execution */
  meta: BlockMeta;
}

/** Result of a single sub-request within a block */
export interface SubBlockResult {
  subIndex: number;
  markdown: string;
  elapsedMs: number;
}

/** Extended BlockResult that supports chunked execution */
export interface ChunkedBlockResult extends BlockResult {
  subResults: SubBlockResult[];
}

/** Per-block execution metadata */
export interface BlockMeta {
  /** Wall-clock time in ms */
  elapsedMs: number;
  /** Token usage (null if not reported by provider) */
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  } | null;
  /** Model used */
  model: string;
  /** Temperature used */
  temperature: number;
  /** Whether streaming completed normally or was partial */
  completionStatus: 'complete' | 'partial' | 'error';
}

// ============================================================
// Extracted context (from Block 1 for use in Blocks 2-5)
// ============================================================

/** Structured context extracted from Block 1 output via regex.
 *  All fields are optional — if extraction fails, the raw markdown
 *  of Block 1 is used as context instead. */
export interface ScreeningResult {
  question: string;
  answer: boolean;  // true = YES, false = NO
  sectionRef: string;  // which sections to audit if NO
}

export interface OrientationContext {
  auditMode: AuditMode | null;
  authorProfileType: AuthorProfileType | null;
  authorProfilePercentage: number | null;
  /** Skeleton as a short text summary (key: value lines) */
  skeletonSummary: string | null;
  /** Screening results from Block 1 quick screening (7 YES/NO checks) */
  screeningResults: ScreeningResult[] | null;
}

// ============================================================
// Pipeline state
// ============================================================

/** Pipeline phase */
export type PipelinePhase = 'idle' | 'running' | 'done' | 'error';

/** Full pipeline state */
export interface PipelineStateV3 {
  phase: PipelinePhase;
  /** Currently executing block (0 = not started) */
  currentBlock: 0 | 1 | 2 | 3 | 4 | 5;
  /** Results for completed blocks. null until that block finishes. */
  block1: BlockResult | null;
  block2: BlockResult | null;
  block3: BlockResult | null;
  block4: BlockResult | null;
  block5: BlockResult | null;
  /** Extracted orientation context (set after Block 1 completes) */
  orientationContext: OrientationContext | null;
  /** Accumulated weaknesses summaries from Blocks 2-4 (for Block 5 input) */
  accumulatedWeaknesses: string[];
  /** Checklist score result (set after Block 5 completes via scoring LLM call) */
  checklistScore: ChecklistScoreResult | null;
  /** Pipeline-level metadata */
  meta: PipelineMeta;
  /** Error message (non-null only in 'error' phase) */
  error: string | null;
}

/** Pipeline-level metadata */
export interface PipelineMeta {
  inputText: string;
  mediaType: MediaType;
  elapsedMs: number;
  tokensUsed: { prompt: number; completion: number; total: number };
}

// ============================================================
// Streaming callbacks
// ============================================================

/** Callbacks for streaming pipeline execution */
export interface StreamingCallbacksV3 {
  /** Called when a block starts executing, and again for each sub-chunk within a chunked block.
   *  - chunkIndex: 0-based index of the current sub-chunk (only when totalChunks > 1) */
  onBlockStart: (blockNumber: 1 | 2 | 3 | 4 | 5, totalChunks?: number, chunkIndex?: number) => void;
  /** Called for each streaming text chunk from the LLM */
  onChunk: (blockNumber: 1 | 2 | 3 | 4 | 5, text: string) => void;
  /** Called when a block completes (markdown fully received + processed) */
  onBlockComplete: (blockNumber: 1 | 2 | 3 | 4 | 5, result: BlockResult) => void;
  /** Called on fatal error */
  onError: (message: string) => void;
}

// ============================================================
// Prompt types
// ============================================================

/** Result of prompt builder function */
export interface PromptSet {
  system: string;
  user: string;
}

// ============================================================
// Temperature config
// ============================================================

/** Temperature per block */
export const BLOCK_TEMPERATURES: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 0.2,   // Precision: extract facts accurately
  2: 0.45,  // Balance: analytical depth + accuracy
  3: 0.45,  // Balance: character empathy + structural analysis
  4: 0.45,  // Balance: philosophical depth + rigor
  5: 0.6,   // Creativity: synthesis + recommendations
};

// ============================================================
// Checklist scoring result
// ============================================================

export interface ChecklistScoreItem {
  id: string;
  block: string;
  text: string;
  level: string;
  status: 'PASS' | 'FAIL' | 'INSUFFICIENT_DATA';
  evidence: string;
  applicable: boolean;
}

export interface ChecklistScoreResult {
  items: ChecklistScoreItem[];
  totalApplicable: number;
  fulfilled: number;
  scorePercent: number;
  byLevel: Record<string, { applicable: number; fulfilled: number; percent: number }>;
}

// ============================================================
// Checklist item (used only for prompt construction)
// ============================================================

/** Checklist item — used to build prompt content, NOT for parsing output */
export interface ChecklistItem {
  id: string;
  name: string;
  description: string;
  level: 'L1' | 'L2' | 'L3' | 'L4';
}
