/**
 * Step 2: Author Profile — determine author's working method.
 *
 * LLM call using getAuthorProfilePrompt() — prompt is in Russian.
 * Parses JSON: { answers: { Q1-Q7 }, weightedScore, percentage, type, confidence, mainRisks, auditPriorities }
 * - mainRisks and auditPriorities values in Russian; type is English enum.
 * Gate: always passes — profile affects priority order, not blocking.
 * maxTokens: 2048
 */

import type { AuditStep, PipelineRunState, StepValidationResult, GateDecision } from '../audit-step';
import type { AuthorProfile, AuthorProfileType } from '../types';
import { getAuthorProfilePrompt } from '../prompts';
import { extractJSON } from '../json-sanitizer';
import type { ChatMessage } from '@/lib/llm-client';

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

export interface AuthorProfileOutput {
  answers: Record<string, boolean>;
  weightedScore: number;
  percentage: number;
  type: AuthorProfileType;
  confidence: 'high' | 'medium' | 'low';
  mainRisks: string[];
  auditPriorities: string[];
}

// ---------------------------------------------------------------------------
// Step definition
// ---------------------------------------------------------------------------

export const stepAuthorProfile: AuditStep<AuthorProfileOutput> = {
  id: 'author_profile',

  buildPrompt: (state: PipelineRunState): ChatMessage[] => {
    const userPrompt = getAuthorProfilePrompt(state.inputText);
    return [
      {
        role: 'system',
        content:
          'Ты — эксперт-аудитор нарративов, реализующий Протокол Аудита Вселенной v10.0. ' +
          'Отвечай ТОЛЬКО валидным JSON. Все описания, риски и приоритеты — на русском языке. ' +
          'Enum-значения (type, confidence) — на английском.',
      },
      { role: 'user', content: userPrompt },
    ];
  },

  parseResponse: (raw: string): AuthorProfileOutput => {
    const jsonStr = extractJSON(raw);
    if (!jsonStr) {
      return defaultOutput('Не удалось распарсить ответ LLM');
    }

    try {
      const parsed = JSON.parse(jsonStr);
      const validTypes: AuthorProfileType[] = ['gardener', 'hybrid', 'architect'];
      const type = validTypes.includes(parsed.type) ? parsed.type : 'hybrid';

      const answers: Record<string, boolean> = {};
      for (const key of ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7']) {
        answers[key] = !!parsed.answers?.[key];
      }

      return {
        answers,
        weightedScore: Number(parsed.weightedScore) || 0,
        percentage: Number(parsed.percentage) || 50,
        type,
        confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'medium',
        mainRisks: Array.isArray(parsed.mainRisks) ? parsed.mainRisks.map(String) : [],
        auditPriorities: Array.isArray(parsed.auditPriorities) ? parsed.auditPriorities.map(String) : [],
      };
    } catch {
      return defaultOutput('Ошибка парсинга JSON');
    }
  },

  validate: (output: AuthorProfileOutput): StepValidationResult => {
    const errors: string[] = [];
    const validTypes: AuthorProfileType[] = ['gardener', 'hybrid', 'architect'];

    if (!validTypes.includes(output.type)) {
      errors.push(`Некорректный тип профиля: "${output.type}"`);
    }

    const answerKeys = Object.keys(output.answers);
    if (answerKeys.length < 7) {
      errors.push(`Ожидается 7 ответов, получено ${answerKeys.length}`);
    }

    if (output.percentage < 0 || output.percentage > 100) {
      errors.push('Процент должен быть от 0 до 100');
    }

    return { valid: errors.length === 0, errors, canRetry: true };
  },

  gateCheck: (_output: AuthorProfileOutput, _state: PipelineRunState): GateDecision => {
    // Author profile never blocks the pipeline
    return { passed: true };
  },

  reduce: (state: PipelineRunState, output: AuthorProfileOutput): PipelineRunState => {
    const profile: AuthorProfile = {
      type: output.type,
      percentage: output.percentage,
      confidence: output.confidence,
      mainRisks: output.mainRisks,
      auditPriorities: output.auditPriorities,
    };

    return {
      ...state,
      authorProfile: profile,
    };
  },

  maxRetries: 3,
  skipLLM: false,
  maxTokens: 8192,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultOutput(reason: string): AuthorProfileOutput {
  return {
    answers: { Q1: false, Q2: false, Q3: false, Q4: false, Q5: false, Q6: false, Q7: false },
    weightedScore: 0,
    percentage: 50,
    type: 'hybrid',
    confidence: 'low',
    mainRisks: [reason],
    auditPriorities: [],
  };
}
