/**
 * Step 3: Skeleton Extraction Tests
 *
 * Tests for stepSkeleton — extracts structural elements from narrative.
 * Covers: parseResponse with complete/incomplete skeletons, gateCheck blocking
 * on missing thematicLaw/rootTrauma, validation, reduce state updates.
 */

import { stepSkeleton } from '../../../src/lib/audit/steps/step-skeleton';
import type { PipelineRunState } from '../../../src/lib/audit/audit-step';
import type { AuditMode, GriefStage } from '../../../src/lib/audit/types';

function createMockState(auditMode: AuditMode = 'conflict'): PipelineRunState {
  return {
    phase: 'author_profile',
    inputText: 'Нарратив о предательстве и потере памяти в мире где боги покинули людей',
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

// Valid complete skeleton LLM response
const VALID_SKELETON_RESPONSE = JSON.stringify({
  thematicLaw: 'В этом мире предательство всегда влечёт за собой потерю памяти',
  rootTrauma: 'Великий Разрыв — событие, когда боги покинули мир',
  hamartia: 'Гордыня протагониста не позволяет ему принять помощь',
  pillars: ['Столп верности', 'Столп жертвенности', 'Столп памяти'],
  emotionalEngine: 'depression',
  authorProhibition: 'Нельзя показывать воспоминания напрямую',
  targetExperience: 'Чувство утраты и постепенное обретение надежды',
  centralQuestion: 'Может ли человек измениться без памяти о прошлом?',
});

describe('stepSkeleton (Step 3: Skeleton Extraction)', () => {
  // =========================================================================
  // Step metadata
  // =========================================================================

  test('Has correct step ID', () => {
    expect(stepSkeleton.id).toBe('skeleton_extraction');
  });

  test('Is NOT a skipLLM step', () => {
    expect(stepSkeleton.skipLLM).toBe(false);
  });

  test('Has maxTokens of 2048', () => {
    expect(stepSkeleton.maxTokens).toBe(2048);
  });

  test('Has maxRetries of 3', () => {
    expect(stepSkeleton.maxRetries).toBe(3);
  });

  // =========================================================================
  // buildPrompt
  // =========================================================================

  describe('buildPrompt', () => {
    test('Returns system and user messages', () => {
      const state = createMockState();
      const messages = stepSkeleton.buildPrompt(state);
      expect(messages.length).toBe(2);
      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('user');
    });

    test('System message requests weakness analysis in Russian', () => {
      const state = createMockState();
      const messages = stepSkeleton.buildPrompt(state);
      expect(messages[0].content).toContain('русском');
    });
  });

  // =========================================================================
  // parseResponse
  // =========================================================================

  describe('parseResponse', () => {
    test('Parses complete skeleton response', () => {
      const result = stepSkeleton.parseResponse(VALID_SKELETON_RESPONSE);
      expect(result.thematicLaw).toContain('предательство');
      expect(result.rootTrauma).toContain('Разрыв');
      expect(result.hamartia).toContain('Гордыня');
      expect(result.pillars).toHaveLength(3);
      expect(result.emotionalEngine).toBe('depression');
      expect(result.authorProhibition).toBeTruthy();
      expect(result.targetExperience).toBeTruthy();
      expect(result.centralQuestion).toBeTruthy();
    });

    test('Handles skeleton with null optional fields', () => {
      const raw = JSON.stringify({
        thematicLaw: 'Закон мира',
        rootTrauma: 'Травма',
        hamartia: null,
        pillars: [null, null, null],
        emotionalEngine: null,
        authorProhibition: null,
        targetExperience: null,
        centralQuestion: null,
      });
      const result = stepSkeleton.parseResponse(raw);
      expect(result.thematicLaw).toBe('Закон мира');
      expect(result.rootTrauma).toBe('Травма');
      expect(result.hamartia).toBeNull();
      expect(result.pillars).toEqual([null, null, null]);
      expect(result.emotionalEngine).toBeNull();
    });

    test('Handles skeleton with all fields null (parse failure)', () => {
      const raw = JSON.stringify({
        thematicLaw: null,
        rootTrauma: null,
        hamartia: null,
        pillars: [null, null, null],
        emotionalEngine: null,
        authorProhibition: null,
        targetExperience: null,
        centralQuestion: null,
      });
      const result = stepSkeleton.parseResponse(raw);
      expect(result.thematicLaw).toBeNull();
      expect(result.rootTrauma).toBeNull();
    });

    test('Handles markdown-fenced JSON', () => {
      const raw = '```json\n' + VALID_SKELETON_RESPONSE + '\n```';
      const result = stepSkeleton.parseResponse(raw);
      expect(result.thematicLaw).toContain('предательство');
    });

    test('Handles empty response', () => {
      const result = stepSkeleton.parseResponse('');
      expect(result.thematicLaw).toBeNull();
      expect(result.rootTrauma).toBeNull();
    });

    test('Handles invalid JSON gracefully', () => {
      const result = stepSkeleton.parseResponse('not json at all');
      expect(result.thematicLaw).toBeNull();
      expect(result.rootTrauma).toBeNull();
    });

    test('Defaults invalid emotionalEngine to null', () => {
      const raw = JSON.stringify({
        thematicLaw: 'Закон',
        rootTrauma: 'Травма',
        hamartia: null,
        pillars: [null, null, null],
        emotionalEngine: 'invalid_stage',
        authorProhibition: null,
        targetExperience: null,
        centralQuestion: null,
      });
      const result = stepSkeleton.parseResponse(raw);
      expect(result.emotionalEngine).toBeNull();
    });

    test('Accepts all valid grief stages for emotionalEngine', () => {
      const validStages: GriefStage[] = ['denial', 'anger', 'bargaining', 'depression', 'acceptance'];
      for (const stage of validStages) {
        const raw = JSON.stringify({
          thematicLaw: 'Закон', rootTrauma: 'Травма', hamartia: null,
          pillars: [null, null, null], emotionalEngine: stage,
          authorProhibition: null, targetExperience: null, centralQuestion: null,
        });
        const result = stepSkeleton.parseResponse(raw);
        expect(result.emotionalEngine).toBe(stage);
      }
    });
  });

  // =========================================================================
  // validate
  // =========================================================================

  describe('validate', () => {
    test('Complete skeleton passes validation', () => {
      const output = stepSkeleton.parseResponse(VALID_SKELETON_RESPONSE);
      const result = stepSkeleton.validate(output);
      expect(result.valid).toBe(true);
    });

    test('Missing thematicLaw fails validation', () => {
      const output = stepSkeleton.parseResponse(JSON.stringify({
        thematicLaw: null, rootTrauma: 'Травма', hamartia: null,
        pillars: ['Столп'], emotionalEngine: null,
        authorProhibition: null, targetExperience: null, centralQuestion: null,
      }));
      const result = stepSkeleton.validate(output);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Тематический закон'))).toBe(true);
    });

    test('Missing rootTrauma fails validation', () => {
      const output = stepSkeleton.parseResponse(JSON.stringify({
        thematicLaw: 'Закон', rootTrauma: null, hamartia: null,
        pillars: ['Столп'], emotionalEngine: null,
        authorProhibition: null, targetExperience: null, centralQuestion: null,
      }));
      const result = stepSkeleton.validate(output);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Корневая травма'))).toBe(true);
    });

    test('No pillars fails validation', () => {
      const output = stepSkeleton.parseResponse(JSON.stringify({
        thematicLaw: 'Закон', rootTrauma: 'Травма', hamartia: null,
        pillars: [null, null, null], emotionalEngine: null,
        authorProhibition: null, targetExperience: null, centralQuestion: null,
      }));
      const result = stepSkeleton.validate(output);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('столп'))).toBe(true);
    });

    test('Can retry on validation failure', () => {
      const output = stepSkeleton.parseResponse('');
      const result = stepSkeleton.validate(output);
      expect(result.canRetry).toBe(true);
    });
  });

  // =========================================================================
  // gateCheck — blocks if thematicLaw or rootTrauma is null
  // =========================================================================

  describe('gateCheck', () => {
    test('Passes when thematicLaw and rootTrauma are present', () => {
      const state = createMockState();
      const output = stepSkeleton.parseResponse(VALID_SKELETON_RESPONSE);
      const result = stepSkeleton.gateCheck(output, state);
      expect(result.passed).toBe(true);
    });

    test('Blocks when thematicLaw is null', () => {
      const state = createMockState();
      const output = stepSkeleton.parseResponse(JSON.stringify({
        thematicLaw: null, rootTrauma: 'Травма', hamartia: null,
        pillars: [null, null, null], emotionalEngine: null,
        authorProhibition: null, targetExperience: null, centralQuestion: null,
      }));
      const result = stepSkeleton.gateCheck(output, state);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('тематический закон');
      expect(result.fixes).toBeDefined();
      expect(result.fixes!.some(f => f.id === 'FIX-thematic_law')).toBe(true);
    });

    test('Blocks when rootTrauma is null', () => {
      const state = createMockState();
      const output = stepSkeleton.parseResponse(JSON.stringify({
        thematicLaw: 'Закон', rootTrauma: null, hamartia: null,
        pillars: [null, null, null], emotionalEngine: null,
        authorProhibition: null, targetExperience: null, centralQuestion: null,
      }));
      const result = stepSkeleton.gateCheck(output, state);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('корневая травма');
      expect(result.fixes!.some(f => f.id === 'FIX-root_trauma')).toBe(true);
    });

    test('Blocks when both thematicLaw and rootTrauma are null', () => {
      const state = createMockState();
      const output = stepSkeleton.parseResponse('');
      const result = stepSkeleton.gateCheck(output, state);
      expect(result.passed).toBe(false);
      expect(result.fixes!.length).toBeGreaterThanOrEqual(2);
    });

    test('Fixes have correct severity and type', () => {
      const state = createMockState();
      const output = stepSkeleton.parseResponse('');
      const result = stepSkeleton.gateCheck(output, state);
      for (const fix of result.fixes!) {
        expect(fix.severity).toBe('critical');
        expect(['ideology', 'memory']).toContain(fix.type);
      }
    });
  });

  // =========================================================================
  // reduce — converts output to Skeleton type and stores in state
  // =========================================================================

  describe('reduce', () => {
    test('Stores complete skeleton in state', () => {
      const state = createMockState();
      const output = stepSkeleton.parseResponse(VALID_SKELETON_RESPONSE);
      const newState = stepSkeleton.reduce(state, output);
      expect(newState.skeleton).not.toBeNull();
      expect(newState.skeleton!.status).toBe('COMPLETE');
      expect(newState.skeleton!.elements.length).toBe(10);
    });

    test('Skeleton elements have correct IDs and names', () => {
      const state = createMockState();
      const output = stepSkeleton.parseResponse(VALID_SKELETON_RESPONSE);
      const newState = stepSkeleton.reduce(state, output);
      const ids = newState.skeleton!.elements.map(e => e.id);
      expect(ids).toContain('thematic_law');
      expect(ids).toContain('root_trauma');
      expect(ids).toContain('hamartia');
      expect(ids).toContain('pillar_1');
      expect(ids).toContain('emotional_engine');
    });

    test('Incomplete skeleton gets INCOMPLETE status', () => {
      const state = createMockState();
      const output = stepSkeleton.parseResponse(JSON.stringify({
        thematicLaw: null, rootTrauma: null, hamartia: null,
        pillars: [null, null, null], emotionalEngine: null,
        authorProhibition: null, targetExperience: null, centralQuestion: null,
      }));
      const newState = stepSkeleton.reduce(state, output);
      expect(newState.skeleton!.status).toBe('INCOMPLETE');
      expect(newState.skeleton!.canProceedToL1).toBe(false);
    });

    test('Complete skeleton can proceed to L1', () => {
      const state = createMockState();
      const output = stepSkeleton.parseResponse(VALID_SKELETON_RESPONSE);
      const newState = stepSkeleton.reduce(state, output);
      expect(newState.skeleton!.canProceedToL1).toBe(true);
    });

    test('Preserves other state fields', () => {
      const state = createMockState();
      const output = stepSkeleton.parseResponse(VALID_SKELETON_RESPONSE);
      const newState = stepSkeleton.reduce(state, output);
      expect(newState.auditMode).toBe('conflict');
      expect(newState.inputText).toContain('Нарратив');
    });
  });
});

// Export for type checking
export {};
