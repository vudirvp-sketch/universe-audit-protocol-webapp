/**
 * UNIVERSE AUDIT PROTOCOL v10.0 - Gate Executor Tests
 * 
 * Tests for RULE_5: If any gate fails: STOP. Output fixes for that level ONLY.
 * Tests for RULE_8: Gate output MUST include block-level breakdown.
 */

import { executeGate, validatePrerequisites } from '../src/lib/audit/gate-executor';

describe('Gate Executor', () => {
  describe('executeGate', () => {
    test('L1 gate halts on score < 60%', () => {
      const sections = [
        { id: 'A', passed: false, passed_count: 2, total_count: 7 },
        { id: 'B', passed: false, passed_count: 3, total_count: 8 },
      ];

      const result = executeGate('L1', sections, 60);

      expect(result.halt).toBe(true);
      expect(result.status).toBe('failed');
      expect(result.fixes).toBeDefined();
      expect(result.fixes!.length).toBeGreaterThan(0);
    });

    test('L1 gate proceeds on score >= 60%', () => {
      const sections = [
        { id: 'A', passed: true, passed_count: 7, total_count: 7 },
        { id: 'B', passed: true, passed_count: 8, total_count: 8 },
      ];

      const result = executeGate('L1', sections, 60);

      expect(result.halt).toBe(false);
      expect(result.status).toBe('passed');
    });

    test('Gate output includes block-level breakdown (RULE_8)', () => {
      const sections = [
        { id: 'A_structure', passed: true, passed_count: 7, total_count: 7 },
        { id: 'B_coherence', passed: false, passed_count: 3, total_count: 8 },
        { id: 'C_economy', passed: true, passed_count: 5, total_count: 5 },
      ];

      const result = executeGate('L1', sections, 60);

      expect(result.metadata.breakdown).toBeDefined();
      expect(Object.keys(result.metadata.breakdown!).length).toBe(3);
      expect(result.metadata.breakdown!['A_structure']).toBe('7/7');
      expect(result.metadata.breakdown!['B_coherence']).toBe('3/8');
    });

    test('Gate failure outputs fixes for that level ONLY (RULE_5)', () => {
      const sections = [
        { id: 'A', passed: false, passed_count: 2, total_count: 7 },
        { id: 'B', passed: false, passed_count: 1, total_count: 8 },
      ];

      const result = executeGate('L1', sections, 60);

      expect(result.halt).toBe(true);
      expect(result.fixes!.every(fix => 
        fix.includes('L1') || fix.includes('Section') || fix.includes('criteria')
      )).toBe(true);
    });
  });

  describe('validatePrerequisites', () => {
    test('Returns invalid when no gate ID provided', () => {
      const result = validatePrerequisites('', []);
      expect(result.canProceed).toBe(false);
    });

    test('Returns valid when prerequisites met', () => {
      const result = validatePrerequisites('GATE-1', []);
      expect(result.canProceed).toBe(true);
    });
  });
});

// Export for type checking
export {};
