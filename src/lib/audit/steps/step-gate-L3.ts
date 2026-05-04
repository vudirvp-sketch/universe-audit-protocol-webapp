/**
 * Step 7: Gate L3 — Psyche evaluation + Grief HARD CHECK.
 *
 * TWO sub-checks, both must pass:
 *   1. Grief Architecture HARD CHECK (RULE_3):
 *      Dominant stage MUST have manifestations across at least 2 levels.
 *      If dominant stage has only 1 level → HARD FAIL regardless of score.
 *   2. L3 Score CHECK: Score ≥ mode-specific threshold.
 *
 * maxTokens: 4096
 */

import type { AuditStep, PipelineRunState, StepValidationResult, GateDecision } from '../audit-step';
import type { GateResult, GriefStage, GriefLevel, GriefMatrixCell, GriefArchitectureMatrix, FixItem } from '../types';
import { getGateThreshold } from '../types';
import { recalculateGateScore } from '../scoring-algorithm';
import { getL3EvaluationPrompt } from '../prompts';
import { extractJSON } from '../json-sanitizer';
import type { ChatMessage } from '@/lib/llm-client';

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

export interface GateL3Output {
  evaluations: Array<{
    id: string;
    status: 'PASS' | 'FAIL' | 'INSUFFICIENT_DATA';
    evidence: string | null;
    functionalRole: string | null;
  }>;
  griefMatrix: {
    dominantStage: GriefStage;
    cells: Array<{
      stage: string;
      level: string;
      character?: string;
      evidence?: string;
      confidence: 'high' | 'medium' | 'low' | 'absent';
    }>;
  };
  score: number;
  gatePassed: boolean;
}

// ---------------------------------------------------------------------------
// Step definition
// ---------------------------------------------------------------------------

export const stepGateL3: AuditStep<GateL3Output> = {
  id: 'L3_evaluation',

  buildPrompt: (state: PipelineRunState): ChatMessage[] => {
    const l2Score = state.gateResults.L2?.score ?? 0;
    const griefContext = state.griefMatrix
      ? JSON.stringify(state.griefMatrix, null, 2)
      : 'Архитектура горя ещё не проанализирована — проанализируй впервые';
    const narrativeText = state.narrativeDigest || state.inputText;
    const useDigest = !!state.narrativeDigest;
    const skeleton = state.skeleton ?? { status: 'INCOMPLETE' as const, elements: [], fixes: [] };
    const userPrompt = getL3EvaluationPrompt(
      narrativeText,
      skeleton,
      l2Score,
      griefContext,
      useDigest,
    );
    return [
      {
        role: 'system',
        content:
          'Ты — эксперт-аудитор нарративов, реализующий Протокол Аудита Вселенной v10.0. ' +
          'Отвечай ТОЛЬКО валидным JSON. Все описания, доказательства и обоснования — на русском языке. ' +
          'Enum-значения (stage, level, confidence, status) — на английском. ' +
          'КРИТИЧЕСКОЕ ПРАВИЛО: доминантная стадия горя должна быть воплощена минимум на 2 уровнях ' +
          '(персонаж, локация, механика, акт). Если только 1 уровень — это HARD FAIL.',
      },
      { role: 'user', content: userPrompt },
    ];
  },

  parseResponse: (raw: string): GateL3Output => {
    const jsonStr = extractJSON(raw);
    if (!jsonStr) return defaultL3Output('Не удалось распарсить ответ LLM');

    try {
      const parsed = JSON.parse(jsonStr);
      const validStages: GriefStage[] = ['denial', 'anger', 'bargaining', 'depression', 'acceptance'];
      // Use only canonical GriefLevel values; map extended levels to canonical
      const validLevels: GriefLevel[] = ['character', 'location', 'mechanic', 'act'];
      const extendedToCanonical: Record<string, GriefLevel> = {
        world: 'mechanic',
        society: 'location',
        scene: 'act',
      };
      const validConfidences = ['high', 'medium', 'low', 'absent'];

      const dominantStage = validStages.includes(parsed.griefMatrix?.dominantStage)
        ? parsed.griefMatrix.dominantStage : 'depression';

      const cells: GateL3Output['griefMatrix']['cells'] = Array.isArray(parsed.griefMatrix?.cells)
        ? parsed.griefMatrix.cells.map((c: Record<string, unknown>) => ({
            stage: (validStages as readonly string[]).includes(c.stage as string) ? (c.stage as GriefStage) : ('depression' as GriefStage),
            level: (validLevels as readonly string[]).includes(c.level as string)
              ? (c.level as GriefLevel)
              : (extendedToCanonical[c.level as string] ?? ('character' as GriefLevel)),
            character: c.character ? String(c.character) : undefined,
            evidence: c.evidence ? String(c.evidence) : undefined,
            confidence: validConfidences.includes(c.confidence as string) ? (c.confidence as 'high' | 'medium' | 'low' | 'absent') : 'absent',
          }))
        : [];

      return {
        evaluations: Array.isArray(parsed.evaluations)
          ? parsed.evaluations.map((e: Record<string, unknown>) => ({
              id: String(e.id || 'unknown'),
              status: ['PASS', 'FAIL', 'INSUFFICIENT_DATA'].includes(e.status as string) ? (e.status as 'PASS' | 'FAIL' | 'INSUFFICIENT_DATA') : 'INSUFFICIENT_DATA',
              evidence: e.evidence ? String(e.evidence) : null,
              functionalRole: e.functionalRole ? String(e.functionalRole) : null,
            }))
          : [],
        griefMatrix: { dominantStage, cells },
        score: Math.min(100, Math.max(0, Number(parsed.score) || 0)),
        gatePassed: !!parsed.gatePassed,
      };
    } catch {
      return defaultL3Output('Ошибка парсинга JSON');
    }
  },

  validate: (output: GateL3Output): StepValidationResult => {
    const errors: string[] = [];
    if (output.evaluations.length === 0) errors.push('Список оценок пуст');
    if (output.score < 0 || output.score > 100) errors.push('Балл должен быть от 0 до 100');
    if (!output.griefMatrix.dominantStage) errors.push('Доминантная стадия горя не определена');
    return { valid: errors.length === 0, errors, canRetry: true };
  },

  gateCheck: (output: GateL3Output, state: PipelineRunState): GateDecision => {
    const mode = state.auditMode || 'conflict';
    const threshold = getGateThreshold(mode, 'L3');

    // RULE_3: Grief HARD CHECK — dominant stage must have manifestations
    // across at least 2 levels (character, location, mechanic, act)
    const dominantStage = output.griefMatrix.dominantStage;
    const dominantCells = output.griefMatrix.cells.filter(
      c => c.stage === dominantStage && c.confidence !== 'absent',
    );
    const dominantLevels = new Set(dominantCells.map(c => c.level));

    if (dominantLevels.size < 2) {
      const fixes: FixItem[] = [{
        id: 'FIX-grief-hard-check',
        description: `Доминантная стадия горя "${dominantStage}" воплощена только на ${dominantLevels.size} уровне(ях). Минимум 2 уровня обязательны (персонаж, локация, механика, акт).`,
        severity: 'critical',
        type: 'memory',
        recommendedApproach: 'radical',
      }];

      return {
        passed: false,
        score: 0, // HARD FAIL overrides any score
        threshold,
        reason: `Grief HARD CHECK не пройден: доминантная стадия "${dominantStage}" имеет проявления только на ${dominantLevels.size} уровне(ях) — минимум 2 обязательно`,
        fixes,
      };
    }

    // DETERMINISTIC SCORE: Code calculates the score from evaluations
    const recalc = recalculateGateScore(output.evaluations);

    // Score check
    if (recalc.score < threshold) {
      const fixes: FixItem[] = output.evaluations
        .filter(e => e.status === 'FAIL')
        .map((e, i) => ({
          id: `FIX-L3-${i}`,
          description: e.functionalRole || e.evidence || 'Критерий L3 не пройден',
          severity: 'major' as const,
          type: 'competence' as const,
          recommendedApproach: 'compromise' as const,
        }));

      // Add unreliability notice if >50% INSUFFICIENT_DATA
      if (recalc.isUnreliable) {
        fixes.unshift({
          id: 'FIX-unreliable',
          description: `Более 50% критериев имеют статус INSUFFICIENT_DATA (${recalc.insufficientDataItems} из ${recalc.applicableItems}). Для надёжной оценки необходим более полный текст.`,
          severity: 'critical',
          type: 'competence',
          recommendedApproach: 'conservative',
        });
      }

      return {
        passed: false,
        score: recalc.score,
        threshold,
        reason: recalc.isUnreliable
          ? `Гейт L3 не пройден: недостаточно данных для надёжной оценки (${recalc.insufficientDataItems} из ${recalc.applicableItems} критериев — INSUFFICIENT_DATA)`
          : `Гейт L3 не пройден: балл ${recalc.score}% ниже порога ${threshold}% (режим: ${mode})`,
        fixes,
      };
    }

    return { passed: true, score: recalc.score, threshold };
  },

  reduce: (state: PipelineRunState, output: GateL3Output): PipelineRunState => {
    const mode = state.auditMode || 'conflict';
    const threshold = getGateThreshold(mode, 'L3');

    // DETERMINISTIC SCORE: Recalculate from evaluations, not LLM
    const recalc = recalculateGateScore(output.evaluations);

    const dominantLevels = new Set(
      output.griefMatrix.cells
        .filter(c => c.stage === output.griefMatrix.dominantStage && c.confidence !== 'absent')
        .map(c => c.level),
    );
    const griefHardCheckPassed = dominantLevels.size >= 2;
    const scorePassed = recalc.score >= threshold;
    const overallPassed = griefHardCheckPassed && scorePassed;

    // Build GriefArchitectureMatrix
    const matrixCells: GriefMatrixCell[] = output.griefMatrix.cells.map(c => ({
      stage: c.stage as GriefStage,
      level: c.level as GriefLevel,
      character: c.character,
      evidence: c.evidence,
      confidence: c.confidence,
    }));

    const griefMatrix: GriefArchitectureMatrix = {
      dominantStage: output.griefMatrix.dominantStage,
      cells: matrixCells,
    };

    const conditions = output.evaluations.map(e => ({
      id: e.id, passed: e.status === 'PASS',
      message: e.functionalRole || e.evidence || (e.status === 'PASS' ? 'Пройдено' : 'Не пройдено'),
    }));

    const breakdown: Record<string, string> = {};
    for (const e of output.evaluations) breakdown[e.id] = e.status;

    const gateResult: GateResult = {
      gateId: 'GATE-L3', gateName: 'Гейт L3: Психика',
      status: overallPassed ? 'passed' : 'failed',
      score: recalc.score, passed: overallPassed,
      conditions, halt: !overallPassed,
      fixes: !griefHardCheckPassed
        ? [`Grief HARD CHECK: доминантная стадия "${output.griefMatrix.dominantStage}" требует минимум 2 уровня воплощения`]
        : !scorePassed
          ? [`Гейт L3: балл ${recalc.score}% ниже порога ${threshold}%`]
          : [],
      metadata: {
        breakdown, level: 'L3',
        isUnreliable: recalc.isUnreliable,
        insufficientRatio: recalc.insufficientRatio,
        effectiveTotal: recalc.effectiveTotal,
      }, level: 'L3',
      applicableItems: recalc.applicableItems,
      passedItems: recalc.passedItems,
      failedItems: recalc.failedItems,
      insufficientDataItems: recalc.insufficientDataItems,
    };

    return {
      ...state,
      gateResults: { ...state.gateResults, L3: gateResult },
      griefMatrix,
    };
  },

  maxRetries: 4,
  skipLLM: false,
  maxTokens: 16384,
  minOutputTokens: 3072,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultL3Output(_reason: string): GateL3Output {
  return {
    evaluations: [],
    griefMatrix: { dominantStage: 'depression', cells: [] },
    score: 0,
    gatePassed: false,
  };
}
