/**
 * Step 5: Gate L1 — Mechanism evaluation.
 *
 * LLM call using getL1EvaluationPrompt() — prompt is in Russian.
 * Checklist filtered by audit mode per Section 0.7 (Finding 5).
 * Gate score must meet mode-specific threshold (conflict: 60%, kishō: 50%, hybrid: 55%).
 * RULE_8: Gate output MUST include block-level breakdown.
 * maxTokens: 4096
 */

import type { AuditStep, PipelineRunState, StepValidationResult, GateDecision } from '../audit-step';
import type { GateResult, FixItem } from '../types';
import { getGateThreshold } from '../types';
import { getL1EvaluationPrompt } from '../prompts';
import { extractJSON } from '../json-sanitizer';
import type { ChatMessage } from '@/lib/llm-client';

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

export interface GateL1Output {
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

export const stepGateL1: AuditStep<GateL1Output> = {
  id: 'L1_evaluation',

  buildPrompt: (state: PipelineRunState): ChatMessage[] => {
    const checklistText = buildL1Checklist(state.auditMode);
    const narrativeText = state.narrativeDigest || state.inputText;
    const useDigest = !!state.narrativeDigest;
    const userPrompt = getL1EvaluationPrompt(
      narrativeText,
      state.skeleton!,
      state.mediaType,
      checklistText,
      useDigest,
    );
    return [
      {
        role: 'system',
        content:
          'Ты — эксперт-аудитор нарративов, реализующий Протокол Аудита Вселенной v10.0. ' +
          'Отвечай ТОЛЬКО валидным JSON. Все описания, доказательства и рекомендации — на русском языке. ' +
          'Enum-значения (status, severity, type, recommendedApproach) — на английском.',
      },
      { role: 'user', content: userPrompt },
    ];
  },

  parseResponse: (raw: string): GateL1Output => {
    const jsonStr = extractJSON(raw);
    if (!jsonStr) {
      return defaultGateOutput('Не удалось распарсить ответ LLM');
    }

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

  validate: (output: GateL1Output): StepValidationResult => {
    const errors: string[] = [];

    if (output.evaluations.length === 0) {
      errors.push('Список оценок пуст — минимум 1 оценка обязателен');
    }

    if (output.score < 0 || output.score > 100) {
      errors.push('Балл должен быть от 0 до 100');
    }

    return { valid: errors.length === 0, errors, canRetry: true };
  },

  gateCheck: (output: GateL1Output, state: PipelineRunState): GateDecision => {
    const mode = state.auditMode || 'conflict';
    const threshold = getGateThreshold(mode, 'L1');

    if (output.score < threshold) {
      const fixes: FixItem[] = output.fixList.map(f => ({
        id: f.id,
        description: f.description,
        severity: f.severity,
        type: f.type,
        recommendedApproach: f.recommendedApproach,
      }));

      return {
        passed: false,
        score: output.score,
        threshold,
        reason: `Гейт L1 не пройден: балл ${output.score}% ниже порога ${threshold}% (режим: ${mode})`,
        fixes,
      };
    }

    return { passed: true, score: output.score, threshold };
  },

  reduce: (state: PipelineRunState, output: GateL1Output): PipelineRunState => {
    const mode = state.auditMode || 'conflict';
    const threshold = getGateThreshold(mode, 'L1');

    const conditions = output.evaluations.map(e => ({
      id: e.id,
      passed: e.status === 'PASS',
      message: e.functionalRole || e.evidence || (e.status === 'PASS' ? 'Пройдено' : 'Не пройдено'),
    }));

    const breakdown: Record<string, string> = {};
    for (const e of output.evaluations) {
      breakdown[e.id] = e.status;
    }

    const applicableItems = output.evaluations.length;
    const passedItems = output.evaluations.filter(e => e.status === 'PASS').length;
    const failedItems = output.evaluations.filter(e => e.status === 'FAIL').length;
    const insufficientDataItems = output.evaluations.filter(e => e.status === 'INSUFFICIENT_DATA').length;

    const gateResult: GateResult = {
      gateId: 'GATE-L1',
      gateName: 'Гейт L1: Механизм',
      status: output.score >= threshold ? 'passed' : 'failed',
      score: output.score,
      passed: output.score >= threshold,
      conditions,
      halt: output.score < threshold,
      fixes: output.fixList.map(f => f.description),
      metadata: { breakdown, level: 'L1' },
      level: 'L1',
      applicableItems,
      passedItems,
      failedItems,
      insufficientDataItems,
      fixList: output.fixList.map(f => ({
        id: f.id,
        description: f.description,
        severity: f.severity,
        type: f.type,
        recommendedApproach: f.recommendedApproach,
      })),
    };

    return {
      ...state,
      gateResults: { ...state.gateResults, L1: gateResult },
    };
  },

  maxRetries: 4,
  skipLLM: false,
  maxTokens: 16384,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildL1Checklist(mode: string | null): string {
  // L1 checklist items — mode-specific per Section 0.7
  const baseItems = [
    'Тематический закон сформулирован как правило мира',
    'Корневая травма разрушает прежний порядок',
    'Хамартия протагониста ведёт к финалу',
    'Закон мира влияет на экономику/физику',
    'Эмоциональный двигатель определён',
    '3 Несокрушимых столпа образуют цикл',
  ];

  const conflictOnly = [
    'Антагонистическая сила имеет внутреннюю логику',
    'Центральный конфликт имеет ставки мирового уровня',
  ];

  const kishoOnly = [
    'Тест десяти переформулировок пройден (для режима кирё)',
    'Смена перспективы является драйвером нарратива',
  ];

  if (mode === 'kishō') {
    return [...baseItems, ...kishoOnly].map((item, i) => `L1_${String(i + 1).padStart(2, '0')}: ${item}`).join('\n');
  }

  if (mode === 'hybrid') {
    return [...baseItems, ...conflictOnly, ...kishoOnly].map((item, i) => `L1_${String(i + 1).padStart(2, '0')}: ${item}`).join('\n');
  }

  // Default: conflict mode — full checklist
  return [...baseItems, ...conflictOnly].map((item, i) => `L1_${String(i + 1).padStart(2, '0')}: ${item}`).join('\n');
}

function defaultGateOutput(reason: string): GateL1Output {
  return {
    evaluations: [],
    score: 0,
    gatePassed: false,
    fixList: [{ id: 'FIX-default', description: reason, severity: 'critical', type: 'competence', recommendedApproach: 'compromise' }],
  };
}
