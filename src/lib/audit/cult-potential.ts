/**
 * T1.4 — Two-Phase Cult Potential Evaluation
 * Universe Audit Protocol v10.0
 * 
 * Implements two-phase cult potential scoring:
 * PHASE 1: Mandatory criteria (C1, C2) — BLOCKING
 * PHASE 2: Weighted score — score < 8/11 = fail
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface CultCriterion {
  id: string;
  name: string;
  description: string;
  weight: number;
  mandatory: boolean;
  category: 'philosophical' | 'narrative' | 'character' | 'world';
}

export interface CultEvaluationInput {
  // C1: Philosophical foundation
  hasRootTrauma: boolean;
  rootTraumaDepth: number; // 0-1
  ideologicalSystem: boolean;
  
  // C2: Thematic depth
  hasThematicLaw: boolean;
  thematicLawIntegration: number; // 0-1
  themeUniversality: boolean;
  
  // Other criteria
  characterComplexity: number; // 0-1
  moralAmbiguity: boolean;
  worldConsistency: number; // 0-1
  transformativePotential: boolean;
  ritualizableElements: boolean;
  communalExperience: boolean;
  interpretiveDepth: number; // 0-1
  rewatchValue: boolean;
  memeticPotential: boolean;
}

export interface CultEvaluationResult {
  passed: boolean;
  phase1Result: {
    passed: boolean;
    criteria: {
      id: string;
      name: string;
      passed: boolean;
      blocking: boolean;
    }[];
  };
  phase2Result: {
    score: number;
    maxScore: number;
    percentage: number;
    passed: boolean;
    criteria: {
      id: string;
      name: string;
      passed: boolean;
      score: number;
      maxScore: number;
    }[];
  };
  classification: CultClassification;
  recommendations: string[];
}

export type CultClassification = 
  | 'high_cult_potential'
  | 'moderate_cult_potential'
  | 'limited_cult_potential'
  | 'standard_work'
  | 'cult_failed';

// ============================================================================
// CRITERIA DEFINITIONS
// ============================================================================

const CULT_CRITERIA: CultCriterion[] = [
  // MANDATORY CRITERIA (PHASE 1)
  {
    id: 'C1',
    name: 'Root Trauma Foundation',
    description: 'Work has identifiable root trauma that grounds ideological system',
    weight: 0,
    mandatory: true,
    category: 'philosophical'
  },
  {
    id: 'C2',
    name: 'Thematic Law Integration',
    description: 'Thematic law is integrated into world mechanics, not just plot',
    weight: 0,
    mandatory: true,
    category: 'philosophical'
  },
  
  // WEIGHTED CRITERIA (PHASE 2)
  {
    id: 'C3',
    name: 'Character Complexity',
    description: 'Characters exhibit moral complexity and internal conflict',
    weight: 1,
    mandatory: false,
    category: 'character'
  },
  {
    id: 'C4',
    name: 'Moral Ambiguity',
    description: 'Work presents morally ambiguous situations without clear answers',
    weight: 1,
    mandatory: false,
    category: 'narrative'
  },
  {
    id: 'C5',
    name: 'World Consistency',
    description: 'World follows internal logic consistently',
    weight: 1,
    mandatory: false,
    category: 'world'
  },
  {
    id: 'C6',
    name: 'Transformative Potential',
    description: 'Work has potential to transform reader/viewer perspective',
    weight: 1,
    mandatory: false,
    category: 'philosophical'
  },
  {
    id: 'C7',
    name: 'Ritualizable Elements',
    description: 'Contains elements that can be ritualized by fans (quotes, symbols, scenes)',
    weight: 1,
    mandatory: false,
    category: 'narrative'
  },
  {
    id: 'C8',
    name: 'Communal Experience',
    description: 'Work creates shared experience that bonds audience',
    weight: 1,
    mandatory: false,
    category: 'narrative'
  },
  {
    id: 'C9',
    name: 'Interpretive Depth',
    description: 'Work rewards multiple interpretations and analysis',
    weight: 1,
    mandatory: false,
    category: 'philosophical'
  },
  {
    id: 'C10',
    name: 'Rewatch/Reread Value',
    description: 'Work reveals new layers on repeat engagement',
    weight: 1,
    mandatory: false,
    category: 'narrative'
  },
  {
    id: 'C11',
    name: 'Memetic Potential',
    description: 'Work has quotable lines or memorable moments that spread',
    weight: 1,
    mandatory: false,
    category: 'narrative'
  }
];

// ============================================================================
// PHASE 1: MANDATORY CRITERIA
// ============================================================================

/**
 * Evaluates Phase 1 mandatory criteria
 * NON-NEGOTIABLE: C1 and C2 are BLOCKING
 */
function evaluatePhase1(input: CultEvaluationInput): CultEvaluationResult['phase1Result'] {
  const criteria = [
    {
      id: 'C1',
      name: 'Root Trauma Foundation',
      passed: input.hasRootTrauma && input.rootTraumaDepth >= 0.5 && input.ideologicalSystem,
      blocking: true
    },
    {
      id: 'C2',
      name: 'Thematic Law Integration',
      passed: input.hasThematicLaw && input.thematicLawIntegration >= 0.5 && input.themeUniversality,
      blocking: true
    }
  ];

  const passed = criteria.every(c => c.passed);

  return {
    passed,
    criteria
  };
}

// ============================================================================
// PHASE 2: WEIGHTED SCORING
// ============================================================================

/**
 * Evaluates Phase 2 weighted criteria
 * NON-NEGOTIABLE: score < 8/11 = fail
 */
function evaluatePhase2(input: CultEvaluationInput): CultEvaluationResult['phase2Result'] {
  const criteria = [
    {
      id: 'C3',
      name: 'Character Complexity',
      passed: input.characterComplexity >= 0.6,
      score: input.characterComplexity >= 0.6 ? 1 : 0,
      maxScore: 1
    },
    {
      id: 'C4',
      name: 'Moral Ambiguity',
      passed: input.moralAmbiguity,
      score: input.moralAmbiguity ? 1 : 0,
      maxScore: 1
    },
    {
      id: 'C5',
      name: 'World Consistency',
      passed: input.worldConsistency >= 0.6,
      score: input.worldConsistency >= 0.6 ? 1 : 0,
      maxScore: 1
    },
    {
      id: 'C6',
      name: 'Transformative Potential',
      passed: input.transformativePotential,
      score: input.transformativePotential ? 1 : 0,
      maxScore: 1
    },
    {
      id: 'C7',
      name: 'Ritualizable Elements',
      passed: input.ritualizableElements,
      score: input.ritualizableElements ? 1 : 0,
      maxScore: 1
    },
    {
      id: 'C8',
      name: 'Communal Experience',
      passed: input.communalExperience,
      score: input.communalExperience ? 1 : 0,
      maxScore: 1
    },
    {
      id: 'C9',
      name: 'Interpretive Depth',
      passed: input.interpretiveDepth >= 0.6,
      score: input.interpretiveDepth >= 0.6 ? 1 : 0,
      maxScore: 1
    },
    {
      id: 'C10',
      name: 'Rewatch/Reread Value',
      passed: input.rewatchValue,
      score: input.rewatchValue ? 1 : 0,
      maxScore: 1
    },
    {
      id: 'C11',
      name: 'Memetic Potential',
      passed: input.memeticPotential,
      score: input.memeticPotential ? 1 : 0,
      maxScore: 1
    }
  ];

  const score = criteria.reduce((sum, c) => sum + c.score, 0);
  const maxScore = criteria.reduce((sum, c) => sum + c.maxScore, 0);
  const percentage = (score / maxScore) * 100;
  
  // NON-NEGOTIABLE: score < 8/11 = fail
  const passed = score >= 8;

  return {
    score,
    maxScore,
    percentage,
    passed,
    criteria
  };
}

// ============================================================================
// MAIN EVALUATION FUNCTION
// ============================================================================

/**
 * Full two-phase cult potential evaluation
 * 
 * PHASE 1: Mandatory criteria (C1, C2) — BLOCKING
 * PHASE 2: Weighted score — score < 8/11 = fail
 */
export function evaluateCultPotential(input: CultEvaluationInput): CultEvaluationResult {
  const phase1Result = evaluatePhase1(input);
  const recommendations: string[] = [];

  // Phase 1 failure: BLOCK immediately
  if (!phase1Result.passed) {
    for (const criterion of phase1Result.criteria) {
      if (!criterion.passed) {
        recommendations.push(getRecommendation(criterion.id));
      }
    }

    return {
      passed: false,
      phase1Result,
      phase2Result: {
        score: 0,
        maxScore: 9,
        percentage: 0,
        passed: false,
        criteria: []
      },
      classification: 'cult_failed',
      recommendations
    };
  }

  // Phase 2 evaluation
  const phase2Result = evaluatePhase2(input);

  // Generate recommendations for failed criteria
  for (const criterion of phase2Result.criteria) {
    if (!criterion.passed) {
      recommendations.push(getRecommendation(criterion.id));
    }
  }

  // Determine classification
  const classification = getCultClassification(phase1Result, phase2Result);

  return {
    passed: phase2Result.passed,
    phase1Result,
    phase2Result,
    classification,
    recommendations
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getRecommendation(criterionId: string): string {
  const recommendations: Record<string, string> = {
    C1: 'Develop root trauma that grounds the ideological system. Root trauma should explain the work\'s philosophy.',
    C2: 'Integrate thematic law into world mechanics. The law should affect physics/economy, not just plot.',
    C3: 'Increase character complexity. Characters should have internal conflicts and moral ambiguity.',
    C4: 'Add moral ambiguity. Present situations without clear right/wrong answers.',
    C5: 'Improve world consistency. Ensure the world follows its internal logic.',
    C6: 'Enhance transformative potential. Create moments that challenge reader/viewer assumptions.',
    C7: 'Add ritualizable elements. Include quotable lines, symbols, or scenes that fans can adopt.',
    C8: 'Create communal experience. Design moments that create shared emotional responses.',
    C9: 'Increase interpretive depth. Add layers that reward multiple readings.',
    C10: 'Add rewatch/reread value. Include details that become apparent on repeat engagement.',
    C11: 'Enhance memetic potential. Create memorable quotes or moments that spread naturally.'
  };

  return recommendations[criterionId] || 'Address the criterion for improved cult potential.';
}

function getCultClassification(
  phase1: CultEvaluationResult['phase1Result'],
  phase2: CultEvaluationResult['phase2Result']
): CultClassification {
  if (!phase1.passed) {
    return 'cult_failed';
  }

  if (phase2.score >= 9) {
    return 'high_cult_potential';
  }

  if (phase2.score >= 8) {
    return 'moderate_cult_potential';
  }

  if (phase2.score >= 6) {
    return 'limited_cult_potential';
  }

  return 'standard_work';
}

// ============================================================================
// QUICK CHECK FUNCTION
// ============================================================================

/**
 * Quick cult potential check without full evaluation
 * Returns boolean and basic classification
 */
export function quickCultCheck(input: {
  hasRootTrauma: boolean;
  hasThematicLaw: boolean;
}): { likely: boolean; confidence: number } {
  // Without mandatory criteria, cult potential is impossible
  if (!input.hasRootTrauma || !input.hasThematicLaw) {
    return { likely: false, confidence: 1.0 };
  }

  // With mandatory criteria met, cult potential is possible
  return { likely: true, confidence: 0.6 };
}

/**
 * Returns classification label for display
 */
export function getCultClassificationLabel(classification: CultClassification): string {
  const labels: Record<CultClassification, string> = {
    high_cult_potential: 'High Cult Potential',
    moderate_cult_potential: 'Moderate Cult Potential',
    limited_cult_potential: 'Limited Cult Potential',
    standard_work: 'Standard Work',
    cult_failed: 'Cult Potential Assessment Failed'
  };

  return labels[classification];
}

// ============================================================================
// EXPORTS
// ============================================================================

export { CULT_CRITERIA };
