/**
 * T1.1 — ISSUE Schema with axes + recommended patches
 * Universe Audit Protocol v10.0
 * 
 * Implements the ISSUE object structure with:
 * - axes (criticality, risk, time_cost)
 * - three patch variants (conservative, compromise, radical)
 * - automatic recommendation calculation
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type Severity = 'critical' | 'major' | 'minor' | 'cosmetic';

export type PatchType = 'conservative' | 'compromise' | 'radical';

export interface Axes {
  criticality: number;  // 1-10: How central to the narrative
  risk: number;         // 1-10: Risk of causing other issues if fixed
  time_cost: number;    // 1-10: Effort required to fix
}

export interface Patch {
  type: PatchType;
  description: string;
  impact: string;
  sideEffects: string[];
}

export interface Issue {
  id: string;
  location: string;
  severity: Severity;
  axes: Axes;
  diagnosis: string;
  patches: {
    conservative: Patch;
    compromise: Patch;
    radical: Patch;
  };
  recommended: PatchType;
  reasoning: string;
}

export interface IssueValidationResult {
  valid: boolean;
  missingFields: string[];
  invalidFields: string[];
}

// ============================================================================
// AXES MATRIX
// ============================================================================

/**
 * Recommendation matrix based on axes values
 * Higher criticality = more aggressive fix recommended
 * Higher risk = more conservative fix recommended
 * Higher time_cost = consider compromise
 */
function getRecommendationFromAxes(axes: Axes): { recommended: PatchType; reasoning: string } {
  const { criticality, risk, time_cost } = axes;
  
  // High criticality + low risk = radical fix
  if (criticality >= 8 && risk <= 4) {
    return {
      recommended: 'radical',
      reasoning: 'High criticality with low risk warrants a comprehensive fix'
    };
  }
  
  // High criticality + high risk = compromise
  if (criticality >= 7 && risk >= 6) {
    return {
      recommended: 'compromise',
      reasoning: 'High criticality but significant risk requires balanced approach'
    };
  }
  
  // Low criticality = conservative
  if (criticality <= 3) {
    return {
      recommended: 'conservative',
      reasoning: 'Low criticality issue - minimal intervention sufficient'
    };
  }
  
  // High time_cost + moderate criticality = compromise
  if (time_cost >= 7 && criticality >= 4 && criticality <= 7) {
    return {
      recommended: 'compromise',
      reasoning: 'Moderate criticality with high effort - balanced fix optimal'
    };
  }
  
  // High risk = conservative default
  if (risk >= 7) {
    return {
      recommended: 'conservative',
      reasoning: 'High risk environment - conservative approach safest'
    };
  }
  
  // Default to compromise for moderate values
  return {
    recommended: 'compromise',
    reasoning: 'Moderate values across axes - balanced approach recommended'
  };
}

// ============================================================================
// ISSUE CREATION
// ============================================================================

/**
 * Creates a complete ISSUE object with automatic recommendation
 * NON-NEGOTIABLE: All fields must be present
 */
export function createIssue(
  params: {
    id: string;
    location: string;
    severity: Severity;
    axes: Axes;
    diagnosis: string;
    patches: {
      conservative: Omit<Patch, 'type'>;
      compromise: Omit<Patch, 'type'>;
      radical: Omit<Patch, 'type'>;
    };
  }
): Issue {
  const recommendation = getRecommendationFromAxes(params.axes);
  
  return {
    id: params.id,
    location: params.location,
    severity: params.severity,
    axes: params.axes,
    diagnosis: params.diagnosis,
    patches: {
      conservative: { ...params.patches.conservative, type: 'conservative' },
      compromise: { ...params.patches.compromise, type: 'compromise' },
      radical: { ...params.patches.radical, type: 'radical' }
    },
    recommended: recommendation.recommended,
    reasoning: recommendation.reasoning
  };
}

// ============================================================================
// ISSUE VALIDATION
// ============================================================================

const REQUIRED_ISSUE_FIELDS = [
  'id', 'location', 'severity', 'axes', 'diagnosis', 'patches', 'recommended'
];

const REQUIRED_AXES_FIELDS = ['criticality', 'risk', 'time_cost'];

const REQUIRED_PATCH_FIELDS = ['type', 'description', 'impact', 'sideEffects'];

/**
 * Validates an ISSUE object for completeness
 * NON-NEGOTIABLE: ISSUE objects missing any field = invalid, regenerate
 */
export function validateIssue(issue: unknown): IssueValidationResult {
  const missingFields: string[] = [];
  const invalidFields: string[] = [];

  if (!issue || typeof issue !== 'object') {
    return {
      valid: false,
      missingFields: ['all'],
      invalidFields: []
    };
  }

  const issueObj = issue as Record<string, unknown>;

  // Check required fields
  for (const field of REQUIRED_ISSUE_FIELDS) {
    if (!(field in issueObj) || issueObj[field] === undefined) {
      missingFields.push(field);
    }
  }

  // Validate axes
  if (issueObj.axes && typeof issueObj.axes === 'object') {
    const axes = issueObj.axes as Record<string, unknown>;
    for (const field of REQUIRED_AXES_FIELDS) {
      if (!(field in axes) || typeof axes[field] !== 'number') {
        invalidFields.push(`axes.${field}`);
      } else {
        const value = axes[field] as number;
        if (value < 1 || value > 10) {
          invalidFields.push(`axes.${field}_out_of_range`);
        }
      }
    }
  }

  // Validate patches
  if (issueObj.patches && typeof issueObj.patches === 'object') {
    const patches = issueObj.patches as Record<string, unknown>;
    for (const patchType of ['conservative', 'compromise', 'radical'] as const) {
      if (patches[patchType] && typeof patches[patchType] === 'object') {
        const patch = patches[patchType] as Record<string, unknown>;
        for (const field of REQUIRED_PATCH_FIELDS) {
          if (!(field in patch)) {
            missingFields.push(`patches.${patchType}.${field}`);
          }
        }
      } else {
        missingFields.push(`patches.${patchType}`);
      }
    }
  }

  // Validate severity
  if (issueObj.severity && !['critical', 'major', 'minor', 'cosmetic'].includes(issueObj.severity as string)) {
    invalidFields.push('severity');
  }

  return {
    valid: missingFields.length === 0 && invalidFields.length === 0,
    missingFields,
    invalidFields
  };
}

// ============================================================================
// PATCH GENERATION HELPERS
// ============================================================================

/**
 * Generates patch templates for common issue types
 */
export function generatePatchTemplates(
  issueType: string,
  context: string
): { conservative: Omit<Patch, 'type'>; compromise: Omit<Patch, 'type'>; radical: Omit<Patch, 'type'> } {
  
  const templates: Record<string, typeof generatePatchTemplates extends (...args: any[]) => infer R ? R : never> = {
    thematic_law_weak: {
      conservative: {
        description: `Add a concrete manifestation of the thematic law in ${context}`,
        impact: 'Strengthens thematic presence with minimal disruption',
        sideEffects: ['May require minor scene adjustments']
      },
      compromise: {
        description: `Integrate thematic law into existing plot beats in ${context}`,
        impact: 'Creates organic thematic integration',
        sideEffects: ['Some dialogue revisions needed', 'Minor pacing adjustments']
      },
      radical: {
        description: `Restructure ${context} to make thematic law central to world mechanics`,
        impact: 'Thematic law becomes fundamental to narrative logic',
        sideEffects: ['Major worldbuilding revisions', 'Character motivation updates', 'Plot restructuring']
      }
    },
    character_inconsistency: {
      conservative: {
        description: `Add bridging scene explaining character behavior in ${context}`,
        impact: 'Explains inconsistency without changing plot',
        sideEffects: ['Minor pacing impact']
      },
      compromise: {
        description: `Revise character motivation in ${context} to align with established traits`,
        impact: 'Creates consistent character voice',
        sideEffects: ['Dialogue revisions', 'Motivation clarification needed']
      },
      radical: {
        description: `Restructure character arc in ${context} to resolve inconsistency at root`,
        impact: 'Eliminates inconsistency fundamentally',
        sideEffects: ['Major arc restructuring', 'Potential plot changes', 'Other character impacts']
      }
    },
    world_logic_gap: {
      conservative: {
        description: `Add exposition explaining the gap in ${context}`,
        impact: 'Addresses gap without changing mechanics',
        sideEffects: ['May feel expository']
      },
      compromise: {
        description: `Introduce soft rule that bridges the gap in ${context}`,
        impact: 'Creates logical connection',
        sideEffects: ['New rule needs consistency checks', 'May affect related systems']
      },
      radical: {
        description: `Redesign world system to eliminate gap in ${context}`,
        impact: 'Eliminates gap at source',
        sideEffects: ['Major worldbuilding changes', 'May require plot revisions', 'Consistency cascade effects']
      }
    }
  };

  return templates[issueType] || {
    conservative: {
      description: `Minor fix for issue in ${context}`,
      impact: 'Addresses issue with minimal changes',
      sideEffects: ['Unknown']
    },
    compromise: {
      description: `Balanced fix for issue in ${context}`,
      impact: 'Addresses issue comprehensively',
      sideEffects: ['Moderate revision required']
    },
    radical: {
      description: `Comprehensive fix for issue in ${context}`,
      impact: 'Eliminates issue at root cause',
      sideEffects: ['Major revision required', 'Potential cascading changes']
    }
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculates overall issue score from axes
 */
export function calculateIssueScore(axes: Axes): number {
  // Weighted average: criticality has highest weight
  return (axes.criticality * 0.5 + axes.risk * 0.3 + axes.time_cost * 0.2);
}

/**
 * Sorts issues by priority (highest first)
 */
export function sortIssuesByPriority(issues: Issue[]): Issue[] {
  return [...issues].sort((a, b) => {
    // Critical severity first
    const severityOrder: Record<Severity, number> = {
      critical: 0, major: 1, minor: 2, cosmetic: 3
    };
    
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    
    // Then by axes score
    return calculateIssueScore(b.axes) - calculateIssueScore(a.axes);
  });
}

/**
 * Filters issues by severity level
 */
export function filterIssuesBySeverity(issues: Issue[], minSeverity: Severity): Issue[] {
  const severityLevels: Severity[] = ['critical', 'major', 'minor', 'cosmetic'];
  const minIndex = severityLevels.indexOf(minSeverity);
  
  return issues.filter(issue => 
    severityLevels.indexOf(issue.severity) <= minIndex
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export const SEVERITY_LEVELS: Severity[] = ['critical', 'major', 'minor', 'cosmetic'];

export const PATCH_TYPES: PatchType[] = ['conservative', 'compromise', 'radical'];
