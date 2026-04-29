/**
 * Audit Pipeline — Client-side entry point for running the full audit.
 *
 * Phase 1: This module wraps the existing orchestrator (runFullAudit) and
 * adapts it for client-side execution. The LLM client is created from
 * user settings and passed through, even though the current orchestrator
 * uses keyword-based logic. Phase 2 will replace the internals with
 * the AuditStepRunner / AuditStep architecture from COMPLETION_PLAN §2.
 *
 * This module is the ONLY place page.tsx should call to start an audit.
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
}

/**
 * Run the full audit pipeline from the browser.
 *
 * @param input - The audit input (narrative, media type, etc.)
 * @param llmClientOrConfig - Either an LLMClient instance or settings to create one
 * @param onProgress - Callback for per-step progress updates
 * @returns The final pipeline state
 */
export async function runAuditPipeline(
  input: AuditInput,
  llmClientOrConfig: LLMClient | { provider: LLMProvider; apiKey: string; model?: string | null; proxyUrl?: string },
  onProgress?: (phase: AuditPhase, state: PipelineState) => void,
): Promise<PipelineState> {
  const startTime = Date.now();

  // Create or use LLM client
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

  // Notify: starting
  const emptyState: PipelineState = {
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
  };
  onProgress?.('skeleton_extraction', emptyState);

  // Run the orchestrator
  // Phase 1: Uses the existing keyword-based orchestrator
  // Phase 2: Will use the sequential AuditStepRunner with real LLM calls
  const result: OrchestratorState = await runFullAudit(orchestratorInput);

  // Map orchestrator result to pipeline state
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
    phase: mapOrchestratorPhase(result.phase),
    blockedAt: result.phase === 'blocked' ? result.error || 'unknown' : null,
    error: result.error || null,
    elapsedMs: Date.now() - startTime,
  };

  // Notify: complete
  onProgress?.(pipelineState.phase, pipelineState);

  return pipelineState;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Map orchestrator phase names to the Zustand store AuditPhase type
 */
function mapOrchestratorPhase(phase: string): AuditPhase {
  const phaseMap: Record<string, AuditPhase> = {
    'input_validation': 'skeleton_extraction',
    'mode_detection': 'mode_selection',
    'author_profile': 'author_profile',
    'skeleton_extraction': 'skeleton_extraction',
    'screening': 'screening',
    'gate_L1': 'L1_evaluation',
    'gate_L2': 'L2_evaluation',
    'gate_L3': 'L3_evaluation',
    'gate_L4': 'L4_evaluation',
    'issue_generation': 'complete',
    'generative_modules': 'complete',
    'final_output': 'complete',
    'complete': 'complete',
    'blocked': 'blocked',
  };
  return phaseMap[phase] || 'idle';
}
