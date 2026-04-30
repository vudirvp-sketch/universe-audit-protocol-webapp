/**
 * Audit Pipeline — Client-side entry point for running the full audit.
 *
 * This module is the ONLY place page.tsx should call to start an audit.
 * It wraps the orchestrator (runFullAudit) and adapts it for browser execution.
 *
 * Phase 1: Orchestrator uses keyword-based logic; LLM client is created
 * but not yet consumed inside orchestrator steps.
 * Phase 2: Will replace orchestrator internals with AuditStepRunner + real LLM calls.
 */

import { createLLMClient, type LLMClient, type LLMProvider } from '@/lib/llm-client';
import { runFullAudit, type OrchestratorState } from './orchestrator';
import type {
  AuditMode,
  AuditPhase,
  MediaType,
  AuthorProfile,
  AuthorProfileAnswers,
  Skeleton,
  ScreeningResult,
  GateResult,
  ChecklistItem,
  GriefArchitectureMatrix,
  AuditReport,
  Issue,
  ChainResult,
  GenerativeOutput,
  NextAction,
} from './types';

// ============================================================================
// PUBLIC API
// ============================================================================

export interface AuditInput {
  narrative: string;
  mediaType: MediaType;
  authorAnswers?: AuthorProfileAnswers;
  provider?: LLMProvider | null;
  apiKey?: string | null;
  model?: string | null;
  proxyUrl?: string;
}

export interface PipelineProgress {
  phase: AuditPhase;
  state: PipelineState;
}

export interface PipelineState {
  auditMode: AuditMode | null;
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
  issues: Issue[];
  whatForChains: ChainResult[];
  generativeOutput: GenerativeOutput | null;
  nextActions: NextAction[];
  finalScore: { total: string; percentage: number; by_level: Record<string, number> } | null;
  phase: AuditPhase;
  blockedAt: string | null;
  error: string | null;
  elapsedMs: number;
  stepTimings: Partial<Record<AuditPhase, number>>;
}

/**
 * Create an empty pipeline state for initial progress callbacks.
 */
function createEmptyPipelineState(): PipelineState {
  return {
    auditMode: null,
    authorProfile: null,
    skeleton: null,
    screeningResult: null,
    gateResults: { L1: null, L2: null, L3: null, L4: null },
    checklist: [],
    griefMatrix: null,
    report: null,
    issues: [],
    whatForChains: [],
    generativeOutput: null,
    nextActions: [],
    finalScore: null,
    phase: 'idle',
    blockedAt: null,
    error: null,
    elapsedMs: 0,
    stepTimings: {},
  };
}

/**
 * Map the orchestrator's AuditPhase to the pipeline's AuditPhase.
 *
 * The orchestrator now uses the canonical AuditPhase values from ./types
 * (e.g. `L1_evaluation` instead of `gate_L1`), so a translation table is
 * no longer needed.  We only need to handle the case where the orchestrator
 * returns an unexpected string — we fall back to `'failed'` so the UI can
 * react.
 */
function toPipelinePhase(phase: string): AuditPhase {
  // The orchestrator already emits canonical AuditPhase values; just validate.
  const canonical: AuditPhase[] = [
    'idle',
    'input_validation',
    'mode_detection',
    'author_profile',
    'skeleton_extraction',
    'screening',
    'L1_evaluation',
    'L2_evaluation',
    'L3_evaluation',
    'self_audit',
    'L4_evaluation',
    'issue_generation',
    'generative_modules',
    'final_output',
    'complete',
    'failed',
    'blocked',
    'cancelled',
  ];

  if (canonical.includes(phase as AuditPhase)) {
    return phase as AuditPhase;
  }
  return 'failed';
}

/**
 * Run the full audit pipeline from the browser.
 *
 * @param input - The audit input (narrative, media type, etc.)
 * @param llmClientOrConfig - Either an LLMClient instance or settings to create one
 * @param onProgress - Callback for per-step progress updates
 * @param abortSignal - Optional AbortSignal for cancelling the pipeline
 * @returns The final pipeline state
 */
export async function runAuditPipeline(
  input: AuditInput,
  llmClientOrConfig: LLMClient | { provider: LLMProvider; apiKey: string; model?: string | null; proxyUrl?: string },
  onProgress?: (phase: AuditPhase, state: PipelineState) => void,
  abortSignal?: AbortSignal,
): Promise<PipelineState> {
  const overallStart = Date.now();
  const stepTimings: Partial<Record<AuditPhase, number>> = {};

  // Check for cancellation before starting
  if (abortSignal?.aborted) {
    return { ...createEmptyPipelineState(), phase: 'cancelled', elapsedMs: Date.now() - overallStart };
  }

  // Create or reuse LLM client
  // Phase 1: LLM client is created but not yet used by the orchestrator.
  // Phase 2: The AuditStepRunner will use it for each pipeline step.
  let llmClient: LLMClient;
  if ('chatCompletion' in llmClientOrConfig) {
    llmClient = llmClientOrConfig;
  } else {
    const config = llmClientOrConfig;
    llmClient = createLLMClient({
      provider: config.provider,
      apiKey: config.apiKey,
      model: config.model || undefined,
      proxyUrl: config.proxyUrl,
    });
  }

  // Map pipeline input to orchestrator input format
  const orchestratorInput = {
    concept: input.narrative,
    media_type: input.mediaType,
    author_answers: input.authorAnswers,
  };

  // Notify: starting input validation
  const emptyState = createEmptyPipelineState();
  onProgress?.('input_validation', { ...emptyState, phase: 'input_validation' });

  // Check cancellation before orchestrator
  if (abortSignal?.aborted) {
    return { ...createEmptyPipelineState(), phase: 'cancelled', elapsedMs: Date.now() - overallStart };
  }

  // Run the orchestrator
  // Phase 1: Uses the existing keyword-based orchestrator
  // Phase 2: Will use the sequential AuditStepRunner with real LLM calls
  const orchestratorStart = Date.now();
  const result: OrchestratorState = await runFullAudit(orchestratorInput);
  const orchestratorElapsed = Date.now() - orchestratorStart;

  // Record the terminal phase timing from the orchestrator result
  const mappedPhase = toPipelinePhase(result.phase);
  stepTimings[mappedPhase] = orchestratorElapsed;

  // Check cancellation after orchestrator
  if (abortSignal?.aborted) {
    return { ...createEmptyPipelineState(), phase: 'cancelled', elapsedMs: Date.now() - overallStart };
  }

  // Map orchestrator result to pipeline state.
  // The orchestrator now returns properly-typed data using canonical types
  // from ./types, so no `as` casts are needed.
  const pipelineState: PipelineState = {
    auditMode: result.audit_mode_config?.mode ?? null,
    authorProfile: result.author_profile_result ?? null,
    skeleton: result.skeleton ?? null,
    screeningResult: result.screening_result ?? null,
    gateResults: {
      L1: result.gate_L1 ?? null,
      L2: result.gate_L2 ?? null,
      L3: result.gate_L3 ?? null,
      L4: result.gate_L4 ?? null,
    },
    checklist: [],
    griefMatrix: null,
    report: null,
    issues: result.issues,
    whatForChains: result.what_for_chains,
    generativeOutput: result.generative_output ?? null,
    nextActions: result.next_actions,
    finalScore: result.final_score ?? null,
    phase: mappedPhase,
    blockedAt: result.phase === 'blocked' ? (result.error ?? 'unknown') : null,
    error: result.error ?? null,
    elapsedMs: Date.now() - overallStart,
    stepTimings,
  };

  // Final progress callback
  onProgress?.(mappedPhase, pipelineState);

  return pipelineState;
}
