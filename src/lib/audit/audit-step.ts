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

  /** Maximum retries on parse/validation failure */
  maxRetries: number;

  /** If true, runStep skips the LLM call entirely (Steps 0 and 11) */
  skipLLM: boolean;

  /** Minimum max_tokens for the LLM response */
  maxTokens: number;
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
// Correction message for retry — in Russian per language contract
// ---------------------------------------------------------------------------

function buildCorrectionMessage(errors: string[]): string {
  return (
    'Ваш предыдущий ответ был невалидным: ' +
    errors.join('; ') +
    '. Пожалуйста, ответьте СТРОГО валидным JSON согласно запрошенной схеме. ' +
    'КРИТИЧЕСКИЕ ПРАВИЛА: (1) Никакого текста до или после JSON. (2) Никаких markdown-блоков. ' +
    '(3) Все строковые значения в двойных кавычках. (4) null вместо None. ' +
    '(5) true/false вместо True/False. (6) Без trailing commas перед } или ]. ' +
    '(7) Все ключи в двойных кавычках.'
  );
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
 * - If finish_reason is 'length', the LLM ran out of tokens and we retry
 *   with a correction message asking for a more concise response.
 * - If parseResponse or validate fails, we retry up to maxRetries times,
 *   appending a Russian correction message on each retry.
 * - If gateCheck returns passed=false, the returned state has phase='blocked'.
 * - If all retries are exhausted, AuditStepError is thrown.
 */
export async function runStep<TOutput = unknown>(
  step: AuditStep<TOutput>,
  state: PipelineRunState,
  llmClient: LLMClient,
  onProgress: (phase: AuditPhase) => void,
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
  // =======================================================================
  let accumulatedMessages: ChatMessage[] = step.buildPrompt(state);

  for (let attempt = 0; attempt <= step.maxRetries; attempt++) {
    try {
      const response = await llmClient.chatCompletion({
        messages: accumulatedMessages,
        max_tokens: step.maxTokens,
      });

      // Detect truncated response — the LLM hit the token ceiling
      const finishReason = response.choices?.[0]?.finish_reason;
      if (finishReason === 'length') {
        if (attempt < step.maxRetries) {
          // Append a correction message and retry
          accumulatedMessages = [
            ...accumulatedMessages,
            {
              role: 'assistant',
              content: response.choices[0].message.content,
            },
            {
              role: 'user',
              content:
                'Ваш ответ был обрезан из-за ограничения токенов. ' +
                'Пожалуйста, ответьте более кратко, сохранив JSON-структуру.',
            },
          ];
          continue;
        }
        throw new AuditStepError(
          step.id,
          attempt + 1,
          `Ответ LLM обрезан (finish_reason: 'length'). ` +
            `Текущий лимит max_tokens: ${step.maxTokens}. ` +
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

      // Validation failed — decide whether to retry
      if (!validation.canRetry || attempt >= step.maxRetries) {
        break;
      }

      // Append correction message and retry
      accumulatedMessages = [
        ...accumulatedMessages,
        {
          role: 'assistant',
          content,
        },
        {
          role: 'user',
          content: buildCorrectionMessage(validation.errors),
        },
      ];
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

      // Retry on transient errors — append a contextual retry prompt
      const retryPrompt = classified.type === 'provider_overloaded'
        ? 'Модель была перегружена. Повторите ответ в формате валидного JSON.'
        : classified.type === 'rate_limit'
          ? 'Сервер перегружен. Подождите немного и повторите ответ в формате валидного JSON.'
          : classified.type === 'timeout'
          ? 'Ответ занял слишком много времени. Пожалуйста, ответьте более кратко в формате валидного JSON.'
          : classified.type === 'invalid_json'
            ? 'Ваш ответ не был валидным JSON. Пожалуйста, ответьте строго в формате валидного JSON.'
            : 'Произошла ошибка при обработке предыдущего ответа. Пожалуйста, повторите ответ в формате валидного JSON.';

      accumulatedMessages = [
        ...accumulatedMessages,
        {
          role: 'user',
          content: retryPrompt,
        },
      ];
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
