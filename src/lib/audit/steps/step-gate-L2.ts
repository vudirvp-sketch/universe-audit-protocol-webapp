/**
 * Step 6: Gate L2 — Body evaluation.
 *
 * Same structure as L1 but for L2 criteria (embodiment, consequences).
 * Checklist filtered by audit mode per Section 0.7.
 * maxTokens: 4096
 */

import type { AuditStep, PipelineRunState, StepValidationResult, GateDecision } from '../audit-step';
import type { GateResult, FixItem } from '../types';
import { getGateThreshold } from '../types';
import { recalculateGateScore } from '../scoring-algorithm';
import { getL2EvaluationPrompt } from '../prompts';
import { extractJSON } from '../json-sanitizer';
import type { ChatMessage } from '@/lib/llm-client';

// ---------------------------------------------------------------------------
// Output type — same structure as L1
// ---------------------------------------------------------------------------

export interface GateL2Output {
  evaluations: Array<{
    id: string;
    status: 'PASS' | 'FAIL' | 'INSUFFICIENT_DATA';
    evidence: string | null;
    functionalRole: string | null;
  }>;
  score: number;
  gatePassed: boolean;
  fixList: Array<{
    id: string;
    description: string;
    severity: 'critical' | 'major' | 'minor';
    type: 'motivation' | 'competence' | 'scale' | 'resources' | 'memory' | 'ideology' | 'time';
    recommendedApproach: 'conservative' | 'compromise' | 'radical';
  }>;
}

// ---------------------------------------------------------------------------
// Step definition
// ---------------------------------------------------------------------------

export const stepGateL2: AuditStep<GateL2Output> = {
  id: 'L2_evaluation',

  buildPrompt: (state: PipelineRunState): ChatMessage[] => {
    const checklistText = buildL2Checklist(state.auditMode);
    const l1Score = state.gateResults.L1?.score ?? 0;
    const narrativeText = state.narrativeDigest || state.inputText;
    const useDigest = !!state.narrativeDigest;
    const skeleton = state.skeleton ?? { status: 'INCOMPLETE' as const, elements: [], fixes: [] };
    const userPrompt = getL2EvaluationPrompt(
      narrativeText,
      skeleton,
      l1Score,
      checklistText,
      useDigest,
    );
    return [
      {
        role: 'system',
        content:
          'Ты — эксперт-аудитор нарративов, реализующий Протокол Аудита Вселенной v10.0. ' +
          'Отвечай ТОЛЬКО валидным JSON. Все описания, доказательства и рекомендации — на русском языке. ' +
          'Enum-значения — на английском.',
      },
      { role: 'user', content: userPrompt },
    ];
  },

  parseResponse: (raw: string): GateL2Output => {
    const jsonStr = extractJSON(raw);
    if (!jsonStr) return defaultGateOutput('Не удалось распарсить ответ LLM');

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
        score: Math.min(100, Math.max(0, Number(parsed.score) || 0)),
        gatePassed: !!parsed.gatePassed,
        fixList: Array.isArray(parsed.fixList)
          ? parsed.fixList.map((f: Record<string, unknown>) => ({
              id: String(f.id || 'unknown'),
              description: String(f.description || ''),
              severity: ['critical', 'major', 'minor'].includes(f.severity as string) ? (f.severity as 'critical' | 'major' | 'minor') : 'major',
              type: ['motivation', 'competence', 'scale', 'resources', 'memory', 'ideology', 'time'].includes(f.type as string) ? (f.type as 'motivation' | 'competence' | 'scale' | 'resources' | 'memory' | 'ideology' | 'time') : 'competence',
              recommendedApproach: ['conservative', 'compromise', 'radical'].includes(f.recommendedApproach as string) ? (f.recommendedApproach as 'conservative' | 'compromise' | 'radical') : 'compromise',
            }))
          : [],
      };
    } catch {
      return defaultGateOutput('Ошибка парсинга JSON');
    }
  },

  validate: (output: GateL2Output): StepValidationResult => {
    const errors: string[] = [];
    if (output.evaluations.length === 0) errors.push('Список оценок пуст');
    if (output.score < 0 || output.score > 100) errors.push('Балл должен быть от 0 до 100');
    return { valid: errors.length === 0, errors, canRetry: true };
  },

  gateCheck: (output: GateL2Output, state: PipelineRunState): GateDecision => {
    const mode = state.auditMode || 'conflict';
    const threshold = getGateThreshold(mode, 'L2');

    // DETERMINISTIC SCORE: Code calculates the score from evaluations
    const recalc = recalculateGateScore(output.evaluations);

    if (recalc.score < threshold) {
      const fixes: FixItem[] = output.fixList.map(f => ({
        id: f.id, description: f.description, severity: f.severity,
        type: f.type, recommendedApproach: f.recommendedApproach,
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
        passed: false, score: recalc.score, threshold,
        reason: recalc.isUnreliable
          ? `Гейт L2 не пройден: недостаточно данных для надёжной оценки (${recalc.insufficientDataItems} из ${recalc.applicableItems} критериев — INSUFFICIENT_DATA)`
          : `Гейт L2 не пройден: балл ${recalc.score}% ниже порога ${threshold}% (режим: ${mode})`,
        fixes,
      };
    }
    return { passed: true, score: recalc.score, threshold };
  },

  reduce: (state: PipelineRunState, output: GateL2Output): PipelineRunState => {
    const mode = state.auditMode || 'conflict';
    const threshold = getGateThreshold(mode, 'L2');

    // DETERMINISTIC SCORE: Recalculate from evaluations, not LLM
    const recalc = recalculateGateScore(output.evaluations);

    const conditions = output.evaluations.map(e => ({
      id: e.id, passed: e.status === 'PASS',
      message: e.functionalRole || e.evidence || (e.status === 'PASS' ? 'Пройдено' : 'Не пройдено'),
    }));
    const breakdown: Record<string, string> = {};
    for (const e of output.evaluations) breakdown[e.id] = e.status;

    const gateResult: GateResult = {
      gateId: 'GATE-L2', gateName: 'Гейт L2: Тело',
      status: recalc.score >= threshold ? 'passed' : 'failed',
      score: recalc.score, passed: recalc.score >= threshold,
      conditions, halt: recalc.score < threshold,
      fixes: output.fixList.map(f => f.description),
      metadata: {
        breakdown, level: 'L2',
        isUnreliable: recalc.isUnreliable,
        insufficientRatio: recalc.insufficientRatio,
        effectiveTotal: recalc.effectiveTotal,
      }, level: 'L2',
      applicableItems: recalc.applicableItems,
      passedItems: recalc.passedItems,
      failedItems: recalc.failedItems,
      insufficientDataItems: recalc.insufficientDataItems,
      fixList: output.fixList.map(f => ({
        id: f.id, description: f.description, severity: f.severity,
        type: f.type, recommendedApproach: f.recommendedApproach,
      })),
    };
    return { ...state, gateResults: { ...state.gateResults, L2: gateResult } };
  },

  maxRetries: 4,
  skipLLM: false,
  maxTokens: 16384,
  minOutputTokens: 2048,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildL2Checklist(mode: string | null): string {
  const baseItems = [
    'Персонаж устал, заплатил деньги или почувствовал запах',
    'Хамартия протагониста создаёт последствия в теле нарратива',
    'Телесная рутина присутствует в ключевых сценах',
    'Доверие к миру через пространственную память',
    'Физическое ограничение проявляется в сценах',
  ];
  const conflictOnly = [
    'Антагонист имеет физическое присутствие в мире',
    'Цена победы воплощена в телесном опыте',
  ];
  const kishoOnly = [
    'Внутренняя трансформация воплощена в телесных деталях',
  ];

  const items = mode === 'kishō'
    ? [...baseItems, ...kishoOnly]
    : mode === 'hybrid'
      ? [...baseItems, ...conflictOnly, ...kishoOnly]
      : [...baseItems, ...conflictOnly];

  return items.map((item, i) => `L2_${String(i + 1).padStart(2, '0')}: ${item}`).join('\n');
}

function defaultGateOutput(reason: string): GateL2Output {
  return {
    evaluations: [], score: 0, gatePassed: false,
    fixList: [{ id: 'FIX-default', description: reason, severity: 'critical', type: 'competence', recommendedApproach: 'compromise' }],
  };
}
