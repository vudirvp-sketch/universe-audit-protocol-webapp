/**
 * AuditStep interface and runStep lifecycle function.
 *
 * Implements the CVA-based invariant shared across all audit pipeline steps:
 *   buildPrompt → callLLM → parseResponse → validate → gateCheck → reduce
 *
 * Variability per step is captured in the AuditStep<TOutput> configuration object.
 * Steps 0 (input validation) and 11 (diagnostics) set skipLLM=true to bypass
 * the LLM call entirely — they are pure computation.
 *
 * RETRY STRATEGY (v2 — "rebuild prompt" instead of "append correction"):
 *
 *   When an LLM returns invalid JSON or fails validation, we NO LONGER append
 *   the failed response + a correction message to the conversation. Instead, we
 *   rebuild the prompt from scratch with increasingly strict JSON enforcement.
 *   This keeps the prompt size stable across retries, preventing:
 *     - Token truncation from ever-growing prompts
 *     - Rate limit pressure from bloated context
 *     - Confusing context for the LLM (failed responses in history)
 *
 *   After 2 failed attempts, we switch to "compressed output" mode, which
 *   explicitly instructs the LLM to produce minimal/condensed JSON — useful
 *   for models with small output token limits.
 *
 *   When finish_reason is 'length' (truncated output), we rebuild with
 *   explicit token budget instructions instead of appending a correction.
 *
 * References: COMPLETION_PLAN Section 2.3 (AuditStep), Section 2.4 (runStep)
 */

import type {
  AuditPhase,
  MediaType,
  AuditMode,
  AuthorProfile,
  Skeleton,
  ScreeningResult,
  GateResult,
  GriefArchitectureMatrix,
  Issue,
  ChainResult,
  GenerativeOutput,
  NextAction,
  FixItem,
} from './types';

import type { ChatMessage } from '@/lib/llm-client';
import { classifyLLMError } from './error-handler';

// ---------------------------------------------------------------------------
// LLMClient — inferred from the factory to avoid coupling to internals
// ---------------------------------------------------------------------------

type LLMClient = ReturnType<typeof import('@/lib/llm-client').createLLMClient>;

// ---------------------------------------------------------------------------
// PipelineRunState — lightweight state used by the pipeline runner
// (no Zustand actions; mutation happens via reduce functions)
// ---------------------------------------------------------------------------

export interface PipelineRunState {
  phase: AuditPhase;
  inputText: string;
  mediaType: MediaType;
  auditMode: AuditMode | null;
  authorProfile: AuthorProfile | null;
  skeleton: Skeleton | null;
  screeningResult: ScreeningResult | null;
  gateResults: {
    L1: GateResult | null;
    L2: GateResult | null;
    L3: GateResult | null;
    L4: GateResult | null;
  };
  griefMatrix: GriefArchitectureMatrix | null;
  issues: Issue[];
  whatForChains: ChainResult[];
  generativeOutput: GenerativeOutput | null;
  nextActions: NextAction[];
  finalScore: { total: string; percentage: number; by_level: Record<string, number> } | null;
  narrativeDigest: string | null;
  error: string | null;
  blockedAt: string | null;
  elapsedMs: number;
  stepTimings: Partial<Record<AuditPhase, number>>;
}

// ---------------------------------------------------------------------------
// GateDecision — returned by gateCheck to decide if the pipeline proceeds
// ---------------------------------------------------------------------------

export interface GateDecision {
  /** Whether the gate was passed and the pipeline may continue */
  passed: boolean;
  /** Numeric score produced by this step (e.g. gate percentage) */
  score?: number;
  /** The threshold that was applied — varies by audit mode (Section 0.7) */
  threshold?: number;
  /** Human-readable reason for failure (Russian) */
  reason?: string;
  /** Suggested fixes the user can apply to pass this gate */
  fixes?: FixItem[];
}

// ---------------------------------------------------------------------------
// StepValidationResult — returned by validate to check parsed LLM output
// ---------------------------------------------------------------------------

export interface StepValidationResult {
  /** Whether the parsed output conforms to the expected schema */
  valid: boolean;
  /** Validation error descriptions (Russian for user-facing, English for debug) */
  errors: string[];
  /** Whether the step may be retried after validation failure */
  canRetry: boolean;
}

// ---------------------------------------------------------------------------
// ModelCapabilities — optional info about the LLM's limits
// ---------------------------------------------------------------------------

export interface ModelCapabilities {
  /** Maximum output tokens the model can produce in a single completion */
  maxOutputTokens?: number;
}

// ---------------------------------------------------------------------------
// AuditStep<TOutput> — declarative configuration for one pipeline step
// ---------------------------------------------------------------------------

export interface AuditStep<TOutput = unknown> {
  /** Unique step identifier matching AuditPhase */
  id: AuditPhase;

  /** Build the LLM prompt from current audit state */
  buildPrompt: (state: PipelineRunState) => ChatMessage[];

  /** Parse raw LLM response string into typed output */
  parseResponse: (raw: string) => TOutput;

  /** Validate parsed output against schema rules */
  validate: (output: TOutput) => StepValidationResult;

  /** Determine if this step blocks the pipeline */
  gateCheck: (output: TOutput, state: PipelineRunState) => GateDecision;

  /** How this step mutates the audit state */
  reduce: (state: PipelineRunState, output: TOutput) => PipelineRunState;

  /**
   * Maximum retries on parse/validation failure.
   * The total number of attempts is maxRetries + 1 (initial + retries).
   * Gate steps (L1–L4) should use maxRetries: 4 (total 5 attempts) for
   * resilience; other steps typically use 3 (total 4 attempts).
   */
  maxRetries: number;

  /** If true, runStep skips the LLM call entirely (Steps 0 and 11) */
  skipLLM: boolean;

  /** Minimum max_tokens for the LLM response */
  maxTokens: number;

  /**
   * Minimum output tokens a model must support for this step to produce
   * valid output. If the model's maxOutputTokens is below this threshold,
   * runStep will proactively add compressed-output instructions to the
   * prompt before the first LLM call, and will emit a warning.
   *
   * This prevents the "silent truncation loop" where a model with small
   * output limits repeatedly generates incomplete JSON that fails
   * validation and exhausts the retry budget.
   *
   * Set to 0 (default) if the step has no minimum requirement.
   */
  minOutputTokens?: number;
}

// ---------------------------------------------------------------------------
// AuditStepError — thrown when a step exhausts its retry budget
// ---------------------------------------------------------------------------

export class AuditStepError extends Error {
  /** The step that failed */
  public readonly stepId: AuditPhase;
  /** How many attempts were made (including the initial one) */
  public readonly attempts: number;
  /** Original cause, if any */
  public readonly cause: unknown;

  constructor(stepId: AuditPhase, attempts: number, message: string, cause?: unknown) {
    super(message);
    this.name = 'AuditStepError';
    this.stepId = stepId;
    this.attempts = attempts;
    this.cause = cause;

    // Restore prototype chain that is broken by extending built-ins
    Object.setPrototypeOf(this, AuditStepError.prototype);
  }
}

// ---------------------------------------------------------------------------
// rebuildWithCorrection — fresh prompt with validation error info
//
// Instead of appending the failed response + correction to the existing
// conversation (which bloats token count), we rebuild from scratch with a
// user message that includes the validation errors and STRONGER JSON format
// requirements. The prompt stays the same size as the original.
// ---------------------------------------------------------------------------

function rebuildWithCorrection<TOutput>(
  step: AuditStep<TOutput>,
  state: PipelineRunState,
  errors: string[],
): ChatMessage[] {
  const baseMessages = step.buildPrompt(state);

  const correctionSuffix =
    '\n\n' +
    '⚠️ КРИТИЧЕСКОЕ ТРЕБОВАНИЕ: Ваш предыдущий ответ не прошёл валидацию.\n' +
    'Ошибки: ' + errors.join('; ') + '\n\n' +
    'ПРАВИЛА ФОРМАТИРОВАНИЯ JSON (СТРОГО):\n' +
    '(1) Весь ответ — ТОЛЬКО валидный JSON. Никакого текста до или после.\n' +
    '(2) Никаких markdown-блоков (```json ... ```).\n' +
    '(3) Все строковые значения в двойных кавычках.\n' +
    '(4) null вместо None. true/false вместо True/False.\n' +
    '(5) Без trailing commas перед } или ].\n' +
    '(6) Все ключи в двойных кавычках.\n' +
    '(7) Экранируйте кавычки внутри строк: \\\" вместо \".\n' +
    '(8) Не добавляйте комментарии внутри JSON.\n' +
    'Повторите ответ, строго соблюдая эти правила.';

  // Append correction to the last user message (or add a new one)
  const lastIdx = baseMessages.length - 1;
  if (lastIdx >= 0 && baseMessages[lastIdx].role === 'user') {
    return [
      ...baseMessages.slice(0, lastIdx),
      { role: 'user' as const, content: baseMessages[lastIdx].content + correctionSuffix },
    ];
  }

  return [
    ...baseMessages,
    { role: 'user' as const, content: correctionSuffix.trim() },
  ];
}

// ---------------------------------------------------------------------------
// rebuildWithCompressedPrompt — fresh prompt requesting minimal/condensed JSON
//
// After multiple failures, we switch to "compressed output" mode. This tells
// the LLM to use minimal JSON — short evidence, no verbose descriptions —
// which helps models with small output token limits succeed.
// ---------------------------------------------------------------------------

function rebuildWithCompressedPrompt<TOutput>(
  step: AuditStep<TOutput>,
  state: PipelineRunState,
  attempt: number,
): ChatMessage[] {
  const baseMessages = step.buildPrompt(state);

  const compressedSuffix =
    '\n\n' +
    '⚠️ СРОЧНО: Ваши предыдущие ответы не прошли валидацию (попытка ' + (attempt + 1) + ').\n\n' +
    'РЕЖИМ СЖАТОГО ВЫВОДА — строго соблюдайте:\n' +
    '(1) Ответьте МИНИМАЛЬНЫМ JSON. Уберите все необязательные поля.\n' +
    '(2) Используйте краткие строковые значения (1-2 предложения, не абзацы).\n' +
    '(3) Поле "evidence" — максимум 10 слов на элемент.\n' +
    '(4) Поле "reason" / "description" — максимум 15 слов.\n' +
    '(5) Не добавляйте пояснений, вступлений или заключений.\n' +
    '(6) Весь ответ — ТОЛЬКО валидный JSON, без markdown-блоков.\n' +
    '(7) Бюджет токенов: ваш ответ должен быть максимально компактным.\n' +
    '(8) null вместо None. true/false вместо True/False. Без trailing commas.\n' +
    'Ответьте компактным валидным JSON.';

  // Append compressed instructions to the last user message (or add a new one)
  const lastIdx = baseMessages.length - 1;
  if (lastIdx >= 0 && baseMessages[lastIdx].role === 'user') {
    return [
      ...baseMessages.slice(0, lastIdx),
      { role: 'user' as const, content: baseMessages[lastIdx].content + compressedSuffix },
    ];
  }

  return [
    ...baseMessages,
    { role: 'user' as const, content: compressedSuffix.trim() },
  ];
}

// ---------------------------------------------------------------------------
// rebuildWithTokenBudget — fresh prompt with explicit token budget for
// truncated (finish_reason: 'length') responses
// ---------------------------------------------------------------------------

function rebuildWithTokenBudget<TOutput>(
  step: AuditStep<TOutput>,
  state: PipelineRunState,
  effectiveMaxTokens: number,
): ChatMessage[] {
  const baseMessages = step.buildPrompt(state);

  const budgetSuffix =
    '\n\n' +
    '⚠️ ВАШ ПРЕДЫДУЩИЙ ОТВЕТ БЫЛ ОБРЕЗАН из-за ограничения токенов.\n' +
    'Бюджет токенов для ответа: не более ' + effectiveMaxTokens + ' токенов.\n\n' +
    'ИНСТРУКЦИИ ДЛЯ КОМПАКТНОГО ОТВЕТА:\n' +
    '(1) Уберите все необязательные поля из JSON.\n' +
    '(2) Строковые значения — максимум 10-15 слов каждое.\n' +
    '(3) Поле "evidence" — максимум 8 слов на элемент.\n' +
    '(4) Не пишите пояснений, вступлений или заключений.\n' +
    '(5) Весь ответ — ТОЛЬКО компактный валидный JSON.\n' +
    '(6) null вместо None. true/false вместо True/False. Без trailing commas.\n' +
    'Ответьте максимально кратким валидным JSON.';

  const lastIdx = baseMessages.length - 1;
  if (lastIdx >= 0 && baseMessages[lastIdx].role === 'user') {
    return [
      ...baseMessages.slice(0, lastIdx),
      { role: 'user' as const, content: baseMessages[lastIdx].content + budgetSuffix },
    ];
  }

  return [
    ...baseMessages,
    { role: 'user' as const, content: budgetSuffix.trim() },
  ];
}

// ---------------------------------------------------------------------------
// clampMaxTokens — ensure max_tokens doesn't exceed the model's actual limit
// ---------------------------------------------------------------------------

function clampMaxTokens(
  requestedTokens: number,
  modelCapabilities?: ModelCapabilities,
): number {
  if (modelCapabilities?.maxOutputTokens && modelCapabilities.maxOutputTokens > 0) {
    return Math.min(requestedTokens, modelCapabilities.maxOutputTokens);
  }
  return requestedTokens;
}

// ---------------------------------------------------------------------------
// runStep — full lifecycle for a single audit pipeline step
// ---------------------------------------------------------------------------

/**
 * Execute a single audit step through the full lifecycle:
 *
 *   skipLLM ?  ──yes──▶  parseResponse('') → validate → gateCheck → reduce
 *               ──no──▶  buildPrompt → callLLM ──▶ [truncated?] ──▶
 *                        parseResponse → validate ──▶ [retry?] ──▶
 *                        gateCheck → reduce
 *
 * - If skipLLM is true, the LLM is never called and the step must produce
 *   output from current state alone (Steps 0 and 11).
 * - If finish_reason is 'length', the LLM ran out of tokens and we REBUILD
 *   the prompt with explicit token budget instructions (not append).
 * - If parseResponse or validate fails, we retry up to maxRetries times.
 *   On retries 0-1 we rebuild with validation correction; on retries 2+
 *   we switch to compressed output mode. The prompt is always rebuilt from
 *   scratch — never appended to — to keep token count stable.
 * - If gateCheck returns passed=false, the returned state has phase='blocked'.
 * - If all retries are exhausted, AuditStepError is thrown.
 *
 * @param step            The audit step configuration
 * @param state           Current pipeline state
 * @param llmClient       LLM client for chat completions
 * @param onProgress      Progress callback
 * @param modelCapabilities  Optional model limits (e.g. maxOutputTokens)
 */
export async function runStep<TOutput = unknown>(
  step: AuditStep<TOutput>,
  state: PipelineRunState,
  llmClient: LLMClient,
  onProgress: (phase: AuditPhase) => void,
  modelCapabilities?: ModelCapabilities,
): Promise<PipelineRunState> {
  const stepStart = Date.now();
  onProgress(step.id);

  // =======================================================================
  // Fast path: skip LLM entirely (pure computation steps)
  // =======================================================================
  if (step.skipLLM) {
    // For skipLLM steps, the step produces output from the current state
    // without any LLM call. parseResponse receives an empty string and must
    // derive its result from the state passed through closure or other means.
    // A more typical pattern is that the step overrides parseResponse to
    // compute from state directly; the empty-string convention keeps the
    // interface uniform.
    const computed = step.parseResponse('');
    const validation = step.validate(computed);

    if (!validation.valid) {
      throw new AuditStepError(
        step.id,
        1,
        `Шаг ${step.id}: вычисленный результат не прошёл валидацию — ${validation.errors.join(', ')}`,
      );
    }

    const decision = step.gateCheck(computed, state);
    const newState = step.reduce(state, computed);

    const elapsed = Date.now() - stepStart;

    if (!decision.passed) {
      return {
        ...newState,
        phase: 'blocked',
        error: decision.reason ?? `Шаг ${step.id} заблокировал конвейер`,
        blockedAt: step.id,
        elapsedMs: state.elapsedMs + elapsed,
        stepTimings: { ...state.stepTimings, [step.id]: elapsed },
      };
    }

    return {
      ...newState,
      elapsedMs: state.elapsedMs + elapsed,
      stepTimings: { ...state.stepTimings, [step.id]: elapsed },
    };
  }

  // =======================================================================
  // LLM path: buildPrompt → callLLM → parseResponse → validate → gateCheck → reduce
  //
  // Key design principle: on retry, REBUILD the prompt from scratch rather
  // than appending the failed response + correction. This prevents the
  // conversation from growing with each retry, which would:
  //   - Increase prompt token count → more likely truncation
  //   - Waste rate limit budget on bloated context
  //   - Confuse the LLM with failed attempts in its history
  // =======================================================================
  let accumulatedMessages: ChatMessage[] = step.buildPrompt(state);
  const effectiveMaxTokens = clampMaxTokens(step.maxTokens, modelCapabilities);

  // ── Proactive compressed mode for models with small output limits ─────
  // If the model's maxOutputTokens is below the step's declared minimum,
  // we add compressed-output instructions BEFORE the first call. This
  // prevents the "silent truncation loop" where the model repeatedly
  // generates incomplete JSON that fails validation.
  const stepMinOutput = (step as AuditStep<unknown> & { minOutputTokens?: number }).minOutputTokens || 0;
  if (stepMinOutput > 0 && effectiveMaxTokens < stepMinOutput) {
    console.warn(
      `[Model capability] Step ${step.id}: model maxOutputTokens (${effectiveMaxTokens}) ` +
      `is below step minimum (${stepMinOutput}). Adding compressed output mode proactively.`
    );
    accumulatedMessages = rebuildWithCompressedPrompt(step, state, 0);
  }

  for (let attempt = 0; attempt <= step.maxRetries; attempt++) {
    try {
      const response = await llmClient.chatCompletion({
        messages: accumulatedMessages,
        max_tokens: effectiveMaxTokens,
      });

      // -----------------------------------------------------------------
      // Detect truncated response — the LLM hit the token ceiling
      // Instead of appending a correction (which would make the next
      // prompt even longer), rebuild with explicit token budget.
      // -----------------------------------------------------------------
      const finishReason = response.choices?.[0]?.finish_reason;

      // Handle content_filter (safety/blocked responses) — NOT retryable
      // with the same prompt. This occurs when Gemini returns SAFETY/
      // RECITATION/BLOCKLIST or similar providers block the response.
      if (finishReason === 'content_filter') {
        throw new AuditStepError(
          step.id,
          attempt + 1,
          'Ответ LLM заблокирован фильтром безопасности провайдера. ' +
          'Попробуйте переформулировать входной текст или использовать другого провайдера/модель.',
        );
      }

      if (finishReason === 'length') {
        if (attempt < step.maxRetries) {
          // Rebuild with token budget instructions instead of appending
          accumulatedMessages = rebuildWithTokenBudget(
            step,
            state,
            effectiveMaxTokens,
          );
          continue;
        }
        throw new AuditStepError(
          step.id,
          attempt + 1,
          `Ответ LLM обрезан (finish_reason: 'length'). ` +
            `Текущий лимит max_tokens: ${effectiveMaxTokens}. ` +
            'Увеличьте max_tokens или упростите промпт.',
        );
      }

      const content = response.choices?.[0]?.message?.content ?? '';

      // Parse and validate the LLM output
      const parsed = step.parseResponse(content);
      const validation = step.validate(parsed);

      if (validation.valid) {
        // Output is valid — run gate check and reduce
        const decision = step.gateCheck(parsed, state);
        const newState = step.reduce(state, parsed);
        const elapsed = Date.now() - stepStart;

        if (!decision.passed) {
          return {
            ...newState,
            phase: 'blocked',
            error: decision.reason ?? `Шаг ${step.id} заблокировал конвейер`,
            blockedAt: step.id,
            elapsedMs: state.elapsedMs + elapsed,
            stepTimings: { ...state.stepTimings, [step.id]: elapsed },
          };
        }

        return {
          ...newState,
          elapsedMs: state.elapsedMs + elapsed,
          stepTimings: { ...state.stepTimings, [step.id]: elapsed },
        };
      }

      // -----------------------------------------------------------------
      // Validation failed — decide whether to retry
      // -----------------------------------------------------------------
      if (!validation.canRetry || attempt >= step.maxRetries) {
        break;
      }

      // Rebuild prompt with stricter JSON enforcement (NOT append).
      // For attempts 0-1: include validation error details for correction.
      // For attempts 2+: switch to compressed output mode.
      if (attempt < 2) {
        accumulatedMessages = rebuildWithCorrection(step, state, validation.errors);
      } else {
        accumulatedMessages = rebuildWithCompressedPrompt(step, state, attempt);
      }
    } catch (error) {
      // Re-throw AuditStepError as-is
      if (error instanceof AuditStepError) {
        throw error;
      }

      // Classify the error for better user messaging and retry decisions
      const classified = classifyLLMError(error);

      // Non-retryable errors (auth, CORS, etc.) — fail immediately
      if (!classified.retryable) {
        throw new AuditStepError(
          step.id,
          attempt + 1,
          classified.userMessage,
          error,
        );
      }

      // Retryable errors — if retries exhausted, throw
      if (attempt >= step.maxRetries) {
        throw new AuditStepError(
          step.id,
          attempt + 1,
          classified.userMessage,
          error,
        );
      }

      // Exponential backoff for transient server errors (503, 502, 429, timeout)
      // These need breathing room before retrying — hammering an overloaded
      // server will only make it worse.
      if (classified.type === 'provider_overloaded' || classified.type === 'rate_limit' || classified.type === 'timeout') {
        const backoffSeconds = Math.min(10 * Math.pow(2, attempt), 60); // 10s, 20s, 40s, 60s max
        console.warn(
          `[Transient error] Step ${step.id}, attempt ${attempt + 1}/${step.maxRetries + 1}: ` +
          `${classified.type} — waiting ${backoffSeconds}s before retry...`
        );
        await new Promise((resolve) => setTimeout(resolve, backoffSeconds * 1000));
      }

      // Rebuild prompt from scratch for next attempt — don't append to the
      // failed conversation. This keeps prompt size stable.
      accumulatedMessages = step.buildPrompt(state);
    }
  }

  // All retries exhausted
  throw new AuditStepError(
    step.id,
    step.maxRetries + 1,
    `Шаг ${step.id}: исчерпано максимальное число попыток (${step.maxRetries + 1}). ` +
    'Проверьте корректность промпта и схему валидации.',
  );
}
