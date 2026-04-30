/**
 * UNIVERSE AUDIT PROTOCOL v10.0 - Gate Executor Tests
 * 
 * Tests for RULE_5: If any gate fails: STOP. Output fixes for that level ONLY.
 * Tests for RULE_8: Gate output MUST include block-level breakdown.
 */

import { executeGate, validatePrerequisites, GATE_DEFINITIONS } from '../src/lib/audit/gate-executor';

describe('Gate Executor', () => {
  describe('executeGate', () => {
    test('Gate fails with low score validators', () => {
      const validators = [
        () => ({ passed: false, score: 30, message: 'First check failed' }),
        () => ({ passed: false, score: 40, message: 'Second check failed' }),
      ];

      const result = executeGate('GATE_0', {}, validators);

      expect(result.halt).toBe(true);
      expect(result.status).toBe('failed');
      expect(result.fixes).toBeDefined();
      expect(result.fixes.length).toBeGreaterThan(0);
    });

    test('Gate passes with high score validators', () => {
      const validators = [
        () => ({ passed: true, score: 100, message: 'First check passed' }),
        () => ({ passed: true, score: 100, message: 'Second check passed' }),
      ];

      const result = executeGate('GATE_0', {}, validators);

      expect(result.halt).toBe(false);
      expect(result.status).toBe('passed');
    });

    test('Gate includes condition breakdown', () => {
      const validators = [
        () => ({ passed: true, score: 100, message: 'Structure check' }),
        () => ({ passed: false, score: 50, message: 'Coherence check failed' }),
        () => ({ passed: true, score: 100, message: 'Economy check' }),
      ];

      const result = executeGate('GATE_0', {}, validators);

      expect(result.conditions).toBeDefined();
      expect(result.conditions.length).toBe(3);
    });

    test('Gate failure outputs fixes for that level ONLY (RULE_5)', () => {
      const validators = [
        () => ({ passed: false, score: 20, message: 'Critical failure' }),
        () => ({ passed: false, score: 30, message: 'Secondary failure' }),
      ];

      const result = executeGate('GATE_0', {}, validators);

      expect(result.halt).toBe(true);
      expect(result.fixes.length).toBeGreaterThan(0);
      // Fixes should be related to the gate that failed
      expect(result.fixes.some(fix => 
        fix.includes('GATE-0') || fix.includes('Input Validation') || fix.includes('required')
      )).toBe(true);
    });

    test('Invalid gate ID returns failed result', () => {
      const result = executeGate('INVALID_GATE', {}, []);

      expect(result.status).toBe('failed');
      expect(result.halt).toBe(true);
      expect(result.fixes).toContain('Неверный идентификатор гейта');
    });

    test('Non-halting gate does not halt on failure', () => {
      const validators = [
        () => ({ passed: false, score: 30, message: 'Check failed' }),
      ];

      // GATE_2 has haltOnFailure: false
      const result = executeGate('GATE_2', {}, validators);

      expect(result.status).toBe('failed');
      expect(result.halt).toBe(false);
    });
  });

  describe('validatePrerequisites', () => {
    test('Returns valid for first gate with no previous gates', () => {
      const result = validatePrerequisites('GATE-0', []);
      expect(result.canProceed).toBe(true);
    });

    test('Returns invalid when previous gate failed with halt', () => {
      const previousGates = [
        {
          gateId: 'GATE-0',
          gateName: 'Input Validation',
          status: 'failed' as const,
          score: 30,
          conditions: [],
          halt: true,
          fixes: ['Fix input'],
          metadata: {}
        }
      ];

      const result = validatePrerequisites('GATE-1', previousGates);
      expect(result.canProceed).toBe(false);
    });

    test('Returns valid when all previous gates passed', () => {
      const previousGates = [
        {
          gateId: 'GATE-0',
          gateName: 'Input Validation',
          status: 'passed' as const,
          score: 100,
          conditions: [],
          halt: false,
          fixes: [],
          metadata: {}
        }
      ];

      const result = validatePrerequisites('GATE-1', previousGates);
      expect(result.canProceed).toBe(true);
    });
  });

  describe('GATE_DEFINITIONS', () => {
    test('All gates have required properties', () => {
      for (const key of Object.keys(GATE_DEFINITIONS)) {
        const gate = GATE_DEFINITIONS[key as keyof typeof GATE_DEFINITIONS];
        expect(gate.id).toBeDefined();
        expect(gate.name).toBeDefined();
        expect(gate.level).toBeDefined();
        expect(gate.description).toBeDefined();
      }
    });

    test('GATE_6 (Grief Architecture) has haltOnFailure = true', () => {
      expect(GATE_DEFINITIONS.GATE_6.haltOnFailure).toBe(true);
    });
  });
});

// Export for type checking
export {};
