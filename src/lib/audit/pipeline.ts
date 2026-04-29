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
import { runFullAudit, type AuditState as OrchestratorState } from './orchestrator';
import type { MediaType, AuthorProfileAnswers, AuditPhase } from './types';

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
  auditMode: string | null;
  authorProfile: unknown | null;
  skeleton: unknown | null;
  screeningResult: unknown | null;
  gateResults: {
    L1: unknown | null;
    L2: unknown | null;
    L3: unknown | null;
    L4: unknown | null;
  };
  checklist: unknown[];
  griefMatrix: unknown | null;
  report: unknown | null;
  issues: unknown[];
  whatForChains: unknown[];
  generativeOutput: unknown | null;
  nextActions: unknown[];
  finalScore: unknown | null;
  phase: AuditPhase;
  blockedAt: string | null;
  error: string | null;
  elapsedMs: number;
  stepTimings: Partial<Record<AuditPhase, number>>;
}

/**
 * Mapping from orchestrator-internal phase names to the canonical AuditPhase type.
 * Orchestrator uses its own phase names; we translate them to the Zustand store's
 * AuditPhase values so the UI can render correct progress.
 */
const ORCHESTRATOR_PHASE_MAP: Record<string, AuditPhase> = {
  'input_validation':    'input_validation',
  'mode_detection':      'mode_detection',
  'author_profile':      'author_profile',
  'skeleton_extraction': 'skeleton_extraction',
  'screening':           'screening',
  'gate_L1':             'L1_evaluation',
  'gate_L2':             'L2_evaluation',
  'gate_L3':             'L3_evaluation',
  'gate_L4':             'L4_evaluation',
  'issue_generation':    'issue_generation',
  'generative_modules':  'generative_modules',
  'final_output':        'final_output',
  'complete':            'complete',
  'blocked':             'blocked',
};

function mapOrchestratorPhase(phase: string): AuditPhase {
  return ORCHESTRATOR_PHASE_MAP[phase] || 'idle';
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
  const startTime = Date.now();

  // Check for cancellation before starting
  if (abortSignal?.aborted) {
    return { ...createEmptyPipelineState(), phase: 'cancelled' };
  }

  // Create or reuse LLM client
  // Phase 1: LLM client is created but not yet used by the orchestrator.
  // Phase 2: The AuditStepRunner will use it for each pipeline step.
  let llmClient: LLMClient;
  if ('chatCompletion' in llmClientOrConfig) {
    llmClient = llmClientOrConfig as LLMClient;
  } else {
    const config = llmClientOrConfig as { provider: LLMProvider; apiKey: string; model?: string | null; proxyUrl?: string };
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
    return { ...createEmptyPipelineState(), phase: 'cancelled' };
  }

  // Run the orchestrator
  // Phase 1: Uses the existing keyword-based orchestrator
  // Phase 2: Will use the sequential AuditStepRunner with real LLM calls
  const result: OrchestratorState = await runFullAudit(orchestratorInput);

  // Check cancellation after orchestrator
  if (abortSignal?.aborted) {
    return { ...createEmptyPipelineState(), phase: 'cancelled' };
  }

  // Map orchestrator result to pipeline state
  const mappedPhase = mapOrchestratorPhase(result.phase);
  const pipelineState: PipelineState = {
    auditMode: result.audit_mode_config?.mode || null,
    authorProfile: result.author_profile_result || null,
    skeleton: result.skeleton || null,
    screeningResult: result.screening_result || null,
    gateResults: {
      L1: result.gate_L1 || null,
      L2: result.gate_L2 || null,
      L3: result.gate_L3 || null,
      L4: result.gate_L4 || null,
    },
    checklist: [],
    griefMatrix: null,
    report: null,
    issues: result.issues || [],
    whatForChains: result.what_for_chains || [],
    generativeOutput: result.generative_output || null,
    nextActions: result.next_actions || [],
    finalScore: result.final_score || null,
    phase: mappedPhase,
    blockedAt: result.phase === 'blocked' ? result.error || 'unknown' : null,
    error: result.error || null,
    elapsedMs: Date.now() - startTime,
    stepTimings: {},
  };

  // Final progress callback
  onProgress?.(mappedPhase, pipelineState);

  return pipelineState;
}
