/**
 * UNIVERSE AUDIT PROTOCOL v10.0 - Grief Validation Tests
 * 
 * Tests for RULE_3: Grief validation is a HARD CHECK before L3 score calculation.
 * Tests for structural hole detection and dominant stage validation.
 */

import { validateGriefArchitecture, executeL3GateWithGriefCheck } from '../src/lib/audit/grief-validation';
import type { GriefPresence, GriefValidationResult } from '../src/lib/audit/types';

describe('Grief Validation', () => {
  describe('validateGriefArchitecture', () => {
    test('Stage on 1 level triggers structural_hole flag', () => {
      const presences: GriefPresence[] = [
        { stage: 'denial', level: 'character', present: true },
        { stage: 'anger', level: 'character', present: true },
        { stage: 'anger', level: 'location', present: true },
        { stage: 'bargaining', level: 'character', present: true },
        { stage: 'bargaining', level: 'mechanic', present: true },
        { stage: 'depression', level: 'character', present: true },
        { stage: 'depression', level: 'location', present: true },
        { stage: 'acceptance', level: 'character', present: true },
        { stage: 'acceptance', level: 'act', present: true },
      ];

      const result = validateGriefArchitecture(presences, 'anger');

      // Denial is only on 1 level - should flag structural hole
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code.includes('structural_hole') || e.stage === 'denial')).toBe(true);
    });

    test('Dominant stage must span 4 levels', () => {
      const presences: GriefPresence[] = [
        { stage: 'depression', level: 'character', present: true },
        { stage: 'depression', level: 'location', present: true },
        // Missing 2 levels - dominant incomplete
      ];

      const result = validateGriefArchitecture(presences, 'depression');

      expect(result.dominantIncomplete).toBe(true);
    });

    test('Valid grief architecture passes all checks', () => {
      const presences: GriefPresence[] = [
        // All stages on at least 2 levels
        { stage: 'denial', level: 'character', present: true },
        { stage: 'denial', level: 'location', present: true },
        { stage: 'anger', level: 'character', present: true },
        { stage: 'anger', level: 'mechanic', present: true },
        { stage: 'bargaining', level: 'character', present: true },
        { stage: 'bargaining', level: 'act', present: true },
        { stage: 'depression', level: 'character', present: true },
        { stage: 'depression', level: 'location', present: true },
        { stage: 'depression', level: 'mechanic', present: true },
        { stage: 'depression', level: 'act', present: true },
        { stage: 'acceptance', level: 'character', present: true },
        { stage: 'acceptance', level: 'location', present: true },
      ];

      const result = validateGriefArchitecture(presences, 'depression');

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });
  });

  describe('executeL3GateWithGriefCheck', () => {
    test('L3 gate fails when grief validation fails', () => {
      const griefResult: GriefValidationResult = {
        valid: false,
        dominantStage: 'depression',
        stageDistribution: {} as any,
        errors: [
          { code: 'structural_hole', message: 'Denial stage missing on multiple levels', stage: 'denial' }
        ],
        warnings: [],
        structuralHoles: [],
        dominantIncomplete: false
      };

      const result = executeL3GateWithGriefCheck([], griefResult);

      expect(result.halt).toBe(true);
      expect(result.status).toBe('failed');
      expect(result.score).toBe(0);
    });

    test('L3 gate proceeds when grief validation passes', () => {
      const griefResult: GriefValidationResult = {
        valid: true,
        dominantStage: 'depression',
        stageDistribution: {} as any,
        errors: [],
        warnings: [],
        structuralHoles: [],
        dominantIncomplete: false
      };

      const sections = [
        { id: 'A', passed: true, passed_count: 7, total_count: 7 },
        { id: 'B', passed: true, passed_count: 8, total_count: 8 },
      ];

      const result = executeL3GateWithGriefCheck(sections, griefResult);

      expect(result.status).toBe('passed');
    });
  });
});

// Export for type checking
export {};
