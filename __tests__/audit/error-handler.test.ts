/**
 * Error Handler Tests
 *
 * Tests for classifyLLMError() — LLM error classification.
 * Covers: all 8 AuditErrorType categories, retryable flags,
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
  // 2. Authentication errors (status 401)
  // =========================================================================

  test('Classifies Response with status 401 as auth error', () => {
    const error = { status: 401 };
    const result = classifyLLMError(error);
    expect(result.type).toBe('auth');
    expect(result.retryable).toBe(false);
    expect(result.status).toBe(401);
    expect(result.userMessage).toContain('API-ключ');
  });

  test('Classifies error with response.status 401 as auth error', () => {
    const error = { response: { status: 401 } };
    const result = classifyLLMError(error);
    expect(result.type).toBe('auth');
    expect(result.retryable).toBe(false);
  });

  test('Classifies error message with (401) pattern as auth error', () => {
    const error = new Error('proxy error (401): unauthorized');
    const result = classifyLLMError(error);
    expect(result.type).toBe('auth');
    expect(result.retryable).toBe(false);
  });

  test('Classifies error message with 401: pattern as auth error', () => {
    const error = new Error('HTTP 401: Unauthorized');
    const result = classifyLLMError(error);
    expect(result.type).toBe('auth');
  });

  // =========================================================================
  // 3. Rate limit errors (status 429)
  // =========================================================================

  test('Classifies Response with status 429 as rate_limit error', () => {
    const error = { status: 429 };
    const result = classifyLLMError(error);
    expect(result.type).toBe('rate_limit');
    expect(result.retryable).toBe(true);
    expect(result.status).toBe(429);
    expect(result.userMessage).toContain('лимит');
  });

  test('Classifies error with response.status 429 as rate_limit error', () => {
    const error = { response: { status: 429 } };
    const result = classifyLLMError(error);
    expect(result.type).toBe('rate_limit');
    expect(result.retryable).toBe(true);
  });

  test('Classifies error message with (429) pattern as rate_limit error', () => {
    const error = new Error('Server responded (429): too many requests');
    const result = classifyLLMError(error);
    expect(result.type).toBe('rate_limit');
  });

  // =========================================================================
  // 4. Provider errors (status 500)
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
  // 5. CORS / proxy errors
  // =========================================================================

  test('Classifies error with "CORS" in message as cors error', () => {
    const error = new Error('CORS policy blocked the request');
    const result = classifyLLMError(error);
    expect(result.type).toBe('cors');
    expect(result.retryable).toBe(false);
    expect(result.userMessage).toContain('CORS-прокси');
  });

  test('Classifies error with "cors" (lowercase) in message as cors error', () => {
    const error = new Error('cors error from proxy');
    const result = classifyLLMError(error);
    expect(result.type).toBe('cors');
  });

  test('Classifies error with "proxy" in message as cors error', () => {
    const error = new Error('proxy connection refused');
    const result = classifyLLMError(error);
    expect(result.type).toBe('cors');
    expect(result.retryable).toBe(false);
  });

  // =========================================================================
  // 6. Timeout errors
  // =========================================================================

  test('Classifies error with "timeout" in message as timeout error', () => {
    const error = new Error('Request timeout after 30s');
    const result = classifyLLMError(error);
    expect(result.type).toBe('timeout');
    expect(result.retryable).toBe(true);
    expect(result.userMessage).toContain('время ожидания');
  });

  test('Classifies error with "Timeout" (capitalized) as timeout error', () => {
    const error = new Error('TimeoutError: connection timed out');
    const result = classifyLLMError(error);
    expect(result.type).toBe('timeout');
  });

  // =========================================================================
  // 7. Invalid JSON errors
  // =========================================================================

  test('Classifies error with "JSON" in message as invalid_json error', () => {
    const error = new Error('Unexpected token in JSON at position 5');
    const result = classifyLLMError(error);
    expect(result.type).toBe('invalid_json');
    expect(result.retryable).toBe(true);
    expect(result.userMessage).toContain('невалидный JSON');
  });

  test('Classifies error with "parse" in message as invalid_json error', () => {
    const error = new Error('Failed to parse response body');
    const result = classifyLLMError(error);
    expect(result.type).toBe('invalid_json');
  });

  test('Classifies error with "Parse" (capitalized) as invalid_json error', () => {
    const error = new Error('Parse error: unexpected token');
    const result = classifyLLMError(error);
    expect(result.type).toBe('invalid_json');
  });

  // =========================================================================
  // 8. Truncated response errors
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
  // 9. Default — unclassified errors
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
    expect(result.type).toBe('auth');
  });

  test('429 takes priority over "timeout" in message', () => {
    const error = { status: 429, message: 'timeout waiting for response' };
    const result = classifyLLMError(error);
    expect(result.type).toBe('rate_limit');
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
      { error: { status: 401 }, expectedType: 'auth' },
      { error: { status: 429 }, expectedType: 'rate_limit' },
      { error: { status: 500 }, expectedType: 'provider' },
      { error: new Error('CORS error'), expectedType: 'cors' },
      { error: new Error('timeout exceeded'), expectedType: 'timeout' },
      { error: new Error('JSON parse error'), expectedType: 'invalid_json' },
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
      { status: 429 },
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
    const retryableTypes: AuditErrorType[] = ['network', 'rate_limit', 'timeout', 'invalid_json', 'truncated'];
    const nonRetryableTypes: AuditErrorType[] = ['auth', 'cors'];

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
    case 'auth':
      return { status: 401 };
    case 'rate_limit':
      return { status: 429 };
    case 'provider':
      return { status: 500 };
    case 'cors':
      return new Error('CORS policy blocked');
    case 'timeout':
      return new Error('timeout exceeded');
    case 'invalid_json':
      return new Error('JSON parse error');
    case 'truncated':
      return new Error('truncated response');
    default:
      return new Error('unknown error');
  }
}

// Export for type checking
export {};
