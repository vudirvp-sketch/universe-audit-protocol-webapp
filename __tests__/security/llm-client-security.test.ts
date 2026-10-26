/**
 * Client-side API-connection contract: how the browser talks to providers
 * directly or through the local relay, and how user-controlled model/base URLs
 * are constrained.
 */
import { describe, expect, it } from 'vitest';
import {
  getProviderUrl,
  normalizeCustomBaseUrl,
  validateApiKey,
  validateRelayUrl,
  buildProviderAuthHeaders,
  PROVIDER_BROWSER_CORS,
  RELAY_URL_DEFAULT,
} from '@/lib/llm-client';

describe('validateRelayUrl', () => {
  it.each([
    [RELAY_URL_DEFAULT, true],
    ['http://127.0.0.1:8787', true],
    ['http://localhost:8787', true],
    ['http://example.com:8787', false],
    ['https://relay.example.com', true],
    ['ftp://relay.example.com', false],
    ['https://user:pass@relay.example.com', false],
    ['https://relay.example.com/?x=1', false],
    ['', false],
    ['   ', false],
    ['not a url', false],
  ])('%s → valid=%s', (raw, valid) => {
    expect(validateRelayUrl(raw).valid).toBe(valid);
  });

  it('never accepts a plain-http relay outside loopback (the key is posted there)', () => {
    expect(validateRelayUrl('http://example.com').valid).toBe(false);
  });

  it('normalizes a trailing slash away so /api/health checks stay correct', () => {
    expect(validateRelayUrl('http://127.0.0.1:8787/').normalized).toBe('http://127.0.0.1:8787');
  });
});

describe('buildProviderAuthHeaders — direct browser transport', () => {
  it('uses x-api-key + browser-access flag for Anthropic (required for browser calls)', () => {
    const headers = buildProviderAuthHeaders('anthropic', 'sk-ant-test');
    expect(headers['x-api-key']).toBe('sk-ant-test');
    expect(headers['anthropic-version']).toBeTruthy();
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(headers['Authorization']).toBeUndefined();
  });

  it('sends the Gemini key in a header, never in the URL', () => {
    const headers = buildProviderAuthHeaders('google', 'AIza-test');
    expect(headers['x-goog-api-key']).toBe('AIza-test');
    expect(getProviderUrl('google', 'gemini-2.5-flash')).not.toContain('AIza-test');
    expect(getProviderUrl('google', 'gemini-2.5-flash')).not.toContain('key=');
  });

  it('uses Bearer for OpenAI-compatible providers and custom endpoints', () => {
    expect(buildProviderAuthHeaders('openai', 'sk-test')['Authorization']).toBe('Bearer sk-test');
    expect(buildProviderAuthHeaders('openrouter', 'sk-or')['Authorization']).toBe('Bearer sk-or');
    expect(buildProviderAuthHeaders('custom', 'sk-x')['Authorization']).toBe('Bearer sk-x');
  });
});

describe('browser CORS support table', () => {
  it('marks the providers the app supports directly in the browser', () => {
    expect(PROVIDER_BROWSER_CORS.google).toBe('yes');
    expect(PROVIDER_BROWSER_CORS.anthropic).toBe('yes');
    expect(PROVIDER_BROWSER_CORS.openrouter).toBe('yes');
    expect(PROVIDER_BROWSER_CORS.deepseek).toBe('yes');
  });

  it('marks CORS-blocked / unverified providers so the UI can suggest the relay', () => {
    expect(PROVIDER_BROWSER_CORS.openai).toBe('no');
    expect(PROVIDER_BROWSER_CORS.groq).toBe('unknown');
    expect(PROVIDER_BROWSER_CORS.mistral).toBe('unknown');
  });
});

describe('normalizeCustomBaseUrl', () => {
  it('accepts an https base and strips trailing slashes', () => {
    const result = normalizeCustomBaseUrl('https://api.example.com/v1///');
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe('https://api.example.com/v1');
  });

  it.each([
    ['http://api.example.com/v1', false],
    ['https://api.example.com/v1?key=leak', false],
    ['https://api.example.com/v1#frag', false],
    ['https://api.example.com/v1', true],
    ['', false],
  ])('%s → valid=%s', (raw, valid) => {
    expect(normalizeCustomBaseUrl(raw).valid).toBe(valid);
  });
});

describe('getProviderUrl', () => {
  it('encodes the model name instead of interpolating it raw', () => {
    const url = getProviderUrl('google', 'gemini/../../v1/files?x=1');
    expect(url).toContain('https://generativelanguage.googleapis.com/');
    // The slash/query must be percent-encoded, not treated as path structure.
    expect(url).not.toContain('/models/gemini/../../v1/files');
    expect(url).not.toContain('?x=1');
  });

  it('keeps normal model names intact', () => {
    expect(getProviderUrl('google', 'gemini-2.5-flash'))
      .toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
    // Hugging Face ids legitimately contain one slash — it must stay a path separator.
    expect(getProviderUrl('huggingface', 'meta-llama/Llama-3.2-3B-Instruct'))
      .toBe('https://api-inference.huggingface.co/models/meta-llama/Llama-3.2-3B-Instruct');
  });

  it('neutralizes traversal segments in a Hugging Face model id', () => {
    const url = getProviderUrl('huggingface', '../../datasets/other');
    expect(url).toBe('https://api-inference.huggingface.co/models/_/_/datasets/other');
    expect(url).not.toContain('/../');
  });

  it('returns an empty URL for the custom provider (base URL required)', () => {
    expect(getProviderUrl('custom', 'gpt-4o')).toBe('');
  });
});

describe('validateApiKey', () => {
  it('rejects empty and too-short keys', () => {
    expect(validateApiKey('google', '').valid).toBe(false);
    expect(validateApiKey('google', 'short').valid).toBe(false);
  });

  it('accepts a plausible key and warns about a mismatched prefix without blocking', () => {
    const correct = validateApiKey('openai', 'sk-proj-1234567890123456');
    expect(correct.valid).toBe(true);
    expect(correct.error).toBeUndefined();

    const mismatched = validateApiKey('openai', 'gsk_1234567890123456');
    expect(mismatched.valid).toBe(true);
    expect(mismatched.error).toMatch(/sk-/);
  });
});
