/**
 * Gate Steps Tests (L1, L2, L3, L4)
 *
 * Tests for all four gate evaluation steps. Each gate follows the same
 * CVA pattern but with different checklists, thresholds, and output types.
 *
 * Key protocol rules tested:
 * - Section 0.7: Mode-specific thresholds (conflict: 60%, kishō: 50%, hybrid: 55%)
 * - RULE_8: Gate output MUST include block-level breakdown
 * - RULE_3 (L3): Grief HARD CHECK — dominant stage needs ≥2 levels
 * - Section 0.8 (L4): Cult potential merged INTO L4
 */

import { stepGateL1 } from '../../../src/lib/audit/steps/step-gate-L1';
import { stepGateL2 } from '../../../src/lib/audit/steps/step-gate-L2';
import { stepGateL3 } from '../../../src/lib/audit/steps/step-gate-L3';
import { stepGateL4 } from '../../../src/lib/audit/steps/step-gate-L4';
import type { PipelineRunState } from '../../../src/lib/audit/audit-step';
import type { AuditMode, GateResult, GriefStage } from '../../../src/lib/audit/types';
import { DEFAULT_THRESHOLDS } from '../../../src/lib/audit/types';

function createMockState(auditMode: AuditMode = 'conflict'): PipelineRunState {
  return {
    phase: 'screening',
    inputText: 'Нарратив о мире с тематическим законом',
    mediaType: 'novel',
    auditMode,
    authorProfile: null,
    skeleton: {
      status: 'COMPLETE',
      elements: [
        { id: 'thematic_law', name: 'Тематический закон', value: 'Закон мира', status: 'complete' },
        { id: 'root_trauma', name: 'Корневая травма', value: 'Травма', status: 'complete' },
      ],
      fixes: [],
      canProceedToL1: true,
    },
    screeningResult: {
      question1_thematicLaw: true,
      question2_worldWithoutProtagonist: true,
      question3_embodiment: true,
      question4_hamartia: true,
      question5_painfulChoice: true,
      question6_antagonistLogic: true,
      question7_finalIrreversible: true,
      flags: [],
      recommendation: 'ready_for_audit',
      no_count: 0,
      proceed_normally: true,
    },
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

// Valid L1 response JSON
const VALID_L1_RESPONSE = JSON.stringify({
  evaluations: [
    { id: 'L1_01', status: 'PASS', evidence: 'Закон сформулирован', functionalRole: 'Механизм' },
    { id: 'L1_02', status: 'PASS', evidence: 'Травма определена', functionalRole: 'Механизм' },
  ],
  score: 75,
  gatePassed: true,
  fixList: [],
});

const VALID_L2_RESPONSE = JSON.stringify({
  evaluations: [
    { id: 'L2_01', status: 'PASS', evidence: 'Столпы определены', functionalRole: 'Тело' },
    { id: 'L2_02', status: 'PASS', evidence: 'Запрет установлен', functionalRole: 'Тело' },
  ],
  score: 70,
  gatePassed: true,
  fixList: [],
});

const VALID_L3_RESPONSE = JSON.stringify({
  evaluations: [
    { id: 'L3_01', status: 'PASS', evidence: 'Психика проанализирована', functionalRole: 'Психика' },
  ],
  griefMatrix: {
    dominantStage: 'depression',
    cells: [
      { stage: 'depression', level: 'character', confidence: 'high' },
      { stage: 'depression', level: 'location', confidence: 'medium' },
      { stage: 'anger', level: 'character', confidence: 'low' },
    ],
  },
  score: 65,
  gatePassed: true,
});

const VALID_L4_RESPONSE = JSON.stringify({
  evaluations: [
    { id: 'L4_01', status: 'PASS', evidence: 'Мета-уровень проанализирован', functionalRole: 'Мета' },
  ],
  threeLayers: {
    personal: { stable: true, proof: 'Личный слой стабилен' },
    plot: { stable: true, proof: 'Сюжетный слой стабилен' },
    meta: { stable: true, proof: 'Мета-слой стабилен' },
  },
  cornelianDilemma: {
    valid: true,
    valueA: 'Верность',
    valueB: 'Свобода',
    irreversible: true,
    thirdPath: 'Нет третьего пути',
  },
  agentMirror: {
    integrated: true,
    directQuestion: 'Что бы вы сделали?',
  },
  cultPotential: {
    score: 70,
    criteria: [true, true, true],
  },
  score: 72,
  gatePassed: true,
});

// ===========================================================================
// Gate L1 Tests
// ===========================================================================

describe('stepGateL1 (Step 5: Gate L1 — Mechanism)', () => {
  test('Has correct step ID', () => {
    expect(stepGateL1.id).toBe('L1_evaluation');
  });

  test('Has maxTokens of 4096 (gate evaluation)', () => {
    expect(stepGateL1.maxTokens).toBe(4096);
  });

  describe('parseResponse', () => {
    test('Parses valid L1 response', () => {
      const result = stepGateL1.parseResponse(VALID_L1_RESPONSE);
      expect(result.evaluations.length).toBe(2);
      expect(result.score).toBe(75);
      expect(result.gatePassed).toBe(true);
    });

    test('Handles empty response', () => {
      const result = stepGateL1.parseResponse('');
      expect(result.evaluations).toEqual([]);
      expect(result.score).toBe(0);
    });
  });

  describe('validate', () => {
    test('Valid output passes', () => {
      const output = stepGateL1.parseResponse(VALID_L1_RESPONSE);
      const result = stepGateL1.validate(output);
      expect(result.valid).toBe(true);
    });

    test('Empty evaluations fail', () => {
      const output = stepGateL1.parseResponse('');
      const result = stepGateL1.validate(output);
      expect(result.valid).toBe(false);
    });
  });

  describe('gateCheck — mode-specific thresholds', () => {
    test('Passes for conflict mode at 75% (threshold 60%)', () => {
      const state = createMockState('conflict');
      const output = stepGateL1.parseResponse(VALID_L1_RESPONSE);
      const result = stepGateL1.gateCheck(output, state);
      expect(result.passed).toBe(true);
      expect(result.threshold).toBe(DEFAULT_THRESHOLDS.conflict.L1);
    });

    test('Blocks for conflict mode at 50% (below 60%)', () => {
      const state = createMockState('conflict');
      const raw = JSON.stringify({
        evaluations: [{ id: 'L1_01', status: 'FAIL', evidence: null, functionalRole: null }],
        score: 50,
        gatePassed: false,
        fixList: [{ id: 'FIX-1', description: 'Fix needed', severity: 'critical', type: 'competence', recommendedApproach: 'radical' }],
      });
      const output = stepGateL1.parseResponse(raw);
      const result = stepGateL1.gateCheck(output, state);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('60');
    });

    test('Passes for kishō mode at 55% (threshold 50%)', () => {
      const state = createMockState('kishō');
      const raw = JSON.stringify({
        evaluations: [{ id: 'L1_01', status: 'PASS', evidence: 'OK', functionalRole: 'Механизм' }],
        score: 55,
        gatePassed: true,
        fixList: [],
      });
      const output = stepGateL1.parseResponse(raw);
      const result = stepGateL1.gateCheck(output, state);
      expect(result.passed).toBe(true);
      expect(result.threshold).toBe(DEFAULT_THRESHOLDS.kishō.L1);
    });

    test('Blocks for kishō mode at 45% (below 50%)', () => {
      const state = createMockState('kishō');
      const raw = JSON.stringify({
        evaluations: [{ id: 'L1_01', status: 'FAIL', evidence: null, functionalRole: null }],
        score: 45,
        gatePassed: false,
        fixList: [{ id: 'FIX-1', description: 'Fix', severity: 'critical', type: 'competence', recommendedApproach: 'compromise' }],
      });
      const output = stepGateL1.parseResponse(raw);
      const result = stepGateL1.gateCheck(output, state);
      expect(result.passed).toBe(false);
      expect(result.threshold).toBe(DEFAULT_THRESHOLDS.kishō.L1);
    });

    test('Provides fixes on failure', () => {
      const state = createMockState('conflict');
      const raw = JSON.stringify({
        evaluations: [{ id: 'L1_01', status: 'FAIL', evidence: null, functionalRole: null }],
        score: 30,
        gatePassed: false,
        fixList: [{ id: 'FIX-test', description: 'Необходимо доработать', severity: 'critical', type: 'competence', recommendedApproach: 'radical' }],
      });
      const output = stepGateL1.parseResponse(raw);
      const result = stepGateL1.gateCheck(output, state);
      expect(result.fixes).toBeDefined();
      expect(result.fixes!.length).toBeGreaterThan(0);
    });
  });

  describe('reduce — RULE_8: block-level breakdown', () => {
    test('Produces GateResult with breakdown', () => {
      const state = createMockState('conflict');
      const output = stepGateL1.parseResponse(VALID_L1_RESPONSE);
      const newState = stepGateL1.reduce(state, output);
      expect(newState.gateResults.L1).not.toBeNull();
      expect(newState.gateResults.L1!.metadata.breakdown).toBeDefined();
      expect(newState.gateResults.L1!.conditions.length).toBeGreaterThan(0);
    });
  });
});

// ===========================================================================
// Gate L2 Tests
// ===========================================================================

describe('stepGateL2 (Step 6: Gate L2 — Body)', () => {
  test('Has correct step ID', () => {
    expect(stepGateL2.id).toBe('L2_evaluation');
  });

  test('Has maxTokens of 4096', () => {
    expect(stepGateL2.maxTokens).toBe(4096);
  });

  describe('gateCheck', () => {
    test('Passes for conflict mode at 70% (threshold 60%)', () => {
      const state = createMockState('conflict');
      const output = stepGateL2.parseResponse(VALID_L2_RESPONSE);
      const result = stepGateL2.gateCheck(output, state);
      expect(result.passed).toBe(true);
    });

    test('Blocks for conflict mode at 55% (below 60%)', () => {
      const state = createMockState('conflict');
      const raw = JSON.stringify({
        evaluations: [{ id: 'L2_01', status: 'FAIL', evidence: null, functionalRole: null }],
        score: 55,
        gatePassed: false,
        fixList: [{ id: 'FIX-1', description: 'Fix', severity: 'major', type: 'competence', recommendedApproach: 'compromise' }],
      });
      const output = stepGateL2.parseResponse(raw);
      const result = stepGateL2.gateCheck(output, state);
      expect(result.passed).toBe(false);
    });
  });

  describe('reduce', () => {
    test('Stores L2 gate result in state', () => {
      const state = createMockState('conflict');
      const output = stepGateL2.parseResponse(VALID_L2_RESPONSE);
      const newState = stepGateL2.reduce(state, output);
      expect(newState.gateResults.L2).not.toBeNull();
      expect(newState.gateResults.L2!.score).toBe(70);
      expect(newState.gateResults.L2!.level).toBe('L2');
    });
  });
});

// ===========================================================================
// Gate L3 Tests (Grief HARD CHECK — RULE_3)
// ===========================================================================

describe('stepGateL3 (Step 7: Gate L3 — Psyche + Grief HARD CHECK)', () => {
  test('Has correct step ID', () => {
    expect(stepGateL3.id).toBe('L3_evaluation');
  });

  describe('parseResponse', () => {
    test('Parses valid L3 response with grief matrix', () => {
      const result = stepGateL3.parseResponse(VALID_L3_RESPONSE);
      expect(result.evaluations.length).toBe(1);
      expect(result.griefMatrix.dominantStage).toBe('depression');
      expect(result.griefMatrix.cells.length).toBe(3);
      expect(result.score).toBe(65);
    });

    test('Handles empty response', () => {
      const result = stepGateL3.parseResponse('');
      expect(result.evaluations).toEqual([]);
      expect(result.griefMatrix.dominantStage).toBe('depression'); // Default
    });
  });

  describe('gateCheck — Grief HARD CHECK (RULE_3)', () => {
    test('Passes when dominant stage has ≥2 levels AND score meets threshold', () => {
      const state = createMockState('conflict');
      const output = stepGateL3.parseResponse(VALID_L3_RESPONSE);
      const result = stepGateL3.gateCheck(output, state);
      // depression has 2 levels (character, location) → HARD CHECK passes
      // score 65 >= threshold 60 → score passes
      expect(result.passed).toBe(true);
    });

    test('BLOCKS when dominant stage has only 1 level (Grief HARD CHECK fail)', () => {
      const state = createMockState('conflict');
      const raw = JSON.stringify({
        evaluations: [{ id: 'L3_01', status: 'PASS', evidence: 'OK', functionalRole: 'Психика' }],
        griefMatrix: {
          dominantStage: 'anger',
          cells: [
            { stage: 'anger', level: 'character', confidence: 'high' },
            // Only 1 level for dominant stage → HARD FAIL
          ],
        },
        score: 80, // High score but HARD CHECK overrides
        gatePassed: true,
      });
      const output = stepGateL3.parseResponse(raw);
      const result = stepGateL3.gateCheck(output, state);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('HARD CHECK');
    });

    test('BLOCKS when score is below threshold (even with valid grief)', () => {
      const state = createMockState('conflict');
      const raw = JSON.stringify({
        evaluations: [{ id: 'L3_01', status: 'FAIL', evidence: null, functionalRole: null }],
        griefMatrix: {
          dominantStage: 'depression',
          cells: [
            { stage: 'depression', level: 'character', confidence: 'high' },
            { stage: 'depression', level: 'location', confidence: 'medium' },
          ],
        },
        score: 40, // Below conflict threshold of 60
        gatePassed: false,
      });
      const output = stepGateL3.parseResponse(raw);
      const result = stepGateL3.gateCheck(output, state);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('балл');
    });

    test('Grief HARD CHECK takes priority over score check', () => {
      // If HARD CHECK fails, it returns first regardless of score
      const state = createMockState('conflict');
      const raw = JSON.stringify({
        evaluations: [{ id: 'L3_01', status: 'PASS', evidence: 'OK', functionalRole: 'Психика' }],
        griefMatrix: {
          dominantStage: 'denial',
          cells: [
            { stage: 'denial', level: 'mechanic', confidence: 'absent' }, // absent = not counted
          ],
        },
        score: 90,
        gatePassed: true,
      });
      const output = stepGateL3.parseResponse(raw);
      const result = stepGateL3.gateCheck(output, state);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('HARD CHECK');
    });
  });

  describe('reduce — stores grief matrix', () => {
    test('Stores GateResult AND GriefArchitectureMatrix', () => {
      const state = createMockState('conflict');
      const output = stepGateL3.parseResponse(VALID_L3_RESPONSE);
      const newState = stepGateL3.reduce(state, output);
      expect(newState.gateResults.L3).not.toBeNull();
      expect(newState.griefMatrix).not.toBeNull();
      expect(newState.griefMatrix!.dominantStage).toBe('depression');
      expect(newState.griefMatrix!.cells.length).toBe(3);
    });
  });
});

// ===========================================================================
// Gate L4 Tests (Cult Potential merged — Section 0.8)
// ===========================================================================

describe('stepGateL4 (Step 8: Gate L4 — Meta + Cult Potential)', () => {
  test('Has correct step ID', () => {
    expect(stepGateL4.id).toBe('L4_evaluation');
  });

  describe('parseResponse', () => {
    test('Parses valid L4 response with all fields', () => {
      const result = stepGateL4.parseResponse(VALID_L4_RESPONSE);
      expect(result.evaluations.length).toBe(1);
      expect(result.score).toBe(72);
      expect(result.threeLayers.personal.stable).toBe(true);
      expect(result.cornelianDilemma.valid).toBe(true);
      expect(result.agentMirror.integrated).toBe(true);
      expect(result.cultPotential.score).toBe(70);
    });

    test('Handles empty response', () => {
      const result = stepGateL4.parseResponse('');
      expect(result.evaluations).toEqual([]);
      expect(result.threeLayers.personal.stable).toBe(false);
      expect(result.cornelianDilemma.valid).toBe(false);
      expect(result.agentMirror.integrated).toBe(false);
      expect(result.cultPotential.score).toBe(0);
    });
  });

  describe('gateCheck — Section 0.7 thresholds + Section 0.8 cult potential', () => {
    test('Passes for conflict mode at 72% (threshold 60%)', () => {
      const state = createMockState('conflict');
      const output = stepGateL4.parseResponse(VALID_L4_RESPONSE);
      const result = stepGateL4.gateCheck(output, state);
      expect(result.passed).toBe(true);
    });

    test('Blocks for conflict mode at 50% (below 60%)', () => {
      const state = createMockState('conflict');
      const raw = JSON.stringify({
        evaluations: [{ id: 'L4_01', status: 'FAIL', evidence: null, functionalRole: null }],
        threeLayers: { personal: { stable: false, proof: '' }, plot: { stable: false, proof: '' }, meta: { stable: false, proof: '' } },
        cornelianDilemma: { valid: false, valueA: '', valueB: '', irreversible: false, thirdPath: '' },
        agentMirror: { integrated: false, directQuestion: '' },
        cultPotential: { score: 30, criteria: [false, false] },
        score: 50,
        gatePassed: false,
      });
      const output = stepGateL4.parseResponse(raw);
      const result = stepGateL4.gateCheck(output, state);
      expect(result.passed).toBe(false);
    });

    test('Provides cult potential fix when score < 50', () => {
      const state = createMockState('conflict');
      const raw = JSON.stringify({
        evaluations: [{ id: 'L4_01', status: 'FAIL', evidence: null, functionalRole: null }],
        threeLayers: { personal: { stable: false, proof: '' }, plot: { stable: false, proof: '' }, meta: { stable: false, proof: '' } },
        cornelianDilemma: { valid: false, valueA: '', valueB: '', irreversible: false, thirdPath: '' },
        agentMirror: { integrated: false, directQuestion: '' },
        cultPotential: { score: 30, criteria: [] },
        score: 40,
        gatePassed: false,
      });
      const output = stepGateL4.parseResponse(raw);
      const result = stepGateL4.gateCheck(output, state);
      expect(result.fixes!.some(f => f.id === 'FIX-cult-potential')).toBe(true);
    });

    test('Provides cornelian dilemma fix when invalid', () => {
      const state = createMockState('conflict');
      const raw = JSON.stringify({
        evaluations: [{ id: 'L4_01', status: 'FAIL', evidence: null, functionalRole: null }],
        threeLayers: { personal: { stable: true, proof: '' }, plot: { stable: true, proof: '' }, meta: { stable: true, proof: '' } },
        cornelianDilemma: { valid: false, valueA: '', valueB: '', irreversible: false, thirdPath: '' },
        agentMirror: { integrated: true, directQuestion: '' },
        cultPotential: { score: 70, criteria: [true] },
        score: 40,
        gatePassed: false,
      });
      const output = stepGateL4.parseResponse(raw);
      const result = stepGateL4.gateCheck(output, state);
      expect(result.fixes!.some(f => f.id === 'FIX-cornelian-dilemma')).toBe(true);
    });
  });

  describe('reduce', () => {
    test('Stores L4 gate result with breakdown including cult potential', () => {
      const state = createMockState('conflict');
      const output = stepGateL4.parseResponse(VALID_L4_RESPONSE);
      const newState = stepGateL4.reduce(state, output);
      expect(newState.gateResults.L4).not.toBeNull();
      expect(newState.gateResults.L4!.metadata.breakdown).toBeDefined();
      expect(newState.gateResults.L4!.metadata.breakdown!['cultPotential']).toContain('70');
    });
  });
});

// Export for type checking
export {};
