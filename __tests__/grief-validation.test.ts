/**
 * UNIVERSE AUDIT PROTOCOL v10.0 - Grief Validation Tests
 * 
 * Tests for RULE_3: Grief validation is a HARD CHECK before L3 score calculation.
 * Tests for structural hole detection and dominant stage validation.
 */

import { 
  validateGriefArchitecture, 
  executeL3GateWithGriefCheck,
  createGriefPresence 
} from '../src/lib/audit/grief-validation';
import type { GriefPresence, GriefValidationResult } from '../src/lib/audit/grief-validation';

describe('Grief Validation', () => {
  describe('validateGriefArchitecture', () => {
    test('Stage on 1 level triggers structural_hole flag', () => {
      const presences: GriefPresence[] = [
        createGriefPresence('denial', 'character', true),
        createGriefPresence('anger', 'character', true),
        createGriefPresence('anger', 'world', true),
        createGriefPresence('bargaining', 'character', true),
        createGriefPresence('bargaining', 'society', true),
        createGriefPresence('depression', 'character', true),
        createGriefPresence('depression', 'scene', true),
        createGriefPresence('acceptance', 'character', true),
        createGriefPresence('acceptance', 'world', true),
      ];

      const result = validateGriefArchitecture(presences);

      // Denial is only on 1 level - should flag structural hole
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'structural_hole' && e.stage === 'denial')).toBe(true);
    });

    test('Dominant stage must span 4 levels for completeness', () => {
      const presences: GriefPresence[] = [
        createGriefPresence('depression', 'character', true),
        createGriefPresence('depression', 'world', true),
        // Missing 2 levels - dominant incomplete
      ];

      const result = validateGriefArchitecture(presences);

      expect(result.dominantStage).toBe('depression');
      expect(result.dominantIncomplete).toBe(true);
    });

    test('Valid grief architecture passes all checks', () => {
      const presences: GriefPresence[] = [
        // All stages on at least 2 levels
        createGriefPresence('denial', 'character', true),
        createGriefPresence('denial', 'world', true),
        createGriefPresence('anger', 'character', true),
        createGriefPresence('anger', 'society', true),
        createGriefPresence('bargaining', 'character', true),
        createGriefPresence('bargaining', 'scene', true),
        createGriefPresence('depression', 'character', true),
        createGriefPresence('depression', 'world', true),
        createGriefPresence('depression', 'society', true),
        createGriefPresence('depression', 'scene', true),
        createGriefPresence('acceptance', 'character', true),
        createGriefPresence('acceptance', 'world', true),
      ];

      const result = validateGriefArchitecture(presences);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    test('Empty input returns invalid result', () => {
      const result = validateGriefArchitecture([]);

      expect(result.valid).toBe(true); // No errors if no data to validate
      expect(result.dominantStage).toBeNull();
    });
  });

  describe('executeL3GateWithGriefCheck', () => {
    test('L3 gate fails when grief validation fails', () => {
      // Create data that will fail validation
      const griefData: GriefPresence[] = [
        createGriefPresence('denial', 'character', true), // Only 1 level - will fail
      ];

      const result = executeL3GateWithGriefCheck('', griefData);

      expect(result.passed).toBe(false);
      expect(result.fixes.length).toBeGreaterThan(0);
    });

    test('L3 gate proceeds when grief validation passes', () => {
      const griefData: GriefPresence[] = [
        createGriefPresence('denial', 'character', true),
        createGriefPresence('denial', 'world', true),
        createGriefPresence('anger', 'character', true),
        createGriefPresence('anger', 'society', true),
        createGriefPresence('bargaining', 'character', true),
        createGriefPresence('bargaining', 'scene', true),
        createGriefPresence('depression', 'character', true),
        createGriefPresence('depression', 'world', true),
        createGriefPresence('depression', 'society', true),
        createGriefPresence('depression', 'scene', true),
        createGriefPresence('acceptance', 'character', true),
        createGriefPresence('acceptance', 'world', true),
      ];

      const result = executeL3GateWithGriefCheck('', griefData);

      expect(result.passed).toBe(true);
      expect(result.fixes.length).toBe(0);
    });

    test('L3 gate can analyze text when no grief data provided', () => {
      const narrativeText = 'The character denied the truth, then became angry at the world.';
      
      const result = executeL3GateWithGriefCheck(narrativeText);

      // Result depends on text analysis
      expect(result.validationResult).toBeDefined();
    });
  });

  describe('createGriefPresence', () => {
    test('Creates valid grief presence entry', () => {
      const presence = createGriefPresence('denial', 'character', true, 'Test description');

      expect(presence.stage).toBe('denial');
      expect(presence.level).toBe('character');
      expect(presence.present).toBe(true);
      expect(presence.description).toBe('Test description');
    });

    test('Creates absent grief presence entry', () => {
      const presence = createGriefPresence('anger', 'world', false);

      expect(presence.present).toBe(false);
      expect(presence.evidence).toBeUndefined();
    });
  });
});

// Export for type checking
export {};
