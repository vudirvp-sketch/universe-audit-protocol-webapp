/**
 * Universe Audit Protocol — Type Definitions
 *
 * Aligned with UNIVERSE_AUDIT_PROTOCOL_ULTIMATE_v16
 * (Causal / Human / Experiential World Audit).
 *
 * 5-block pipeline, free-form markdown report, minimal structured extraction.
 * The machine-readable layer is the optional v16 §27 JSON appended by Block 5.
 */

// ============================================================
// Core types
// ============================================================

/** Media type — determines prompt framing (v16 §16 medium restrictions) */
export type MediaType = 'narrative' | 'game' | 'visual' | 'ttrpg';

/**
 * v16 §2 GUIDED MODE — author-supplied framing.
 * Every field is optional; anything supplied changes weighting and applicability,
 * never the underlying causal standard.
 */
export interface GuidedContext {
  genre?: string;
  targetAudience?: string;
  targetExperience?: string;
  /** Non-negotiable pillars the audit must not try to redesign away */
  nonNegotiables?: string;
  /** Weaknesses the author already knows about */
  knownConcerns?: string;
  /** Questions the audit must not open */
  excludedConcerns?: string;
}

/**
 * v16 §2 MATERIAL-AWARE MODE — one additional supplied artefact.
 * Artefacts are evidence layers, not alternate drafts to reconcile silently.
 */
export interface AuditMaterial {
  /** Short human label, e.g. "Дизайн-документ", "Лор-библия" */
  label: string;
  text: string;
}

/** Audit mode — v16 §2. Determined in Block 1. */
export type AuditMode = 'lazy' | 'guided' | 'material_aware';

/** Fast screen answer — v16 §6 (YES / PARTIAL / NO / UNKNOWN / N/A) */
export type FastScreenAnswer = 'YES' | 'PARTIAL' | 'NO' | 'UNKNOWN' | 'NA';

/** Pipeline input */
export interface AuditInput {
  text: string;
  mediaType: MediaType;
  /** Whether to include the v16 §28 reference-calibration block in Block 5 */
  referenceComparison?: boolean;
  /** Optional author framing — turns the audit into guided mode (v16 §2) */
  guided?: GuidedContext;
  /** Additional artefacts beyond the primary text — material-aware mode (v16 §2) */
  materials?: AuditMaterial[];
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
  customSupportsJSONMode?: boolean | null;
  rpmLimit?: number;
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
  /** Weaknesses summary extracted from end of LLM response.
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

/** One fast-screen answer — v16 §6 */
export interface FastScreenResult {
  /** Question text as emitted by the LLM (short form) */
  question: string;
  /** Parsed answer, null when the line could not be parsed */
  answer: FastScreenAnswer | null;
}

/** Structured context extracted from Block 1 output via regex.
 *  All fields are nullable — if extraction fails, the raw markdown
 *  of Block 1 is used as context instead. */
export interface OrientationContext {
  /** v16 §2 audit mode (lazy / guided / material_aware) */
  auditMode: AuditMode | null;
  /** v16 §4 narrative / experiential engine hypothesis (free text) */
  narrativeEngine: string | null;
  /** v16 §4.2 working authorship-risk hypothesis (free text, not a label) */
  authorshipHypothesis: string | null;
  /** v16 §5 skeleton as a short text summary (11 elements) */
  skeletonSummary: string | null;
  /** v16 §5 FOUNDATION-LIMITED marker — material too thin for the skeleton */
  foundationLimited: boolean;
  /** v16 §6 seven fast-screen results */
  fastScreen: FastScreenResult[] | null;
}

// ============================================================
// Verdict (v16 §26.S / §27) — replaces the legacy checklist score
// ============================================================

/** Keys of the qualitative verdict bands — v16 §26.S */
export type VerdictBandKey =
  | 'world_foundation'
  | 'systemic_depth'
  | 'human_integration'
  | 'experiential_integration'
  | 'story_capacity'
  | 'identity'
  | 'overall_state';

export interface VerdictBand {
  key: VerdictBandKey;
  /** Human-readable Russian label */
  label: string;
  /** Value exactly as returned by the LLM (e.g. coherent, developing) */
  value: string;
}

export interface AuditVerdictIssue {
  id: string;
  failureClass: string;
  diagnosis: string;
  confidence: string;
}

export interface AuditVerdictRecommendation {
  priority: number;
  problem: string;
  /** LOCAL / CONNECTIVE / STRUCTURAL / EXPERIMENTAL — v16 §21.2 */
  interventionClass: string;
}

/** v16 §22 capability frontier buckets, counted */
export interface CapabilityFrontierCounts {
  demonstrated: number;
  under_proven: number;
  latent: number;
  new_primitive_required: number;
  experimental: number;
  deferred: number;
  contradicted_or_should_not_add: number;
}

/** Machine-readable verdict extracted from Block 5 */
export interface AuditVerdict {
  bands: VerdictBand[];
  /** high / mixed / low — v16 §26.S */
  confidence: string | null;
  issues: AuditVerdictIssue[];
  recommendations: AuditVerdictRecommendation[];
  frontier: CapabilityFrontierCounts | null;
  /** The closing sentence required by v16 §26.S */
  closingStatement: string | null;
  /** Which layer produced the verdict — JSON block first, markdown fallback */
  source: 'json' | 'markdown';
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
  /** Machine-readable verdict (set after Block 5 completes, non-blocking) */
  verdict: AuditVerdict | null;
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
  1: 0.2,   // Precision: extract facts and evidence status accurately
  2: 0.4,   // Balance: systemic causal analysis
  3: 0.4,   // Balance: epistemic and human diagnosis
  4: 0.45,  // Balance: experiential and thematic reading
  5: 0.55,  // Synthesis: root-cause compression and interventions
};
