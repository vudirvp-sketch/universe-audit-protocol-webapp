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
    const userPrompt = getL4EvaluationPrompt(
      state.inputText,
      state.skeleton!,
      l3Score,
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

    if (output.score < threshold) {
      const fixes: FixItem[] = [];

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
          description: `Гейт L4 не пройден: балл ${output.score}% ниже порога ${threshold}%`,
          severity: 'major',
          type: 'competence',
          recommendedApproach: 'compromise',
        });
      }

      return {
        passed: false,
        score: output.score,
        threshold,
        reason: `Гейт L4 не пройден: балл ${output.score}% ниже порога ${threshold}% (режим: ${mode})`,
        fixes,
      };
    }

    return { passed: true, score: output.score, threshold };
  },

  reduce: (state: PipelineRunState, output: GateL4Output): PipelineRunState => {
    const mode = state.auditMode || 'conflict';
    const threshold = getGateThreshold(mode, 'L4');

    const conditions = output.evaluations.map(e => ({
      id: e.id, passed: e.status === 'PASS',
      message: e.functionalRole || e.evidence || (e.status === 'PASS' ? 'Пройдено' : 'Не пройдено'),
    }));

    const breakdown: Record<string, string> = {};
    for (const e of output.evaluations) breakdown[e.id] = e.status;
    breakdown['threeLayers'] = `${output.threeLayers.personal.stable ? '✓' : '✗'}/${output.threeLayers.plot.stable ? '✓' : '✗'}/${output.threeLayers.meta.stable ? '✓' : '✗'}`;
    breakdown['cornelianDilemma'] = output.cornelianDilemma.valid ? 'VALID' : 'INVALID';
    breakdown['agentMirror'] = output.agentMirror.integrated ? 'INTEGRATED' : 'MISSING';
    breakdown['cultPotential'] = `${output.cultPotential.score}%`;

    const gateResult: GateResult = {
      gateId: 'GATE-L4', gateName: 'Гейт L4: Мета',
      status: output.score >= threshold ? 'passed' : 'failed',
      score: output.score, passed: output.score >= threshold,
      conditions, halt: output.score < threshold,
      fixes: output.score < threshold 
        ? output.evaluations.filter(e => e.status === 'FAIL').map((e, i) => `[L4] ${e.functionalRole || e.evidence || e.id}`)
        : [],
      metadata: { breakdown, level: 'L4' }, level: 'L4',
      applicableItems: output.evaluations.length,
      passedItems: output.evaluations.filter(e => e.status === 'PASS').length,
      failedItems: output.evaluations.filter(e => e.status === 'FAIL').length,
      insufficientDataItems: output.evaluations.filter(e => e.status === 'INSUFFICIENT_DATA').length,
      fixList: output.score < threshold
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

  maxRetries: 3,
  skipLLM: false,
  maxTokens: 16384,
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
