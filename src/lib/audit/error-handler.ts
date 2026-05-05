/**
 * LLM error classification for the audit pipeline.
 *
 * Every error that arises during an LLM call is classified into a specific
 * AuditErrorType so the orchestrator can decide whether to retry, show a
 * user-friendly message, or abort the pipeline.
 *
 * All userMessage strings are in Russian per the language contract.
 *
 * References: COMPLETION_PLAN Section 4.1 — LLM error classification
 */

// ---------------------------------------------------------------------------
// AuditErrorType — discriminated error categories
// ---------------------------------------------------------------------------

export type AuditErrorType =
  | 'network'
  | 'transient_error'
  | 'fatal_auth_error'
  | 'fatal_cors_error'
  | 'provider'
  | 'parse_error'
  | 'truncated';

// ---------------------------------------------------------------------------
// AuditError — structured error with classification and retry info
// ---------------------------------------------------------------------------

export interface AuditError {
  /** Classified error type */
  type: AuditErrorType;
  /** Human-readable message in Russian for display to the user */
  userMessage: string;
  /** Whether the operation can be retried automatically */
  retryable: boolean;
  /** HTTP status code, if available from a Response object */
  status?: number;
}

// ---------------------------------------------------------------------------
// classifyLLMError — map unknown errors to structured AuditError
// ---------------------------------------------------------------------------

/**
 * Classify an unknown error from an LLM call into a structured AuditError.
 *
 * Classification priority (first match wins):
 *   1.  TypeError with 'fetch' in message → network
 *   2.  Response with status 401           → auth
 *   3.  Response with status 429           → rate_limit
 *   4.  Response with status 503 / message with 'overloaded'/'high demand' → provider_overloaded
 *   5.  Response with status 502 / message with 'bad gateway' → provider_overloaded
 *   6.  Response with status 500           → provider
 *   7.  Error message with 'CORS'/'proxy'  → cors
 *   8.  Error message with 'timeout'       → timeout
 *   9.  Error message with 'JSON'/'parse'  → parse_error
 *   10. Error message with 'truncated'/'finish_reason' → truncated
 *   11. Default                            → provider
 */
export function classifyLLMError(error: unknown): AuditError {
  // Extract a message string for pattern matching
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : String(error);

  const messageLower = message.toLowerCase();

  // 1. TypeError with 'fetch' — network connectivity failure
  if (error instanceof TypeError && messageLower.includes('fetch')) {
    return {
      type: 'network',
      userMessage:
        'Не удалось подключиться к серверу. Проверьте интернет-соединение и попробуйте снова.',
      retryable: true,
    };
  }

  // 2. Response with status 401/403 — authentication failure
  if (isResponseWithStatus(error, 401) || isResponseWithStatus(error, 403)) {
    return {
      type: 'fatal_auth_error',
      userMessage:
        'Ошибка аутентификации: неверный или просроченный API-ключ. Проверьте ключ в настройках.',
      retryable: false,
      status: isResponseWithStatus(error, 401) ? 401 : 403,
    };
  }

  // 3. Response with status 429 — rate limiting (transient)
  if (isResponseWithStatus(error, 429)) {
    return {
      type: 'transient_error',
      userMessage:
        'Превышен лимит запросов к LLM-провайдеру. Подождите немного и попробуйте снова.',
      retryable: true,
      status: 429,
    };
  }

  // 4. Response with status 503 — service unavailable (model overloaded, transient)
  if (isResponseWithStatus(error, 503) || messageLower.includes('503') || messageLower.includes('overloaded') || messageLower.includes('high demand') || messageLower.includes('unavailable')) {
    return {
      type: 'transient_error',
      userMessage:
        'Модель LLM-провайдера перегружена (503). Это временная проблема — система автоматически повторит запрос через несколько секунд.',
      retryable: true,
      status: 503,
    };
  }

  // 5. Response with status 502 — bad gateway (upstream timeout, transient)
  if (isResponseWithStatus(error, 502) || messageLower.includes('502') || messageLower.includes('bad gateway')) {
    return {
      type: 'transient_error',
      userMessage:
        'Шлюз LLM-провайдера временно недоступен (502). Это временная проблема — система автоматически повторит запрос.',
      retryable: true,
      status: 502,
    };
  }

  // 6. Response with status 500 — provider-side error
  if (isResponseWithStatus(error, 500)) {
    return {
      type: 'provider',
      userMessage:
        'Внутренняя ошибка на стороне LLM-провайдера. Попробуйте позже или смените провайдера.',
      retryable: true,
      status: 500,
    };
  }

  // 7. CORS / proxy errors — typically from the Cloudflare Worker
  if (messageLower.includes('cors') || messageLower.includes('proxy')) {
    return {
      type: 'fatal_cors_error',
      userMessage:
        'Ошибка CORS-прокси. Убедитесь, что URL прокси указан верно в настройках, и что Worker развёрнут.',
      retryable: false,
    };
  }

  // 8. Timeout errors (transient)
  if (messageLower.includes('timeout')) {
    return {
      type: 'transient_error',
      userMessage:
        'Превышено время ожидания ответа от LLM. Попробуйте снова или используйте более быструю модель.',
      retryable: true,
    };
  }

  // 9. Parse errors — LLM returned unparseable markdown or empty response
  if (messageLower.includes('parse') || messageLower.includes('пустой ответ') || messageLower.includes('empty response')) {
    return {
      type: 'parse_error',
      userMessage:
        'Не удалось распарсить ответ LLM. Система обработает лучший результат.',
      retryable: true,
    };
  }

  // 10. Truncated response — finish_reason was 'length'
  if (messageLower.includes('truncated') || messageLower.includes('finish_reason')) {
    return {
      type: 'truncated',
      userMessage:
        'Ответ LLM был обрезан из-за ограничения токенов. Попробуйте увеличить max_tokens в настройках шага.',
      retryable: true,
    };
  }

  // 11. Default — unclassified provider error
  return {
    type: 'provider',
    userMessage:
      'Неожиданная ошибка при обращении к LLM-провайдеру: ' + message,
    retryable: false,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check if an error is (or wraps) a Response object with a specific HTTP status.
 * Some fetch wrappers throw the Response directly, or attach it as error.response.
 */
function isResponseWithStatus(error: unknown, status: number): boolean {
  // Direct Response instance
  if (typeof Response !== 'undefined' && error instanceof Response) {
    return error.status === status;
  }

  // Error wrapping a Response (e.g. error.response = new Response(...))
  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;
    if (err.status === status) {
      return true;
    }
    if (err.response && typeof err.response === 'object') {
      const resp = err.response as Record<string, unknown>;
      if (resp.status === status) {
        return true;
      }
    }
  }

  // Fallback: check the error message for the status code pattern
  // e.g. "proxy error (401): ..."
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';

  if (message.includes(`(${status})`) || message.includes(`${status}:`)) {
    return true;
  }

  return false;
}
