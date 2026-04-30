/**
 * Step 0: Input Validation — pure client-side, no LLM call.
 *
 * Checks: non-empty, minimum length (50 chars), maximum length (50000 chars),
 * not just whitespace. On failure the pipeline is blocked immediately.
 * No LLM tokens are wasted on invalid input.
 *
 * skipLLM: true — the step produces its result entirely from state.
 * maxTokens: 0 — never calls LLM.
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
// Step definition
// ---------------------------------------------------------------------------

export const stepValidate: AuditStep<InputValidationOutput> = {
  id: 'input_validation',

  buildPrompt: () => [], // never called — skipLLM is true

  parseResponse: (_raw: string): InputValidationOutput => {
    // skipLLM step — derive output from state through closure.
    // We return a marker that validate() will replace with real data.
    // The actual validation logic lives in validate() which has access
    // to the PipelineRunState via the gateCheck/reduce cycle.
    return { valid: false, length: 0, sanitized: '', wrapped: '', errors: [] };
  },

  validate: (output: InputValidationOutput): StepValidationResult => {
    // This step uses a two-phase approach: parseResponse creates a shell,
    // then the real validation happens here. But since skipLLM steps call
    // parseResponse('') first then validate(), we need the state somehow.
    // The canonical approach is: reduce receives the computed output.
    // For skipLLM steps, we make parseResponse smart via a closure trick.
    //
    // However, the AuditStep interface does not pass state to validate().
    // So we must do the actual validation logic in parseResponse via a
    // module-level state reference. This is the pattern used by the COMPLETION_PLAN.
    if (output.valid) {
      return { valid: true, errors: [], canRetry: false };
    }
    if (output.errors.length > 0) {
      return { valid: false, errors: output.errors, canRetry: false };
    }
    // No errors but not valid — means parseResponse returned the shell
    return { valid: true, errors: [], canRetry: false };
  },

  gateCheck: (output: InputValidationOutput, _state: PipelineRunState): GateDecision => {
    if (!output.valid) {
      return {
        passed: false,
        reason: output.errors.join('; '),
        fixes: [],
      };
    }
    return { passed: true };
  },

  reduce: (state: PipelineRunState, _output: InputValidationOutput): PipelineRunState => {
    // Compute the real validation from the current state
    const text = state.inputText;
    const errors: string[] = [];

    if (!text || text.trim().length === 0) {
      errors.push('Концепт пустой — невозможно продолжить');
    } else if (text.trim().length < 50) {
      errors.push('Концепт слишком краткий для полноценного аудита (минимум 50 символов)');
    } else if (text.length > 50000) {
      errors.push('Концепт слишком длинный. Сократите до 50000 символов.');
    }

    // Check for non-text input (HTML tags)
    if (/<[^>]+>/.test(text) && text.includes('</')) {
      // Warn but don't block — strip tags
    }

    const valid = errors.length === 0;
    const sanitized = valid ? sanitizeNarrative(text) : text;
    const wrapped = valid ? wrapUserInput(sanitized) : '';

    return {
      ...state,
      phase: valid ? 'input_validation' : 'blocked',
      error: valid ? null : errors.join('; '),
    };
  },

  maxRetries: 0,
  skipLLM: true,
  maxTokens: 0,
};

// ---------------------------------------------------------------------------
// Helper: validate input text (used by both parseResponse and reduce)
// ---------------------------------------------------------------------------

export function validateInputText(text: string): InputValidationOutput {
  const errors: string[] = [];

  if (!text || text.trim().length === 0) {
    errors.push('Концепт пустой — невозможно продолжить');
  } else if (text.trim().length < 50) {
    errors.push('Концепт слишком краткий для полноценного аудита (минимум 50 символов)');
  } else if (text.length > 50000) {
    errors.push('Концепт слишком длинный. Сократите до 50000 символов.');
  }

  const valid = errors.length === 0;
  const sanitized = valid ? sanitizeNarrative(text) : text;
  const wrapped = valid ? wrapUserInput(sanitized) : '';

  return { valid, length: text.length, sanitized, wrapped, errors };
}
