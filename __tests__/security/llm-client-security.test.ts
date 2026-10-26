/**
 * Client-side API-connection contract: what the browser is willing to send the
 * API key to, and how user-controlled model/base URLs are constrained.
 */
import { describe, expect, it } from 'vitest';
import {
  getProviderUrl,
  normalizeCustomBaseUrl,
  validateApiKey,
  validateProxyUrl,
} from '@/lib/llm-client';

describe('validateProxyUrl', () => {
  it.each([
    ['https://universe-audit-proxy.vudirvp.workers.dev', true],
    ['https://proxy.example.com/cors', true],
    ['http://localhost:8787', true],
    ['http://127.0.0.1:8787', true],
    ['http://proxy.example.com', false],
    ['ftp://proxy.example.com', false],
    ['https://user:pass@proxy.example.com', false],
    ['https://proxy.example.com/?x=1', false],
    ['', false],
    ['   ', false],
    ['not a url', false],
    ['https://proxy.example.com with space', false],
  ])('%s → valid=%s', (raw, valid) => {
    expect(validateProxyUrl(raw).valid).toBe(valid);
  });

  it('never accepts a plain-http proxy outside loopback', () => {
    expect(validateProxyUrl('http://example.com').valid).toBe(false);
  });

  it('normalizes a trailing slash away so /health checks stay correct', () => {
    expect(validateProxyUrl('https://proxy.example.com/').normalized).toBe('https://proxy.example.com');
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
