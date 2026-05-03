/**
 * Step 9: Issue + Chain Generation — "А чтобы что?" chain analysis.
 *
 * LLM call for chain analysis — prompt is in Russian.
 * RULE_2: Chain terminal at step ≤4 → critical issue.
 * RULE_9: Validate every Issue object has all required fields.
 * maxTokens: 2048
 */

import type { AuditStep, PipelineRunState, StepValidationResult, GateDecision } from '../audit-step';
import type { Issue, ChainResult, PatchType } from '../types';
import { extractJSON } from '../json-sanitizer';
import { wrapUserInput, sanitizeNarrative } from '../input-sanitizer';
import type { ChatMessage } from '@/lib/llm-client';

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

export interface IssuesChainsOutput {
  chains: Array<{
    element: string;
    terminal_type: 'BREAK' | 'DILEMMA' | null;
    terminalStep: number;
    step_reached: number;
    iterations: Array<{ step: number; question: string; answer: string }>;
    valid: boolean;
    reasoning: string;
  }>;
  issues: Array<{
    id: string;
    location: string;
    severity: 'critical' | 'major' | 'minor' | 'cosmetic';
    diagnosis: string;
    patches: {
      conservative: { description: string; impact?: string; sideEffects?: string[] };
      compromise: { description: string; impact?: string; sideEffects?: string[] };
      radical: { description: string; impact?: string; sideEffects?: string[] };
    };
    recommended: PatchType;
    reasoning?: string;
  }>;
}

// ---------------------------------------------------------------------------
// Step definition
// ---------------------------------------------------------------------------

export const stepIssuesChains: AuditStep<IssuesChainsOutput> = {
  id: 'issue_generation',

  buildPrompt: (state: PipelineRunState): ChatMessage[] => {
    const safeNarrative = wrapUserInput(sanitizeNarrative(state.inputText));
    const skeletonContext = state.skeleton ? JSON.stringify(state.skeleton, null, 2) : 'Скелет не извлечён';
    const gateContext = JSON.stringify({
      L1: state.gateResults.L1?.score,
      L2: state.gateResults.L2?.score,
      L3: state.gateResults.L3?.score,
      L4: state.gateResults.L4?.score,
    }, null, 2);

    return [
      {
        role: 'system',
        content:
          'Ты — эксперт-аудитор нарративов, реализующий Протокол Аудита Вселенной v10.0. ' +
          'Отвечай ТОЛЬКО валидным JSON. Все описания, диагнозы и рекомендации — на русском языке. ' +
          'Enum-значения (severity, recommended) — на английском. ' +
          'КРИТИЧЕСКОЕ ПРАВИЛО: если цепочка «А чтобы что?» обрывается на шаге ≤4, это критическая проблема.',
      },
      {
        role: 'user',
        content: `Проведи анализ цепочек «А чтобы что?» и сгенерируй проблемы для данного нарратива:

НАРРАТИВ:
${safeNarrative}

СКЕЛЕТ:
${skeletonContext}

РЕЗУЛЬТАТЫ ГЕЙТОВ:
${gateContext}

Для каждого ключевого элемента скелета задай вопрос «А чтобы что?» и проследи цепочку до терминала (BREAK или DILEMMA).

Затем сгенерируй проблемы на основе:
1. Цепочек, обрывающихся на шаге ≤4 (критические)
2. Проваленных критериев гейтов L1-L4
3. Слабостей скелета

Каждая проблема должна иметь 3 варианта исправления: conservative, compromise, radical.

Верни ответ в формате JSON:
{
  "chains": [...],
  "issues": [
    {
      "id": "ISSUE-XX",
      "location": "§section + level",
      "severity": "critical|major|minor|cosmetic",
      "diagnosis": "описание на русском",
      "patches": {
        "conservative": { "description": "...", "impact": "...", "sideEffects": [] },
        "compromise": { "description": "...", "impact": "...", "sideEffects": [] },
        "radical": { "description": "...", "impact": "...", "sideEffects": [] }
      },
      "recommended": "conservative|compromise|radical",
      "reasoning": "обоснование на русском"
    }
  ]
}`,
      },
    ];
  },

  parseResponse: (raw: string): IssuesChainsOutput => {
    const jsonStr = extractJSON(raw);
    if (!jsonStr) return { chains: [], issues: [] };

    try {
      const parsed = JSON.parse(jsonStr);
      const validSeverities = ['critical', 'major', 'minor', 'cosmetic'];
      const validPatchTypes: PatchType[] = ['conservative', 'compromise', 'radical'];

      const chains: IssuesChainsOutput['chains'] = Array.isArray(parsed.chains)
        ? parsed.chains.map((c: Record<string, unknown>) => ({
            element: String(c.element || 'unknown'),
            terminal_type: ['BREAK', 'DILEMMA'].includes(c.terminal_type as string) ? (c.terminal_type as 'BREAK' | 'DILEMMA') : null,
            terminalStep: Number(c.terminalStep) || 0,
            step_reached: Number(c.step_reached) || 0,
            iterations: Array.isArray(c.iterations)
              ? c.iterations.map((it: Record<string, unknown>) => ({
                  step: Number(it.step) || 0,
                  question: String(it.question || ''),
                  answer: String(it.answer || ''),
                }))
              : [],
            valid: !!c.valid,
            reasoning: String(c.reasoning || ''),
          }))
        : [];

      const issues: IssuesChainsOutput['issues'] = Array.isArray(parsed.issues)
        ? parsed.issues.map((i: Record<string, unknown>) => {
            const patches = i.patches as Record<string, Record<string, unknown>> | undefined;
            return {
              id: String(i.id || 'ISSUE-UNKNOWN'),
              location: String(i.location || ''),
              severity: validSeverities.includes(i.severity as string) ? (i.severity as 'critical' | 'major' | 'minor' | 'cosmetic') : 'major',
              diagnosis: String(i.diagnosis || ''),
              patches: {
                conservative: { description: String(patches?.conservative?.description || ''), impact: String(patches?.conservative?.impact || ''), sideEffects: Array.isArray(patches?.conservative?.sideEffects) ? patches.conservative.sideEffects.map(String) : [] },
                compromise: { description: String(patches?.compromise?.description || ''), impact: String(patches?.compromise?.impact || ''), sideEffects: Array.isArray(patches?.compromise?.sideEffects) ? patches.compromise.sideEffects.map(String) : [] },
                radical: { description: String(patches?.radical?.description || ''), impact: String(patches?.radical?.impact || ''), sideEffects: Array.isArray(patches?.radical?.sideEffects) ? patches.radical.sideEffects.map(String) : [] },
              },
              recommended: validPatchTypes.includes(i.recommended as PatchType) ? (i.recommended as PatchType) : 'compromise',
              reasoning: i.reasoning ? String(i.reasoning) : undefined,
            };
          })
        : [];

      return { chains, issues };
    } catch {
      return { chains: [], issues: [] };
    }
  },

  validate: (output: IssuesChainsOutput): StepValidationResult => {
    const errors: string[] = [];

    // RULE_9: Validate every Issue object has all required fields
    for (const issue of output.issues) {
      if (!issue.id) errors.push(`Проблема без id: ${issue.diagnosis}`);
      if (!issue.diagnosis) errors.push(`Проблема ${issue.id} без диагноза`);
      if (!issue.patches.conservative.description) errors.push(`Проблема ${issue.id} без conservative патча`);
      if (!issue.patches.compromise.description) errors.push(`Проблема ${issue.id} без compromise патча`);
      if (!issue.patches.radical.description) errors.push(`Проблема ${issue.id} без radical патча`);
    }

    return { valid: errors.length === 0, errors, canRetry: true };
  },

  gateCheck: (_output: IssuesChainsOutput, _state: PipelineRunState): GateDecision => {
    // Issue generation never blocks — it produces output for diagnostics
    return { passed: true };
  },

  reduce: (state: PipelineRunState, output: IssuesChainsOutput): PipelineRunState => {
    const chainResults: ChainResult[] = output.chains.map(c => ({
      terminal_type: c.terminal_type,
      terminal: c.terminal_type || 'UNCLASSIFIED',
      terminalStep: c.terminalStep,
      step_reached: c.step_reached,
      iterations: c.iterations,
      valid: c.valid,
      action: c.terminal_type === 'BREAK' ? 'bind_to_law_or_remove' : null,
      reasoning: c.reasoning,
    }));

    const issues: Issue[] = output.issues.map(i => ({
      id: i.id,
      location: i.location,
      severity: i.severity,
      // Derive axes from severity — severity maps to criticality scale;
      // risk and time_cost are estimated from severity as reasonable defaults.
      // These are not arbitrary: critical issues have high criticality/risk/cost.
      axes: {
        criticality: i.severity === 'critical' ? 9 : i.severity === 'major' ? 6 : i.severity === 'minor' ? 3 : 1,
        risk: i.severity === 'critical' ? 8 : i.severity === 'major' ? 5 : i.severity === 'minor' ? 3 : 1,
        time_cost: i.severity === 'critical' ? 7 : i.severity === 'major' ? 5 : i.severity === 'minor' ? 2 : 1,
      },
      diagnosis: i.diagnosis,
      patches: {
        conservative: { type: 'conservative' as PatchType, description: i.patches.conservative.description, impact: i.patches.conservative.impact, sideEffects: i.patches.conservative.sideEffects },
        compromise: { type: 'compromise' as PatchType, description: i.patches.compromise.description, impact: i.patches.compromise.impact, sideEffects: i.patches.compromise.sideEffects },
        radical: { type: 'radical' as PatchType, description: i.patches.radical.description, impact: i.patches.radical.impact, sideEffects: i.patches.radical.sideEffects },
      },
      recommended: i.recommended,
      reasoning: i.reasoning,
    }));

    return {
      ...state,
      whatForChains: chainResults,
      issues: [...state.issues, ...issues],
    };
  },

  maxRetries: 3,
  skipLLM: false,
  maxTokens: 16384,
};
