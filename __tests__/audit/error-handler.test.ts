/**
 * Error Handler Tests
 *
 * Tests for classifyLLMError() — LLM error classification.
 * Covers: all 7 AuditErrorType categories, retryable flags,
 * Response object handling, error message patterns, and defaults.
 */

import { classifyLLMError } from '../../src/lib/audit/error-handler';
import type { AuditErrorType } from '../../src/lib/audit/error-handler';

describe('classifyLLMError', () => {
  // =========================================================================
  // 1. Network errors (TypeError with 'fetch')
  // =========================================================================

  test('Classifies TypeError with "fetch" as network error', () => {
    const error = new TypeError('Failed to fetch');
    const result = classifyLLMError(error);
    expect(result.type).toBe('network');
    expect(result.retryable).toBe(true);
    expect(result.userMessage).toContain('интернет-соединение');
  });

  test('Classifies TypeError with "FETCH" (case-insensitive) as network error', () => {
    const error = new TypeError('FETCH error occurred');
    const result = classifyLLMError(error);
    expect(result.type).toBe('network');
    expect(result.retryable).toBe(true);
  });

  test('Does NOT classify non-TypeError with "fetch" as network error', () => {
    // A regular Error with "fetch" in message does not match rule 1
    const error = new Error('fetch problem');
    const result = classifyLLMError(error);
    // Should fall through to default (provider) or match another rule
    expect(result.type).not.toBe('network');
  });

  // =========================================================================
  // 2. Authentication errors (status 401 / 403)
  // =========================================================================

  test('Classifies Response with status 401 as fatal_auth_error', () => {
    const error = { status: 401 };
    const result = classifyLLMError(error);
    expect(result.type).toBe('fatal_auth_error');
    expect(result.retryable).toBe(false);
    expect(result.status).toBe(401);
    expect(result.userMessage).toContain('API-ключ');
  });

  test('Classifies Response with status 403 as fatal_auth_error', () => {
    const error = { status: 403 };
    const result = classifyLLMError(error);
    expect(result.type).toBe('fatal_auth_error');
    expect(result.retryable).toBe(false);
    expect(result.status).toBe(403);
    expect(result.userMessage).toContain('API-ключ');
  });

  test('Classifies error with response.status 401 as fatal_auth_error', () => {
    const error = { response: { status: 401 } };
    const result = classifyLLMError(error);
    expect(result.type).toBe('fatal_auth_error');
    expect(result.retryable).toBe(false);
  });

  test('Classifies error message with (401) pattern as fatal_auth_error', () => {
    const error = new Error('proxy error (401): unauthorized');
    const result = classifyLLMError(error);
    expect(result.type).toBe('fatal_auth_error');
    expect(result.retryable).toBe(false);
  });

  test('Classifies error message with 401: pattern as fatal_auth_error', () => {
    const error = new Error('HTTP 401: Unauthorized');
    const result = classifyLLMError(error);
    expect(result.type).toBe('fatal_auth_error');
  });

  // =========================================================================
  // 3. Rate limit / transient errors (status 429)
  // =========================================================================

  test('Classifies Response with status 429 as transient_error', () => {
    const error = { status: 429 };
    const result = classifyLLMError(error);
    expect(result.type).toBe('transient_error');
    expect(result.retryable).toBe(true);
    expect(result.status).toBe(429);
    expect(result.userMessage).toContain('лимит');
  });

  test('Classifies error with response.status 429 as transient_error', () => {
    const error = { response: { status: 429 } };
    const result = classifyLLMError(error);
    expect(result.type).toBe('transient_error');
    expect(result.retryable).toBe(true);
  });

  test('Classifies error message with (429) pattern as transient_error', () => {
    const error = new Error('Server responded (429): too many requests');
    const result = classifyLLMError(error);
    expect(result.type).toBe('transient_error');
  });

  // =========================================================================
  // 4. Provider overloaded / transient errors (status 503)
  // =========================================================================

  test('Classifies Response with status 503 as transient_error', () => {
    const error = { status: 503 };
    const result = classifyLLMError(error);
    expect(result.type).toBe('transient_error');
    expect(result.retryable).toBe(true);
    expect(result.status).toBe(503);
    expect(result.userMessage).toContain('503');
  });

  test('Classifies error with response.status 503 as transient_error', () => {
    const error = { response: { status: 503 } };
    const result = classifyLLMError(error);
    expect(result.type).toBe('transient_error');
    expect(result.retryable).toBe(true);
  });

  test('Classifies error message with "overloaded" as transient_error', () => {
    const error = new Error('Model is overloaded, try again later');
    const result = classifyLLMError(error);
    expect(result.type).toBe('transient_error');
    expect(result.retryable).toBe(true);
  });

  test('Classifies error message with "high demand" as transient_error', () => {
    const error = new Error('Model is experiencing high demand');
    const result = classifyLLMError(error);
    expect(result.type).toBe('transient_error');
  });

  // =========================================================================
  // 5. Bad gateway / transient errors (status 502)
  // =========================================================================

  test('Classifies Response with status 502 as transient_error', () => {
    const error = { status: 502 };
    const result = classifyLLMError(error);
    expect(result.type).toBe('transient_error');
    expect(result.retryable).toBe(true);
    expect(result.status).toBe(502);
    expect(result.userMessage).toContain('502');
  });

  test('Classifies error with response.status 502 as transient_error', () => {
    const error = { response: { status: 502 } };
    const result = classifyLLMError(error);
    expect(result.type).toBe('transient_error');
    expect(result.retryable).toBe(true);
  });

  test('Classifies error message with "bad gateway" as transient_error', () => {
    const error = new Error('bad gateway error');
    const result = classifyLLMError(error);
    expect(result.type).toBe('transient_error');
  });

  // =========================================================================
  // 6. Provider errors (status 500)
  // =========================================================================

  test('Classifies Response with status 500 as provider error', () => {
    const error = { status: 500 };
    const result = classifyLLMError(error);
    expect(result.type).toBe('provider');
    expect(result.retryable).toBe(true);
    expect(result.status).toBe(500);
    expect(result.userMessage).toContain('провайдера');
  });

  test('Classifies error with response.status 500 as provider error', () => {
    const error = { response: { status: 500 } };
    const result = classifyLLMError(error);
    expect(result.type).toBe('provider');
    expect(result.retryable).toBe(true);
  });

  // =========================================================================
  // 7. CORS / proxy errors
  // =========================================================================

  test('Classifies error with "CORS" in message as fatal_cors_error', () => {
    const error = new Error('CORS policy blocked the request');
    const result = classifyLLMError(error);
    expect(result.type).toBe('fatal_cors_error');
    expect(result.retryable).toBe(false);
    expect(result.userMessage).toContain('CORS');
  });

  test('Classifies error with "cors" (lowercase) in message as fatal_cors_error', () => {
    const error = new Error('cors error from proxy');
    const result = classifyLLMError(error);
    expect(result.type).toBe('fatal_cors_error');
  });

  test('Classifies error with "proxy" in message as default provider (not fatal_cors)', () => {
    // BUGFIX: "proxy" alone should NOT be classified as fatal_cors_error.
    // Many error messages contain "proxy" (e.g. timeout from proxy, 502 from proxy)
    // and should fall through to the default classification.
    // Only "CORS" in message triggers fatal_cors_error.
    const error = new Error('proxy connection refused');
    const result = classifyLLMError(error);
    expect(result.type).toBe('provider'); // falls through to default
    expect(result.retryable).toBe(false);
  });

  test('Classifies error with "proxy_error" in message as transient_error (proxy internal error)', () => {
    const error = new Error('proxy_error: internal worker failure');
    const result = classifyLLMError(error);
    expect(result.type).toBe('transient_error');
    expect(result.retryable).toBe(true);
  });

  test('Classifies error with "Внутренняя ошибка прокси" as transient_error', () => {
    const error = new Error('Внутренняя ошибка прокси');
    const result = classifyLLMError(error);
    expect(result.type).toBe('transient_error');
    expect(result.retryable).toBe(true);
  });

  // =========================================================================
  // 8. Timeout errors (transient)
  // =========================================================================

  test('Classifies error with "timeout" in message as transient_error', () => {
    const error = new Error('Request timeout after 30s');
    const result = classifyLLMError(error);
    expect(result.type).toBe('transient_error');
    expect(result.retryable).toBe(true);
    expect(result.userMessage).toContain('время ожидания');
  });

  test('Classifies error with "Timeout" (capitalized) as transient_error', () => {
    const error = new Error('TimeoutError: connection timed out');
    const result = classifyLLMError(error);
    expect(result.type).toBe('transient_error');
  });

  // =========================================================================
  // 9. Parse errors
  // =========================================================================

  test('Classifies error with "parse" in message as parse_error', () => {
    const error = new Error('Failed to parse response body');
    const result = classifyLLMError(error);
    expect(result.type).toBe('parse_error');
    expect(result.retryable).toBe(true);
    expect(result.userMessage).toContain('распарсить');
  });

  test('Classifies error with "Parse" (capitalized) as parse_error', () => {
    const error = new Error('Parse error: unexpected token');
    const result = classifyLLMError(error);
    expect(result.type).toBe('parse_error');
  });

  test('Classifies error with "пустой ответ" as parse_error', () => {
    const error = new Error('пустой ответ от сервера');
    const result = classifyLLMError(error);
    expect(result.type).toBe('parse_error');
    expect(result.retryable).toBe(true);
  });

  // =========================================================================
  // 10. Truncated response errors
  // =========================================================================

  test('Classifies error with "truncated" in message as truncated error', () => {
    const error = new Error('Response was truncated due to token limit');
    const result = classifyLLMError(error);
    expect(result.type).toBe('truncated');
    expect(result.retryable).toBe(true);
    expect(result.userMessage).toContain('обрезан');
  });

  test('Classifies error with "finish_reason" in message as truncated error', () => {
    const error = new Error('finish_reason was length, response incomplete');
    const result = classifyLLMError(error);
    expect(result.type).toBe('truncated');
  });

  // =========================================================================
  // 11. Default — unclassified errors
  // =========================================================================

  test('Classifies unknown error as provider (default)', () => {
    const error = new Error('Something unexpected happened');
    const result = classifyLLMError(error);
    expect(result.type).toBe('provider');
    expect(result.retryable).toBe(false);
    expect(result.userMessage).toContain('Неожиданная ошибка');
  });

  test('Classifies string error as provider (default)', () => {
    const result = classifyLLMError('random error string');
    expect(result.type).toBe('provider');
    expect(result.retryable).toBe(false);
  });

  test('Classifies number error as provider (default)', () => {
    const result = classifyLLMError(42);
    expect(result.type).toBe('provider');
  });

  test('Classifies null error as provider (default)', () => {
    const result = classifyLLMError(null);
    expect(result.type).toBe('provider');
  });

  test('Classifies undefined error as provider (default)', () => {
    const result = classifyLLMError(undefined);
    expect(result.type).toBe('provider');
  });

  // =========================================================================
  // Classification priority — first match wins
  // =========================================================================

  test('401 takes priority over "json" in message', () => {
    // An error with status 401 AND "json" in the message should classify as auth
    const error = { status: 401, message: 'json parse failed with auth error' };
    const result = classifyLLMError(error);
    expect(result.type).toBe('fatal_auth_error');
  });

  test('429 takes priority over "timeout" in message', () => {
    const error = { status: 429, message: 'timeout waiting for response' };
    const result = classifyLLMError(error);
    expect(result.type).toBe('transient_error');
  });

  test('500 takes priority over "cors" in message', () => {
    const error = { status: 500, message: 'cors proxy error' };
    const result = classifyLLMError(error);
    expect(result.type).toBe('provider');
    expect(result.status).toBe(500);
  });

  // =========================================================================
  // userMessage language contract — all messages in Russian
  // =========================================================================

  test('All error types produce Russian userMessage', () => {
    const testCases: Array<{ error: unknown; expectedType: AuditErrorType }> = [
      { error: new TypeError('Failed to fetch'), expectedType: 'network' },
      { error: { status: 401 }, expectedType: 'fatal_auth_error' },
      { error: { status: 403 }, expectedType: 'fatal_auth_error' },
      { error: { status: 429 }, expectedType: 'transient_error' },
      { error: { status: 503 }, expectedType: 'transient_error' },
      { error: { status: 502 }, expectedType: 'transient_error' },
      { error: { status: 500 }, expectedType: 'provider' },
      { error: new Error('CORS error'), expectedType: 'fatal_cors_error' },
      { error: new Error('timeout exceeded'), expectedType: 'transient_error' },
      { error: new Error('JSON parse error'), expectedType: 'parse_error' },
      { error: new Error('truncated response'), expectedType: 'truncated' },
      { error: new Error('unknown issue'), expectedType: 'provider' },
    ];

    for (const { error, expectedType } of testCases) {
      const result = classifyLLMError(error);
      expect(result.type).toBe(expectedType);
      // Verify the message contains at least some Cyrillic characters
      const hasCyrillic = /[а-яА-ЯёЁ]/.test(result.userMessage);
      expect(hasCyrillic).toBe(true);
    }
  });

  // =========================================================================
  // AuditError interface completeness
  // =========================================================================

  test('Every result has required AuditError fields', () => {
    const errors = [
      new TypeError('Failed to fetch'),
      { status: 401 },
      { status: 403 },
      { status: 429 },
      { status: 503 },
      { status: 502 },
      { status: 500 },
      new Error('CORS error'),
      new Error('timeout'),
      new Error('JSON error'),
      new Error('truncated'),
      'string error',
      null,
      undefined,
      42,
    ];

    for (const error of errors) {
      const result = classifyLLMError(error);
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('userMessage');
      expect(result).toHaveProperty('retryable');
      expect(typeof result.type).toBe('string');
      expect(typeof result.userMessage).toBe('string');
      expect(typeof result.retryable).toBe('boolean');
    }
  });

  test('retryable is true only for expected error types', () => {
    const retryableTypes: AuditErrorType[] = ['network', 'transient_error', 'parse_error', 'truncated'];
    const nonRetryableTypes: AuditErrorType[] = ['fatal_auth_error', 'fatal_cors_error'];

    // Verify retryable types
    for (const type of retryableTypes) {
      const error = createErrorForType(type);
      const result = classifyLLMError(error);
      expect(result.type).toBe(type);
      expect(result.retryable).toBe(true);
    }

    // Verify non-retryable types
    for (const type of nonRetryableTypes) {
      const error = createErrorForType(type);
      const result = classifyLLMError(error);
      expect(result.type).toBe(type);
      expect(result.retryable).toBe(false);
    }
  });
});

// Helper to create an error that maps to a specific AuditErrorType
function createErrorForType(type: AuditErrorType): unknown {
  switch (type) {
    case 'network':
      return new TypeError('Failed to fetch');
    case 'transient_error':
      return { status: 429 };
    case 'fatal_auth_error':
      return { status: 401 };
    case 'fatal_cors_error':
      return new Error('CORS policy blocked');
    case 'provider':
      return { status: 500 };
    case 'parse_error':
      return new Error('JSON parse error');
    case 'truncated':
      return new Error('truncated response');
    default:
      return new Error('unknown error');
  }
}

// Export for type checking
export {};
