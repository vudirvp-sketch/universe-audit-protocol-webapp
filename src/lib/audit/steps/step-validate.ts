/**
 * Step 0: Input Validation — pure client-side, no LLM call.
 *
 * Checks: non-empty, minimum length (50 chars),
 * not just whitespace. On failure the pipeline is blocked immediately.
 * No upper length limit — the narrative processor handles large texts.
 * No LLM tokens are wasted on invalid input.
 *
 * skipLLM: true — the step produces its result entirely from state.
 * maxTokens: 0 — never calls LLM.
 *
 * DESIGN: For skipLLM steps, parseResponse('') is called first but has no
 * access to state. We use the gateData field on GateDecision to pass
 * computed data from gateCheck() (which DOES receive state) to reduce().
 * The flow is:
 *   1. parseResponse('') → empty shell
 *   2. validate(shell) → always valid (shell is just a marker)
 *   3. gateCheck(shell, state) → performs REAL validation, returns gateData
 *   4. reduce(state, shell, gateData) → uses gateData to produce new state
 *
 * This eliminates the previous module-level mutable cache (cachedValidation),
 * which was NOT concurrency-safe across browser tabs and violated functional
 * purity.
 */

import type { AuditStep, PipelineRunState, StepValidationResult, GateDecision } from '../audit-step';
import { wrapUserInput, sanitizeNarrative } from '../input-sanitizer';

// ---------------------------------------------------------------------------
// Output type for this step
// ---------------------------------------------------------------------------

export interface InputValidationOutput {
  valid: boolean;
  length: number;
  sanitized: string;
  wrapped: string;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Core validation logic (shared between gateCheck and reduce)
// ---------------------------------------------------------------------------

export function validateInputText(text: string): InputValidationOutput {
  const errors: string[] = [];

  if (!text || text.trim().length === 0) {
    errors.push('Концепт пустой — невозможно продолжить');
  } else if (text.trim().length < 50) {
    errors.push('Концепт слишком краткий для полноценного аудита (минимум 50 символов)');
  }

  const valid = errors.length === 0;
  const sanitized = valid ? sanitizeNarrative(text) : text;
  const wrapped = valid ? wrapUserInput(sanitized) : '';

  return { valid, length: text.length, sanitized, wrapped, errors };
}

// ---------------------------------------------------------------------------
// Step definition
// ---------------------------------------------------------------------------

export const stepValidate: AuditStep<InputValidationOutput> = {
  id: 'input_validation',

  buildPrompt: () => [], // never called — skipLLM is true

  parseResponse: (_raw: string): InputValidationOutput => {
    // skipLLM step — return a marker shell. The real validation happens
    // in gateCheck() which has access to PipelineRunState.
    // Results are passed to reduce() via gateData (not module-level cache).
    return { valid: false, length: 0, sanitized: '', wrapped: '', errors: [] };
  },

  validate: (_output: InputValidationOutput): StepValidationResult => {
    // Always valid — the shell is just a marker. Real validation logic
    // lives in gateCheck() which has access to the state.
    return { valid: true, errors: [], canRetry: false };
  },

  gateCheck: (_output: InputValidationOutput, state: PipelineRunState): GateDecision => {
    // Perform REAL validation from the current state
    const result = validateInputText(state.inputText);

    if (!result.valid) {
      return {
        passed: false,
        reason: result.errors.join('; '),
        fixes: [],
        gateData: result, // Pass to reduce() — no module-level cache needed
      };
    }

    return {
      passed: true,
      gateData: result, // Pass to reduce() — no module-level cache needed
    };
  },

  reduce: (state: PipelineRunState, _output: InputValidationOutput, gateData?: unknown): PipelineRunState => {
    // Use gateData from gateCheck (passed through GateDecision)
    // Fall back to re-computing from state if gateData is missing (defensive)
    const result = (gateData as InputValidationOutput | undefined) ?? validateInputText(state.inputText);

    return {
      ...state,
      // Store sanitized and wrapped text in the state for downstream steps
      // The inputText stays as-is for display; the sanitized version is used
      // by buildPrompt functions via inputText (they call sanitizeNarrative themselves)
      phase: result.valid ? 'input_validation' : 'blocked',
      error: result.valid ? null : result.errors.join('; '),
    };
  },

  maxRetries: 0,
  skipLLM: true,
  maxTokens: 0,
};
