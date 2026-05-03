/**
 * Step 4: Screening — quick 7-question screening with count-based logic.
 *
 * LLM call using getScreeningPrompt() — prompt is in Russian.
 * Parses JSON: { answers: [7 booleans], flags: string[], recommendation: string }
 * - flags values in Russian; recommendation is English enum.
 *
 * GATE CHECK: Count-based logic per Section 0.6:
 *   Code counts NO answers → determines recommendation (NOT LLM opinion).
 *   - 0-1 NO → ready_for_audit
 *   - 2-3 NO → requires_sections
 *   - 4+ NO  → stop_return_to_skeleton
 *
 * maxTokens: 1024
 */

import type { AuditStep, PipelineRunState, StepValidationResult, GateDecision } from '../audit-step';
import type { ScreeningResult, ScreeningRecommendation, FixItem } from '../types';
import { getScreeningPrompt } from '../prompts';
import { extractJSON } from '../json-sanitizer';
import type { ChatMessage } from '@/lib/llm-client';

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

export interface ScreeningOutput {
  answers: boolean[];
  flags: string[];
  recommendation: ScreeningRecommendation;
  llmRecommendation: string; // What the LLM suggested (for comparison)
}

// ---------------------------------------------------------------------------
// Step definition
// ---------------------------------------------------------------------------

export const stepScreening: AuditStep<ScreeningOutput> = {
  id: 'screening',

  buildPrompt: (state: PipelineRunState): ChatMessage[] => {
    const userPrompt = getScreeningPrompt(state.inputText);
    return [
      {
        role: 'system',
        content:
          'Ты — эксперт-аудитор нарративов, реализующий Протокол Аудита Вселенной v10.0. ' +
          'Отвечай ТОЛЬКО валидным JSON. Все флаги и описания — на русском языке. ' +
          'Enum-значения (recommendation) — на английском.',
      },
      { role: 'user', content: userPrompt },
    ];
  },

  parseResponse: (raw: string): ScreeningOutput => {
    const jsonStr = extractJSON(raw);
    if (!jsonStr) {
      return {
        answers: [false, false, false, false, false, false, false],
        flags: ['Не удалось распарсить ответ LLM'],
        recommendation: 'stop_return_to_skeleton',
        llmRecommendation: 'parse_error',
      };
    }

    try {
      const parsed = JSON.parse(jsonStr);
      const answers = Array.isArray(parsed.answers)
        ? parsed.answers.slice(0, 7).map((a: unknown) => !!a)
        : [false, false, false, false, false, false, false];

      // Pad to exactly 7 answers
      while (answers.length < 7) answers.push(false);

      const flags = Array.isArray(parsed.flags) ? parsed.flags.map(String) : [];
      const llmRec = String(parsed.recommendation || 'unknown');

      // Section 0.6: COUNT-BASED recommendation — code wins over LLM opinion
      const recommendation = determineScreeningRecommendation(answers);

      return { answers, flags, recommendation, llmRecommendation: llmRec };
    } catch {
      return {
        answers: [false, false, false, false, false, false, false],
        flags: ['Ошибка парсинга JSON'],
        recommendation: 'stop_return_to_skeleton',
        llmRecommendation: 'parse_error',
      };
    }
  },

  validate: (output: ScreeningOutput): StepValidationResult => {
    const errors: string[] = [];

    if (output.answers.length !== 7) {
      errors.push(`Ожидается 7 ответов, получено ${output.answers.length}`);
    }

    const validRecs: ScreeningRecommendation[] = ['ready_for_audit', 'requires_sections', 'stop_return_to_skeleton'];
    if (!validRecs.includes(output.recommendation)) {
      errors.push(`Некорректная рекомендация: "${output.recommendation}"`);
    }

    return { valid: errors.length === 0, errors, canRetry: true };
  },

  gateCheck: (output: ScreeningOutput, _state: PipelineRunState): GateDecision => {
    // Section 0.6: 4+ NO answers → stop_return_to_skeleton → BLOCKED
    if (output.recommendation === 'stop_return_to_skeleton') {
      const noCount = output.answers.filter(a => !a).length;

      const fixes: FixItem[] = output.flags.map((flag, i) => ({
        id: `FIX-screening-${i}`,
        description: flag,
        severity: 'critical' as const,
        type: 'ideology' as const,
        recommendedApproach: 'compromise' as const,
      }));

      return {
        passed: false,
        reason: `Скрининг не пройден: ${noCount} из 7 ответов НЕТ. Требуется доработка концепта перед продолжением.`,
        fixes,
      };
    }

    return { passed: true };
  },

  reduce: (state: PipelineRunState, output: ScreeningOutput): PipelineRunState => {
    const noCount = output.answers.filter(a => !a).length;

    const screeningResult: ScreeningResult = {
      question1_thematicLaw: output.answers[0],
      question2_worldWithoutProtagonist: output.answers[1],
      question3_embodiment: output.answers[2],
      question4_hamartia: output.answers[3],
      question5_painfulChoice: output.answers[4],
      question6_antagonistLogic: output.answers[5],
      question7_finalIrreversible: output.answers[6],
      flags: output.flags,
      recommendation: output.recommendation,
      no_count: noCount,
      sections_for_deep_audit: output.flags,
      proceed_normally: noCount < 4,
    };

    return {
      ...state,
      screeningResult,
    };
  },

  maxRetries: 3,
  skipLLM: false,
  maxTokens: 4096,
};

// ---------------------------------------------------------------------------
// Section 0.6: Count-based screening recommendation
// ---------------------------------------------------------------------------

function determineScreeningRecommendation(answers: boolean[]): ScreeningRecommendation {
  const noCount = answers.filter(a => !a).length;
  if (noCount <= 1) return 'ready_for_audit';
  if (noCount <= 3) return 'requires_sections';
  return 'stop_return_to_skeleton';
}
