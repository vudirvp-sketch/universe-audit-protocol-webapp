/**
 * UNIVERSE AUDIT PROTOCOL v10.0 - Issue Schema Tests
 * 
 * Tests for RULE_9: ISSUE objects missing ANY field = invalid. Regenerate.
 */

import { validateIssue, createIssue } from '../src/lib/audit/issue-schema';
import type { Issue, Axes } from '../src/lib/audit/types';

describe('Issue Schema Validation', () => {
  const validAxes: Axes = { criticality: 7, risk: 5, time_cost: 4 };
  
  const validPatches = {
    conservative: { 
      type: 'conservative' as const,
      description: 'Minimal fix', 
      impact: 'Quick resolution',
      risks: ['Minor risk'],
      tests: ['Verify fix works'],
      sideEffects: []
    },
    compromise: { 
      type: 'compromise' as const,
      description: 'Balanced fix', 
      impact: 'Moderate improvement',
      risks: ['Moderate risk'],
      tests: ['Verify balance'],
      sideEffects: ['Related changes needed']
    },
    radical: { 
      type: 'radical' as const,
      description: 'Complete restructure', 
      impact: 'Full resolution',
      risks: ['Major risk', 'Breaking changes'],
      tests: ['Full regression test'],
      sideEffects: ['Wide-ranging impact']
    }
  };

  describe('validateIssue', () => {
    test('Complete issue passes validation', () => {
      const validIssue: Issue = {
        id: 'ISSUE-01',
        location: '§1.1 + L1',
        severity: 'critical',
        axes: validAxes,
        diagnosis: 'Critical structural issue detected',
        patches: validPatches,
        recommended: 'compromise'
      };

      const result = validateIssue(validIssue);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('ISSUE-01');
      expect(result?.valid).toBe(true);
    });

    test('Issue missing id field is invalid', () => {
      const invalidIssue = {
        location: '§1.1 + L1',
        severity: 'critical',
        axes: validAxes,
        diagnosis: 'Test',
        patches: validPatches,
        recommended: 'conservative'
      } as Issue;

      const result = validateIssue(invalidIssue);

      expect(result).toBeNull();
    });

    test('Issue missing location field is invalid', () => {
      const invalidIssue = {
        id: 'ISSUE-01',
        severity: 'critical',
        axes: validAxes,
        diagnosis: 'Test',
        patches: validPatches,
        recommended: 'conservative'
      } as Issue;

      const result = validateIssue(invalidIssue);

      expect(result).toBeNull();
    });

    test('Issue missing diagnosis field is invalid', () => {
      const invalidIssue = {
        id: 'ISSUE-01',
        location: '§1.1 + L1',
        severity: 'critical',
        axes: validAxes,
        patches: validPatches,
        recommended: 'conservative'
      } as Issue;

      const result = validateIssue(invalidIssue);

      expect(result).toBeNull();
    });

    test('Issue missing axes is invalid', () => {
      const invalidIssue = {
        id: 'ISSUE-01',
        location: '§1.1 + L1',
        severity: 'critical',
        diagnosis: 'Test',
        patches: validPatches,
        recommended: 'conservative'
      } as Issue;

      const result = validateIssue(invalidIssue);

      expect(result).toBeNull();
    });

    test('Issue missing patches is invalid', () => {
      const invalidIssue = {
        id: 'ISSUE-01',
        location: '§1.1 + L1',
        severity: 'critical',
        axes: validAxes,
        diagnosis: 'Test',
        recommended: 'conservative'
      } as Issue;

      const result = validateIssue(invalidIssue);

      expect(result).toBeNull();
    });

    test('Issue missing conservative patch is invalid', () => {
      const invalidIssue: Issue = {
        id: 'ISSUE-01',
        location: '§1.1 + L1',
        severity: 'critical',
        axes: validAxes,
        diagnosis: 'Test',
        patches: {
          conservative: validPatches.conservative,
          compromise: validPatches.compromise,
          // Missing radical patch
        } as any,
        recommended: 'conservative'
      };

      const result = validateIssue(invalidIssue);

      expect(result).toBeNull();
    });

    test('Issue missing recommended field is invalid', () => {
      const invalidIssue = {
        id: 'ISSUE-01',
        location: '§1.1 + L1',
        severity: 'critical',
        axes: validAxes,
        diagnosis: 'Test',
        patches: validPatches
      } as Issue;

      const result = validateIssue(invalidIssue);

      expect(result).toBeNull();
    });

    test('Issue with invalid severity is handled', () => {
      const invalidIssue: Issue = {
        id: 'ISSUE-01',
        location: '§1.1 + L1',
        severity: 'invalid' as any,
        axes: validAxes,
        diagnosis: 'Test',
        patches: validPatches,
        recommended: 'conservative'
      };

      const result = validateIssue(invalidIssue);

      // Should either fail or normalize the severity
      expect(result?.valid || result === null).toBe(true);
    });
  });

  describe('createIssue', () => {
    test('Creates valid issue from partial input', () => {
      const partialInput = {
        id: 'ISSUE-TEST',
        location: '§2.1 + L2',
        severity: 'major' as const,
        axes: { criticality: 5, risk: 4, time_cost: 3 },
        diagnosis: 'Test diagnosis',
        patches: validPatches
      };

      const result = createIssue(partialInput);

      expect(result).toBeDefined();
      expect(result.id).toBe('ISSUE-TEST');
      expect(result.recommended).toBeDefined();
    });

    test('Generates default values for missing optional fields', () => {
      const minimalInput = {
        id: 'ISSUE-MIN',
        location: '§1.1 + L1',
        severity: 'minor' as const,
        axes: { criticality: 3, risk: 2, time_cost: 2 },
        diagnosis: 'Minor issue',
        patches: validPatches
      };

      const result = createIssue(minimalInput);

      expect(result.recommended).toBeDefined();
      expect(['conservative', 'compromise', 'radical']).toContain(result.recommended);
    });
  });

  describe('Axes validation', () => {
    test('Axes values must be in valid range', () => {
      const validAxesValues = [
        { criticality: 1, risk: 1, time_cost: 1 },
        { criticality: 5, risk: 5, time_cost: 5 },
        { criticality: 10, risk: 10, time_cost: 10 },
      ];

      validAxesValues.forEach(axes => {
        const issue: Issue = {
          id: 'ISSUE-AXES',
          location: '§1.1 + L1',
          severity: 'critical',
          axes,
          diagnosis: 'Test',
          patches: validPatches,
          recommended: 'conservative'
        };

        const result = validateIssue(issue);
        expect(result).not.toBeNull();
      });
    });
  });
});

// Export for type checking
export {};
