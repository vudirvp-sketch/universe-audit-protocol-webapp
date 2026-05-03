/**
 * Step 8: Gate L4 — Meta evaluation (including Cult Potential per Section 0.8).
 *
 * Cult potential is merged INTO L4 evaluation, not a separate step.
 * LLM call using getL4EvaluationPrompt() — prompt is in Russian.
 * maxTokens: 4096
 */

import type { AuditStep, PipelineRunState, StepValidationResult, GateDecision } from '../audit-step';
import type { GateResult, FixItem } from '../types';
import { getGateThreshold } from '../types';
import { recalculateGateScore } from '../scoring-algorithm';
import { getL4EvaluationPrompt } from '../prompts';
import { extractJSON } from '../json-sanitizer';
import type { ChatMessage } from '@/lib/llm-client';

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

export interface GateL4Output {
  evaluations: Array<{
    id: string;
    status: 'PASS' | 'FAIL' | 'INSUFFICIENT_DATA';
    evidence: string | null;
    functionalRole: string | null;
  }>;
  threeLayers: {
    personal: { stable: boolean; proof: string };
    plot: { stable: boolean; proof: string };
    meta: { stable: boolean; proof: string };
  };
  cornelianDilemma: {
    valid: boolean;
    valueA: string;
    valueB: string;
    irreversible: boolean;
    thirdPath: string;
  };
  agentMirror: {
    integrated: boolean;
    directQuestion: string;
  };
  cultPotential: {
    score: number;
    criteria: boolean[];
  };
  score: number;
  gatePassed: boolean;
}

// ---------------------------------------------------------------------------
// Step definition
// ---------------------------------------------------------------------------

export const stepGateL4: AuditStep<GateL4Output> = {
  id: 'L4_evaluation',

  buildPrompt: (state: PipelineRunState): ChatMessage[] => {
    const l3Score = state.gateResults.L3?.score ?? 0;
    const narrativeText = state.narrativeDigest || state.inputText;
    const useDigest = !!state.narrativeDigest;
    const userPrompt = getL4EvaluationPrompt(
      narrativeText,
      state.skeleton!,
      l3Score,
      useDigest,
    );
    return [
      {
        role: 'system',
        content:
          'Ты — эксперт-аудитор нарративов, реализующий Протокол Аудита Вселенной v10.0. ' +
          'Отвечай ТОЛЬКО валидным JSON. Все описания, доказательства и обоснования — на русском языке. ' +
          'Enum-значения — на английском. ' +
          'Культовый потенциал является частью оценки L4, не отдельным шагом.',
      },
      { role: 'user', content: userPrompt },
    ];
  },

  parseResponse: (raw: string): GateL4Output => {
    const jsonStr = extractJSON(raw);
    if (!jsonStr) return defaultL4Output('Не удалось распарсить ответ LLM');

    try {
      const parsed = JSON.parse(jsonStr);

      return {
        evaluations: Array.isArray(parsed.evaluations)
          ? parsed.evaluations.map((e: Record<string, unknown>) => ({
              id: String(e.id || 'unknown'),
              status: ['PASS', 'FAIL', 'INSUFFICIENT_DATA'].includes(e.status as string) ? (e.status as 'PASS' | 'FAIL' | 'INSUFFICIENT_DATA') : 'INSUFFICIENT_DATA',
              evidence: e.evidence ? String(e.evidence) : null,
              functionalRole: e.functionalRole ? String(e.functionalRole) : null,
            }))
          : [],
        threeLayers: {
          personal: { stable: !!parsed.threeLayers?.personal?.stable, proof: String(parsed.threeLayers?.personal?.proof || '') },
          plot: { stable: !!parsed.threeLayers?.plot?.stable, proof: String(parsed.threeLayers?.plot?.proof || '') },
          meta: { stable: !!parsed.threeLayers?.meta?.stable, proof: String(parsed.threeLayers?.meta?.proof || '') },
        },
        cornelianDilemma: {
          valid: !!parsed.cornelianDilemma?.valid,
          valueA: String(parsed.cornelianDilemma?.valueA || ''),
          valueB: String(parsed.cornelianDilemma?.valueB || ''),
          irreversible: !!parsed.cornelianDilemma?.irreversible,
          thirdPath: String(parsed.cornelianDilemma?.thirdPath || ''),
        },
        agentMirror: {
          integrated: !!parsed.agentMirror?.integrated,
          directQuestion: String(parsed.agentMirror?.directQuestion || ''),
        },
        cultPotential: {
          score: Number(parsed.cultPotential?.score) || 0,
          criteria: Array.isArray(parsed.cultPotential?.criteria)
            ? parsed.cultPotential.criteria.map((c: unknown) => !!c)
            : [],
        },
        score: Math.min(100, Math.max(0, Number(parsed.score) || 0)),
        gatePassed: !!parsed.gatePassed,
      };
    } catch {
      return defaultL4Output('Ошибка парсинга JSON');
    }
  },

  validate: (output: GateL4Output): StepValidationResult => {
    const errors: string[] = [];
    if (output.evaluations.length === 0) errors.push('Список оценок пуст');
    if (output.score < 0 || output.score > 100) errors.push('Балл должен быть от 0 до 100');
    return { valid: errors.length === 0, errors, canRetry: true };
  },

  gateCheck: (output: GateL4Output, state: PipelineRunState): GateDecision => {
    const mode = state.auditMode || 'conflict';
    const threshold = getGateThreshold(mode, 'L4');

    // DETERMINISTIC SCORE: Code calculates the score from evaluations
    const recalc = recalculateGateScore(output.evaluations);

    if (recalc.score < threshold) {
      const fixes: FixItem[] = [];

      // Add unreliability notice if >50% INSUFFICIENT_DATA (before sub-checks)
      if (recalc.isUnreliable) {
        fixes.push({
          id: 'FIX-unreliable',
          description: `Более 50% критериев имеют статус INSUFFICIENT_DATA (${recalc.insufficientDataItems} из ${recalc.applicableItems}). Для надёжной оценки необходим более полный текст.`,
          severity: 'critical',
          type: 'competence',
          recommendedApproach: 'conservative',
        });
      }

      // Cult potential mandatory criteria (Phase 1 of cult evaluation)
      if (output.cultPotential.score < 50) {
        fixes.push({
          id: 'FIX-cult-potential',
          description: 'Культовый потенциал ниже базового порога — углубите тематическую интеграцию',
          severity: 'major',
          type: 'ideology',
          recommendedApproach: 'compromise',
        });
      }

      // Cornelian dilemma
      if (!output.cornelianDilemma.valid) {
        fixes.push({
          id: 'FIX-cornelian-dilemma',
          description: 'Корнелиева дилемма не валидна — создайте конфликт Ценность vs Ценность',
          severity: 'critical',
          type: 'ideology',
          recommendedApproach: 'radical',
        });
      }

      // Agent mirror
      if (!output.agentMirror.integrated) {
        fixes.push({
          id: 'FIX-agent-mirror',
          description: 'Зеркало агента не интегрировано — финал должен побуждать к самоанализу',
          severity: 'major',
          type: 'competence',
          recommendedApproach: 'compromise',
        });
      }

      if (fixes.length === 0) {
        fixes.push({
          id: 'FIX-L4-general',
          description: `Гейт L4 не пройден: балл ${recalc.score}% ниже порога ${threshold}%`,
          severity: 'major',
          type: 'competence',
          recommendedApproach: 'compromise',
        });
      }

      return {
        passed: false,
        score: recalc.score,
        threshold,
        reason: recalc.isUnreliable
          ? `Гейт L4 не пройден: недостаточно данных для надёжной оценки (${recalc.insufficientDataItems} из ${recalc.applicableItems} критериев — INSUFFICIENT_DATA)`
          : `Гейт L4 не пройден: балл ${recalc.score}% ниже порога ${threshold}% (режим: ${mode})`,
        fixes,
      };
    }

    return { passed: true, score: recalc.score, threshold };
  },

  reduce: (state: PipelineRunState, output: GateL4Output): PipelineRunState => {
    const mode = state.auditMode || 'conflict';
    const threshold = getGateThreshold(mode, 'L4');

    // DETERMINISTIC SCORE: Recalculate from evaluations, not LLM
    const recalc = recalculateGateScore(output.evaluations);

    const conditions = output.evaluations.map(e => ({
      id: e.id, passed: e.status === 'PASS',
      message: e.functionalRole || e.evidence || (e.status === 'PASS' ? 'Пройдено' : 'Не пройдено'),
    }));

    const breakdown: Record<string, string> = {};
    for (const e of output.evaluations) breakdown[e.id] = e.status;
    breakdown['threeLayers'] = `${output.threeLayers.personal.stable ? '\u2713' : '\u2717'}/${output.threeLayers.plot.stable ? '\u2713' : '\u2717'}/${output.threeLayers.meta.stable ? '\u2713' : '\u2717'}`;
    breakdown['cornelianDilemma'] = output.cornelianDilemma.valid ? 'VALID' : 'INVALID';
    breakdown['agentMirror'] = output.agentMirror.integrated ? 'INTEGRATED' : 'MISSING';
    breakdown['cultPotential'] = `${output.cultPotential.score}%`;

    const gateResult: GateResult = {
      gateId: 'GATE-L4', gateName: 'Гейт L4: Мета',
      status: recalc.score >= threshold ? 'passed' : 'failed',
      score: recalc.score, passed: recalc.score >= threshold,
      conditions, halt: recalc.score < threshold,
      fixes: recalc.score < threshold
        ? output.evaluations.filter(e => e.status === 'FAIL').map((e, i) => `[L4] ${e.functionalRole || e.evidence || e.id}`)
        : [],
      metadata: {
        breakdown, level: 'L4',
        isUnreliable: recalc.isUnreliable,
        insufficientRatio: recalc.insufficientRatio,
        effectiveTotal: recalc.effectiveTotal,
      }, level: 'L4',
      applicableItems: recalc.applicableItems,
      passedItems: recalc.passedItems,
      failedItems: recalc.failedItems,
      insufficientDataItems: recalc.insufficientDataItems,
      fixList: recalc.score < threshold
        ? output.evaluations.filter(e => e.status === 'FAIL').map((e, i) => ({
            id: `FIX-L4-${i}`,
            description: e.evidence || e.functionalRole || e.id,
            severity: i < 2 ? 'critical' as const : 'major' as const,
            type: 'ideology' as const,
            recommendedApproach: (i < 1 ? 'radical' as const : 'compromise' as const),
          }))
        : [],
    };

    return {
      ...state,
      gateResults: { ...state.gateResults, L4: gateResult },
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

function defaultL4Output(reason: string): GateL4Output {
  return {
    evaluations: [],
    threeLayers: {
      personal: { stable: false, proof: reason },
      plot: { stable: false, proof: reason },
      meta: { stable: false, proof: reason },
    },
    cornelianDilemma: { valid: false, valueA: '', valueB: '', irreversible: false, thirdPath: '' },
    agentMirror: { integrated: false, directQuestion: '' },
    cultPotential: { score: 0, criteria: [] },
    score: 0,
    gatePassed: false,
  };
}
