/**
 * Step 1: Mode Detection — determine audit mode (conflict / kishō / hybrid).
 *
 * LLM call using getAuditModePrompt() — prompt is in Russian per Language Contract.
 * Parses JSON: { hasAntagonist, victoryTrajectory, externalConflict, mode, reasoning }
 * - `reasoning` is in Russian; `mode` is English enum.
 * Gate: always passes — mode detection never blocks, only affects downstream execution.
 * maxTokens: 1024
 */

import type { AuditStep, PipelineRunState, StepValidationResult, GateDecision } from '../audit-step';
import type { AuditMode } from '../types';
import { getAuditModePrompt } from '../prompts';
import { extractJSON } from '../json-sanitizer';
import type { ChatMessage } from '@/lib/llm-client';

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

export interface ModeDetectionOutput {
  hasAntagonist: boolean;
  victoryTrajectory: boolean;
  externalConflict: boolean;
  mode: AuditMode;
  reasoning: string;
}

// ---------------------------------------------------------------------------
// Step definition
// ---------------------------------------------------------------------------

export const stepModeDetection: AuditStep<ModeDetectionOutput> = {
  id: 'mode_detection',

  buildPrompt: (state: PipelineRunState): ChatMessage[] => {
    const userPrompt = getAuditModePrompt(state.inputText);
    return [
      {
        role: 'system',
        content:
          'Ты — эксперт-аудитор нарративов, реализующий Протокол Аудита Вселенной v10.0. ' +
          'Отвечай ТОЛЬКО валидным JSON. Все описания и обоснования — на русском языке. ' +
          'Enum-значения (например, mode) — на английском.',
      },
      { role: 'user', content: userPrompt },
    ];
  },

  parseResponse: (raw: string): ModeDetectionOutput => {
    const jsonStr = extractJSON(raw);
    if (!jsonStr) {
      return {
        hasAntagonist: false,
        victoryTrajectory: false,
        externalConflict: false,
        mode: 'conflict',
        reasoning: 'Не удалось распарсить ответ LLM',
      };
    }

    try {
      const parsed = JSON.parse(jsonStr);
      const validModes: AuditMode[] = ['conflict', 'kishō', 'hybrid'];
      const mode = validModes.includes(parsed.mode) ? parsed.mode : 'conflict';

      return {
        hasAntagonist: !!parsed.hasAntagonist,
        victoryTrajectory: !!parsed.victoryTrajectory,
        externalConflict: !!parsed.externalConflict,
        mode,
        reasoning: String(parsed.reasoning || ''),
      };
    } catch {
      return {
        hasAntagonist: false,
        victoryTrajectory: false,
        externalConflict: false,
        mode: 'conflict',
        reasoning: 'Ошибка парсинга JSON',
      };
    }
  },

  validate: (output: ModeDetectionOutput): StepValidationResult => {
    const validModes: AuditMode[] = ['conflict', 'kishō', 'hybrid'];
    const errors: string[] = [];

    if (!validModes.includes(output.mode)) {
      errors.push(`Некорректный режим аудита: "${output.mode}". Ожидается conflict, kishō или hybrid.`);
    }

    if (!output.reasoning || output.reasoning.trim().length === 0) {
      errors.push('Отсутствует обоснование выбора режима (reasoning)');
    }

    return { valid: errors.length === 0, errors, canRetry: true };
  },

  gateCheck: (_output: ModeDetectionOutput, _state: PipelineRunState): GateDecision => {
    // Mode detection never blocks the pipeline
    return { passed: true };
  },

  reduce: (state: PipelineRunState, output: ModeDetectionOutput): PipelineRunState => {
    return {
      ...state,
      auditMode: output.mode,
    };
  },

  maxRetries: 3,
  skipLLM: false,
  maxTokens: 4096,
};
