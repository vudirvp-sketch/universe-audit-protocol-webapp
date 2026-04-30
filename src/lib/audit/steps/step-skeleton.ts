/**
 * Step 3: Skeleton Extraction — extract structural elements from narrative.
 *
 * LLM call using getSkeletonExtractionPrompt() — prompt is in Russian.
 * Parses JSON: { thematicLaw, rootTrauma, hamartia, pillars, emotionalEngine,
 *                authorProhibition, targetExperience, centralQuestion }
 * All text values in Russian.
 *
 * GATE CHECK: If thematicLaw === null OR rootTrauma === null → BLOCKED.
 * These are non-negotiable prerequisites per the protocol.
 *
 * maxTokens: 2048
 */

import type { AuditStep, PipelineRunState, StepValidationResult, GateDecision } from '../audit-step';
import type { Skeleton, GriefStage, FixItem } from '../types';
import { getSkeletonExtractionPrompt } from '../prompts';
import { extractJSON } from '../json-sanitizer';
import type { ChatMessage } from '@/lib/llm-client';

// ---------------------------------------------------------------------------
// Output type (matches LLM JSON response)
// ---------------------------------------------------------------------------

export interface SkeletonOutput {
  thematicLaw: string | null;
  rootTrauma: string | null;
  hamartia: string | null;
  pillars: [string | null, string | null, string | null];
  emotionalEngine: GriefStage | null;
  authorProhibition: string | null;
  targetExperience: string | null;
  centralQuestion: string | null;
}

// ---------------------------------------------------------------------------
// Step definition
// ---------------------------------------------------------------------------

export const stepSkeleton: AuditStep<SkeletonOutput> = {
  id: 'skeleton_extraction',

  buildPrompt: (state: PipelineRunState): ChatMessage[] => {
    const userPrompt = getSkeletonExtractionPrompt(state.inputText, state.mediaType);
    return [
      {
        role: 'system',
        content:
          'Ты — эксперт-аудитор нарративов, реализующий Протокол Аудита Вселенной v10.0. ' +
          'Отвечай ТОЛЬКО валидным JSON. Все описания и извлечённые элементы — на русском языке. ' +
          'Enum-значения (emotionalEngine) — на английском. ' +
          'Если элемент не удаётся извлечь, используй null для этого поля. ' +
          'Проведи анализ слабостей на русском языке. Все описания, диагнозы и рекомендации должны быть на русском.',
      },
      { role: 'user', content: userPrompt },
    ];
  },

  parseResponse: (raw: string): SkeletonOutput => {
    const jsonStr = extractJSON(raw);
    if (!jsonStr) {
      return emptySkeleton('Не удалось распарсить ответ LLM');
    }

    try {
      const parsed = JSON.parse(jsonStr);
      const validStages: GriefStage[] = ['denial', 'anger', 'bargaining', 'depression', 'acceptance'];

      return {
        thematicLaw: parseNullableString(parsed.thematicLaw),
        rootTrauma: parseNullableString(parsed.rootTrauma),
        hamartia: parseNullableString(parsed.hamartia),
        pillars: [
          parseNullableString(parsed.pillars?.[0]),
          parseNullableString(parsed.pillars?.[1]),
          parseNullableString(parsed.pillars?.[2]),
        ],
        emotionalEngine: validStages.includes(parsed.emotionalEngine) ? parsed.emotionalEngine : null,
        authorProhibition: parseNullableString(parsed.authorProhibition),
        targetExperience: parseNullableString(parsed.targetExperience),
        centralQuestion: parseNullableString(parsed.centralQuestion),
      };
    } catch {
      return emptySkeleton('Ошибка парсинга JSON');
    }
  },

  validate: (output: SkeletonOutput): StepValidationResult => {
    const errors: string[] = [];

    // thematicLaw and rootTrauma MUST be present — they are non-negotiable prerequisites
    if (output.thematicLaw === null) {
      errors.push('Тематический закон не извлечён — обязательный элемент скелета');
    }
    if (output.rootTrauma === null) {
      errors.push('Корневая травма не извлечена — обязательный элемент скелета');
    }

    // Pillars should have at least one
    const pillarCount = output.pillars.filter(p => p !== null).length;
    if (pillarCount === 0) {
      errors.push('Не извлечён ни один столп — минимум 1 столп обязателен');
    }

    return { valid: errors.length === 0, errors, canRetry: true };
  },

  gateCheck: (output: SkeletonOutput, _state: PipelineRunState): GateDecision => {
    // NON-NEGOTIABLE: thematicLaw and rootTrauma must be non-null
    if (output.thematicLaw === null || output.rootTrauma === null) {
      const fixes: FixItem[] = [];

      if (output.thematicLaw === null) {
        fixes.push({
          id: 'FIX-thematic_law',
          description: 'Сформулируйте тематический закон как правило мира: «В этом мире [X] всегда ведёт к [Y]»',
          severity: 'critical',
          type: 'ideology',
          recommendedApproach: 'radical',
        });
      }

      if (output.rootTrauma === null) {
        fixes.push({
          id: 'FIX-root_trauma',
          description: 'Определите корневую травму — событие, разрушившее прежний порядок',
          severity: 'critical',
          type: 'memory',
          recommendedApproach: 'radical',
        });
      }

      return {
        passed: false,
        reason: 'Извлечение скелета не прошло: отсутствуют обязательные элементы (тематический закон, корневая травма)',
        fixes,
      };
    }

    return { passed: true };
  },

  reduce: (state: PipelineRunState, output: SkeletonOutput): PipelineRunState => {
    // Convert SkeletonOutput to canonical Skeleton type
    const elements = [
      { id: 'thematic_law', name: 'Тематический закон', value: output.thematicLaw, status: output.thematicLaw ? 'complete' as const : 'missing' as const },
      { id: 'root_trauma', name: 'Корневая травма', value: output.rootTrauma, status: output.rootTrauma ? 'complete' as const : 'missing' as const },
      { id: 'hamartia', name: 'Хамартия', value: output.hamartia, status: output.hamartia ? 'complete' as const : 'missing' as const },
      { id: 'pillar_1', name: 'Столп 1', value: output.pillars[0], status: output.pillars[0] ? 'complete' as const : 'missing' as const },
      { id: 'pillar_2', name: 'Столп 2', value: output.pillars[1], status: output.pillars[1] ? 'complete' as const : 'missing' as const },
      { id: 'pillar_3', name: 'Столп 3', value: output.pillars[2], status: output.pillars[2] ? 'complete' as const : 'missing' as const },
      { id: 'emotional_engine', name: 'Эмоциональный двигатель', value: output.emotionalEngine, status: output.emotionalEngine ? 'complete' as const : 'missing' as const },
      { id: 'author_prohibition', name: 'Авторский запрет', value: output.authorProhibition, status: output.authorProhibition ? 'complete' as const : 'missing' as const },
      { id: 'target_experience', name: 'Целевой опыт', value: output.targetExperience, status: output.targetExperience ? 'complete' as const : 'missing' as const },
      { id: 'central_question', name: 'Центральный вопрос', value: output.centralQuestion, status: output.centralQuestion ? 'complete' as const : 'missing' as const },
    ];

    const skeleton: Skeleton = {
      status: output.thematicLaw && output.rootTrauma ? 'COMPLETE' : 'INCOMPLETE',
      elements,
      fixes: [],
      canProceedToL1: !!(output.thematicLaw && output.rootTrauma),
    };

    return {
      ...state,
      skeleton,
    };
  },

  maxRetries: 3,
  skipLLM: false,
  maxTokens: 2048,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseNullableString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

function emptySkeleton(_reason: string): SkeletonOutput {
  return {
    thematicLaw: null,
    rootTrauma: null,
    hamartia: null,
    pillars: [null, null, null],
    emotionalEngine: null,
    authorProhibition: null,
    targetExperience: null,
    centralQuestion: null,
  };
}
