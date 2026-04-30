/**
 * Step 1: Mode Detection Tests
 *
 * Tests for stepModeDetection — determines audit mode (conflict/kishō/hybrid).
 * Uses mock LLM responses to test parseResponse, validate, gateCheck, reduce.
 */

import { stepModeDetection } from '../../../src/lib/audit/steps/step-mode-detection';
import type { PipelineRunState } from '../../../src/lib/audit/audit-step';
import type { AuditMode } from '../../../src/lib/audit/types';

function createMockState(inputText = 'Test narrative', auditMode: AuditMode | null = null): PipelineRunState {
  return {
    phase: 'input_validation',
    inputText,
    mediaType: 'novel',
    auditMode,
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

describe('stepModeDetection (Step 1: Mode Detection)', () => {
  // =========================================================================
  // Step metadata
  // =========================================================================

  test('Has correct step ID', () => {
    expect(stepModeDetection.id).toBe('mode_detection');
  });

  test('Is NOT a skipLLM step', () => {
    expect(stepModeDetection.skipLLM).toBe(false);
  });

  test('Has maxTokens of 1024', () => {
    expect(stepModeDetection.maxTokens).toBe(1024);
  });

  test('Has maxRetries of 2', () => {
    expect(stepModeDetection.maxRetries).toBe(2);
  });

  // =========================================================================
  // buildPrompt — produces system + user messages
  // =========================================================================

  describe('buildPrompt', () => {
    test('Returns array with system and user messages', () => {
      const state = createMockState('Мой концепт про антагониста');
      const messages = stepModeDetection.buildPrompt(state);
      expect(messages.length).toBe(2);
      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('user');
    });

    test('System message is in Russian', () => {
      const state = createMockState('Test');
      const messages = stepModeDetection.buildPrompt(state);
      expect(messages[0].content).toContain('аудитор');
    });

    test('User message contains the input text', () => {
      const state = createMockState('Уникальный концепт');
      const messages = stepModeDetection.buildPrompt(state);
      expect(messages[1].content).toContain('Уникальный концепт');
    });
  });

  // =========================================================================
  // parseResponse — extracts mode from LLM JSON response
  // =========================================================================

  describe('parseResponse', () => {
    test('Parses valid conflict mode response', () => {
      const raw = JSON.stringify({
        hasAntagonist: true,
        victoryTrajectory: true,
        externalConflict: true,
        mode: 'conflict',
        reasoning: 'Наличие антагониста определяет конфликтный режим',
      });
      const result = stepModeDetection.parseResponse(raw);
      expect(result.mode).toBe('conflict');
      expect(result.hasAntagonist).toBe(true);
      expect(result.reasoning).toContain('антагониста');
    });

    test('Parses valid kishō mode response', () => {
      const raw = JSON.stringify({
        hasAntagonist: false,
        victoryTrajectory: false,
        externalConflict: false,
        mode: 'kishō',
        reasoning: 'Внутренняя трансформация без антагониста',
      });
      const result = stepModeDetection.parseResponse(raw);
      expect(result.mode).toBe('kishō');
      expect(result.hasAntagonist).toBe(false);
    });

    test('Parses valid hybrid mode response', () => {
      const raw = JSON.stringify({
        hasAntagonist: true,
        victoryTrajectory: false,
        externalConflict: false,
        mode: 'hybrid',
        reasoning: 'Смешанный режим',
      });
      const result = stepModeDetection.parseResponse(raw);
      expect(result.mode).toBe('hybrid');
    });

    test('Handles markdown-fenced JSON response', () => {
      const raw = '```json\n{"hasAntagonist": true, "victoryTrajectory": true, "externalConflict": true, "mode": "conflict", "reasoning": "test"}\n```';
      const result = stepModeDetection.parseResponse(raw);
      expect(result.mode).toBe('conflict');
    });

    test('Defaults to conflict for invalid mode value', () => {
      const raw = JSON.stringify({
        hasAntagonist: true,
        victoryTrajectory: true,
        externalConflict: true,
        mode: 'invalid_mode',
        reasoning: 'test',
      });
      const result = stepModeDetection.parseResponse(raw);
      expect(result.mode).toBe('conflict');
    });

    test('Handles empty/null response', () => {
      const result = stepModeDetection.parseResponse('');
      expect(result.mode).toBe('conflict'); // Default fallback
      expect(result.reasoning).toBeTruthy();
    });

    test('Handles response with text around JSON', () => {
      const raw = 'Анализ завершён:\n{"hasAntagonist": true, "victoryTrajectory": true, "externalConflict": true, "mode": "conflict", "reasoning": "test"}\nКонец.';
      const result = stepModeDetection.parseResponse(raw);
      expect(result.mode).toBe('conflict');
    });

    test('Coerces boolean fields', () => {
      const raw = JSON.stringify({
        hasAntagonist: 1,
        victoryTrajectory: 'yes',
        externalConflict: 0,
        mode: 'conflict',
        reasoning: 'test',
      });
      const result = stepModeDetection.parseResponse(raw);
      expect(result.hasAntagonist).toBe(true);
      expect(result.victoryTrajectory).toBe(true);
      expect(result.externalConflict).toBe(false);
    });
  });

  // =========================================================================
  // validate — checks mode and reasoning
  // =========================================================================

  describe('validate', () => {
    test('Valid output passes validation', () => {
      const output = stepModeDetection.parseResponse(
        JSON.stringify({ hasAntagonist: true, victoryTrajectory: true, externalConflict: true, mode: 'conflict', reasoning: 'test' })
      );
      const result = stepModeDetection.validate(output);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('Missing reasoning fails validation', () => {
      const output = {
        hasAntagonist: true,
        victoryTrajectory: true,
        externalConflict: true,
        mode: 'conflict' as AuditMode,
        reasoning: '',
      };
      const result = stepModeDetection.validate(output);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('обоснование'))).toBe(true);
    });

    test('Can retry on validation failure', () => {
      const output = {
        hasAntagonist: true,
        victoryTrajectory: true,
        externalConflict: true,
        mode: 'conflict' as AuditMode,
        reasoning: '',
      };
      const result = stepModeDetection.validate(output);
      expect(result.canRetry).toBe(true);
    });
  });

  // =========================================================================
  // gateCheck — always passes (mode detection never blocks)
  // =========================================================================

  describe('gateCheck', () => {
    test('Always passes regardless of mode', () => {
      const state = createMockState();
      const output = { hasAntagonist: false, victoryTrajectory: false, externalConflict: false, mode: 'kishō' as AuditMode, reasoning: '' };
      const result = stepModeDetection.gateCheck(output, state);
      expect(result.passed).toBe(true);
    });

    test('Passes even with conflict mode', () => {
      const state = createMockState();
      const output = { hasAntagonist: true, victoryTrajectory: true, externalConflict: true, mode: 'conflict' as AuditMode, reasoning: 'test' };
      const result = stepModeDetection.gateCheck(output, state);
      expect(result.passed).toBe(true);
    });
  });

  // =========================================================================
  // reduce — stores mode in state
  // =========================================================================

  describe('reduce', () => {
    test('Stores conflict mode in state', () => {
      const state = createMockState();
      const output = { hasAntagonist: true, victoryTrajectory: true, externalConflict: true, mode: 'conflict' as AuditMode, reasoning: 'test' };
      const newState = stepModeDetection.reduce(state, output);
      expect(newState.auditMode).toBe('conflict');
    });

    test('Stores kishō mode in state', () => {
      const state = createMockState();
      const output = { hasAntagonist: false, victoryTrajectory: false, externalConflict: false, mode: 'kishō' as AuditMode, reasoning: 'test' };
      const newState = stepModeDetection.reduce(state, output);
      expect(newState.auditMode).toBe('kishō');
    });

    test('Preserves other state fields', () => {
      const state = createMockState('My narrative');
      const output = { hasAntagonist: true, victoryTrajectory: true, externalConflict: true, mode: 'hybrid' as AuditMode, reasoning: 'test' };
      const newState = stepModeDetection.reduce(state, output);
      expect(newState.inputText).toBe('My narrative');
      expect(newState.mediaType).toBe('novel');
      expect(newState.auditMode).toBe('hybrid');
    });
  });
});

// Export for type checking
export {};
