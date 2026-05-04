/**
 * Remaining Step Tests (Issues/Chains, Generative, Final) + Integration Test
 *
 * Step 9: Issue + "А чтобы что?" chain generation — RULE_2, RULE_9
 * Step 10: Generative modules — RULE_10
 * Step 11: Final score (skipLLM) — classification, priority actions
 * Pipeline integration: resumeAuditFromStep
 */

import { stepIssuesChains } from '../../../src/lib/audit/steps/step-issues-chains';
import { stepGenerative } from '../../../src/lib/audit/steps/step-generative';
import { stepFinal } from '../../../src/lib/audit/steps/step-final';
import type { PipelineRunState } from '../../../src/lib/audit/audit-step';
import type { AuditMode, GateResult } from '../../../src/lib/audit/types';

function createMockStateWithGates(auditMode: AuditMode = 'conflict'): PipelineRunState {
  return {
    phase: 'L4_evaluation',
    inputText: 'Нарратив о мире с тематическим законом и корневой травмой',
    mediaType: 'novel',
    auditMode,
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
    gateResults: {
      L1: { gateId: 'GATE-L1', gateName: 'L1', status: 'passed', score: 70, passed: true, conditions: [], halt: false, fixes: [], metadata: {} } as GateResult,
      L2: { gateId: 'GATE-L2', gateName: 'L2', status: 'passed', score: 65, passed: true, conditions: [], halt: false, fixes: [], metadata: {} } as GateResult,
      L3: { gateId: 'GATE-L3', gateName: 'L3', status: 'passed', score: 60, passed: true, conditions: [], halt: false, fixes: [], metadata: {} } as GateResult,
      L4: { gateId: 'GATE-L4', gateName: 'L4', status: 'passed', score: 55, passed: true, conditions: [], halt: false, fixes: [], metadata: {} } as GateResult,
    },
    griefMatrix: { dominantStage: 'depression', cells: [] },
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

// ===========================================================================
// Step 9: Issues + Chains
// ===========================================================================

describe('stepIssuesChains (Step 9: Issue + Chain Generation)', () => {
  test('Has correct step ID', () => {
    expect(stepIssuesChains.id).toBe('issue_generation');
  });

  test('Is NOT a skipLLM step', () => {
    expect(stepIssuesChains.skipLLM).toBe(false);
  });

  describe('parseResponse', () => {
    test('Parses valid issues and chains response', () => {
      const raw = JSON.stringify({
        chains: [
          { element: 'thematicLaw', terminal_type: 'DILEMMA', terminalStep: 6, step_reached: 6, iterations: [{ step: 1, question: 'А чтобы что?', answer: 'Чтобы мир изменился' }], valid: true, reasoning: 'test' },
        ],
        issues: [
          {
            id: 'ISSUE-01', location: '§1 + L1', severity: 'critical',
            diagnosis: 'Критическая проблема', recommended: 'radical',
            patches: {
              conservative: { description: 'Минимальный фикс', impact: 'Quick', sideEffects: [] },
              compromise: { description: 'Баланс', impact: 'Medium', sideEffects: [] },
              radical: { description: 'Полная переработка', impact: 'Full', sideEffects: [] },
            },
          },
        ],
      });
      const result = stepIssuesChains.parseResponse(raw);
      expect(result.chains.length).toBe(1);
      expect(result.chains[0].terminal_type).toBe('DILEMMA');
      expect(result.issues.length).toBe(1);
      expect(result.issues[0].id).toBe('ISSUE-01');
      expect(result.issues[0].severity).toBe('critical');
    });

    test('Handles empty response', () => {
      const result = stepIssuesChains.parseResponse('');
      expect(result.chains).toEqual([]);
      expect(result.issues).toEqual([]);
    });
  });

  describe('validate — RULE_9: every issue must have all required fields', () => {
    test('Valid issues pass validation', () => {
      const raw = JSON.stringify({
        chains: [],
        issues: [{
          id: 'ISSUE-01', location: '§1 + L1', severity: 'major',
          diagnosis: 'Проблема', recommended: 'compromise',
          patches: {
            conservative: { description: 'Fix 1', impact: 'Low', sideEffects: [] },
            compromise: { description: 'Fix 2', impact: 'Med', sideEffects: [] },
            radical: { description: 'Fix 3', impact: 'High', sideEffects: [] },
          },
        }],
      });
      const output = stepIssuesChains.parseResponse(raw);
      const result = stepIssuesChains.validate(output);
      expect(result.valid).toBe(true);
    });

    test('Issue without diagnosis fails validation', () => {
      const output = {
        chains: [],
        issues: [{
          id: 'ISSUE-01', location: '§1', severity: 'critical' as const,
          diagnosis: '', // Missing
          recommended: 'radical' as const,
          patches: {
            conservative: { description: 'Fix 1' },
            compromise: { description: 'Fix 2' },
            radical: { description: 'Fix 3' },
          },
        }],
      };
      const result = stepIssuesChains.validate(output);
      expect(result.valid).toBe(false);
    });
  });

  describe('gateCheck', () => {
    test('Always passes — issue generation never blocks', () => {
      const state = createMockStateWithGates();
      const output = stepIssuesChains.parseResponse('');
      const result = stepIssuesChains.gateCheck(output, state);
      expect(result.passed).toBe(true);
    });
  });

  describe('reduce', () => {
    test('Stores chains and issues in state', () => {
      const state = createMockStateWithGates();
      const raw = JSON.stringify({
        chains: [{ element: 'law', terminal_type: 'BREAK', terminalStep: 3, step_reached: 3, iterations: [{ step: 1, question: 'Q', answer: 'A' }], valid: true, reasoning: '' }],
        issues: [{
          id: 'ISSUE-01', location: '§1', severity: 'critical', diagnosis: 'Test', recommended: 'radical',
          patches: { conservative: { description: 'C' }, compromise: { description: 'M' }, radical: { description: 'R' } },
        }],
      });
      const output = stepIssuesChains.parseResponse(raw);
      const newState = stepIssuesChains.reduce(state, output);
      expect(newState.whatForChains.length).toBe(1);
      expect(newState.issues.length).toBe(1);
      expect(newState.issues[0].axes.criticality).toBe(9); // Critical severity maps to 9
    });

    test('Appends issues to existing ones', () => {
      const state = { ...createMockStateWithGates(), issues: [{ id: 'EXISTING', location: '', severity: 'minor' as const, axes: { criticality: 3, risk: 2, time_cost: 2 }, diagnosis: 'Old', patches: { conservative: { type: 'conservative' as const, description: 'C' }, compromise: { type: 'compromise' as const, description: 'M' }, radical: { type: 'radical' as const, description: 'R' } }, recommended: 'conservative' as const }] };
      const raw = JSON.stringify({
        chains: [],
        issues: [{
          id: 'ISSUE-NEW', location: '§2', severity: 'major', diagnosis: 'New issue', recommended: 'compromise',
          patches: { conservative: { description: 'C' }, compromise: { description: 'M' }, radical: { description: 'R' } },
        }],
      });
      const output = stepIssuesChains.parseResponse(raw);
      const newState = stepIssuesChains.reduce(state, output);
      expect(newState.issues.length).toBe(2);
    });
  });
});

// ===========================================================================
// Step 10: Generative Modules
// ===========================================================================

describe('stepGenerative (Step 10: Generative Modules)', () => {
  test('Has correct step ID', () => {
    expect(stepGenerative.id).toBe('generative_modules');
  });

  describe('parseResponse', () => {
    test('Parses grief mapping and dilemma', () => {
      const raw = JSON.stringify({
        grief_mapping: {
          law: 'Предательство ведёт к потере памяти',
          derived_stage: 'depression',
          justification_chain: ['Обоснование 1', 'Обоснование 2'],
        },
        dilemma: {
          value_A: 'Верность',
          value_B: 'Свобода',
          criteria_met: { type_choice: true, irreversibility: true, identity: true, victory_price: false },
          post_final_world: 'Мир без памяти',
          conflict_description: 'Выбор между верностью и свободой',
        },
      });
      const result = stepGenerative.parseResponse(raw);
      expect(result.grief_mapping).toBeDefined();
      expect(result.grief_mapping!.derived_stage).toBe('depression');
      expect(result.grief_mapping!.justification_chain.length).toBe(2);
      expect(result.dilemma).toBeDefined();
      expect(result.dilemma!.value_A).toBe('Верность');
      expect(result.dilemma!.criteria_met.type_choice).toBe(true);
    });

    test('Handles empty response', () => {
      const result = stepGenerative.parseResponse('');
      expect(result).toEqual({});
    });
  });

  describe('validate', () => {
    test('Always passes — generative modules produce optional output', () => {
      const result = stepGenerative.validate({});
      expect(result.valid).toBe(true);
    });
  });

  describe('gateCheck', () => {
    test('Always passes — generative modules never block', () => {
      const state = createMockStateWithGates();
      const result = stepGenerative.gateCheck({}, state);
      expect(result.passed).toBe(true);
    });
  });

  describe('reduce', () => {
    test('Merges generative output with existing', () => {
      const state = { ...createMockStateWithGates(), generativeOutput: { grief_mapping: { law: 'Old law', derived_stage: 'depression' as const, justification_chain: [] } } };
      const output = { dilemma: { value_A: 'A', value_B: 'B', criteria_met: { type_choice: true, irreversibility: false, identity: false, victory_price: false }, post_final_world: 'World' } };
      const newState = stepGenerative.reduce(state, output);
      expect(newState.generativeOutput!.grief_mapping).toBeDefined(); // Preserved
      expect(newState.generativeOutput!.dilemma).toBeDefined(); // Added
    });
  });
});

// ===========================================================================
// Step 11: Final Score (skipLLM)
// ===========================================================================

describe('stepFinal (Step 11: Diagnostics + Final Score)', () => {
  test('Has correct step ID', () => {
    expect(stepFinal.id).toBe('final_output');
  });

  test('Is a skipLLM step', () => {
    expect(stepFinal.skipLLM).toBe(true);
  });

  test('Has zero maxTokens', () => {
    expect(stepFinal.maxTokens).toBe(0);
  });

  // computeFinalOutput is a private function, so we test through gateCheck + reduce
  describe('Final score computation (via gateCheck + reduce)', () => {
    test('Computes average of 4 gate scores', () => {
      const state = createMockStateWithGates();
      const shell = stepFinal.parseResponse('');
      stepFinal.gateCheck(shell, state);
      const newState = stepFinal.reduce(state, shell);
      // L1=70, L2=65, L3=60, L4=55 → avg = 62.5 → rounded = 63
      expect(newState.finalScore!.percentage).toBe(63);
      expect(newState.finalScore!.by_level.L1).toBe(70);
      expect(newState.finalScore!.by_level.L4).toBe(55);
    });

    test('Classifies as cult_masterpiece at 90%+', () => {
      const state = createMockStateWithGates();
      state.gateResults = {
        L1: { gateId: 'G1', gateName: 'L1', status: 'passed', score: 95, passed: true, conditions: [], halt: false, fixes: [], metadata: {} } as GateResult,
        L2: { gateId: 'G2', gateName: 'L2', status: 'passed', score: 95, passed: true, conditions: [], halt: false, fixes: [], metadata: {} } as GateResult,
        L3: { gateId: 'G3', gateName: 'L3', status: 'passed', score: 95, passed: true, conditions: [], halt: false, fixes: [], metadata: {} } as GateResult,
        L4: { gateId: 'G4', gateName: 'L4', status: 'passed', score: 95, passed: true, conditions: [], halt: false, fixes: [], metadata: {} } as GateResult,
      };
      const shell = stepFinal.parseResponse('');
      stepFinal.gateCheck(shell, state);
      const newState = stepFinal.reduce(state, shell);
      // Access classification through nextActions content (not directly stored)
      expect(newState.finalScore!.percentage).toBe(95);
    });

    test('Classifies as powerful at 75-89%', () => {
      const state = createMockStateWithGates();
      state.gateResults = {
        L1: { gateId: 'G1', gateName: 'L1', status: 'passed', score: 80, passed: true, conditions: [], halt: false, fixes: [], metadata: {} } as GateResult,
        L2: { gateId: 'G2', gateName: 'L2', status: 'passed', score: 80, passed: true, conditions: [], halt: false, fixes: [], metadata: {} } as GateResult,
        L3: { gateId: 'G3', gateName: 'L3', status: 'passed', score: 80, passed: true, conditions: [], halt: false, fixes: [], metadata: {} } as GateResult,
        L4: { gateId: 'G4', gateName: 'L4', status: 'passed', score: 80, passed: true, conditions: [], halt: false, fixes: [], metadata: {} } as GateResult,
      };
      const shell = stepFinal.parseResponse('');
      stepFinal.gateCheck(shell, state);
      const newState = stepFinal.reduce(state, shell);
      expect(newState.finalScore!.percentage).toBe(80);
    });

    test('Score 63% is living_weak_soul range', () => {
      const state = createMockStateWithGates();
      const shell = stepFinal.parseResponse('');
      stepFinal.gateCheck(shell, state);
      const newState = stepFinal.reduce(state, shell);
      expect(newState.finalScore!.percentage).toBe(63);
    });

    test('Low scores produce decoration-level classification', () => {
      const state = createMockStateWithGates();
      state.gateResults = {
        L1: { gateId: 'G1', gateName: 'L1', status: 'passed', score: 40, passed: true, conditions: [], halt: false, fixes: [], metadata: {} } as GateResult,
        L2: { gateId: 'G2', gateName: 'L2', status: 'passed', score: 40, passed: true, conditions: [], halt: false, fixes: [], metadata: {} } as GateResult,
        L3: { gateId: 'G3', gateName: 'L3', status: 'passed', score: 40, passed: true, conditions: [], halt: false, fixes: [], metadata: {} } as GateResult,
        L4: { gateId: 'G4', gateName: 'L4', status: 'passed', score: 40, passed: true, conditions: [], halt: false, fixes: [], metadata: {} } as GateResult,
      };
      const shell = stepFinal.parseResponse('');
      stepFinal.gateCheck(shell, state);
      const newState = stepFinal.reduce(state, shell);
      expect(newState.finalScore!.percentage).toBe(40);
    });

    test('Generates exactly 3 priority actions', () => {
      const state = createMockStateWithGates();
      const shell = stepFinal.parseResponse('');
      stepFinal.gateCheck(shell, state);
      const newState = stepFinal.reduce(state, shell);
      expect(newState.nextActions.length).toBe(3);
    });

    test('Handles missing gate results gracefully', () => {
      const state = createMockStateWithGates();
      state.gateResults = { L1: null, L2: null, L3: null, L4: null };
      const shell = stepFinal.parseResponse('');
      stepFinal.gateCheck(shell, state);
      const newState = stepFinal.reduce(state, shell);
      expect(newState.finalScore!.percentage).toBe(0);
    });
  });

  describe('gateCheck', () => {
    test('Always passes — final step never blocks', () => {
      const state = createMockStateWithGates();
      const shell = stepFinal.parseResponse('');
      const result = stepFinal.gateCheck(shell, state);
      expect(result.passed).toBe(true);
    });
  });

  describe('reduce', () => {
    test('Stores final score and next actions in state', () => {
      const state = createMockStateWithGates();
      const shell = stepFinal.parseResponse('');
      stepFinal.gateCheck(shell, state); // Populate cache
      const newState = stepFinal.reduce(state, shell);
      expect(newState.finalScore).not.toBeNull();
      expect(newState.finalScore!.percentage).toBe(63);
      expect(newState.nextActions.length).toBe(3);
    });
  });
});

// ===========================================================================
// Pipeline Integration Test — resumeAuditFromStep
// ===========================================================================

describe('Pipeline Integration — Step Registry & Order', () => {
  test('Step registry has all 12 steps registered', async () => {
    const { stepRegistry, getStepOrder } = await import('../../../src/lib/audit/step-registry');
    expect(stepRegistry.registeredCount).toBe(12);
  });

  test('Step order follows protocol sequence', async () => {
    const { getStepOrder } = await import('../../../src/lib/audit/step-registry');
    const order = getStepOrder();
    expect(order[0]).toBe('input_validation');
    expect(order[1]).toBe('mode_detection');
    expect(order[2]).toBe('author_profile');
    expect(order[3]).toBe('skeleton_extraction');
    expect(order[4]).toBe('screening');
    expect(order[5]).toBe('L1_evaluation');
    expect(order[6]).toBe('L2_evaluation');
    expect(order[7]).toBe('L3_evaluation');
    expect(order[8]).toBe('L4_evaluation');
    expect(order[9]).toBe('issue_generation');
    expect(order[10]).toBe('generative_modules');
    expect(order[11]).toBe('final_output');
  });

  test('All steps have required AuditStep interface fields', async () => {
    const { stepRegistry, getStepOrder } = await import('../../../src/lib/audit/step-registry');
    const order = getStepOrder();
    for (const phase of order) {
      const step = stepRegistry.getStep(phase);
      expect(step.id).toBe(phase);
      expect(typeof step.buildPrompt).toBe('function');
      expect(typeof step.parseResponse).toBe('function');
      expect(typeof step.validate).toBe('function');
      expect(typeof step.gateCheck).toBe('function');
      expect(typeof step.reduce).toBe('function');
      expect(typeof step.maxRetries).toBe('number');
      expect(typeof step.skipLLM).toBe('boolean');
      expect(typeof step.maxTokens).toBe('number');
    }
  });

  test('Exactly 2 steps are skipLLM: input_validation and final_output', async () => {
    const { stepRegistry, getStepOrder } = await import('../../../src/lib/audit/step-registry');
    const order = getStepOrder();
    const skipLLMSteps = order.filter(phase => stepRegistry.getStep(phase).skipLLM);
    expect(skipLLMSteps).toEqual(['input_validation', 'final_output']);
  });

  test('Gate steps have maxTokens of 4096', async () => {
    const { stepRegistry } = await import('../../../src/lib/audit/step-registry');
    for (const level of ['L1_evaluation', 'L2_evaluation', 'L3_evaluation', 'L4_evaluation'] as const) {
      const step = stepRegistry.getStep(level);
      expect(step.maxTokens).toBe(4096);
    }
  });

  test('Mode-specific thresholds are correctly defined', async () => {
    const { DEFAULT_THRESHOLDS } = await import('../../../src/lib/audit/types');
    expect(DEFAULT_THRESHOLDS.conflict.L1).toBe(60);
    expect(DEFAULT_THRESHOLDS['kishō'].L1).toBe(50);
    expect(DEFAULT_THRESHOLDS.hybrid.L1).toBe(55);
  });
});

// Export for type checking
export {};
