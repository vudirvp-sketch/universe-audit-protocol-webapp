/**
 * Transport contract: exactly what leaves the browser.
 *
 * Direct mode must call the provider itself with provider-native auth headers
 * and the provider-native body (no envelope, no third party). Relay mode must
 * post the envelope to the local relay only. These assertions are the
 * difference between "no backend" and "key goes through a stranger".
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLLMClient, RELAY_URL_DEFAULT } from '@/lib/llm-client';

interface CapturedCall {
  url: string;
  init: RequestInit;
}

function stubProviderResponse(): CapturedCall[] {
  const calls: CapturedCall[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({
      id: 'x', object: 'chat.completion', created: 0, model: 'test',
      choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
  return calls;
}

const MESSAGES = [{ role: 'user' as const, content: 'привет' }];

describe('direct transport', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('calls the provider URL with provider auth and the native body (no envelope)', async () => {
    const calls = stubProviderResponse();
    const client = createLLMClient({ provider: 'openai', apiKey: 'sk-test', model: 'gpt-4.1-mini' });
    await client.chatCompletion({ messages: MESSAGES, max_tokens: 10 });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.openai.com/v1/chat/completions');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer sk-test');
    const body = JSON.parse(String(calls[0].init.body)) as Record<string, unknown>;
    // Provider-native body — no {provider, apiKey, targetUrl, payload} envelope.
    expect(body.provider).toBeUndefined();
    expect(body.apiKey).toBeUndefined();
    expect(body.model).toBe('gpt-4.1-mini');
    expect(body.messages).toEqual(MESSAGES);
    expect(String(calls[0].init.body)).not.toContain('sk-test');
  });

  it('sends the Anthropic browser-access header', async () => {
    const calls = stubProviderResponse();
    const client = createLLMClient({ provider: 'anthropic', apiKey: 'sk-ant-test', model: 'claude-sonnet-4-6' });
    await client.chatCompletion({ messages: MESSAGES, max_tokens: 10 });

    expect(calls[0].url).toBe('https://api.anthropic.com/v1/messages');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-ant-test');
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(headers.Authorization).toBeUndefined();
  });

  it('sends the Gemini key in a header and keeps it out of the URL', async () => {
    const calls = stubProviderResponse();
    const client = createLLMClient({ provider: 'google', apiKey: 'AIza-test', model: 'gemini-2.5-flash' });
    await client.chatCompletion({ messages: MESSAGES, max_tokens: 10 });

    expect(calls[0].url).toContain('generativelanguage.googleapis.com');
    expect(calls[0].url).not.toContain('AIza-test');
    expect(calls[0].url).not.toContain('key=');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['x-goog-api-key']).toBe('AIza-test');
  });
});

describe('relay transport', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('posts the envelope to the local relay only', async () => {
    const calls = stubProviderResponse();
    const client = createLLMClient({
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      transport: 'relay',
    });
    await client.chatCompletion({ messages: MESSAGES, max_tokens: 10 });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${RELAY_URL_DEFAULT}/api/llm`);
    const envelope = JSON.parse(String(calls[0].init.body)) as Record<string, unknown>;
    expect(envelope.provider).toBe('openai');
    expect(envelope.apiKey).toBe('sk-test');
    expect(envelope.targetUrl).toBe('https://api.openai.com/v1/chat/completions');
    expect(typeof envelope.payload).toBe('string');
    // No provider auth header leaves the browser in relay mode.
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('supports a custom relay URL', async () => {
    const calls = stubProviderResponse();
    const client = createLLMClient({
      provider: 'openai',
      apiKey: 'sk-test',
      transport: 'relay',
      relayUrl: 'http://127.0.0.1:9000/',
    });
    await client.chatCompletion({ messages: MESSAGES, max_tokens: 10 });
    expect(calls[0].url).toBe('http://127.0.0.1:9000/api/llm');
  });

  it('refuses a malformed relay URL instead of posting the key to it', async () => {
    const calls = stubProviderResponse();
    const client = createLLMClient({
      provider: 'openai',
      apiKey: 'sk-test',
      transport: 'relay',
      relayUrl: 'http://relay.example.com',
    });
    await expect(client.chatCompletion({ messages: MESSAGES, max_tokens: 10 }))
      .rejects.toThrow(/локального релея/i);
    expect(calls).toHaveLength(0);
  });
});

describe('custom provider', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('validates the custom base URL before sending the key', async () => {
    const calls = stubProviderResponse();
    const client = createLLMClient({
      provider: 'custom',
      apiKey: 'sk-test',
      model: 'local-model',
      baseUrl: 'http://example.com/v1',
    });
    await expect(client.chatCompletion({ messages: MESSAGES, max_tokens: 10 }))
      .rejects.toThrow(/Base URL/i);
    expect(calls).toHaveLength(0);
  });

  it('appends /chat/completions to a valid custom base URL', async () => {
    const calls = stubProviderResponse();
    const client = createLLMClient({
      provider: 'custom',
      apiKey: 'sk-test',
      model: 'local-model',
      baseUrl: 'http://127.0.0.1:11434/v1',
    });
    await client.chatCompletion({ messages: MESSAGES, max_tokens: 10 });
    expect(calls[0].url).toBe('http://127.0.0.1:11434/v1/chat/completions');
  });
});
