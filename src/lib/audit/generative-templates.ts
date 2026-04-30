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
  // Deprivations based on loss
  'смерть': { stage: 'denial', reasoning: 'Смерть вызывает первоначальное отрицание как первую реакцию на потерю' },
  'потеря': { stage: 'denial', reasoning: 'Потеря обычно инициирует отрицание как защитный механизм' },
  'разлука': { stage: 'denial', reasoning: 'Разлука с привязанностью создаёт реакцию отрицания' },
  
  // Deprivations based on injustice
  'несправедливость': { stage: 'anger', reasoning: 'Несправедливость естественным образом вызывает гнев' },
  'предательство': { stage: 'anger', reasoning: 'Предательство вызывает гнев из-за нарушения доверия' },
  'угнетение': { stage: 'anger', reasoning: 'Угнетение разжигает гнев от бессилия' },
  
  // Deprivations based on loss of control
  'потеря контроля': { stage: 'bargaining', reasoning: 'Потеря контроля приводит к попыткам вернуть его через торг' },
  'неопределённость': { stage: 'bargaining', reasoning: 'Неопределённость побуждает к торгу за определённость' },
  'бессилие': { stage: 'bargaining', reasoning: 'Бессилие приводит к торгу за дееспособность' },
  
  // Deprivations based on meaning loss
  'бессмысленность': { stage: 'depression', reasoning: 'Потеря смысла создаёт депрессивную реакцию' },
  'безнадёжность': { stage: 'depression', reasoning: 'Безнадёжность естественным образом ведёт к депрессии' },
  'одиночество': { stage: 'depression', reasoning: 'Одиночество вызывает депрессивный уход' },
  
  // Deprivations based on transformation
  'преображение': { stage: 'acceptance', reasoning: 'Преображение подразумевает движение к принятию' },
  'рост': { stage: 'acceptance', reasoning: 'Рост предполагает принятие изменений' },
  'примирение': { stage: 'acceptance', reasoning: 'Примирение указывает на принятие' }
};

// ============================================================================
// THEME TO DILEMMA MAPPING (§12)
// ============================================================================

const THEME_TO_DILEMMA_MAP: Record<string, {
  value1: string;
  value2: string;
  conflict: string;
}> = {
  'свобода': {
    value1: 'Личная свобода',
    value2: 'Коллективная безопасность',
    conflict: 'Свобода против Безопасности'
  },
  'любовь': {
    value1: 'Личная любовь',
    value2: 'Долг / Ответственность',
    conflict: 'Сердце против Долга'
  },
  'истина': {
    value1: 'Честная правда',
    value2: 'Защитная ложь',
    conflict: 'Истина против Сострадания'
  },
  'власть': {
    value1: 'Власть во благо',
    value2: 'Развращающая власть',
    conflict: 'Власть против Честности'
  },
  'идентичность': {
    value1: 'Истинное «Я»',
    value2: 'Социальные ожидания',
    conflict: 'Личность против Общества'
  },
  'справедливость': {
    value1: 'Строгая справедливость',
    value2: 'Милосердие / Прощение',
    conflict: 'Справедливость против Милосердия'
  },
  'верность': {
    value1: 'Личная верность',
    value2: 'Моральные принципы',
    conflict: 'Верность против Этики'
  },
  'жертва': {
    value1: 'Самопожертвование',
    value2: 'Самосохранение',
    conflict: 'Благородная жертва против Выживания'
  },
  'перемены': {
    value1: 'Принятие перемен',
    value2: 'Сохранение традиций',
    conflict: 'Прогресс против Стабильности'
  },
  'принадлежность': {
    value1: 'Истинная принадлежность',
    value2: 'Конформизм',
    conflict: 'Аутентичность против Принятия'
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
      reasoning: 'Доминантная стадия уже предоставлена — вывод не нужен'
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
  if (lawText.includes('потеря') || lawText.includes('утрат') || lawText.includes('без') || lawText.includes('loss') || lawText.includes('gone')) {
    return {
      stage: 'denial',
      confidence: 0.7,
      reasoning: 'Характеристики закона указывают на отрицание на основе потери как доминантную стадию'
    };
  }

  // Check for conflict indicators
  if (lawText.includes('конфликт') || lawText.includes('против') || lawText.includes('борьба') || lawText.includes('conflict') || lawText.includes('against')) {
    return {
      stage: 'anger',
      confidence: 0.7,
      reasoning: 'Характеристики закона указывают на гнев на основе конфликта как доминантную стадию'
    };
  }

  // Check for bargaining indicators
  if (lawText.includes('обмен') || lawText.includes('плата') || lawText.includes('цена') || lawText.includes('exchange') || lawText.includes('cost')) {
    return {
      stage: 'bargaining',
      confidence: 0.7,
      reasoning: 'Характеристики закона указывают на торг на основе платы как доминантную стадию'
    };
  }

  // Default to depression for heavy thematic laws
  return {
    stage: 'depression',
    confidence: 0.6,
    reasoning: 'По умолчанию: тяжесть тематического закона указывает на депрессию как доминантную стадию'
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
      reasoning: 'Итоговая дилемма уже предоставлена — вывод не нужен'
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
        reasoning: `Тема «${themeKey}» естественным образом создаёт конфликт между ${mapping.value1} и ${mapping.value2}`
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
  
  return `Необходимо выбрать между ${value1} и ${value2} — ${mapping.conflict}`;
}

function deriveDefaultDilemma(
  themeText: string,
  input: ThemeToDilemmaInput
): GeneratedOutput {
  // Create generic dilemma based on theme
  const genericDilemma = input.protagonistValue && input.antagonistValue
    ? `Необходимо выбрать между ${input.protagonistValue} и ${input.antagonistValue}`
    : 'Необходимо выбрать между двумя конфликтующими ценностями, производными от темы';

  return {
    success: true,
    generatedFields: {
      finalDilemma: genericDilemma,
      conflictingValues: [
        input.protagonistValue || 'Ценность протагониста',
        input.antagonistValue || 'Ценность антагониста'
      ]
    },
    confidence: 0.5,
    reasoning: 'Общая дилемма создана из доступной информации о теме',
    alternatives: [
      { finalDilemma: 'Личное желание конфликтует с общим благом' },
      { finalDilemma: 'Индивидуальные потребности сталкиваются с коллективной ответственностью' }
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
