/**
 * Audit Pipeline — Client-side entry point for running the full audit.
 *
 * This module is the ONLY place page.tsx should call to start an audit.
 * It uses the AuditStepRunner from audit-step.ts to execute each pipeline
 * step sequentially with real LLM calls.
 *
 * Phase 2: Replaced keyword-based orchestrator with AuditStepRunner.
 * Each step is a declarative AuditStep object registered in step-registry.
 */

import { createLLMClient, type LLMClient, type LLMProvider } from '@/lib/llm-client';
import { runStep, type PipelineRunState } from './audit-step';
import { getStep, getStepOrder, stepRegistry } from './step-registry';
import type {
  AuditPhase,
  MediaType,
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
import { MASTER_CHECKLIST, filterChecklistByMedia } from './protocol-data';
import { filterByMediaType, evaluateGate } from './scoring-algorithm';

// Ensure steps are registered (side-effect import triggers auto-registration)
void stepRegistry.registeredCount;

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
  auditMode: import('./types').AuditMode | null;
  authorProfile: import('./types').AuthorProfile | null;
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
 * Create the initial PipelineRunState from the user's input.
 */
function createInitialRunState(input: AuditInput): PipelineRunState {
  return {
    phase: 'idle',
    inputText: input.narrative,
    mediaType: input.mediaType,
    auditMode: null,
    authorProfile: null,
    skeleton: null,
    screeningResult: null,
    gateResults: { L1: null, L2: null, L3: null, L4: null },
    griefMatrix: null,
    issues: [],
    whatForChains: [],
    generativeOutput: null,
    nextActions: [],
    finalScore: null,
    error: null,
    blockedAt: null,
    elapsedMs: 0,
    stepTimings: {},
  };
}

/**
 * Run the full audit pipeline from the browser using the AuditStepRunner.
 *
 * Each step is executed sequentially via runStep() from audit-step.ts.
 * On gate failure (blocked), the pipeline stops immediately.
 * Progress callbacks update the UI in real time.
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

  // Check for cancellation before starting
  if (abortSignal?.aborted) {
    return { ...createEmptyPipelineState(), phase: 'cancelled', elapsedMs: 0 };
  }

  // Create or reuse LLM client
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

  // Initialize the pipeline run state
  let runState: PipelineRunState = createInitialRunState(input);
  const stepOrder = getStepOrder();

  // Notify: starting
  onProgress?.('input_validation', mapToPipelineState(runState));

  // Execute each step sequentially
  for (const phase of stepOrder) {
    // Check cancellation before each step
    if (abortSignal?.aborted) {
      runState = { ...runState, phase: 'cancelled' };
      break;
    }

    // Get the step from the registry
    if (!stepRegistry.hasStep(phase)) {
      // Skip unregistered steps — this shouldn't happen in production
      continue;
    }

    const step = getStep(phase);
    const stepStart = Date.now();

    try {
      // Execute the step via AuditStepRunner
      runState = await runStep(step, runState, llmClient, (p) => {
        onProgress?.(p, mapToPipelineState(runState));
      });

      // Track timing
      const stepElapsed = Date.now() - stepStart;
      runState = {
        ...runState,
        elapsedMs: Date.now() - overallStart,
        stepTimings: { ...runState.stepTimings, [phase]: stepElapsed },
      };

      // Notify progress
      onProgress?.(runState.phase, mapToPipelineState(runState));

      // If blocked, stop the pipeline
      if (runState.phase === 'blocked') {
        break;
      }
    } catch (error) {
      // AuditStepError or unexpected error — mark as failed
      const message = error instanceof Error ? error.message : String(error);
      runState = {
        ...runState,
        phase: 'failed',
        error: message,
        elapsedMs: Date.now() - overallStart,
        stepTimings: { ...runState.stepTimings, [phase]: Date.now() - stepStart },
      };
      break;
    }
  }

  // Mark as complete if not blocked/failed/cancelled
  if (runState.phase !== 'blocked' && runState.phase !== 'failed' && runState.phase !== 'cancelled') {
    runState = { ...runState, phase: 'complete' };
  }

  // Final progress callback
  onProgress?.(runState.phase, mapToPipelineState(runState));

  return mapToPipelineState(runState);
}

/**
 * Map PipelineRunState to the public PipelineState interface.
 * Populates checklist from gate results using scoring-algorithm and
 * generates a report when the pipeline is complete or blocked.
 */
function mapToPipelineState(runState: PipelineRunState): PipelineState {
  // Build checklist from gate evaluation results if any gate has been evaluated
  let checklist: ChecklistItem[] = [];
  if (runState.skeleton || runState.screeningResult ||
      runState.gateResults.L1 || runState.gateResults.L2 ||
      runState.gateResults.L3 || runState.gateResults.L4) {
    checklist = buildChecklistFromState(runState);
  }

  // Build report when pipeline has enough data (at least skeleton extracted)
  let report: AuditReport | null = null;
  if (runState.skeleton) {
    report = buildReportFromState(runState, checklist);
  }

  return {
    auditMode: runState.auditMode,
    authorProfile: runState.authorProfile,
    skeleton: runState.skeleton,
    screeningResult: runState.screeningResult,
    gateResults: runState.gateResults,
    checklist,
    griefMatrix: runState.griefMatrix,
    report,
    issues: runState.issues,
    whatForChains: runState.whatForChains,
    generativeOutput: runState.generativeOutput,
    nextActions: runState.nextActions,
    finalScore: runState.finalScore,
    phase: runState.phase,
    blockedAt: runState.blockedAt,
    error: runState.error,
    elapsedMs: runState.elapsedMs,
    stepTimings: runState.stepTimings,
  };
}

/**
 * Build checklist items from current pipeline state.
 * Uses the master checklist filtered by media type and updates
 * statuses based on gate evaluation results.
 */
function buildChecklistFromState(runState: PipelineRunState): ChecklistItem[] {
  // Use the media type from the run state; default to 'novel' if not set
  const mediaType = runState.mediaType;
  const filtered = filterByMediaType([...MASTER_CHECKLIST], mediaType);

  // If a gate result exists for a level, update checklist statuses from it
  for (const level of ['L1', 'L2', 'L3', 'L4'] as const) {
    const gateResult = runState.gateResults[level];
    if (!gateResult) continue;

    for (const condition of gateResult.conditions) {
      const matchIdx = filtered.findIndex(item => item.id === condition.id);
      if (matchIdx >= 0) {
        filtered[matchIdx] = {
          ...filtered[matchIdx],
          status: condition.passed ? 'PASS' : 'FAIL',
        };
      }
    }
  }

  return filtered;
}

/**
 * Build an AuditReport from the current pipeline state.
 * Only called when at least the skeleton has been extracted.
 */
function buildReportFromState(runState: PipelineRunState, checklist: ChecklistItem[]): AuditReport {
  const gateResults = runState.gateResults;
  const scores: Record<string, number> = {};

  for (const level of ['L1', 'L2', 'L3', 'L4'] as const) {
    const gate = gateResults[level];
    if (gate) {
      scores[level] = gate.score;
    }
  }

  return {
    protocolVersion: '10.0',
    auditMode: runState.auditMode || 'conflict',
    authorProfile: runState.authorProfile,
    skeleton: runState.skeleton,
    screeningResult: runState.screeningResult,
    gateResults,
    checklist,
    griefMatrix: runState.griefMatrix,
    issues: runState.issues,
    whatForChains: runState.whatForChains,
    generativeOutput: runState.generativeOutput,
    finalScore: runState.finalScore,
    scores,
    generatedAt: new Date().toISOString(),
  };
}
