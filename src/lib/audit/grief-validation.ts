/**
 * T1.2 — Grief Validation as pre-gate hard check
 * Universe Audit Protocol v10.0
 * 
 * Implements HARD CHECK for L3 (Architecture of Grief)
 * Validates BEFORE score calculation
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type GriefStage = 'denial' | 'anger' | 'bargaining' | 'depression' | 'acceptance';

export type GriefLevel = 'world' | 'society' | 'character' | 'scene';

export interface GriefPresence {
  stage: GriefStage;
  level: GriefLevel;
  present: boolean;
  description?: string;
  evidence?: string;
}

export interface GriefValidationResult {
  valid: boolean;
  dominantStage: GriefStage | null;
  stageDistribution: Record<GriefStage, GriefLevel[]>;
  errors: GriefValidationError[];
  warnings: GriefValidationWarning[];
  structuralHoles: StructuralHole[];
  dominantIncomplete: boolean;
}

export interface GriefValidationError {
  code: string;
  message: string;
  stage?: GriefStage;
  level?: GriefLevel;
}

export interface GriefValidationWarning {
  code: string;
  message: string;
  stage?: GriefStage;
  level?: GriefLevel;
}

export interface StructuralHole {
  stage: GriefStage;
  missingLevels: GriefLevel[];
  severity: 'critical' | 'major' | 'minor';
}

// ============================================================================
// VALIDATION RULES
// ============================================================================

/**
 * RULE 1: Each stage must be present on ≥2 levels
 * Otherwise: structural_hole
 */
const MIN_LEVELS_PER_STAGE = 2;

/**
 * RULE 2: Dominant stage must be present on ALL 4 levels
 * Otherwise: dominant_incomplete
 */
const REQUIRED_LEVELS_FOR_DOMINANT: GriefLevel[] = ['world', 'society', 'character', 'scene'];

// ============================================================================
// GRIEF STAGE KEYWORDS
// ============================================================================

const GRIEF_KEYWORDS: Record<GriefStage, string[]> = {
  denial: [
    'отрицани', 'отказыва', 'не вер', 'не может быть', 'отверга',
    'игнорир', 'притворя', 'отвод', 'невозможно', 'ошибка',
    'слепота', 'избегани', 'иллюзи', 'нормальн', 'не принима'
  ],
  anger: [
    'гнев', 'ярость', 'злость', 'ненавис', 'обвиня', 'обида',
    'горечь', 'враждеб', 'ярост', 'возмущени', 'гнева',
    'насили', 'разрушени', 'мщени', 'месть'
  ],
  bargaining: [
    'сделк', 'торг', 'договор', 'компромисс', 'обмен',
    'если бы', 'а что если', 'услови', 'обещани', 'мольба',
    'отчаяни', 'попытка контрол', 'договориться'
  ],
  depression: [
    'грусть', 'скорбь', 'печаль', 'отчаяни', 'безнадёж', 'пустот',
    'оцепенени', 'уход', 'одиночество', 'тьма', 'потерян',
    'бессмыслен', 'страдани', 'боль', 'траур', 'тоска'
  ],
  acceptance: [
    'приняти', 'покой', 'понима', 'освобожде', 'отпуска',
    'примирени', 'объяти', 'исцелени', 'рост', 'движение дальше',
    'разрешени', 'мудрость', 'преображени', 'новая реальность'
  ]
};

// ============================================================================
// LEVEL KEYWORDS
// ============================================================================

const LEVEL_KEYWORDS: Record<GriefLevel, string[]> = {
  world: [
    'мир', 'вселенн', 'царство', 'королевство', 'наци', 'государство',
    'цивилизац', 'космос', 'реальность', 'закон природы', 'мироздани'
  ],
  society: [
    'обществ', 'культур', 'сообществ', 'народ', 'населени',
    'социальн', 'политическ', 'экономическ', 'институт', 'группа'
  ],
  character: [
    'персонаж', 'герой', 'протагонист', 'человек', 'личность',
    'разум', 'сердце', 'душа', 'психик', 'внутренн'
  ],
  scene: [
    'сцена', 'момент', 'действие', 'диалог', 'взаимодействие',
    'конкретн', 'видим', 'проявлени', 'выражени', 'эпизод'
  ]
};

// ============================================================================
// MAIN VALIDATION FUNCTION
// ============================================================================

/**
 * Validates grief architecture
 * NON-NEGOTIABLE: This is a HARD CHECK before L3 scoring
 */
export function validateGriefArchitecture(
  griefData: GriefPresence[]
): GriefValidationResult {
  const errors: GriefValidationError[] = [];
  const warnings: GriefValidationWarning[] = [];
  const structuralHoles: StructuralHole[] = [];
  
  // Build stage distribution map
  const stageDistribution: Record<GriefStage, GriefLevel[]> = {
    denial: [],
    anger: [],
    bargaining: [],
    depression: [],
    acceptance: []
  };

  for (const entry of griefData) {
    if (entry.present) {
      if (!stageDistribution[entry.stage].includes(entry.level)) {
        stageDistribution[entry.stage].push(entry.level);
      }
    }
  }

  // RULE 1: Check for structural holes (each stage on ≥2 levels)
  for (const stage of Object.keys(stageDistribution) as GriefStage[]) {
    const levels = stageDistribution[stage];
    if (levels.length > 0 && levels.length < MIN_LEVELS_PER_STAGE) {
      const missingLevels = REQUIRED_LEVELS_FOR_DOMINANT.filter(l => !levels.includes(l));
      structuralHoles.push({
        stage,
        missingLevels,
        severity: levels.length === 1 ? 'critical' : 'major'
      });
      errors.push({
        code: 'structural_hole',
        message: `Стадия «${stage}» представлена только на ${levels.length} уровне(ях). Минимум: ${MIN_LEVELS_PER_STAGE}`,
        stage,
        level: levels[0]
      });
    }
  }

  // Identify dominant stage
  let dominantStage: GriefStage | null = null;
  let maxLevels = 0;
  
  for (const stage of Object.keys(stageDistribution) as GriefStage[]) {
    if (stageDistribution[stage].length > maxLevels) {
      maxLevels = stageDistribution[stage].length;
      dominantStage = stage;
    }
  }

  // RULE 2: Check dominant stage completeness
  let dominantIncomplete = false;
  
  if (dominantStage) {
    const dominantLevels = stageDistribution[dominantStage];
    const missingLevels = REQUIRED_LEVELS_FOR_DOMINANT.filter(l => !dominantLevels.includes(l));
    
    if (missingLevels.length > 0) {
      dominantIncomplete = true;
      errors.push({
        code: 'dominant_incomplete',
        message: `Доминантная стадия «${dominantStage}» не имеет проявлений на уровнях: ${missingLevels.join(', ')}`,
        stage: dominantStage
      });
    }
  }

  // Check for missing stages entirely
  for (const stage of Object.keys(stageDistribution) as GriefStage[]) {
    if (stageDistribution[stage].length === 0) {
      warnings.push({
        code: 'missing_stage',
        message: `Стадия «${stage}» не представлена в архитектуре горя`,
        stage
      });
    }
  }

  return {
    valid: errors.length === 0,
    dominantStage,
    stageDistribution,
    errors,
    warnings,
    structuralHoles,
    dominantIncomplete
  };
}

// ============================================================================
// TEXT ANALYSIS
// ============================================================================

/**
 * Analyzes text for grief stage presence
 * Returns detected grief presences
 */
export function analyzeGriefInText(text: string): GriefPresence[] {
  const presences: GriefPresence[] = [];
  const lowerText = text.toLowerCase();

  for (const stage of Object.keys(GRIEF_KEYWORDS) as GriefStage[]) {
    for (const level of Object.keys(LEVEL_KEYWORDS) as GriefLevel[]) {
      const stageKeywords = GRIEF_KEYWORDS[stage];
      const levelKeywords = LEVEL_KEYWORDS[level];
      
      let hasStage = false;
      let hasLevel = false;
      let matchedKeyword = '';

      for (const keyword of stageKeywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
          hasStage = true;
          matchedKeyword = keyword;
          break;
        }
      }

      for (const keyword of levelKeywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
          hasLevel = true;
          break;
        }
      }

      presences.push({
        stage,
        level,
        present: hasStage && hasLevel,
        description: hasStage && hasLevel ? `Обнаружена стадия «${stage}» на уровне «${level}»` : undefined,
        evidence: hasStage ? matchedKeyword : undefined
      });
    }
  }

  return presences;
}

// ============================================================================
// GATE INTEGRATION
// ============================================================================

/**
 * Executes L3 gate with grief check
 * This is the HARD CHECK entry point
 * 
 * NON-NEGOTIABLE: Call this BEFORE any L3 scoring
 */
export function executeL3GateWithGriefCheck(
  narrativeContent: string,
  providedGriefData?: GriefPresence[]
): {
  passed: boolean;
  validationResult: GriefValidationResult;
  blockReason?: string;
  fixes: string[];
} {
  // Use provided data or analyze from text
  const griefData = providedGriefData || analyzeGriefInText(narrativeContent);
  const validationResult = validateGriefArchitecture(griefData);
  
  const fixes: string[] = [];

  if (!validationResult.valid) {
    // Generate specific fixes
    for (const hole of validationResult.structuralHoles) {
      fixes.push(
        `[КРИТИЧЕСКОЕ] Добавьте проявления стадии «${hole.stage}» на уровнях: ${hole.missingLevels.join(', ')}`
      );
    }

    if (validationResult.dominantIncomplete && validationResult.dominantStage) {
      const dominantLevels = validationResult.stageDistribution[validationResult.dominantStage];
      const missing = REQUIRED_LEVELS_FOR_DOMINANT.filter(l => !dominantLevels.includes(l));
      fixes.push(
        `[ОБЯЗАТЕЛЬНОЕ] Доминантная стадия «${validationResult.dominantStage}» должна проявляться на всех уровнях. Отсутствуют: ${missing.join(', ')}`
      );
    }

    return {
      passed: false,
      validationResult,
      blockReason: 'Валидация архитектуры горя не пройдена — см. рекомендации ниже',
      fixes
    };
  }

  return {
    passed: true,
    validationResult,
    fixes: []
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Creates a grief presence entry
 */
export function createGriefPresence(
  stage: GriefStage,
  level: GriefLevel,
  present: boolean,
  description?: string
): GriefPresence {
  return {
    stage,
    level,
    present,
    description,
    evidence: present ? 'Помечено вручную как присутствующее' : undefined
  };
}

/**
 * Gets the dominant stage from distribution
 */
export function getDominantStage(
  distribution: Record<GriefStage, GriefLevel[]>
): GriefStage | null {
  let dominant: GriefStage | null = null;
  let maxCount = 0;

  for (const stage of Object.keys(distribution) as GriefStage[]) {
    if (distribution[stage].length > maxCount) {
      maxCount = distribution[stage].length;
      dominant = stage;
    }
  }

  return dominant;
}

/**
 * Formats grief validation result for display
 */
export function formatGriefValidationResult(result: GriefValidationResult): string {
  const lines: string[] = [];
  
  lines.push('## Валидация архитектуры горя');
  lines.push('');
  lines.push(`**Статус:** ${result.valid ? 'ПРОЙДЕНО' : 'НЕ ПРОЙДЕНО'}`);
  lines.push(`**Доминантная стадия:** ${result.dominantStage || 'Не определена'}`);
  lines.push('');

  lines.push('### Распределение по стадиям:');
  for (const stage of Object.keys(result.stageDistribution) as GriefStage[]) {
    const levels = result.stageDistribution[stage];
    lines.push(`- ${stage}: ${levels.length > 0 ? levels.join(', ') : '(не представлена)'}`);
  }
  lines.push('');

  if (result.errors.length > 0) {
    lines.push('### Ошибки:');
    for (const error of result.errors) {
      lines.push(`- ❌ [${error.code}] ${error.message}`);
    }
    lines.push('');
  }

  if (result.warnings.length > 0) {
    lines.push('### Предупреждения:');
    for (const warning of result.warnings) {
      lines.push(`- ⚠️ [${warning.code}] ${warning.message}`);
    }
    lines.push('');
  }

  if (result.structuralHoles.length > 0) {
    lines.push('### Структурные пробелы:');
    for (const hole of result.structuralHoles) {
      lines.push(`- [${hole.severity.toUpperCase()}] ${hole.stage}: отсутствуют уровни ${hole.missingLevels.join(', ')}`);
    }
  }

  return lines.join('\n');
}

// ============================================================================
// EXPORTS
// ============================================================================

export const GRIEF_STAGES: GriefStage[] = ['denial', 'anger', 'bargaining', 'depression', 'acceptance'];

export const GRIEF_LEVELS: GriefLevel[] = ['world', 'society', 'character', 'scene'];
