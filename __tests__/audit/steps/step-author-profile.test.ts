/**
 * Step 2: Author Profile Tests
 *
 * Tests for stepAuthorProfile — determines author's working method.
 * Uses mock LLM responses to test parseResponse, validate, gateCheck, reduce.
 */

import { stepAuthorProfile } from '../../../src/lib/audit/steps/step-author-profile';
import type { PipelineRunState } from '../../../src/lib/audit/audit-step';
import type { AuthorProfileType } from '../../../src/lib/audit/types';

function createMockState(): PipelineRunState {
  return {
    phase: 'mode_detection',
    inputText: 'Test narrative with enough length for validation',
    mediaType: 'novel',
    auditMode: 'conflict',
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

describe('stepAuthorProfile (Step 2: Author Profile)', () => {
  // =========================================================================
  // Step metadata
  // =========================================================================

  test('Has correct step ID', () => {
    expect(stepAuthorProfile.id).toBe('author_profile');
  });

  test('Is NOT a skipLLM step', () => {
    expect(stepAuthorProfile.skipLLM).toBe(false);
  });

  test('Has maxTokens of 2048', () => {
    expect(stepAuthorProfile.maxTokens).toBe(2048);
  });

  // =========================================================================
  // buildPrompt
  // =========================================================================

  describe('buildPrompt', () => {
    test('Returns system and user messages', () => {
      const state = createMockState();
      const messages = stepAuthorProfile.buildPrompt(state);
      expect(messages.length).toBe(2);
      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('user');
    });

    test('System message mentions Russian output requirement', () => {
      const state = createMockState();
      const messages = stepAuthorProfile.buildPrompt(state);
      expect(messages[0].content).toContain('русском');
    });
  });

  // =========================================================================
  // parseResponse
  // =========================================================================

  describe('parseResponse', () => {
    test('Parses gardener profile response', () => {
      const raw = JSON.stringify({
        answers: { Q1: true, Q2: true, Q3: true, Q4: true, Q5: true, Q6: true, Q7: true },
        weightedScore: 85,
        percentage: 85,
        type: 'gardener',
        confidence: 'high',
        mainRisks: ['Недостаток структуры'],
        auditPriorities: ['Проверить логику'],
      });
      const result = stepAuthorProfile.parseResponse(raw);
      expect(result.type).toBe('gardener');
      expect(result.percentage).toBe(85);
      expect(result.confidence).toBe('high');
      expect(result.mainRisks).toContain('Недостаток структуры');
    });

    test('Parses architect profile response', () => {
      const raw = JSON.stringify({
        answers: { Q1: false, Q2: false, Q3: false, Q4: false, Q5: false, Q6: false, Q7: false },
        weightedScore: 15,
        percentage: 15,
        type: 'architect',
        confidence: 'high',
        mainRisks: ['Жёсткость структуры'],
        auditPriorities: ['Проверить органичность'],
      });
      const result = stepAuthorProfile.parseResponse(raw);
      expect(result.type).toBe('architect');
    });

    test('Parses hybrid profile response', () => {
      const raw = JSON.stringify({
        answers: { Q1: true, Q2: false, Q3: true, Q4: false, Q5: true, Q6: false, Q7: true },
        weightedScore: 50,
        percentage: 50,
        type: 'hybrid',
        confidence: 'medium',
        mainRisks: [],
        auditPriorities: [],
      });
      const result = stepAuthorProfile.parseResponse(raw);
      expect(result.type).toBe('hybrid');
    });

    test('Defaults to hybrid for invalid type', () => {
      const raw = JSON.stringify({
        answers: { Q1: true, Q2: true, Q3: true, Q4: true, Q5: true, Q6: true, Q7: true },
        weightedScore: 50,
        percentage: 50,
        type: 'invalid_type',
        confidence: 'low',
        mainRisks: [],
        auditPriorities: [],
      });
      const result = stepAuthorProfile.parseResponse(raw);
      expect(result.type).toBe('hybrid');
    });

    test('Handles markdown-fenced JSON', () => {
      const raw = '```json\n{"answers":{"Q1":true,"Q2":true,"Q3":true,"Q4":true,"Q5":true,"Q6":true,"Q7":true},"weightedScore":90,"percentage":90,"type":"gardener","confidence":"high","mainRisks":[],"auditPriorities":[]}\n```';
      const result = stepAuthorProfile.parseResponse(raw);
      expect(result.type).toBe('gardener');
    });

    test('Handles empty response gracefully', () => {
      const result = stepAuthorProfile.parseResponse('');
      expect(result.type).toBe('hybrid'); // Default
      expect(result.confidence).toBe('low');
    });

    test('Pads answers to 7 keys', () => {
      const raw = JSON.stringify({
        answers: { Q1: true },
        weightedScore: 50,
        percentage: 50,
        type: 'hybrid',
        confidence: 'medium',
        mainRisks: [],
        auditPriorities: [],
      });
      const result = stepAuthorProfile.parseResponse(raw);
      expect(Object.keys(result.answers)).toHaveLength(7);
    });
  });

  // =========================================================================
  // validate
  // =========================================================================

  describe('validate', () => {
    test('Valid output passes validation', () => {
      const output = stepAuthorProfile.parseResponse(
        JSON.stringify({
          answers: { Q1: true, Q2: true, Q3: true, Q4: true, Q5: true, Q6: true, Q7: true },
          weightedScore: 80,
          percentage: 80,
          type: 'gardener',
          confidence: 'high',
          mainRisks: [],
          auditPriorities: [],
        })
      );
      const result = stepAuthorProfile.validate(output);
      expect(result.valid).toBe(true);
    });

    test('Output with fewer than 7 answers fails validation', () => {
      const output = {
        answers: { Q1: true, Q2: true },
        weightedScore: 50,
        percentage: 50,
        type: 'hybrid' as AuthorProfileType,
        confidence: 'medium' as const,
        mainRisks: [],
        auditPriorities: [],
      };
      const result = stepAuthorProfile.validate(output);
      expect(result.valid).toBe(false);
    });

    test('Can retry on validation failure', () => {
      const output = {
        answers: {},
        weightedScore: 50,
        percentage: 50,
        type: 'hybrid' as AuthorProfileType,
        confidence: 'medium' as const,
        mainRisks: [],
        auditPriorities: [],
      };
      const result = stepAuthorProfile.validate(output);
      expect(result.canRetry).toBe(true);
    });
  });

  // =========================================================================
  // gateCheck — always passes (author profile never blocks)
  // =========================================================================

  describe('gateCheck', () => {
    test('Always passes regardless of profile type', () => {
      const state = createMockState();
      const output = stepAuthorProfile.parseResponse(
        JSON.stringify({
          answers: { Q1: true, Q2: true, Q3: true, Q4: true, Q5: true, Q6: true, Q7: true },
          weightedScore: 90,
          percentage: 90,
          type: 'gardener',
          confidence: 'high',
          mainRisks: [],
          auditPriorities: [],
        })
      );
      const result = stepAuthorProfile.gateCheck(output, state);
      expect(result.passed).toBe(true);
    });
  });

  // =========================================================================
  // reduce — stores author profile in state
  // =========================================================================

  describe('reduce', () => {
    test('Stores profile in state with all fields', () => {
      const state = createMockState();
      const output = stepAuthorProfile.parseResponse(
        JSON.stringify({
          answers: { Q1: true, Q2: true, Q3: true, Q4: true, Q5: true, Q6: true, Q7: true },
          weightedScore: 80,
          percentage: 80,
          type: 'gardener',
          confidence: 'high',
          mainRisks: ['Риск 1'],
          auditPriorities: ['Приоритет 1'],
        })
      );
      const newState = stepAuthorProfile.reduce(state, output);
      expect(newState.authorProfile).not.toBeNull();
      expect(newState.authorProfile!.type).toBe('gardener');
      expect(newState.authorProfile!.percentage).toBe(80);
      expect(newState.authorProfile!.confidence).toBe('high');
      expect(newState.authorProfile!.mainRisks).toContain('Риск 1');
      expect(newState.authorProfile!.auditPriorities).toContain('Приоритет 1');
    });

    test('Maps mainRisks and auditPriorities correctly', () => {
      const state = createMockState();
      const output = stepAuthorProfile.parseResponse(
        JSON.stringify({
          answers: { Q1: true, Q2: true, Q3: true, Q4: true, Q5: true, Q6: true, Q7: true },
          weightedScore: 80,
          percentage: 80,
          type: 'architect',
          confidence: 'high',
          mainRisks: ['Risk'],
          auditPriorities: ['Priority'],
        })
      );
      const newState = stepAuthorProfile.reduce(state, output);
      expect(newState.authorProfile!.mainRisks).toEqual(['Risk']);
      expect(newState.authorProfile!.auditPriorities).toEqual(['Priority']);
    });

    test('Preserves other state fields', () => {
      const state = createMockState();
      const output = stepAuthorProfile.parseResponse(
        JSON.stringify({
          answers: { Q1: true, Q2: true, Q3: true, Q4: true, Q5: true, Q6: true, Q7: true },
          weightedScore: 50,
          percentage: 50,
          type: 'hybrid',
          confidence: 'medium',
          mainRisks: [],
          auditPriorities: [],
        })
      );
      const newState = stepAuthorProfile.reduce(state, output);
      expect(newState.auditMode).toBe('conflict');
      expect(newState.inputText).toBe('Test narrative with enough length for validation');
    });
  });
});

// Export for type checking
export {};
