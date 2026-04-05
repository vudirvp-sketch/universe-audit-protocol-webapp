/**
 * UNIVERSE AUDIT PROTOCOL v10.0 - Issue Schema Tests
 * 
 * Tests for RULE_9: ISSUE objects missing ANY field = invalid. Regenerate.
 */

import { validateIssue, createIssue } from '../src/lib/audit/issue-schema';
import type { Issue, Axes } from '../src/lib/audit/issue-schema';

describe('Issue Schema Validation', () => {
  const validAxes: Axes = { criticality: 7, risk: 5, time_cost: 4 };
  
  const validPatches = {
    conservative: { 
      description: 'Minimal fix', 
      impact: 'Quick resolution',
      sideEffects: ['Minor risk']
    },
    compromise: { 
      description: 'Balanced fix', 
      impact: 'Moderate improvement',
      sideEffects: ['Related changes needed']
    },
    radical: { 
      description: 'Complete restructure', 
      impact: 'Full resolution',
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
        patches: {
          conservative: { type: 'conservative', ...validPatches.conservative },
          compromise: { type: 'compromise', ...validPatches.compromise },
          radical: { type: 'radical', ...validPatches.radical }
        },
        recommended: 'compromise',
        reasoning: 'Test reasoning'
      };

      const result = validateIssue(validIssue);

      expect(result.valid).toBe(true);
      expect(result.missingFields.length).toBe(0);
      expect(result.invalidFields.length).toBe(0);
    });

    test('Issue missing id field is invalid', () => {
      const invalidIssue = {
        location: '§1.1 + L1',
        severity: 'critical',
        axes: validAxes,
        diagnosis: 'Test',
        patches: {
          conservative: { type: 'conservative', ...validPatches.conservative },
          compromise: { type: 'compromise', ...validPatches.compromise },
          radical: { type: 'radical', ...validPatches.radical }
        },
        recommended: 'conservative',
        reasoning: 'Test'
      } as Issue;

      const result = validateIssue(invalidIssue);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain('id');
    });

    test('Issue missing location field is invalid', () => {
      const invalidIssue = {
        id: 'ISSUE-01',
        severity: 'critical',
        axes: validAxes,
        diagnosis: 'Test',
        patches: {
          conservative: { type: 'conservative', ...validPatches.conservative },
          compromise: { type: 'compromise', ...validPatches.compromise },
          radical: { type: 'radical', ...validPatches.radical }
        },
        recommended: 'conservative',
        reasoning: 'Test'
      } as Issue;

      const result = validateIssue(invalidIssue);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain('location');
    });

    test('Issue missing diagnosis field is invalid', () => {
      const invalidIssue = {
        id: 'ISSUE-01',
        location: '§1.1 + L1',
        severity: 'critical',
        axes: validAxes,
        patches: {
          conservative: { type: 'conservative', ...validPatches.conservative },
          compromise: { type: 'compromise', ...validPatches.compromise },
          radical: { type: 'radical', ...validPatches.radical }
        },
        recommended: 'conservative',
        reasoning: 'Test'
      } as Issue;

      const result = validateIssue(invalidIssue);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain('diagnosis');
    });

    test('Issue missing axes is invalid', () => {
      const invalidIssue = {
        id: 'ISSUE-01',
        location: '§1.1 + L1',
        severity: 'critical',
        diagnosis: 'Test',
        patches: {
          conservative: { type: 'conservative', ...validPatches.conservative },
          compromise: { type: 'compromise', ...validPatches.compromise },
          radical: { type: 'radical', ...validPatches.radical }
        },
        recommended: 'conservative',
        reasoning: 'Test'
      } as Issue;

      const result = validateIssue(invalidIssue);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain('axes');
    });

    test('Issue missing patches is invalid', () => {
      const invalidIssue = {
        id: 'ISSUE-01',
        location: '§1.1 + L1',
        severity: 'critical',
        axes: validAxes,
        diagnosis: 'Test',
        recommended: 'conservative',
        reasoning: 'Test'
      } as Issue;

      const result = validateIssue(invalidIssue);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain('patches');
    });

    test('Issue missing radical patch is invalid', () => {
      const invalidIssue: Issue = {
        id: 'ISSUE-01',
        location: '§1.1 + L1',
        severity: 'critical',
        axes: validAxes,
        diagnosis: 'Test',
        patches: {
          conservative: { type: 'conservative', ...validPatches.conservative },
          compromise: { type: 'compromise', ...validPatches.compromise },
          radical: undefined as any
        },
        recommended: 'conservative',
        reasoning: 'Test'
      };

      const result = validateIssue(invalidIssue);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain('patches.radical');
    });

    test('Issue missing recommended field is invalid', () => {
      const invalidIssue = {
        id: 'ISSUE-01',
        location: '§1.1 + L1',
        severity: 'critical',
        axes: validAxes,
        diagnosis: 'Test',
        patches: {
          conservative: { type: 'conservative', ...validPatches.conservative },
          compromise: { type: 'compromise', ...validPatches.compromise },
          radical: { type: 'radical', ...validPatches.radical }
        },
        reasoning: 'Test'
      } as Issue;

      const result = validateIssue(invalidIssue);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain('recommended');
    });

    test('Issue with invalid severity is handled', () => {
      const invalidIssue: Issue = {
        id: 'ISSUE-01',
        location: '§1.1 + L1',
        severity: 'invalid' as any,
        axes: validAxes,
        diagnosis: 'Test',
        patches: {
          conservative: { type: 'conservative', ...validPatches.conservative },
          compromise: { type: 'compromise', ...validPatches.compromise },
          radical: { type: 'radical', ...validPatches.radical }
        },
        recommended: 'conservative',
        reasoning: 'Test'
      };

      const result = validateIssue(invalidIssue);

      // Should flag severity as invalid
      expect(result.invalidFields).toContain('severity');
    });
  });

  describe('createIssue', () => {
    test('Creates valid issue from partial input', () => {
      const result = createIssue({
        id: 'ISSUE-TEST',
        location: '§2.1 + L2',
        severity: 'major',
        axes: { criticality: 5, risk: 4, time_cost: 3 },
        diagnosis: 'Test diagnosis',
        patches: validPatches
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('ISSUE-TEST');
      expect(result.recommended).toBeDefined();
      expect(result.reasoning).toBeDefined();
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
      expect(result.reasoning).toBeDefined();
    });
  });

  describe('Axes validation', () => {
    test('Axes values must be in valid range (1-10)', () => {
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
          patches: {
            conservative: { type: 'conservative', ...validPatches.conservative },
            compromise: { type: 'compromise', ...validPatches.compromise },
            radical: { type: 'radical', ...validPatches.radical }
          },
          recommended: 'conservative',
          reasoning: 'Test'
        };

        const result = validateIssue(issue);
        expect(result.valid).toBe(true);
      });
    });

    test('Axes values out of range are invalid', () => {
      const invalidAxes = { criticality: 15, risk: 5, time_cost: 5 };

      const issue: Issue = {
        id: 'ISSUE-AXES-INVALID',
        location: '§1.1 + L1',
        severity: 'critical',
        axes: invalidAxes,
        diagnosis: 'Test',
        patches: {
          conservative: { type: 'conservative', ...validPatches.conservative },
          compromise: { type: 'compromise', ...validPatches.compromise },
          radical: { type: 'radical', ...validPatches.radical }
        },
        recommended: 'conservative',
        reasoning: 'Test'
      };

      const result = validateIssue(issue);
      expect(result.invalidFields).toContain('axes.criticality_out_of_range');
    });
  });
});

// Export for type checking
export {};
