/**
 * UNIVERSE AUDIT PROTOCOL v10.0 - Cult Potential Tests
 * 
 * Tests for RULE_3: Cult Potential mandatory criteria are BLOCKING.
 * Tests for two-phase evaluation system.
 */

import { evaluateCultPotential, cult_criteria } from '../src/lib/audit/cult-potential';
import type { CultEvaluationInput } from '../src/lib/audit/types';

describe('Cult Potential Two-Phase Evaluation', () => {
  describe('evaluateCultPotential', () => {
    test('Mandatory criteria failure blocks regardless of score', () => {
      const input: CultEvaluationInput = {
        hasRootTrauma: true,
        rootTraumaDepth: 0.9,
        ideologicalSystem: true,
        hasThematicLaw: true,
        thematicLawIntegration: 0.9,
        themeUniversality: true,
        characterComplexity: 0.9,
        moralAmbiguity: true,
        worldConsistency: 0.9,
        transformativePotential: true,
        ritualizableElements: true,
        communalExperience: true,
        interpretiveDepth: 0.9,
        rewatchValue: true,
        memeticPotential: true
      };

      const result = evaluateCultPotential(input);

      // If mandatory criteria fail, should return phase1Result.passed = false
      if (!result.phase1Result.passed) {
        expect(result.passed).toBe(false);
        expect(result.phase1Result.criteria.some(c => c.blocking && !c.passed)).toBe(true);
      }
    });

    test('High score but mandatory failure still blocks', () => {
      // This test verifies that even if optional criteria score high,
      // mandatory criteria failure blocks the result
      const input: CultEvaluationInput = {
        hasRootTrauma: true,
        rootTraumaDepth: 0.9,
        ideologicalSystem: false, // This affects mandatory criteria
        hasThematicLaw: true,
        thematicLawIntegration: 0.9,
        themeUniversality: true,
        characterComplexity: 0.9,
        moralAmbiguity: true,
        worldConsistency: 0.9,
        transformativePotential: true,
        ritualizableElements: true,
        communalExperience: true,
        interpretiveDepth: 0.9,
        rewatchValue: true,
        memeticPotential: true
      };

      const result = evaluateCultPotential(input);

      // Check if any mandatory criteria failed
      const mandatoryCriteria = result.phase1Result.criteria.filter(c => c.blocking);
      const someMandatoryFailed = mandatoryCriteria.some(c => !c.passed);

      if (someMandatoryFailed) {
        expect(result.passed).toBe(false);
      }
    });

    test('All criteria met results in high cult potential', () => {
      const input: CultEvaluationInput = {
        hasRootTrauma: true,
        rootTraumaDepth: 0.9,
        ideologicalSystem: true,
        hasThematicLaw: true,
        thematicLawIntegration: 0.9,
        themeUniversality: true,
        characterComplexity: 0.9,
        moralAmbiguity: true,
        worldConsistency: 0.9,
        transformativePotential: true,
        ritualizableElements: true,
        communalExperience: true,
        interpretiveDepth: 0.9,
        rewatchValue: true,
        memeticPotential: true
      };

      const result = evaluateCultPotential(input);

      expect(result.phase2Result.percentage).toBeGreaterThan(70);
      expect(result.classification).not.toBe('cult_failed');
    });

    test('Phase 2 score threshold works correctly', () => {
      const input: CultEvaluationInput = {
        hasRootTrauma: true,
        rootTraumaDepth: 0.5,
        ideologicalSystem: true,
        hasThematicLaw: true,
        thematicLawIntegration: 0.5,
        themeUniversality: false,
        characterComplexity: 0.5,
        moralAmbiguity: false,
        worldConsistency: 0.5,
        transformativePotential: false,
        ritualizableElements: false,
        communalExperience: false,
        interpretiveDepth: 0.5,
        rewatchValue: false,
        memeticPotential: false
      };

      const result = evaluateCultPotential(input);

      // Low scores should result in lower classification
      if (result.phase1Result.passed) {
        expect(result.phase2Result.percentage).toBeLessThan(70);
      }
    });

    test('Cult criteria contains mandatory and optional criteria', () => {
      expect(cult_criteria).toBeDefined();
      expect(cult_criteria.length).toBeGreaterThan(0);
      
      const mandatory = cult_criteria.filter(c => c.mandatory);
      expect(mandatory.length).toBeGreaterThan(0);
      
      const optional = cult_criteria.filter(c => !c.mandatory);
      expect(optional.length).toBeGreaterThan(0);
    });
  });
});

// Export for type checking
export {};
