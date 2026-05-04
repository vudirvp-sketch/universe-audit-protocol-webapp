/**
 * Step 10: Generative Modules — grief mapping (§9) and dilemma generation (§12).
 *
 * LLM calls for:
 *   - Grief mapping: Law → Grief Stage (activate when dominant_stage not supplied)
 *   - Dilemma generation: Theme → Dilemma (activate when final_dilemma not supplied)
 *
 * RULE_10: Generative templates MUST activate automatically.
 * maxTokens: 2048
 */

import type { AuditStep, PipelineRunState, StepValidationResult, GateDecision } from '../audit-step';
import type { GenerativeOutput, GriefStage } from '../types';
import { extractJSON } from '../json-sanitizer';
import { wrapUserInput, sanitizeNarrative } from '../input-sanitizer';
import type { ChatMessage } from '@/lib/llm-client';

// ---------------------------------------------------------------------------
// Step definition — uses GenerativeOutput from types.ts directly
// ---------------------------------------------------------------------------

export const stepGenerative: AuditStep<GenerativeOutput> = {
  id: 'generative_modules',

  buildPrompt: (state: PipelineRunState): ChatMessage[] => {
    const safeNarrative = wrapUserInput(sanitizeNarrative(state.narrativeDigest || state.inputText));
    const skeletonContext = state.skeleton ? JSON.stringify(state.skeleton, null, 2) : '';
    const dominantStage = state.griefMatrix?.dominantStage;

    return [
      {
        role: 'system',
        content:
          'Ты — эксперт-аудитор нарративов, реализующий Протокол Аудита Вселенной v10.0. ' +
          'Отвечай ТОЛЬКО валидным JSON. Все описания и обоснования — на русском языке. ' +
          'Enum-значения (derived_stage) — на английском.',
      },
      {
        role: 'user',
        content: `Сгенерируй генеративные модули для данного нарратива:

НАРРАТИВ:
${safeNarrative}

СКЕЛЕТ:
${skeletonContext}

${dominantStage ? `Доминантная стадия горя уже определена: ${dominantStage}` : 'Доминантная стадия горя не определена — выведи её из тематического закона'}

ЗАДАЧИ:
1. §9 — Маппинг «Закон → Стадия горя»: выведи доминантную стадию горя из тематического закона
2. §12 — «Тема → Дилемма»: сгенерируй корнелиеву дилемму на основе тематического закона

Верни ответ в формате JSON:
{
  "grief_mapping": {
    "law": "тематический закон на русском",
    "derived_stage": "denial|anger|bargaining|depression|acceptance",
    "justification_chain": ["обоснование 1 на русском", "обоснование 2 на русском"]
  },
  "dilemma": {
    "value_A": "ценность А на русском",
    "value_B": "ценность Б на русском",
    "criteria_met": {
      "type_choice": true/false,
      "irreversibility": true/false,
      "identity": true/false,
      "victory_price": true/false
    },
    "post_final_world": "описание мира после финала на русском",
    "conflict_description": "описание конфликта на русском"
  }
}`,
      },
    ];
  },

  parseResponse: (raw: string): GenerativeOutput => {
    const jsonStr = extractJSON(raw);
    if (!jsonStr) return {};

    try {
      const parsed = JSON.parse(jsonStr);
      const validStages: GriefStage[] = ['denial', 'anger', 'bargaining', 'depression', 'acceptance'];
      const result: GenerativeOutput = {};

      // Parse grief mapping
      if (parsed.grief_mapping) {
        const gm = parsed.grief_mapping;
        const chain = Array.isArray(gm.justification_chain) ? gm.justification_chain.map(String) : [];
        result.grief_mapping = {
          law: String(gm.law || ''),
          derived_stage: validStages.includes(gm.derived_stage) ? gm.derived_stage : 'depression',
          justification_chain: chain,
          justification: Array.isArray(gm.justification) ? gm.justification.map(String) : chain,
        };
      }

      // Parse dilemma
      if (parsed.dilemma) {
        const d = parsed.dilemma;
        result.dilemma = {
          value_A: String(d.value_A || ''),
          value_B: String(d.value_B || ''),
          criteria_met: {
            type_choice: !!d.criteria_met?.type_choice,
            irreversibility: !!d.criteria_met?.irreversibility,
            identity: !!d.criteria_met?.identity,
            victory_price: !!d.criteria_met?.victory_price,
          },
          post_final_world: String(d.post_final_world || ''),
          conflict_description: d.conflict_description ? String(d.conflict_description) : undefined,
        };
      }

      return result;
    } catch {
      return {};
    }
  },

  validate: (_output: GenerativeOutput): StepValidationResult => {
    // Generative modules produce optional output — always valid
    return { valid: true, errors: [], canRetry: false };
  },

  gateCheck: (_output: GenerativeOutput, _state: PipelineRunState): GateDecision => {
    // Generative modules never block
    return { passed: true };
  },

  reduce: (state: PipelineRunState, output: GenerativeOutput): PipelineRunState => {
    // Merge with existing generative output
    const existing = state.generativeOutput || {};
    return {
      ...state,
      generativeOutput: {
        ...existing,
        ...(output.grief_mapping ? { grief_mapping: output.grief_mapping } : {}),
        ...(output.dilemma ? { dilemma: output.dilemma } : {}),
      },
    };
  },

  maxRetries: 4,
  skipLLM: false,
  maxTokens: 8192,
};
