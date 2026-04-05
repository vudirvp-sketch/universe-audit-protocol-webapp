/**
 * T2.3 — Generative Templates
 * Universe Audit Protocol v10.0
 * 
 * Implements conditional generative templates:
 * - §9: Law → Grief Stage derivation
 * - §12: Theme → Dilemma derivation
 * 
 * Templates activate automatically when required inputs absent
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface GenerativeTemplate {
  id: string;
  name: string;
  triggerCondition: (input: Record<string, unknown>) => boolean;
  generate: (input: Record<string, unknown>) => GeneratedOutput;
  description: string;
}

export interface GeneratedOutput {
  success: boolean;
  generatedFields: Record<string, unknown>;
  confidence: number;
  reasoning: string;
  alternatives?: Record<string, unknown>[];
}

export interface LawToGriefInput {
  thematicLaw?: string;
  worldRule?: string;
  deprivationType?: string;
  dominantStage?: string;
}

export interface ThemeToDilemmaInput {
  theme?: string;
  thematicLaw?: string;
  protagonistValue?: string;
  antagonistValue?: string;
  finalDilemma?: string;
}

// ============================================================================
// DEPRIVATION TO GRIEF STAGE MAPPING (§9)
// ============================================================================

const DEPRIVATION_TO_GRIEF_MAP: Record<string, {
  stage: string;
  reasoning: string;
}> = {
  // Loss-based deprivations
  'death': { stage: 'denial', reasoning: 'Death triggers initial denial as the first response to loss' },
  'loss': { stage: 'denial', reasoning: 'Loss typically initiates denial as the protective mechanism' },
  'separation': { stage: 'denial', reasoning: 'Separation from attachment creates denial response' },
  
  // Injustice-based deprivations
  'injustice': { stage: 'anger', reasoning: 'Injustice naturally triggers anger at the unfairness' },
  'betrayal': { stage: 'anger', reasoning: 'Betrayal provokes anger at the breach of trust' },
  'oppression': { stage: 'anger', reasoning: 'Oppression fuels anger at powerlessness' },
  
  // Control-based deprivations
  'control_loss': { stage: 'bargaining', reasoning: 'Loss of control leads to attempts to regain it through bargaining' },
  'uncertainty': { stage: 'bargaining', reasoning: 'Uncertainty triggers bargaining for certainty' },
  'powerlessness': { stage: 'bargaining', reasoning: 'Powerlessness leads to bargaining for agency' },
  
  // Meaning-based deprivations
  'meaninglessness': { stage: 'depression', reasoning: 'Loss of meaning creates depressive response' },
  'hopelessness': { stage: 'depression', reasoning: 'Hopelessness naturally leads to depression' },
  'isolation': { stage: 'depression', reasoning: 'Isolation triggers depressive withdrawal' },
  
  // Transformation-based deprivations
  'transformation': { stage: 'acceptance', reasoning: 'Transformation implies movement toward acceptance' },
  'growth': { stage: 'acceptance', reasoning: 'Growth suggests acceptance of change' },
  'reconciliation': { stage: 'acceptance', reasoning: 'Reconciliation indicates acceptance' }
};

// ============================================================================
// THEME TO DILEMMA MAPPING (§12)
// ============================================================================

const THEME_TO_DILEMMA_MAP: Record<string, {
  value1: string;
  value2: string;
  conflict: string;
}> = {
  'freedom': {
    value1: 'Individual Freedom',
    value2: 'Collective Safety',
    conflict: 'Freedom vs Security'
  },
  'love': {
    value1: 'Personal Love',
    value2: 'Duty/Responsibility',
    conflict: 'Heart vs Obligation'
  },
  'truth': {
    value1: 'Honest Truth',
    value2: 'Protective Lies',
    conflict: 'Truth vs Compassion'
  },
  'power': {
    value1: 'Power for Good',
    value2: 'Power\'s Corruption',
    conflict: 'Power vs Integrity'
  },
  'identity': {
    value1: 'Authentic Self',
    value2: 'Social Expectations',
    conflict: 'Self vs Society'
  },
  'justice': {
    value1: 'Strict Justice',
    value2: 'Mercy/Forgiveness',
    conflict: 'Justice vs Compassion'
  },
  'loyalty': {
    value1: 'Personal Loyalty',
    value2: 'Moral Principles',
    conflict: 'Loyalty vs Ethics'
  },
  'sacrifice': {
    value1: 'Self-Sacrifice',
    value2: 'Self-Preservation',
    conflict: 'Noble Sacrifice vs Survival'
  },
  'change': {
    value1: 'Embracing Change',
    value2: 'Preserving Tradition',
    conflict: 'Progress vs Stability'
  },
  'belonging': {
    value1: 'True Belonging',
    value2: 'Fitting In',
    conflict: 'Authenticity vs Acceptance'
  }
};

// ============================================================================
// §9: LAW → GRIEF STAGE DERIVATION
// ============================================================================

/**
 * Derives grief stage from thematic law when dominant_stage not provided
 * Activates automatically when dominant_stage is absent
 */
export function deriveGriefFromLaw(input: LawToGriefInput): GeneratedOutput {
  // Check if derivation is needed
  if (input.dominantStage) {
    return {
      success: true,
      generatedFields: { dominantStage: input.dominantStage },
      confidence: 1.0,
      reasoning: 'Dominant stage already provided - no derivation needed'
    };
  }

  // Need to derive from deprivation type
  const lawText = (input.thematicLaw || input.worldRule || '').toLowerCase();
  
  // Find matching deprivation type
  for (const [deprivationType, mapping] of Object.entries(DEPRIVATION_TO_GRIEF_MAP)) {
    if (lawText.includes(deprivationType) || 
        (input.deprivationType && input.deprivationType.toLowerCase().includes(deprivationType))) {
      return {
        success: true,
        generatedFields: {
          dominantStage: mapping.stage,
          deprivationType: deprivationType
        },
        confidence: 0.85,
        reasoning: mapping.reasoning
      };
    }
  }

  // Default derivation based on law characteristics
  const derivedStage = deriveFromLawCharacteristics(lawText);
  
  return {
    success: true,
    generatedFields: { dominantStage: derivedStage.stage },
    confidence: derivedStage.confidence,
    reasoning: derivedStage.reasoning,
    alternatives: [
      { dominantStage: 'denial', reasoning: 'Alternative: Law suggests initial loss response' },
      { dominantStage: 'anger', reasoning: 'Alternative: Law suggests conflict response' }
    ]
  };
}

function deriveFromLawCharacteristics(lawText: string): {
  stage: string;
  confidence: number;
  reasoning: string;
} {
  // Check for loss indicators
  if (lawText.includes('loss') || lawText.includes('gone') || lawText.includes('without')) {
    return {
      stage: 'denial',
      confidence: 0.7,
      reasoning: 'Law characteristics suggest loss-based denial as dominant'
    };
  }

  // Check for conflict indicators
  if (lawText.includes('conflict') || lawText.includes('against') || lawText.includes('oppose')) {
    return {
      stage: 'anger',
      confidence: 0.7,
      reasoning: 'Law characteristics suggest conflict-based anger as dominant'
    };
  }

  // Check for bargaining indicators
  if (lawText.includes('exchange') || lawText.includes('trade') || lawText.includes('cost')) {
    return {
      stage: 'bargaining',
      confidence: 0.7,
      reasoning: 'Law characteristics suggest cost-based bargaining as dominant'
    };
  }

  // Default to depression for heavy thematic laws
  return {
    stage: 'depression',
    confidence: 0.6,
    reasoning: 'Default: Heavy thematic weight suggests depression as dominant'
  };
}

// ============================================================================
// §12: THEME → DILEMMA DERIVATION
// ============================================================================

/**
 * Derives dilemma from theme when final_dilemma not provided
 * Activates automatically when final_dilemma is absent
 */
export function deriveDilemmaFromTheme(input: ThemeToDilemmaInput): GeneratedOutput {
  // Check if derivation is needed
  if (input.finalDilemma) {
    return {
      success: true,
      generatedFields: { finalDilemma: input.finalDilemma },
      confidence: 1.0,
      reasoning: 'Final dilemma already provided - no derivation needed'
    };
  }

  const themeText = (input.theme || input.thematicLaw || '').toLowerCase();
  
  // Find matching theme
  for (const [themeKey, mapping] of Object.entries(THEME_TO_DILEMMA_MAP)) {
    if (themeText.includes(themeKey)) {
      const dilemma = createDilemma(mapping, input);
      return {
        success: true,
        generatedFields: {
          finalDilemma: dilemma,
          conflictingValues: [mapping.value1, mapping.value2]
        },
        confidence: 0.8,
        reasoning: `Theme "${themeKey}" naturally creates conflict between ${mapping.value1} and ${mapping.value2}`
      };
    }
  }

  // Default derivation for unknown themes
  return deriveDefaultDilemma(themeText, input);
}

function createDilemma(
  mapping: typeof THEME_TO_DILEMMA_MAP['freedom'],
  input: ThemeToDilemmaInput
): string {
  const value1 = input.protagonistValue || mapping.value1;
  const value2 = input.antagonistValue || mapping.value2;
  
  return `Must choose between ${value1} and ${value2} - ${mapping.conflict}`;
}

function deriveDefaultDilemma(
  themeText: string,
  input: ThemeToDilemmaInput
): GeneratedOutput {
  // Create generic dilemma based on theme
  const genericDilemma = input.protagonistValue && input.antagonistValue
    ? `Must choose between ${input.protagonistValue} and ${input.antagonistValue}`
    : 'Must choose between two conflicting values derived from theme';

  return {
    success: true,
    generatedFields: {
      finalDilemma: genericDilemma,
      conflictingValues: [
        input.protagonistValue || 'Protagonist Value',
        input.antagonistValue || 'Antagonist Value'
      ]
    },
    confidence: 0.5,
    reasoning: 'Generic dilemma created from available theme information',
    alternatives: [
      { finalDilemma: 'Personal desire conflicts with greater good' },
      { finalDilemma: 'Individual needs clash with collective responsibility' }
    ]
  };
}

// ============================================================================
// TEMPLATE REGISTRY
// ============================================================================

const GENERATIVE_TEMPLATES: GenerativeTemplate[] = [
  {
    id: 'law-to-grief',
    name: '§9 Law → Grief Stage Derivation',
    description: 'Derives dominant grief stage from thematic law when not provided',
    triggerCondition: (input) => !input.dominantStage && (!!input.thematicLaw || !!input.worldRule),
    generate: (input) => deriveGriefFromLaw(input as LawToGriefInput)
  },
  {
    id: 'theme-to-dilemma',
    name: '§12 Theme → Dilemma Derivation',
    description: 'Derives final dilemma from theme when not provided',
    triggerCondition: (input) => !input.finalDilemma && (!!input.theme || !!input.thematicLaw),
    generate: (input) => deriveDilemmaFromTheme(input as ThemeToDilemmaInput)
  }
];

// ============================================================================
// MAIN TEMPLATE APPLICATION
// ============================================================================

/**
 * Applies applicable generative templates to input
 * Returns all generated fields combined
 */
export function applyGenerativeTemplates(
  input: Record<string, unknown>
): {
  appliedTemplates: string[];
  generatedFields: Record<string, unknown>;
  confidence: number;
  reasoning: string;
} {
  const appliedTemplates: string[] = [];
  const generatedFields: Record<string, unknown> = {};
  const reasonings: string[] = [];
  let totalConfidence = 1.0;
  let templateCount = 0;

  for (const template of GENERATIVE_TEMPLATES) {
    if (template.triggerCondition(input)) {
      const result = template.generate(input);
      
      if (result.success) {
        appliedTemplates.push(template.id);
        Object.assign(generatedFields, result.generatedFields);
        reasonings.push(`[${template.name}] ${result.reasoning}`);
        totalConfidence *= result.confidence;
        templateCount++;
      }
    }
  }

  // Average confidence if multiple templates applied
  const finalConfidence = templateCount > 0 
    ? Math.pow(totalConfidence, 1 / templateCount)
    : 1.0;

  return {
    appliedTemplates,
    generatedFields,
    confidence: finalConfidence,
    reasoning: reasonings.join('\n')
  };
}

/**
 * Checks if any templates would be triggered
 */
export function checkTemplateTriggers(
  input: Record<string, unknown>
): { triggered: boolean; templates: string[] } {
  const triggeredTemplates: string[] = [];

  for (const template of GENERATIVE_TEMPLATES) {
    if (template.triggerCondition(input)) {
      triggeredTemplates.push(template.name);
    }
  }

  return {
    triggered: triggeredTemplates.length > 0,
    templates: triggeredTemplates
  };
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

export const TEMPLATE_IDS = GENERATIVE_TEMPLATES.map(t => t.id);

export { GENERATIVE_TEMPLATES };
