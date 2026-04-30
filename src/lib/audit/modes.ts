/**
 * T0.1 — Audit Mode Branching System
 * Universe Audit Protocol v10.0
 * 
 * Implements three audit modes: CONFLICT, KISHŌ, HYBRID
 * Each mode has distinct execution logic and requirements
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// AuditMode is the canonical type from ./types — do not duplicate here
export type { AuditMode } from './types';
import type { AuditMode } from './types';

export interface ModeIndicators {
  hasMultipleWorldviews: boolean;
  hasSystematicInconsistencies: boolean;
  hasCanonicalContradictions: boolean;
  hasAuthorUncertainty: boolean;
  hasIntentionalAmbiguity: boolean;
  kishōScore: number; // 0-1 scale
}

export interface ModeExecutionConfig {
  mode: AuditMode;
  priorityOrder: string[];
  haltOnInconsistency: boolean;
  requireTenRepaintingTest: boolean;
  outputFormat: 'standard' | 'forked' | 'reconciled';
  specialInstructions: string[];
  gateOverrides: Record<string, boolean>;
}

export interface TenRepaintingTest {
  originalClaim: string;
  repaintings: string[];
  consistencyScore: number; // 0-1
  passed: boolean;
}

// ============================================================================
// MODE DETECTION LOGIC
// ============================================================================

/**
 * Detects the appropriate audit mode based on narrative characteristics
 * 
 * Decision Matrix:
 * - CONFLICT: Multiple canonical contradictions, systematic inconsistencies
 * - KISHŌ: Author uncertainty, intentional ambiguity, requires validation
 * - HYBRID: Mixed indicators, requires both approaches
 */
export function detectAuditMode(indicators: ModeIndicators): AuditMode {
  const {
    hasMultipleWorldviews,
    hasSystematicInconsistencies,
    hasCanonicalContradictions,
    hasAuthorUncertainty,
    hasIntentionalAmbiguity,
    kishōScore
  } = indicators;

  // KISHŌ mode: Author uncertainty or intentional ambiguity takes precedence
  if (hasAuthorUncertainty || hasIntentionalAmbiguity || kishōScore > 0.7) {
    return 'kishō';
  }

  // CONFLICT mode: Clear canonical contradictions
  if (hasCanonicalContradictions || hasSystematicInconsistencies) {
    // Check for hybrid situation
    if (hasMultipleWorldviews && kishōScore > 0.3) {
      return 'hybrid';
    }
    return 'conflict';
  }

  // HYBRID mode: Mixed indicators
  if (hasMultipleWorldviews && (hasAuthorUncertainty || kishōScore > 0.3)) {
    return 'hybrid';
  }

  // Default to CONFLICT for standard audit
  return 'conflict';
}

// ============================================================================
// MODE EXECUTION CONFIGURATIONS
// ============================================================================

const CONFLICT_CONFIG: ModeExecutionConfig = {
  mode: 'conflict',
  priorityOrder: [
    'identify_contradictions',
    'map_conflict_sources',
    'evaluate_canonical_weight',
    'propose_resolutions',
    'select_optimal_resolution'
  ],
  haltOnInconsistency: false,
  requireTenRepaintingTest: false,
  outputFormat: 'standard',
  specialInstructions: [
    'Все противоречия должны быть каталогизированы с указанием источников',
    'Канонический вес определяет приоритет разрешения',
    'Сохранять намеренные парадоксы, отмеченные автором'
  ],
  gateOverrides: {}
};

const KISHŌ_CONFIG: ModeExecutionConfig = {
  mode: 'kishō',
  priorityOrder: [
    'ten_repainting_test',
    'validate_uncertainty_sources',
    'establish_clarification_questions',
    'propose_author_dialogue',
    'document_ambiguity_zones'
  ],
  haltOnInconsistency: true,
  requireTenRepaintingTest: true,
  outputFormat: 'forked',
  specialInstructions: [
    'ОБЯЗАТЕЛЬНО выполнить тест десяти переформулировок перед продолжением',
    'Остановить при неразрешённой противоречивости до уточнения автором',
    'Выводить разветвлённые пути для неоднозначных элементов',
    'Никогда не предполагать намерения автора без явного подтверждения'
  ],
  gateOverrides: {
    'gate_2': true, // Additional validation at GATE-2
    'gate_4': true  // Require confirmation at GATE-4
  }
};

const HYBRID_CONFIG: ModeExecutionConfig = {
  mode: 'hybrid',
  priorityOrder: [
    'detect_contradiction_type',
    'separate_clear_from_ambiguous',
    'apply_conflict_resolution_to_clear',
    'apply_kishō_to_ambiguous',
    'synthesize_results'
  ],
  haltOnInconsistency: false,
  requireTenRepaintingTest: true,
  outputFormat: 'reconciled',
  specialInstructions: [
    'Применять логику КОНФЛИКТА к явным противоречиям',
    'Применять логику КИРЁ к неоднозначным элементам',
    'Синтез должен сохранять оба пути разрешения',
    'Документировать переключение режима в каждом разделе'
  ],
  gateOverrides: {
    'gate_3': true // Additional synthesis check
  }
};

// ============================================================================
// MAIN EXPORT FUNCTIONS
// ============================================================================

/**
 * Returns the execution configuration for the specified audit mode
 */
export function getModeExecutionConfig(mode: AuditMode): ModeExecutionConfig {
  switch (mode) {
    case 'conflict':
      return CONFLICT_CONFIG;
    case 'kishō':
      return KISHŌ_CONFIG;
    case 'hybrid':
      return HYBRID_CONFIG;
    default:
      throw new Error(`Unknown audit mode: ${mode}`);
  }
}

/**
 * Validates the audit mode before beginning audit
 * Returns validation result with any mode-specific requirements
 */
export function validateAuditMode(
  mode: AuditMode,
  input: {
    hasAuthorAccess: boolean;
    canRunRepaintingTest: boolean;
    hasCanonicalSources: boolean;
  }
): { valid: boolean; requirements: string[]; warnings: string[] } {
  const requirements: string[] = [];
  const warnings: string[] = [];

  switch (mode) {
    case 'kishō':
      if (!input.hasAuthorAccess) {
        warnings.push('Режим КИРЁ оптимален при наличии доступа к автору для уточнения');
      }
      if (!input.canRunRepaintingTest) {
        requirements.push('Режим КИРЁ требует возможности выполнения теста десяти переформулировок');
      }
      break;

    case 'hybrid':
      if (!input.canRunRepaintingTest) {
        requirements.push('Режим ГИБРИД требует возможности выполнения теста десяти переформулировок');
      }
      if (!input.hasCanonicalSources) {
        warnings.push('Режим ГИБРИД может иметь ограниченное разрешение конфликтов без канонических источников');
      }
      break;

    case 'conflict':
      if (!input.hasCanonicalSources) {
        warnings.push('Режим КОНФЛИКТ может иметь сниженную эффективность без канонических источников');
      }
      break;
  }

  return {
    valid: requirements.length === 0,
    requirements,
    warnings
  };
}

// ============================================================================
// TEN-REPAINTING TEST IMPLEMENTATION
// ============================================================================

/**
 * Executes the Ten-repainting test for KISHŌ mode validation
 * 
 * The test re-expresses a claim in 10 different ways to check for
 * hidden contradictions or ambiguities.
 */
export function executeTenRepaintingTest(
  originalClaim: string,
  repaintings: string[]
): TenRepaintingTest {
  if (repaintings.length < 10) {
    return {
      originalClaim,
      repaintings,
      consistencyScore: 0,
      passed: false
    };
  }

  // Calculate consistency score based on semantic similarity
  // In production, this would use embedding similarity
  let consistentCount = 0;
  
  for (const repainting of repaintings) {
    // Simple heuristic: check for negation contradictions
    const hasNegation = repainting.toLowerCase().includes('не ') ||
                        repainting.toLowerCase().includes('никогда') ||
                        repainting.toLowerCase().includes('ни за что');
    const originalHasNegation = originalClaim.toLowerCase().includes('не ') ||
                                 originalClaim.toLowerCase().includes('никогда') ||
                                 originalClaim.toLowerCase().includes('ни за что');
    
    if (hasNegation === originalHasNegation) {
      consistentCount++;
    }
  }

  const consistencyScore = consistentCount / repaintings.length;
  const passed = consistencyScore >= 0.8; // 80% threshold

  return {
    originalClaim,
    repaintings,
    consistencyScore,
    passed
  };
}

// ============================================================================
// MODE TRANSITION LOGIC
// ============================================================================

/**
 * Determines if mode transition is needed during audit
 * Can switch modes based on emerging evidence
 */
export function shouldTransitionMode(
  currentMode: AuditMode,
  newEvidence: {
    foundCanonicalContradiction: boolean;
    foundAuthorUncertainty: boolean;
    foundIntentionalAmbiguity: boolean;
  }
): { shouldTransition: boolean; newMode?: AuditMode; reason: string } {
  
  if (currentMode === 'kishō' && newEvidence.foundCanonicalContradiction) {
    return {
      shouldTransition: true,
      newMode: 'hybrid',
      reason: 'Обнаружено каноническое противоречие в режиме КИРЁ — переключение на ГИБРИД'
    };
  }

  if (currentMode === 'conflict' && newEvidence.foundAuthorUncertainty) {
    return {
      shouldTransition: true,
      newMode: 'hybrid',
      reason: 'Обнаружена авторская неопределённость в режиме КОНФЛИКТ — переключение на ГИБРИД'
    };
  }

  return {
    shouldTransition: false,
    reason: 'Переход между режимами не требуется'
  };
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

export const MODE_LABELS: Record<AuditMode, string> = {
  conflict: 'КОНФЛИКТ — Режим канонического разрешения',
  kishō: 'КИРЁ — Режим уточнения у автора',
  hybrid: 'ГИБРИД — Комбинированный режим'
};

export const MODE_DESCRIPTIONS: Record<AuditMode, string> = {
  conflict: 'Для нарративов с явными каноническими противоречиями, требующими разрешения на основе авторитетности источника.',
  kishō: 'Для нарративов с авторской неопределённостью или намеренной двусмысленностью, требующими диалога уточнения.',
  hybrid: 'Для нарративов со смешанными типами противоречий, требующими и канонического разрешения, и диалога с автором.'
};
