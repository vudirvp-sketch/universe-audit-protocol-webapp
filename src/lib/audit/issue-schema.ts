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
  
  // Высокая критичность + низкий риск = радикальное исправление
  if (criticality >= 8 && risk <= 4) {
    return {
      recommended: 'radical',
      reasoning: 'Высокая критичность при низком риске требует комплексного исправления'
    };
  }
  
  // Высокая критичность + высокий риск = компромисс
  if (criticality >= 7 && risk >= 6) {
    return {
      recommended: 'compromise',
      reasoning: 'Высокая критичность, но значительный риск требует сбалансированного подхода'
    };
  }
  
  // Низкая критичность = консервативное исправление
  if (criticality <= 3) {
    return {
      recommended: 'conservative',
      reasoning: 'Низкая критичность проблемы — минимального вмешательства достаточно'
    };
  }
  
  // Высокая трудоёмкость + средняя критичность = компромисс
  if (time_cost >= 7 && criticality >= 4 && criticality <= 7) {
    return {
      recommended: 'compromise',
      reasoning: 'Средняя критичность при высокой трудоёмкости — оптимален сбалансированный подход'
    };
  }
  
  // Высокий риск = консервативный подход по умолчанию
  if (risk >= 7) {
    return {
      recommended: 'conservative',
      reasoning: 'Высокорисковая среда — безопаснее консервативный подход'
    };
  }
  
  // По умолчанию компромисс для средних значений
  return {
    recommended: 'compromise',
    reasoning: 'Средние значения по осям — рекомендован сбалансированный подход'
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
        description: `Добавить конкретное проявление тематического закона в ${context}`,
        impact: 'Усиливает тематическое присутствие с минимальными изменениями',
        sideEffects: ['Могут потребоваться незначительные корректировки сцен']
      },
      compromise: {
        description: `Интегрировать тематический закон в существующие сюжетные точки в ${context}`,
        impact: 'Создаёт органичную тематическую интеграцию',
        sideEffects: ['Необходима переработка части диалогов', 'Незначительная корректировка темпа']
      },
      radical: {
        description: `Реструктурировать ${context}, сделав тематический закон центральной механикой мира`,
        impact: 'Тематический закон становится фундаментом нарративной логики',
        sideEffects: ['Существенная переработка мироустройства', 'Обновление мотивации персонажей', 'Реструктуризация сюжета']
      }
    },
    character_inconsistency: {
      conservative: {
        description: `Добавить переходную сцену, объясняющую поведение персонажа в ${context}`,
        impact: 'Объясняет несогласованность без изменения сюжета',
        sideEffects: ['Незначительное влияние на темп']
      },
      compromise: {
        description: `Пересмотреть мотивацию персонажа в ${context} для соответствия установленным чертам`,
        impact: 'Создаёт последовательный голос персонажа',
        sideEffects: ['Переработка диалогов', 'Необходимо уточнение мотивации']
      },
      radical: {
        description: `Реструктурировать арку персонажа в ${context} для устранения несогласованности у корня`,
        impact: 'Устраняет несогласованность фундаментально',
        sideEffects: ['Существенная перестройка арки', 'Возможные изменения сюжета', 'Влияние на других персонажей']
      }
    },
    world_logic_gap: {
      conservative: {
        description: `Добавить экспозицию, объясняющую логический пробел в ${context}`,
        impact: 'Устраняет пробел без изменения механик',
        sideEffects: ['Может ощущаться как искусственная экспозиция']
      },
      compromise: {
        description: `Ввести мягкое правило, заполняющее пробел в ${context}`,
        impact: 'Создаёт логическую связь',
        sideEffects: ['Новое правило требует проверок согласованности', 'Может затронуть смежные системы']
      },
      radical: {
        description: `Перепроектировать систему мира для устранения пробела в ${context}`,
        impact: 'Устраняет пробел у источника',
        sideEffects: ['Существенные изменения мироустройства', 'Может потребовать переработки сюжета', 'Каскадные эффекты согласованности']
      }
    }
  };

  return templates[issueType] || {
    conservative: {
      description: `Незначительное исправление проблемы в ${context}`,
      impact: 'Устраняет проблему с минимальными изменениями',
      sideEffects: ['Неизвестно']
    },
    compromise: {
      description: `Сбалансированное исправление проблемы в ${context}`,
      impact: 'Комплексно устраняет проблему',
      sideEffects: ['Требуется умеренная переработка']
    },
    radical: {
      description: `Комплексное исправление проблемы в ${context}`,
      impact: 'Устраняет проблему у корневой причины',
      sideEffects: ['Требуется существенная переработка', 'Возможны каскадные изменения']
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
