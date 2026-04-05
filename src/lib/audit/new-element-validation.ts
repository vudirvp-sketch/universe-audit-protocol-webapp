/**
 * T2.1 — §18 Five Checks + Five Touches Scoring
 * Universe Audit Protocol v10.0
 * 
 * Implements validation for new narrative elements
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface FiveChecksResult {
  pillars_enhanced: { passed: boolean; count: number; details: string };
  creates_dilemma: { passed: boolean; details: string };
  visible_cost: { passed: boolean; details: string };
  ripple_effect: { passed: boolean; count: number; details: string };
  dual_level: { passed: boolean; levels: string[]; details: string };
  allPassed: boolean;
}

export interface FiveTouchesResult {
  dialogue: { score: number; status: string; details: string };
  choice: { score: number; status: string; details: string };
  texture: { score: number; status: string; details: string };
  shadow: { score: number; status: string; details: string };
  metaphor: { score: number; status: string; details: string };
  averageScore: number;
  overallStatus: string;
}

export interface NewElementValidationResult {
  elementName: string;
  fiveChecks: FiveChecksResult;
  fiveTouches: FiveTouchesResult;
  passed: boolean;
  issues: string[];
  recommendations: string[];
}

// ============================================================================
// FIVE CHECKS IMPLEMENTATION
// ============================================================================

/**
 * Five Checks - ALL must pass for element to be valid
 * 
 * 1. pillars_enhanced ≥1
 * 2. creates_dilemma = true
 * 3. visible_cost = true
 * 4. ripple_effect ≥2
 * 5. dual_level = true
 */
export function evaluateFiveChecks(element: {
  pillarsEnhanced: number;
  createsDilemma: boolean;
  visibleCost: boolean;
  rippleEffect: number;
  dualLevel: boolean;
  details?: {
    pillarsEnhancedDetails?: string;
    dilemmaDetails?: string;
    costDetails?: string;
    rippleDetails?: string;
    dualLevelDetails?: string;
  };
}): FiveChecksResult {
  const checks = {
    pillars_enhanced: {
      passed: element.pillarsEnhanced >= 1,
      count: element.pillarsEnhanced,
      details: element.details?.pillarsEnhancedDetails || 
        `Enhances ${element.pillarsEnhanced} pillar(s)`
    },
    creates_dilemma: {
      passed: element.createsDilemma,
      details: element.details?.dilemmaDetails ||
        (element.createsDilemma ? 'Creates meaningful dilemma' : 'No dilemma created')
    },
    visible_cost: {
      passed: element.visibleCost,
      details: element.details?.costDetails ||
        (element.visibleCost ? 'Cost is visible to reader/viewer' : 'Cost not visible')
    },
    ripple_effect: {
      passed: element.rippleEffect >= 2,
      count: element.rippleEffect,
      details: element.details?.rippleDetails ||
        `Creates ${element.rippleEffect} ripple effect(s)`
    },
    dual_level: {
      passed: element.dualLevel,
      levels: element.dualLevel ? ['plot', 'theme'] : [],
      details: element.details?.dualLevelDetails ||
        (element.dualLevel ? 'Operates on multiple levels' : 'Single level operation')
    }
  };

  const allPassed = Object.values(checks).every(c => c.passed);

  return {
    ...checks,
    allPassed
  };
}

// ============================================================================
// FIVE TOUCHES IMPLEMENTATION
// ============================================================================

/**
 * Five Touches - Scoring system 1-5
 * 
 * 1-2: underdeveloped (flag)
 * 3-4: functional
 * 5: complete
 */
export function evaluateFiveTouches(element: {
  dialogue: number;
  choice: number;
  texture: number;
  shadow: number;
  metaphor: number;
  details?: {
    dialogueDetails?: string;
    choiceDetails?: string;
    textureDetails?: string;
    shadowDetails?: string;
    metaphorDetails?: string;
  };
}): FiveTouchesResult {
  const getStatus = (score: number): string => {
    if (score <= 2) return 'underdeveloped';
    if (score <= 4) return 'functional';
    return 'complete';
  };

  const touches = {
    dialogue: {
      score: element.dialogue,
      status: getStatus(element.dialogue),
      details: element.details?.dialogueDetails || 
        `Dialogue integration: ${element.dialogue}/5`
    },
    choice: {
      score: element.choice,
      status: getStatus(element.choice),
      details: element.details?.choiceDetails ||
        `Character choice impact: ${element.choice}/5`
    },
    texture: {
      score: element.texture,
      status: getStatus(element.texture),
      details: element.details?.textureDetails ||
        `World texture contribution: ${element.texture}/5`
    },
    shadow: {
      score: element.shadow,
      status: getStatus(element.shadow),
      details: element.details?.shadowDetails ||
        `Shadow/dark side integration: ${element.shadow}/5`
    },
    metaphor: {
      score: element.metaphor,
      status: getStatus(element.metaphor),
      details: element.details?.metaphorDetails ||
        `Metaphorical resonance: ${element.metaphor}/5`
    }
  };

  const scores = [element.dialogue, element.choice, element.texture, element.shadow, element.metaphor];
  const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  // Overall status based on average
  let overallStatus: string;
  if (averageScore < 2.5) {
    overallStatus = 'underdeveloped';
  } else if (averageScore < 4.5) {
    overallStatus = 'functional';
  } else {
    overallStatus = 'complete';
  }

  return {
    ...touches,
    averageScore,
    overallStatus
  };
}

// ============================================================================
// MAIN VALIDATION FUNCTION
// ============================================================================

/**
 * Complete new element validation
 */
export function validateNewElement(element: {
  name: string;
  pillarsEnhanced: number;
  createsDilemma: boolean;
  visibleCost: boolean;
  rippleEffect: number;
  dualLevel: boolean;
  dialogue: number;
  choice: number;
  texture: number;
  shadow: number;
  metaphor: number;
  details?: Record<string, string>;
}): NewElementValidationResult {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Evaluate Five Checks
  const fiveChecks = evaluateFiveChecks({
    pillarsEnhanced: element.pillarsEnhanced,
    createsDilemma: element.createsDilemma,
    visibleCost: element.visibleCost,
    rippleEffect: element.rippleEffect,
    dualLevel: element.dualLevel,
    details: {
      pillarsEnhancedDetails: element.details?.pillarsEnhancedDetails,
      dilemmaDetails: element.details?.dilemmaDetails,
      costDetails: element.details?.costDetails,
      rippleDetails: element.details?.rippleDetails,
      dualLevelDetails: element.details?.dualLevelDetails
    }
  });

  // Evaluate Five Touches
  const fiveTouches = evaluateFiveTouches({
    dialogue: element.dialogue,
    choice: element.choice,
    texture: element.texture,
    shadow: element.shadow,
    metaphor: element.metaphor,
    details: {
      dialogueDetails: element.details?.dialogueDetails,
      choiceDetails: element.details?.choiceDetails,
      textureDetails: element.details?.textureDetails,
      shadowDetails: element.details?.shadowDetails,
      metaphorDetails: element.details?.metaphorDetails
    }
  });

  // Collect issues from Five Checks
  if (!fiveChecks.pillars_enhanced.passed) {
    issues.push('Must enhance at least 1 pillar');
    recommendations.push('Connect element to core narrative pillars (theme, character, world)');
  }
  if (!fiveChecks.creates_dilemma.passed) {
    issues.push('Must create a dilemma');
    recommendations.push('Add a choice or conflict that the element creates');
  }
  if (!fiveChecks.visible_cost.passed) {
    issues.push('Cost must be visible');
    recommendations.push('Show the cost/price of the element to reader/viewer');
  }
  if (!fiveChecks.ripple_effect.passed) {
    issues.push(`Ripple effect must be ≥2 (current: ${fiveChecks.ripple_effect.count})`);
    recommendations.push('Add consequences that spread to other story elements');
  }
  if (!fiveChecks.dual_level.passed) {
    issues.push('Must operate on multiple levels');
    recommendations.push('Ensure element works on both plot and thematic levels');
  }

  // Collect issues from Five Touches
  const underdevelopedTouches: string[] = [];
  if (fiveTouches.dialogue.status === 'underdeveloped') {
    underdevelopedTouches.push('dialogue');
    recommendations.push('Improve dialogue integration with this element');
  }
  if (fiveTouches.choice.status === 'underdeveloped') {
    underdevelopedTouches.push('choice');
    recommendations.push('Strengthen character choice connection to this element');
  }
  if (fiveTouches.texture.status === 'underdeveloped') {
    underdevelopedTouches.push('texture');
    recommendations.push('Add sensory/world details connected to this element');
  }
  if (fiveTouches.shadow.status === 'underdeveloped') {
    underdevelopedTouches.push('shadow');
    recommendations.push('Explore dark side/implications of this element');
  }
  if (fiveTouches.metaphor.status === 'underdeveloped') {
    underdevelopedTouches.push('metaphor');
    recommendations.push('Add metaphorical resonance to this element');
  }

  if (underdevelopedTouches.length > 0) {
    issues.push(`Underdeveloped touches: ${underdevelopedTouches.join(', ')}`);
  }

  // Overall pass determination
  const passed = fiveChecks.allPassed && fiveTouches.averageScore >= 2.5;

  return {
    elementName: element.name,
    fiveChecks,
    fiveTouches,
    passed,
    issues,
    recommendations
  };
}

// ============================================================================
// FORMATTING
// ============================================================================

/**
 * Formats validation result for display
 */
export function formatValidationResult(result: NewElementValidationResult): string {
  const lines: string[] = [];
  
  lines.push(`## New Element Validation: ${result.elementName}`);
  lines.push('');
  lines.push(`**Overall:** ${result.passed ? 'PASSED' : 'FAILED'}`);
  lines.push('');

  lines.push('### Five Checks (ALL must pass):');
  const checks = result.fiveChecks;
  lines.push(`- Pillars Enhanced: ${checks.pillars_enhanced.passed ? '✓' : '✗'} (${checks.pillars_enhanced.count})`);
  lines.push(`- Creates Dilemma: ${checks.creates_dilemma.passed ? '✓' : '✗'}`);
  lines.push(`- Visible Cost: ${checks.visible_cost.passed ? '✓' : '✗'}`);
  lines.push(`- Ripple Effect: ${checks.ripple_effect.passed ? '✓' : '✗'} (${checks.ripple_effect.count})`);
  lines.push(`- Dual Level: ${checks.dual_level.passed ? '✓' : '✗'}`);
  lines.push('');

  lines.push('### Five Touches (1-5 scale):');
  const touches = result.fiveTouches;
  lines.push(`- Dialogue: ${touches.dialogue.score}/5 (${touches.dialogue.status})`);
  lines.push(`- Choice: ${touches.choice.score}/5 (${touches.choice.status})`);
  lines.push(`- Texture: ${touches.texture.score}/5 (${touches.texture.status})`);
  lines.push(`- Shadow: ${touches.shadow.score}/5 (${touches.shadow.status})`);
  lines.push(`- Metaphor: ${touches.metaphor.score}/5 (${touches.metaphor.status})`);
  lines.push(`- Average: ${touches.averageScore.toFixed(1)}/5 (${touches.overallStatus})`);
  lines.push('');

  if (result.issues.length > 0) {
    lines.push('### Issues:');
    for (const issue of result.issues) {
      lines.push(`- ❌ ${issue}`);
    }
    lines.push('');
  }

  if (result.recommendations.length > 0) {
    lines.push('### Recommendations:');
    for (const rec of result.recommendations) {
      lines.push(`- ${rec}`);
    }
  }

  return lines.join('\n');
}

// ============================================================================
// EXPORTS
// ============================================================================

export const FIVE_CHECKS_NAMES = [
  'pillars_enhanced',
  'creates_dilemma',
  'visible_cost',
  'ripple_effect',
  'dual_level'
] as const;

export const FIVE_TOUCHES_NAMES = [
  'dialogue',
  'choice',
  'texture',
  'shadow',
  'metaphor'
] as const;
