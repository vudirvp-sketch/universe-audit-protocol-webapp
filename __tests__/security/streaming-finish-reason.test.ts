/**
 * Streaming finish-reason contract.
 *
 * Gemini reports truncation as MAX_TOKENS and Anthropic as max_tokens; the app
 * downstream expects the OpenAI vocabulary ('length'), otherwise a truncated
 * answer looks like a normal stop.
 */
import { describe, expect, it } from 'vitest';
import { extractDelta, normalizeStreamingFinishReason } from '@/lib/streaming';

describe('normalizeStreamingFinishReason', () => {
  it.each([
    ['google', 'MAX_TOKENS', 'length'],
    ['google', 'STOP', 'stop'],
    ['google', 'SAFETY', 'content_filter'],
    ['google', 'RECITATION', 'content_filter'],
    ['anthropic', 'max_tokens', 'length'],
    ['anthropic', 'end_turn', 'stop'],
    ['anthropic', 'stop_sequence', 'stop'],
    ['openai', 'length', 'length'],
    ['openai', 'stop', 'stop'],
  ] as const)('%s/%s → %s', (provider, raw, expected) => {
    expect(normalizeStreamingFinishReason(provider, raw)).toBe(expected);
  });

  it('returns undefined when the provider sent no finish reason', () => {
    expect(normalizeStreamingFinishReason('google', undefined)).toBeUndefined();
  });
});

describe('extractDelta finish reasons', () => {
  it('maps a Gemini MAX_TOKENS stream event to length', () => {
    const event = JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'partial' }] }, finishReason: 'MAX_TOKENS' }],
    });
    expect(extractDelta('google', event)).toEqual({ text: 'partial', finishReason: 'length' });
  });

  it('maps an Anthropic message_delta max_tokens stop reason to length', () => {
    const event = JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'max_tokens' } });
    expect(extractDelta('anthropic', event)).toEqual({ text: '', finishReason: 'length' });
  });

  it('passes an OpenAI-compatible length through unchanged', () => {
    const event = JSON.stringify({ choices: [{ delta: { content: 'x' }, finish_reason: 'length' }] });
    expect(extractDelta('openai', event)).toEqual({ text: 'x', finishReason: 'length' });
  });
});
