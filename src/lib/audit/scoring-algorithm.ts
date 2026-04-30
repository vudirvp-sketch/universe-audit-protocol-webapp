// Universe Audit Protocol v10.0 - Scoring Algorithm
import type { 
  ChecklistItem, 
  GateResult, 
  FixItem,
  AuthorProfileAnswers, 
  AuthorProfile,
  MediaType,
  GriefStage,
  GriefArchitectureMatrix,
  GriefMatrixCell
} from './types';
import { MASTER_CHECKLIST, AUTHOR_QUESTIONS } from './protocol-data';
import { getGateThreshold } from './types';

/**
 * Calculate score for a level
 * Formula: (Passed_Applicable / Total_Applicable) × 100%
 */
export function calculateLevelScore(
  checklist: ChecklistItem[], 
  level: 'L1' | 'L2' | 'L3' | 'L4',
  mediaType: MediaType
): { score: number; passed: number; failed: number; insufficient: number; total: number } {
  // Precise level filtering
  const preciseLevelItems = checklist.filter(item => {
    if (!item.applicable) return false;
    
    // Exact match
    if (item.level === level) return true;
    
    // Combined levels - count for both
    if (item.level === 'L1/L2' && (level === 'L1' || level === 'L2')) return true;
    if (item.level === 'L1/L3' && (level === 'L1' || level === 'L3')) return true;
    if (item.level === 'L2/L3' && (level === 'L2' || level === 'L3')) return true;
    if (item.level === 'L2/L4' && (level === 'L2' || level === 'L4')) return true;
    
    return false;
  });

  const passed = preciseLevelItems.filter(i => i.status === 'PASS').length;
  const failed = preciseLevelItems.filter(i => i.status === 'FAIL').length;
  const insufficient = preciseLevelItems.filter(i => i.status === 'INSUFFICIENT_DATA').length;
  
  // Calculate effective denominator (exclude insufficient data)
  const effectiveTotal = preciseLevelItems.length - insufficient;
  
  // If more than 50% have insufficient data, return 0 and flag
  if (insufficient > preciseLevelItems.length * 0.5) {
    return { score: 0, passed, failed, insufficient, total: preciseLevelItems.length };
  }
  
  const score = effectiveTotal > 0 ? Math.round((passed / effectiveTotal) * 100) : 0;
  
  return { score, passed, failed, insufficient, total: preciseLevelItems.length };
}

/**
 * Evaluate gate - returns GateResult with fix list if failed
 */
export function evaluateGate(
  checklist: ChecklistItem[],
  level: 'L1' | 'L2' | 'L3' | 'L4',
  mediaType: MediaType,
  auditMode: 'conflict' | 'kishō' | 'hybrid' = 'conflict'
): GateResult {
  const { score, passed, failed, insufficient, total } = calculateLevelScore(checklist, level, mediaType);
  
  // Use mode-specific threshold per Section 0.7
  const threshold = getGateThreshold(auditMode, level);
  const passedGate = score >= threshold;
  
  // Generate fix list if failed
  const fixList: FixItem[] = [];
  
  if (!passedGate) {
    const failedItems = checklist.filter(i => 
      i.applicable && 
      i.status === 'FAIL' && 
      i.level.includes(level)
    );
    
    failedItems.forEach((item, index) => {
      fixList.push({
        id: `FIX-${level}-${index + 1}`,
        description: item.text,
        severity: index < 3 ? 'critical' : index < 6 ? 'major' : 'minor',
        type: inferLogicHoleType(item.text),
        recommendedApproach: inferRecommendedApproach(item.text, index)
      });
    });
  }
  
  // Build conditions for each checklist item
  const conditions = checklist
    .filter(i => i.applicable && i.level.includes(level))
    .map(item => ({
      id: item.id,
      passed: item.status === 'PASS',
      message: `${item.id}: ${item.status}`
    }));
  
  return {
    gateId: `GATE-${level}`,
    gateName: `Гейт уровня ${level}`,
    status: passedGate ? 'passed' : 'failed',
    score,
    passed: passedGate,
    conditions,
    halt: !passedGate,
    fixes: fixList.map(f => f.description),
    metadata: {
      level,
      breakdown: {},
      threshold,
      auditMode,
    },
    // Legacy properties for UI compatibility
    level,
    applicableItems: total,
    passedItems: passed,
    failedItems: failed,
    insufficientDataItems: insufficient,
    fixList
  };
}

/**
 * Infer logic hole type from item text
 */
function inferLogicHoleType(text: string): FixItem['type'] {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('мотивац') || lowerText.includes('антагонист') || lowerText.includes('motivation') || lowerText.includes('antagonist')) return 'motivation';
  if (lowerText.includes('компетенц') || lowerText.includes('умн') || lowerText.includes('competence') || lowerText.includes('smart')) return 'competence';
  if (lowerText.includes('масштаб') || lowerText.includes('последстви') || lowerText.includes('scale') || lowerText.includes('consequence')) return 'scale';
  if (lowerText.includes('ресурс') || lowerText.includes('снабжен') || lowerText.includes('эконом') || lowerText.includes('resource') || lowerText.includes('supply') || lowerText.includes('economic')) return 'resources';
  if (lowerText.includes('памят') || lowerText.includes('забыл') || lowerText.includes('memory') || lowerText.includes('forgot')) return 'memory';
  if (lowerText.includes('идеологи') || lowerText.includes('фракц') || lowerText.includes('ideology') || lowerText.includes('faction')) return 'ideology';
  if (lowerText.includes('врем') || lowerText.includes('хронолог') || lowerText.includes('time') || lowerText.includes('chronology')) return 'time';
  
  return 'motivation'; // default
}

/**
 * Infer recommended approach based on position and text
 */
function inferRecommendedApproach(text: string, position: number): FixItem['recommendedApproach'] {
  if (position < 2) return 'radical';
  if (position < 5) return 'compromise';
  return 'conservative';
}

/**
 * Filter checklist items by media type
 */
export function filterByMediaType(checklist: ChecklistItem[], mediaType: MediaType): ChecklistItem[] {
  return checklist.map(item => {
    const applicable = checkMediaApplicability(item.tag, mediaType);
    return { ...item, applicable };
  });
}

/**
 * Check if a tag is applicable to media type
 */
export function checkMediaApplicability(
  tag: string, 
  mediaType: MediaType
): boolean {
  // CORE applies to all
  if (tag === 'CORE') return true;
  
  // Handle combined tags (e.g., "GAME|VISUAL")
  if (tag.includes('|')) {
    const tags = tag.split('|');
    return tags.some(t => checkMediaApplicability(t, mediaType));
  }
  
  // GAME tag - only for games and ttrpg
  if (tag === 'GAME' && (mediaType === 'game' || mediaType === 'ttrpg')) return true;
  
  // VISUAL tag - for film, anime, series
  if (tag === 'VISUAL' && ['film', 'anime', 'series'].includes(mediaType)) return true;
  
  // AUDIO tag - for film, anime, series (soundtrack/voice matters)
  if (tag === 'AUDIO' && ['film', 'anime', 'series'].includes(mediaType)) return true;
  
  // INTERACTIVE tag - for games and ttrpg
  if (tag === 'INTERACTIVE' && (mediaType === 'game' || mediaType === 'ttrpg')) return true;
  
  return false;
}

/**
 * Classify author profile based on weighted answers
 */
export function classifyAuthorProfile(answers: AuthorProfileAnswers): AuthorProfile {
  let weightedScore = 0;
  let maxScore = 0;
  
  AUTHOR_QUESTIONS.forEach(q => {
    maxScore += q.weight;
    if (answers[q.id]) {
      weightedScore += q.weight;
    }
  });
  
  const percentage = Math.round((weightedScore / maxScore) * 100);
  
  // Classification with confidence bands
  let type: AuthorProfile['type'];
  let confidence: AuthorProfile['confidence'];
  
  if (percentage >= 80) {
    type = 'gardener';
    confidence = 'high';
  } else if (percentage >= 60) {
    type = 'gardener';
    confidence = 'medium';
  } else if (percentage >= 45) {
    type = 'hybrid';
    confidence = 'high';
  } else if (percentage >= 35) {
    type = 'hybrid';
    confidence = 'low'; // Edge case - needs review
  } else if (percentage >= 20) {
    type = 'architect';
    confidence = 'medium';
  } else {
    type = 'architect';
    confidence = 'high';
  }
  
  // Edge case detection
  const keySignals = [answers.Q3, answers.Q5, answers.Q7];
  const keySignalsYes = keySignals.filter(Boolean).length;
  
  if (percentage >= 35 && percentage < 45) {
    // Edge case - check key signals alignment
    if (keySignalsYes === 3) {
      type = 'gardener';
      confidence = 'medium';
    } else if (keySignalsYes === 0) {
      type = 'architect';
      confidence = 'medium';
    }
  }
  
  // Main risks based on profile
  const mainRisks: string[] = [];
  const auditPriorities: string[] = [];
  
  if (type === 'gardener') {
    mainRisks.push('Дыры масштаба, ресурсов, времени');
    mainRisks.push('Фракции как декорация');
    auditPriorities.push('Разделы 3, 8 (L1)');
  } else if (type === 'architect') {
    mainRisks.push('Дыры компетенции');
    mainRisks.push('Стагнация персонажей');
    auditPriorities.push('Разделы 6, 8 (L1-L2)');
  } else {
    mainRisks.push('Рассинхрон уровней MDA+OT');
    auditPriorities.push('Раздел 1.6 (L1)');
  }
  
  return {
    type,
    percentage,
    confidence,
    mainRisks,
    auditPriorities
  };
}

/**
 * Determine audit mode based on answers
 */
export function determineAuditMode(
  hasAntagonist: boolean,
  victoryTrajectory: boolean,
  externalConflict: boolean
): 'conflict' | 'kishō' | 'hybrid' {
  const answers = [hasAntagonist, victoryTrajectory, externalConflict];
  const yesCount = answers.filter(Boolean).length;
  const noCount = answers.filter(a => !a).length;
  
  // All 3 yes → conflict; all 3 no → kishō; mixed → hybrid
  if (yesCount === 3) return 'conflict';
  if (noCount === 3) return 'kishō';
  if (yesCount >= 2) return 'conflict';  // 2 yes + 1 no
  if (noCount >= 2) return 'kishō';      // 2 no + 1 yes
  return 'hybrid';                         // This shouldn't happen with 3 booleans, but safety
}

/**
 * Initialize grief architecture matrix
 */
export function initializeGriefMatrix(): GriefArchitectureMatrix {
  const stages: GriefStage[] = ['denial', 'anger', 'bargaining', 'depression', 'acceptance'];
  const levels: ('character' | 'location' | 'mechanic' | 'act')[] = ['character', 'location', 'mechanic', 'act'];
  
  const cells: GriefMatrixCell[] = [];
  
  stages.forEach(stage => {
    levels.forEach(level => {
      cells.push({
        stage,
        level,
        confidence: 'absent'
      });
    });
  });
  
  return {
    dominantStage: null,
    cells
  };
}

/**
 * Calculate overall audit score
 */
export function calculateOverallScore(checklist: ChecklistItem[]): {
  score: number;
  percentage: number;
  applicable: number;
  passed: number;
  classification: 'cult_masterpiece' | 'powerful' | 'living_weak_soul' | 'decoration';
} {
  const applicable = checklist.filter(i => i.applicable);
  const passed = applicable.filter(i => i.status === 'PASS');
  const insufficient = applicable.filter(i => i.status === 'INSUFFICIENT_DATA');
  
  // Exclude insufficient data from denominator
  const effectiveTotal = applicable.length - insufficient.length;
  const score = passed.length;
  const percentage = effectiveTotal > 0 ? Math.round((passed.length / effectiveTotal) * 100) : 0;
  
  // Classification
  let classification: 'cult_masterpiece' | 'powerful' | 'living_weak_soul' | 'decoration';
  
  if (percentage >= 90) {
    classification = 'cult_masterpiece';
  } else if (percentage >= 75) {
    classification = 'powerful';
  } else if (percentage >= 55) {
    classification = 'living_weak_soul';
  } else {
    classification = 'decoration';
  }
  
  return {
    score,
    percentage,
    applicable: applicable.length,
    passed: passed.length,
    classification
  };
}

/**
 * Calculate cult potential score
 */
export function calculateCultPotential(criteria: boolean[]): number {
  return criteria.filter(Boolean).length;
}

/**
 * Generate priority actions from failed items
 */
export function generatePriorityActions(
  gateResults: {
    L1: GateResult | null;
    L2: GateResult | null;
    L3: GateResult | null;
    L4: GateResult | null;
  }
): [string, string, string] {
  const actions: string[] = [];
  
  // L1 actions first — null-check fixList before slicing
  if (gateResults.L1 && !gateResults.L1.passed && gateResults.L1.fixList && gateResults.L1.fixList.length > 0) {
    const topFixes = gateResults.L1.fixList.slice(0, 2);
    topFixes.forEach(fix => {
      actions.push(`[L1] ${fix.description.slice(0, 60)}...`);
    });
  }

  // L2 actions — null-check fixList
  if (gateResults.L2 && !gateResults.L2.passed && actions.length < 3 && gateResults.L2.fixList && gateResults.L2.fixList.length > 0) {
    const topFix = gateResults.L2.fixList[0];
    if (topFix) {
      actions.push(`[L2] ${topFix.description.slice(0, 60)}...`);
    }
  }
  
  // Fill remaining with general recommendations
  while (actions.length < 3) {
    const remaining = 3 - actions.length;
    if (remaining === 1) {
      actions.push('Завершите полный аудит для детальных рекомендаций');
    } else {
      actions.push(`Проверьте элемент чеклиста аудита ${actions.length + 1}`);
    }
  }
  
  return actions as [string, string, string];
}

/**
 * Validate grief matrix - check if dominant stage is fully filled
 */
export function validateGriefMatrix(matrix: GriefArchitectureMatrix): {
  isValid: boolean;
  missingCells: GriefMatrixCell[];
} {
  if (!matrix.dominantStage) {
    return { isValid: false, missingCells: matrix.cells };
  }
  
  const dominantCells = matrix.cells.filter(c => c.stage === matrix.dominantStage);
  const missingCells = dominantCells.filter(c => c.confidence === 'absent' || !c.character);
  
  return {
    isValid: missingCells.length === 0,
    missingCells
  };
}

/**
 * Get applicable checklist count for media type
 */
export function getApplicableChecklistCount(mediaType: MediaType): number {
  const filtered = filterByMediaType([...MASTER_CHECKLIST], mediaType);
  return filtered.filter(i => i.applicable).length;
}
