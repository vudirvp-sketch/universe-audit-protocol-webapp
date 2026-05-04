/**
 * Step 0: Input Validation Tests
 *
 * Tests for stepValidate — the skipLLM step that validates user input.
 * Covers: valid/invalid input lengths, edge cases, gateCheck, reduce.
 */

import { stepValidate, validateInputText } from '../../../src/lib/audit/steps/step-validate';
import type { PipelineRunState } from '../../../src/lib/audit/audit-step';

// Helper to create a minimal PipelineRunState
function createMockState(inputText: string): PipelineRunState {
  return {
    phase: 'idle',
    inputText,
    mediaType: 'novel',
    auditMode: null,
    authorProfile: null,
    skeleton: null,
    screeningResult: null,
    gateResults: { L1: null, L2: null, L3: null, L4: null },
    griefMatrix: null,
    issues: [],
    whatForChains: [],
    generativeOutput: null,
    narrativeDigest: null,
    nextActions: [],
    finalScore: null,
    error: null,
    blockedAt: null,
    elapsedMs: 0,
    stepTimings: {},
  };
}

describe('stepValidate (Step 0: Input Validation)', () => {
  // =========================================================================
  // Step metadata
  // =========================================================================

  test('Has correct step ID', () => {
    expect(stepValidate.id).toBe('input_validation');
  });

  test('Is a skipLLM step', () => {
    expect(stepValidate.skipLLM).toBe(true);
  });

  test('Has zero maxTokens', () => {
    expect(stepValidate.maxTokens).toBe(0);
  });

  test('Has zero maxRetries', () => {
    expect(stepValidate.maxRetries).toBe(0);
  });

  test('buildPrompt returns empty array (never called)', () => {
    const state = createMockState('valid input text');
    expect(stepValidate.buildPrompt(state)).toEqual([]);
  });

  // =========================================================================
  // validateInputText — core validation logic
  // =========================================================================

  describe('validateInputText', () => {
    test('Rejects empty string', () => {
      const result = validateInputText('');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('пустой');
    });

    test('Rejects whitespace-only string', () => {
      const result = validateInputText('   \n\t  ');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('пустой');
    });

    test('Rejects string shorter than 50 characters', () => {
      const result = validateInputText('Короткий текст');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('краткий');
      expect(result.errors[0]).toContain('50');
    });

    test('Rejects string exactly 49 characters', () => {
      const text49 = 'а'.repeat(49);
      const result = validateInputText(text49);
      expect(result.valid).toBe(false);
    });

    test('Accepts string exactly 50 characters', () => {
      const text50 = 'а'.repeat(50);
      const result = validateInputText(text50);
      expect(result.valid).toBe(true);
    });

    test('Accepts string with 50+ characters', () => {
      const text = 'Это достаточно длинный текст для того чтобы пройти валидацию входных данных аудита протокола вселенной';
      const result = validateInputText(text);
      expect(result.valid).toBe(true);
    });

    test('Rejects string longer than 50000 characters', () => {
      const text50001 = 'а'.repeat(50001);
      const result = validateInputText(text50001);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('50000');
    });

    test('Accepts string exactly 50000 characters', () => {
      const text50000 = 'а'.repeat(50000);
      const result = validateInputText(text50000);
      expect(result.valid).toBe(true);
    });

    test('Returns correct length', () => {
      const text = 'Hello world test';
      const result = validateInputText(text);
      expect(result.length).toBe(text.length);
    });

    test('Returns sanitized text for valid input', () => {
      const text = 'а'.repeat(100);
      const result = validateInputText(text);
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBeDefined();
      expect(result.sanitized.length).toBeGreaterThan(0);
    });

    test('Returns wrapped text for valid input', () => {
      const text = 'а'.repeat(100);
      const result = validateInputText(text);
      expect(result.valid).toBe(true);
      expect(result.wrapped).toContain('<user_input>');
    });
  });

  // =========================================================================
  // parseResponse — returns empty shell (skipLLM pattern)
  // =========================================================================

  describe('parseResponse', () => {
    test('Returns shell with valid=false', () => {
      const result = stepValidate.parseResponse('');
      expect(result.valid).toBe(false);
      expect(result.length).toBe(0);
      expect(result.errors).toEqual([]);
    });
  });

  // =========================================================================
  // validate — always returns valid (shell is just a marker)
  // =========================================================================

  describe('validate', () => {
    test('Always returns valid=true for the shell marker', () => {
      const shell = stepValidate.parseResponse('');
      const result = stepValidate.validate(shell);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.canRetry).toBe(false);
    });
  });

  // =========================================================================
  // gateCheck — performs REAL validation from state
  // =========================================================================

  describe('gateCheck', () => {
    test('Passes for valid input (50+ chars)', () => {
      const state = createMockState('а'.repeat(100));
      const shell = stepValidate.parseResponse('');
      const result = stepValidate.gateCheck(shell, state);
      expect(result.passed).toBe(true);
    });

    test('Blocks for empty input', () => {
      const state = createMockState('');
      const shell = stepValidate.parseResponse('');
      const result = stepValidate.gateCheck(shell, state);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('пустой');
    });

    test('Blocks for too short input', () => {
      const state = createMockState('Коротко');
      const shell = stepValidate.parseResponse('');
      const result = stepValidate.gateCheck(shell, state);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('краткий');
    });

    test('Blocks for too long input', () => {
      const state = createMockState('а'.repeat(50001));
      const shell = stepValidate.parseResponse('');
      const result = stepValidate.gateCheck(shell, state);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('50000');
    });
  });

  // =========================================================================
  // reduce — updates state based on cached validation result
  // =========================================================================

  describe('reduce', () => {
    test('Sets phase to input_validation for valid input', () => {
      const state = createMockState('а'.repeat(100));
      // Must call gateCheck first to populate the cache
      const shell = stepValidate.parseResponse('');
      stepValidate.gateCheck(shell, state);
      const newState = stepValidate.reduce(state, shell);
      expect(newState.phase).toBe('input_validation');
      expect(newState.error).toBeNull();
    });

    test('Sets phase to blocked for invalid input', () => {
      const state = createMockState('');
      const shell = stepValidate.parseResponse('');
      stepValidate.gateCheck(shell, state);
      const newState = stepValidate.reduce(state, shell);
      expect(newState.phase).toBe('blocked');
      expect(newState.error).not.toBeNull();
    });
  });
});

// Export for type checking
export {};
