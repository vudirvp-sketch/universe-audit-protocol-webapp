/**
 * Step 11: Diagnostics + Final Score — pure computation, no LLM call.
 *
 * skipLLM: true — calculates final score, classification, priority actions.
 * - Final score: (L1 + L2 + L3 + L4) / 4
 * - Classification: cult_masterpiece / powerful / living_weak_soul / decoration
 * - 3 priority actions from accumulated fix lists
 * maxTokens: 0
 *
 * DESIGN: Uses module-level cache for skipLLM state communication,
 * same pattern as step-validate.ts. gateCheck() computes the real result
 * from PipelineRunState and caches it; reduce() uses the cached result.
 */

import type { AuditStep, PipelineRunState, StepValidationResult, GateDecision } from '../audit-step';
import type { NextAction } from '../types';

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

export interface FinalOutput {
  finalScore: {
    total: string;
    percentage: number;
    by_level: Record<string, number>;
  };
  classification: 'cult_masterpiece' | 'powerful' | 'living_weak_soul' | 'decoration';
  priorityActions: NextAction[];
}

// ---------------------------------------------------------------------------
// Module-level cache for skipLLM state communication
// WARNING: Same concurrency note as step-validate.ts — safe per-tab, not
// across shared-worker scenarios.
// ---------------------------------------------------------------------------

let cachedOutput: FinalOutput | null = null;

// ---------------------------------------------------------------------------
// Core computation logic (shared between gateCheck and reduce)
// ---------------------------------------------------------------------------

function computeFinalOutput(state: PipelineRunState): FinalOutput {
  const by_level: Record<string, number> = {
    L1: state.gateResults.L1?.score || 0,
    L2: state.gateResults.L2?.score || 0,
    L3: state.gateResults.L3?.score || 0,
    L4: state.gateResults.L4?.score || 0,
  };

  const total = by_level.L1 + by_level.L2 + by_level.L3 + by_level.L4;
  const percentage = Math.round(total / 4);

  // Classification based on percentage
  let classification: FinalOutput['classification'];
  if (percentage >= 85) {
    classification = 'cult_masterpiece';
  } else if (percentage >= 65) {
    classification = 'powerful';
  } else if (percentage >= 40) {
    classification = 'living_weak_soul';
  } else {
    classification = 'decoration';
  }

  // Generate 3 priority actions from accumulated issues
  const priorityActions: NextAction[] = [];

  const criticalIssues = state.issues.filter(i => i.severity === 'critical');
  if (criticalIssues.length > 0) {
    priorityActions.push({
      priority: 1,
      action: `Устранить ${criticalIssues.length} критических проблем`,
      rationale: 'Критические проблемы блокируют связность нарратива',
      estimated_effort: 'days',
    });
  }

  const failedGates = (['L1', 'L2', 'L3', 'L4'] as const)
    .filter(level => state.gateResults[level]?.status === 'failed');
  if (failedGates.length > 0 && priorityActions.length < 3) {
    priorityActions.push({
      priority: priorityActions.length + 1,
      action: `Исправить провал гейтов: ${failedGates.join(', ')}`,
      rationale: 'Проваленные гейты блокируют целые уровни аудита',
      estimated_effort: 'days',
    });
  }

  const majorIssues = state.issues.filter(i => i.severity === 'major');
  if (majorIssues.length > 0 && priorityActions.length < 3) {
    priorityActions.push({
      priority: priorityActions.length + 1,
      action: `Решить ${majorIssues.length} значительных проблем`,
      rationale: 'Значительные проблемы снижают общее качество нарратива',
      estimated_effort: 'weeks',
    });
  }

  // Fill remaining slots if needed
  while (priorityActions.length < 3) {
    const idx = priorityActions.length + 1;
    priorityActions.push({
      priority: idx,
      action: 'Углубить тематическую интеграцию',
      rationale: 'Тематическая связность — основа культового потенциала',
      estimated_effort: 'weeks',
    });
  }

  return {
    finalScore: {
      total: `${Math.round(total)}/400`,
      percentage,
      by_level,
    },
    classification,
    priorityActions: priorityActions.slice(0, 3),
  };
}

// ---------------------------------------------------------------------------
// Step definition
// ---------------------------------------------------------------------------

export const stepFinal: AuditStep<FinalOutput> = {
  id: 'final_output',

  buildPrompt: () => [], // never called — skipLLM is true

  parseResponse: (_raw: string): FinalOutput => {
    // skipLLM step — return a marker shell. Real computation happens in gateCheck.
    return {
      finalScore: { total: '0/400', percentage: 0, by_level: { L1: 0, L2: 0, L3: 0, L4: 0 } },
      classification: 'decoration',
      priorityActions: [],
    };
  },

  validate: (_output: FinalOutput): StepValidationResult => {
    // Always valid — the shell is just a marker. Real computation in gateCheck.
    return { valid: true, errors: [], canRetry: false };
  },

  gateCheck: (_output: FinalOutput, state: PipelineRunState): GateDecision => {
    // Compute the real final output from the current state
    const result = computeFinalOutput(state);
    cachedOutput = result;

    // Final step never blocks — it's the terminal computation
    return { passed: true, score: result.finalScore.percentage };
  },

  reduce: (state: PipelineRunState, _output: FinalOutput): PipelineRunState => {
    // Use the cached result from gateCheck
    const result = cachedOutput ?? computeFinalOutput(state);
    cachedOutput = null; // Clear cache after use

    return {
      ...state,
      finalScore: result.finalScore,
      nextActions: result.priorityActions,
    };
  },

  maxRetries: 0,
  skipLLM: true,
  maxTokens: 0,
};
