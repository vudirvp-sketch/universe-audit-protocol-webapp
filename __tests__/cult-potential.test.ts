/**
 * UNIVERSE AUDIT PROTOCOL v10.0 - Cult Potential Tests
 * 
 * Tests for RULE_3: Cult Potential mandatory criteria are BLOCKING.
 * Tests for two-phase evaluation system.
 */

import { evaluateCultPotential, CULT_CRITERIA, quickCultCheck } from '../src/lib/audit/cult-potential';
import type { CultEvaluationInput } from '../src/lib/audit/cult-potential';

describe('Cult Potential Two-Phase Evaluation', () => {
  describe('evaluateCultPotential', () => {
    test('Mandatory criteria failure blocks regardless of score', () => {
      const input: CultEvaluationInput = {
        hasRootTrauma: false, // This will fail C1
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

      // Phase 1 should fail because hasRootTrauma is false
      expect(result.phase1Result.passed).toBe(false);
      expect(result.passed).toBe(false);
      expect(result.classification).toBe('cult_failed');
    });

    test('High score but mandatory failure still blocks', () => {
      const input: CultEvaluationInput = {
        hasRootTrauma: true,
        rootTraumaDepth: 0.9,
        ideologicalSystem: false, // This will fail C1
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

      // Check if C1 failed
      const c1Result = result.phase1Result.criteria.find(c => c.id === 'C1');
      expect(c1Result?.passed).toBe(false);
      expect(result.passed).toBe(false);
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

      expect(result.phase1Result.passed).toBe(true);
      expect(result.phase2Result.percentage).toBeGreaterThan(70);
      expect(result.classification).not.toBe('cult_failed');
    });

    test('Phase 2 score threshold works correctly', () => {
      const input: CultEvaluationInput = {
        hasRootTrauma: true,
        rootTraumaDepth: 0.9,
        ideologicalSystem: true,
        hasThematicLaw: true,
        thematicLawIntegration: 0.9,
        themeUniversality: true,
        characterComplexity: 0.5, // Below threshold
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

      // Phase 1 should pass
      expect(result.phase1Result.passed).toBe(true);
      // Phase 2 should have low score
      expect(result.phase2Result.score).toBeLessThan(8);
      expect(result.phase2Result.passed).toBe(false);
    });

    test('CULT_CRITERIA contains mandatory and optional criteria', () => {
      expect(CULT_CRITERIA).toBeDefined();
      expect(CULT_CRITERIA.length).toBeGreaterThan(0);
      
      const mandatory = CULT_CRITERIA.filter(c => c.mandatory);
      expect(mandatory.length).toBeGreaterThan(0);
      
      const optional = CULT_CRITERIA.filter(c => !c.mandatory);
      expect(optional.length).toBeGreaterThan(0);
    });
  });

  describe('quickCultCheck', () => {
    test('Returns false when root trauma missing', () => {
      const result = quickCultCheck({
        hasRootTrauma: false,
        hasThematicLaw: true
      });

      expect(result.likely).toBe(false);
      expect(result.confidence).toBe(1.0);
    });

    test('Returns false when thematic law missing', () => {
      const result = quickCultCheck({
        hasRootTrauma: true,
        hasThematicLaw: false
      });

      expect(result.likely).toBe(false);
    });

    test('Returns possible when both mandatory criteria present', () => {
      const result = quickCultCheck({
        hasRootTrauma: true,
        hasThematicLaw: true
      });

      expect(result.likely).toBe(true);
    });
  });
});

// Export for type checking
export {};
