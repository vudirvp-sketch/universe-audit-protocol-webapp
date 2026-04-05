/**
 * T1.5 — Skeleton Weakness Tests
 * Universe Audit Protocol v10.0
 * 
 * Implements weakness tests for critical skeleton elements
 * skeleton.status = "INCOMPLETE" → L1 blocked
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface SkeletonElement {
  id: string;
  name: string;
  value: string | null;
  status: 'complete' | 'partial' | 'missing' | 'incomplete';
  weaknessTest: WeaknessTest;
}

export interface WeaknessTest {
  question: string;
  passed: boolean | null;
  failureAction: string;
  severity: 'critical' | 'major' | 'minor';
}

export interface SkeletonExtractionResult {
  elements: SkeletonElement[];
  overallStatus: 'complete' | 'incomplete' | 'partial';
  weaknesses: WeaknessResult[];
  blockers: string[];
  canProceedToL1: boolean;
}

export interface WeaknessResult {
  element: string;
  testQuestion: string;
  passed: boolean;
  action: string;
  severity: 'critical' | 'major' | 'minor';
}

// ============================================================================
// SKELETON ELEMENTS WITH WEAKNESS TESTS
// ============================================================================

const SKELETON_ELEMENTS = [
  {
    id: 'thematic_law',
    name: 'Thematic Law',
    weaknessTest: {
      question: 'Remove theme: breaks physics or only plot?',
      failureAction: 'bind_to_law_or_remove',
      severity: 'critical' as const
    }
  },
  {
    id: 'root_trauma',
    name: 'Root Trauma',
    weaknessTest: {
      question: 'Explains all ideologies?',
      failureAction: 'deepen_trauma_connection',
      severity: 'critical' as const
    }
  },
  {
    id: 'hamartia',
    name: 'Hamartia (Fatal Flaw)',
    weaknessTest: {
      question: 'Ending follows from trait?',
      failureAction: 'connect_flaw_to_ending',
      severity: 'critical' as const
    }
  },
  {
    id: 'protagonist',
    name: 'Protagonist Core',
    weaknessTest: {
      question: 'Clear desire + obstacle?',
      failureAction: 'clarify_protagonist_drive',
      severity: 'major' as const
    }
  },
  {
    id: 'antagonist',
    name: 'Antagonist Force',
    weaknessTest: {
      question: 'Embodies opposite of protagonist?',
      failureAction: 'strengthen_antagonist_thematic',
      severity: 'major' as const
    }
  },
  {
    id: 'central_conflict',
    name: 'Central Conflict',
    weaknessTest: {
      question: 'Stakes are world-level?',
      failureAction: 'raise_stakes_to_world_level',
      severity: 'major' as const
    }
  },
  {
    id: 'world_law',
    name: 'World Law',
    weaknessTest: {
      question: 'Affects economy/physics, not just plot?',
      failureAction: 'integrate_law_into_world',
      severity: 'critical' as const
    }
  },
  {
    id: 'emotional_core',
    name: 'Emotional Core',
    weaknessTest: {
      question: 'Universal emotion + specific manifestation?',
      failureAction: 'ground_emotion_in_specifics',
      severity: 'minor' as const
    }
  }
];

// ============================================================================
// MAIN EXTRACTION FUNCTION
// ============================================================================

/**
 * Extracts and validates skeleton elements
 * Applies weakness tests to each element
 */
export function extractSkeleton(
  narrativeData: Record<string, unknown>
): SkeletonExtractionResult {
  const elements: SkeletonElement[] = [];
  const weaknesses: WeaknessResult[] = [];
  const blockers: string[] = [];

  for (const elementDef of SKELETON_ELEMENTS) {
    const value = narrativeData[elementDef.id] as string | null;
    const hasValue = value !== null && value !== undefined && value !== '';
    
    // Determine element status
    let status: SkeletonElement['status'];
    if (!hasValue) {
      status = 'missing';
    } else if (typeof value === 'string' && value.length < 20) {
      status = 'partial';
    } else {
      status = 'complete';
    }

    // Apply weakness test
    const testResult = applyWeaknessTest(elementDef, value, narrativeData);

    const element: SkeletonElement = {
      id: elementDef.id,
      name: elementDef.name,
      value: hasValue ? value : null,
      status,
      weaknessTest: {
        question: elementDef.weaknessTest.question,
        passed: testResult.passed,
        failureAction: elementDef.weaknessTest.failureAction,
        severity: elementDef.weaknessTest.severity
      }
    };

    elements.push(element);

    // Record weakness if test failed
    if (testResult.passed === false) {
      weaknesses.push({
        element: elementDef.name,
        testQuestion: elementDef.weaknessTest.question,
        passed: false,
        action: elementDef.weaknessTest.failureAction,
        severity: elementDef.weaknessTest.severity
      });

      // Critical weaknesses become blockers
      if (elementDef.weaknessTest.severity === 'critical') {
        blockers.push(
          `[${elementDef.id.toUpperCase()}] ${elementDef.weaknessTest.failureAction}`
        );
      }
    }
  }

  // Determine overall status
  let overallStatus: SkeletonExtractionResult['overallStatus'];
  const missingCount = elements.filter(e => e.status === 'missing').length;
  const criticalFailures = weaknesses.filter(w => w.severity === 'critical').length;

  if (missingCount > 2 || criticalFailures > 0) {
    overallStatus = 'incomplete';
  } else if (missingCount > 0 || elements.some(e => e.status === 'partial')) {
    overallStatus = 'partial';
  } else {
    overallStatus = 'complete';
  }

  // NON-NEGOTIABLE: skeleton.status = "INCOMPLETE" → L1 blocked
  const canProceedToL1 = overallStatus !== 'incomplete';

  return {
    elements,
    overallStatus,
    weaknesses,
    blockers,
    canProceedToL1
  };
}

// ============================================================================
// WEAKNESS TEST IMPLEMENTATIONS
// ============================================================================

/**
 * Applies weakness test to an element
 * Returns test result with pass/fail status
 */
function applyWeaknessTest(
  elementDef: typeof SKELETON_ELEMENTS[0],
  value: string | null,
  context: Record<string, unknown>
): { passed: boolean | null; reason?: string } {
  
  // Cannot test missing elements
  if (!value) {
    return { passed: null, reason: 'Element missing' };
  }

  const testId = elementDef.id;
  const lowerValue = value.toLowerCase();

  switch (testId) {
    case 'thematic_law':
      return testThematicLaw(lowerValue, context);
    
    case 'root_trauma':
      return testRootTrauma(lowerValue, context);
    
    case 'hamartia':
      return testHamartia(lowerValue, context);
    
    case 'protagonist':
      return testProtagonist(lowerValue, context);
    
    case 'antagonist':
      return testAntagonist(lowerValue, context);
    
    case 'central_conflict':
      return testCentralConflict(lowerValue, context);
    
    case 'world_law':
      return testWorldLaw(lowerValue, context);
    
    case 'emotional_core':
      return testEmotionalCore(lowerValue, context);
    
    default:
      return { passed: null, reason: 'Unknown test' };
  }
}

function testThematicLaw(value: string, context: Record<string, unknown>): { passed: boolean; reason: string } {
  // Test: Remove theme - breaks physics or only plot?
  const physicsKeywords = ['physics', 'law', 'rule', 'mechanic', 'system', 'force', 'nature'];
  const plotOnlyKeywords = ['just happens', 'only affects', 'only in', 'just a', 'merely'];
  
  const hasPhysicsIntegration = physicsKeywords.some(kw => value.includes(kw));
  const hasPlotOnlyIndicators = plotOnlyKeywords.some(kw => value.includes(kw));
  
  // Check if thematic law affects worldbuilding
  const worldbuilding = context.worldbuilding as Record<string, unknown> | undefined;
  const hasWorldIntegration = worldbuilding && Object.keys(worldbuilding).length > 0;

  if (hasPhysicsIntegration && !hasPlotOnlyIndicators) {
    return { passed: true, reason: 'Thematic law integrated with world physics' };
  }
  
  if (hasWorldIntegration) {
    return { passed: true, reason: 'Thematic law connected to worldbuilding' };
  }

  if (hasPlotOnlyIndicators) {
    return { passed: false, reason: 'Thematic law appears to affect only plot, not world mechanics' };
  }

  // Default: needs review
  return { passed: false, reason: 'Unable to confirm thematic law integration with world physics' };
}

function testRootTrauma(value: string, context: Record<string, unknown>): { passed: boolean; reason: string } {
  // Test: Explains all ideologies?
  const ideologyKeywords = ['ideology', 'belief', 'philosophy', 'system', 'worldview'];
  
  // Check if root trauma connects to ideological system
  const ideologies = context.themes as string[] | undefined;
  const hasIdeologyConnection = ideologies && ideologies.length > 0;

  // Check for explanatory power
  const explanatoryKeywords = ['because', 'explains', 'roots', 'origin', 'source', 'foundation'];
  const hasExplanatoryPower = explanatoryKeywords.some(kw => value.includes(kw));

  if (hasIdeologyConnection && hasExplanatoryPower) {
    return { passed: true, reason: 'Root trauma explains ideological foundation' };
  }

  if (hasExplanatoryPower) {
    return { passed: true, reason: 'Root trauma has explanatory power' };
  }

  return { passed: false, reason: 'Root trauma does not clearly explain ideological system' };
}

function testHamartia(value: string, context: Record<string, unknown>): { passed: boolean; reason: string } {
  // Test: Ending follows from trait?
  const endingKeywords = ['ending', 'conclusion', 'result', 'outcome', 'fate', 'destiny'];
  const hasEndingConnection = endingKeywords.some(kw => value.includes(kw));

  // Check for causal chain
  const causalKeywords = ['leads to', 'causes', 'results in', 'brings about', 'ensures'];
  const hasCausalChain = causalKeywords.some(kw => value.includes(kw));

  if (hasEndingConnection || hasCausalChain) {
    return { passed: true, reason: 'Hamartia connects to narrative ending' };
  }

  return { passed: false, reason: 'Hamartia does not clearly connect to ending' };
}

function testProtagonist(value: string, _context: Record<string, unknown>): { passed: boolean; reason: string } {
  // Test: Clear desire + obstacle?
  const desireKeywords = ['wants', 'desires', 'seeks', 'needs', 'goal', 'aim', 'pursues'];
  const obstacleKeywords = ['but', 'however', 'obstacle', 'prevented', 'blocked', 'opposed', 'against'];

  const hasDesire = desireKeywords.some(kw => value.includes(kw));
  const hasObstacle = obstacleKeywords.some(kw => value.includes(kw));

  if (hasDesire && hasObstacle) {
    return { passed: true, reason: 'Protagonist has clear desire and obstacle' };
  }

  if (hasDesire) {
    return { passed: false, reason: 'Protagonist has desire but obstacle unclear' };
  }

  if (hasObstacle) {
    return { passed: false, reason: 'Protagonist has obstacle but desire unclear' };
  }

  return { passed: false, reason: 'Protagonist desire and obstacle both unclear' };
}

function testAntagonist(value: string, _context: Record<string, unknown>): { passed: boolean; reason: string } {
  // Test: Embodies opposite of protagonist?
  const oppositeKeywords = ['opposite', 'contrasts', 'mirror', 'reflection', 'antithesis', 'against'];
  const thematicKeywords = ['theme', 'represents', 'embodies', 'symbolizes', 'stands for'];

  const hasOpposite = oppositeKeywords.some(kw => value.includes(kw));
  const hasThematicRole = thematicKeywords.some(kw => value.includes(kw));

  if (hasOpposite || hasThematicRole) {
    return { passed: true, reason: 'Antagonist has clear thematic opposition' };
  }

  return { passed: false, reason: 'Antagonist thematic opposition unclear' };
}

function testCentralConflict(value: string, _context: Record<string, unknown>): { passed: boolean; reason: string } {
  // Test: Stakes are world-level?
  const worldStakesKeywords = ['world', 'society', 'civilization', 'all', 'everyone', 'humanity', 'universe'];
  const personalStakesKeywords = ['personal', 'individual', 'just', 'only', 'private'];

  const hasWorldStakes = worldStakesKeywords.some(kw => value.includes(kw));
  const hasOnlyPersonalStakes = personalStakesKeywords.some(kw => value.includes(kw));

  if (hasWorldStakes && !hasOnlyPersonalStakes) {
    return { passed: true, reason: 'Central conflict has world-level stakes' };
  }

  if (hasOnlyPersonalStakes) {
    return { passed: false, reason: 'Central conflict appears limited to personal stakes' };
  }

  // Moderate: unclear but not necessarily failing
  return { passed: false, reason: 'Central conflict stakes level unclear' };
}

function testWorldLaw(value: string, _context: Record<string, unknown>): { passed: boolean; reason: string } {
  // Test: Affects economy/physics, not just plot?
  const worldAffectKeywords = ['economy', 'physics', 'nature', 'society', 'system', 'mechanic', 'rule'];
  const plotOnlyKeywords = ['just', 'only affects story', 'only in scene'];

  const hasWorldAffect = worldAffectKeywords.some(kw => value.includes(kw));
  const hasPlotOnly = plotOnlyKeywords.some(kw => value.includes(kw));

  if (hasWorldAffect && !hasPlotOnly) {
    return { passed: true, reason: 'World law affects world mechanics' };
  }

  return { passed: false, reason: 'World law integration with world mechanics unclear' };
}

function testEmotionalCore(value: string, _context: Record<string, unknown>): { passed: boolean; reason: string } {
  // Test: Universal emotion + specific manifestation?
  const universalEmotions = ['love', 'fear', 'grief', 'hope', 'desire', 'loss', 'belonging', 'identity'];
  const specificIndicators = ['specific', 'particular', 'unique', 'this', 'here', 'now'];

  const hasUniversal = universalEmotions.some(kw => value.includes(kw));
  const hasSpecific = specificIndicators.some(kw => value.includes(kw));

  if (hasUniversal && hasSpecific) {
    return { passed: true, reason: 'Emotional core combines universal with specific' };
  }

  if (hasUniversal) {
    return { passed: false, reason: 'Emotional core has universal emotion but lacks specificity' };
  }

  return { passed: false, reason: 'Emotional core needs clearer universal emotion' };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Formats skeleton extraction result for display
 */
export function formatSkeletonResult(result: SkeletonExtractionResult): string {
  const lines: string[] = [];
  
  lines.push('## Skeleton Extraction Results');
  lines.push('');
  lines.push(`**Overall Status:** ${result.overallStatus.toUpperCase()}`);
  lines.push(`**Can Proceed to L1:** ${result.canProceedToL1 ? 'YES' : 'NO'}`);
  lines.push('');

  lines.push('### Elements:');
  for (const element of result.elements) {
    const statusIcon = element.status === 'complete' ? '✓' : 
                       element.status === 'partial' ? '◐' : '✗';
    const testIcon = element.weaknessTest.passed === true ? '✓' :
                     element.weaknessTest.passed === false ? '✗' : '?';
    
    lines.push(`- ${statusIcon} **${element.name}**: ${element.status}`);
    lines.push(`  - Test: "${element.weaknessTest.question}" ${testIcon}`);
    if (element.weaknessTest.passed === false) {
      lines.push(`  - Action: ${element.weaknessTest.failureAction}`);
    }
  }
  lines.push('');

  if (result.weaknesses.length > 0) {
    lines.push('### Weaknesses Found:');
    for (const w of result.weaknesses) {
      lines.push(`- [${w.severity.toUpperCase()}] ${w.element}: ${w.action}`);
    }
  }

  if (result.blockers.length > 0) {
    lines.push('');
    lines.push('### L1 Blockers:');
    for (const blocker of result.blockers) {
      lines.push(`- ${blocker}`);
    }
  }

  return lines.join('\n');
}

/**
 * Quick check if skeleton is viable
 */
export function isSkeletonViable(narrativeData: Record<string, unknown>): boolean {
  // Minimum required elements
  const requiredElements = ['thematic_law', 'root_trauma', 'hamartia'];
  
  for (const element of requiredElements) {
    const value = narrativeData[element];
    if (!value || (typeof value === 'string' && value.length < 10)) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const REQUIRED_SKELETON_ELEMENTS = SKELETON_ELEMENTS
  .filter(e => e.weaknessTest.severity === 'critical')
  .map(e => e.id);
