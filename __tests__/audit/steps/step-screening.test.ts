/**
 * Step 4: Screening Tests
 *
 * Tests for stepScreening — 7-question screening with count-based logic.
 * Covers: parseResponse, count-based recommendation (Section 0.6),
 * gateCheck blocking on 4+ NO answers, validation, reduce.
 */

import { stepScreening } from '../../../src/lib/audit/steps/step-screening';
import type { PipelineRunState } from '../../../src/lib/audit/audit-step';
import type { ScreeningRecommendation } from '../../../src/lib/audit/types';

function createMockState(): PipelineRunState {
  return {
    phase: 'skeleton_extraction',
    inputText: 'Нарратив о мире с тематическим законом и корневой травмой',
    mediaType: 'novel',
    auditMode: 'conflict',
    authorProfile: null,
    skeleton: {
      status: 'COMPLETE',
      elements: [
        { id: 'thematic_law', name: 'Тематический закон', value: 'Закон', status: 'complete' },
        { id: 'root_trauma', name: 'Корневая травма', value: 'Травма', status: 'complete' },
      ],
      fixes: [],
      canProceedToL1: true,
    },
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

describe('stepScreening (Step 4: Screening)', () => {
  // =========================================================================
  // Step metadata
  // =========================================================================

  test('Has correct step ID', () => {
    expect(stepScreening.id).toBe('screening');
  });

  test('Is NOT a skipLLM step', () => {
    expect(stepScreening.skipLLM).toBe(false);
  });

  test('Has maxTokens of 1024', () => {
    expect(stepScreening.maxTokens).toBe(1024);
  });

  // =========================================================================
  // parseResponse — Section 0.6: count-based recommendation
  // =========================================================================

  describe('parseResponse', () => {
    test('0-1 NO answers → ready_for_audit', () => {
      const raw = JSON.stringify({
        answers: [true, true, true, true, true, true, true],
        flags: [],
        recommendation: 'ready_for_audit',
      });
      const result = stepScreening.parseResponse(raw);
      expect(result.recommendation).toBe('ready_for_audit');
    });

    test('1 NO answer → ready_for_audit', () => {
      const raw = JSON.stringify({
        answers: [true, true, true, true, true, true, false],
        flags: ['Один слабый элемент'],
        recommendation: 'ready_for_audit',
      });
      const result = stepScreening.parseResponse(raw);
      expect(result.recommendation).toBe('ready_for_audit');
    });

    test('2 NO answers → requires_sections', () => {
      const raw = JSON.stringify({
        answers: [true, true, true, true, true, false, false],
        flags: ['Флаг 1', 'Флаг 2'],
        recommendation: 'requires_sections',
      });
      const result = stepScreening.parseResponse(raw);
      expect(result.recommendation).toBe('requires_sections');
    });

    test('3 NO answers → requires_sections', () => {
      const raw = JSON.stringify({
        answers: [true, true, true, true, false, false, false],
        flags: [],
        recommendation: 'requires_sections',
      });
      const result = stepScreening.parseResponse(raw);
      expect(result.recommendation).toBe('requires_sections');
    });

    test('4 NO answers → stop_return_to_skeleton', () => {
      const raw = JSON.stringify({
        answers: [true, true, true, false, false, false, false],
        flags: ['Проблема 1'],
        recommendation: 'stop_return_to_skeleton',
      });
      const result = stepScreening.parseResponse(raw);
      expect(result.recommendation).toBe('stop_return_to_skeleton');
    });

    test('7 NO answers → stop_return_to_skeleton', () => {
      const raw = JSON.stringify({
        answers: [false, false, false, false, false, false, false],
        flags: ['Все вопросы НЕТ'],
        recommendation: 'stop_return_to_skeleton',
      });
      const result = stepScreening.parseResponse(raw);
      expect(result.recommendation).toBe('stop_return_to_skeleton');
    });

    test('CODE OVERRIDES LLM recommendation (Section 0.6)', () => {
      // LLM says ready_for_audit but 4+ NO answers → code wins
      const raw = JSON.stringify({
        answers: [true, true, true, false, false, false, false],
        flags: [],
        recommendation: 'ready_for_audit', // LLM is wrong
      });
      const result = stepScreening.parseResponse(raw);
      expect(result.recommendation).toBe('stop_return_to_skeleton');
      expect(result.llmRecommendation).toBe('ready_for_audit'); // Preserved for comparison
    });

    test('Handles markdown-fenced JSON', () => {
      const raw = '```json\n{"answers": [true, true, true, true, true, true, true], "flags": [], "recommendation": "ready_for_audit"}\n```';
      const result = stepScreening.parseResponse(raw);
      expect(result.recommendation).toBe('ready_for_audit');
    });

    test('Handles empty response — defaults to stop_return_to_skeleton', () => {
      const result = stepScreening.parseResponse('');
      expect(result.recommendation).toBe('stop_return_to_skeleton');
    });

    test('Pads answers to 7 if fewer provided', () => {
      const raw = JSON.stringify({
        answers: [true, true],
        flags: [],
        recommendation: 'unknown',
      });
      const result = stepScreening.parseResponse(raw);
      expect(result.answers.length).toBe(7);
    });

    test('Truncates answers to 7 if more provided', () => {
      const raw = JSON.stringify({
        answers: [true, true, true, true, true, true, true, true, true],
        flags: [],
        recommendation: 'ready_for_audit',
      });
      const result = stepScreening.parseResponse(raw);
      expect(result.answers.length).toBe(7);
    });
  });

  // =========================================================================
  // validate
  // =========================================================================

  describe('validate', () => {
    test('Valid screening output passes', () => {
      const output = stepScreening.parseResponse(
        JSON.stringify({ answers: [true, true, true, true, true, true, true], flags: [], recommendation: 'ready_for_audit' })
      );
      const result = stepScreening.validate(output);
      expect(result.valid).toBe(true);
    });

    test('Output with wrong answer count fails', () => {
      const output = {
        answers: [true, true], // Only 2
        flags: [],
        recommendation: 'ready_for_audit' as ScreeningRecommendation,
        llmRecommendation: 'ready_for_audit',
      };
      const result = stepScreening.validate(output);
      expect(result.valid).toBe(false);
    });
  });

  // =========================================================================
  // gateCheck — blocks on stop_return_to_skeleton
  // =========================================================================

  describe('gateCheck', () => {
    test('Passes for ready_for_audit', () => {
      const state = createMockState();
      const output = stepScreening.parseResponse(
        JSON.stringify({ answers: [true, true, true, true, true, true, true], flags: [], recommendation: 'ready_for_audit' })
      );
      const result = stepScreening.gateCheck(output, state);
      expect(result.passed).toBe(true);
    });

    test('Passes for requires_sections', () => {
      const state = createMockState();
      const output = stepScreening.parseResponse(
        JSON.stringify({ answers: [true, true, true, true, true, false, false], flags: [], recommendation: 'requires_sections' })
      );
      const result = stepScreening.gateCheck(output, state);
      expect(result.passed).toBe(true);
    });

    test('Blocks for stop_return_to_skeleton', () => {
      const state = createMockState();
      const output = stepScreening.parseResponse(
        JSON.stringify({ answers: [true, true, true, false, false, false, false], flags: ['Проблема 1'], recommendation: 'stop_return_to_skeleton' })
      );
      const result = stepScreening.gateCheck(output, state);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('4');
      expect(result.fixes).toBeDefined();
      expect(result.fixes!.length).toBeGreaterThan(0);
    });

    test('Fixes are generated from flags', () => {
      const state = createMockState();
      const output = stepScreening.parseResponse(
        JSON.stringify({ answers: [false, false, false, false, false, false, false], flags: ['Флаг А', 'Флаг Б'], recommendation: 'stop_return_to_skeleton' })
      );
      const result = stepScreening.gateCheck(output, state);
      expect(result.fixes!.length).toBe(2);
    });
  });

  // =========================================================================
  // reduce — stores ScreeningResult in state
  // =========================================================================

  describe('reduce', () => {
    test('Stores complete screening result in state', () => {
      const state = createMockState();
      const output = stepScreening.parseResponse(
        JSON.stringify({ answers: [true, true, true, true, true, true, true], flags: [], recommendation: 'ready_for_audit' })
      );
      const newState = stepScreening.reduce(state, output);
      expect(newState.screeningResult).not.toBeNull();
      expect(newState.screeningResult!.recommendation).toBe('ready_for_audit');
      expect(newState.screeningResult!.no_count).toBe(0);
      expect(newState.screeningResult!.proceed_normally).toBe(true);
    });

    test('Maps answers to named screening questions', () => {
      const state = createMockState();
      const output = stepScreening.parseResponse(
        JSON.stringify({ answers: [true, false, true, false, true, false, true], flags: [], recommendation: 'requires_sections' })
      );
      const newState = stepScreening.reduce(state, output);
      expect(newState.screeningResult!.question1_thematicLaw).toBe(true);
      expect(newState.screeningResult!.question2_worldWithoutProtagonist).toBe(false);
      expect(newState.screeningResult!.question4_hamartia).toBe(false);
      expect(newState.screeningResult!.no_count).toBe(3);
    });

    test('Sets proceed_normally to false for 4+ NO answers', () => {
      const state = createMockState();
      const output = stepScreening.parseResponse(
        JSON.stringify({ answers: [true, true, true, false, false, false, false], flags: [], recommendation: 'stop_return_to_skeleton' })
      );
      const newState = stepScreening.reduce(state, output);
      expect(newState.screeningResult!.proceed_normally).toBe(false);
    });

    test('Preserves other state fields', () => {
      const state = createMockState();
      const output = stepScreening.parseResponse(
        JSON.stringify({ answers: [true, true, true, true, true, true, true], flags: [], recommendation: 'ready_for_audit' })
      );
      const newState = stepScreening.reduce(state, output);
      expect(newState.auditMode).toBe('conflict');
      expect(newState.skeleton).not.toBeNull();
    });
  });
});

// Export for type checking
export {};
