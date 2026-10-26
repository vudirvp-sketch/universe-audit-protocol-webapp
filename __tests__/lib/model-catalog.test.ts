/**
 * Live model catalog contract.
 *
 * The settings screen must show what the provider actually serves today, not a
 * hardcoded list, so these tests pin three things:
 *   - the browser asks the provider's own list endpoint with provider-native
 *     auth (and the relay envelope when the transport is the local relay);
 *   - provider JSON shapes are parsed into sane ids, with non-chat entries and
 *     OpenRouter's batch/free/alias variants dropped;
 *   - every failure degrades to a cached or bundled list instead of an empty UI.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearModelCache,
  fetchModelIds,
  loadModelCatalog,
  MODEL_CACHE_TTL_MS,
  ModelListError,
  parseAnthropicModels,
  parseGeminiModels,
  parseOpenAICompatibleModels,
  parseOpenRouterModels,
  readCachedModels,
  writeCachedModels,
} from '@/lib/model-catalog';
import { LLM_PROVIDERS, PREFERRED_MODELS, RELAY_URL_DEFAULT } from '@/lib/llm-client';

interface CapturedCall {
  url: string;
  init: RequestInit;
}

function stubJson(payload: unknown, status = 200): CapturedCall[] {
  const calls: CapturedCall[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }));
  return calls;
}

function installLocalStorage(): Map<string, string> {
  const store = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
    },
  });
  return store;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ── parsers ─────────────────────────────────────────────────────────────

describe('provider list parsers', () => {
  it('keeps chat models from an OpenAI-compatible list and drops non-chat endpoints', () => {
    const payload = {
      data: [
        { id: 'gpt-6.1-sol' },
        { id: 'text-embedding-3-large' },
        { id: 'whisper-1' },
        { id: 'dall-e-3' },
        { id: 'gpt-6-luna' },
      ],
    };
    expect(parseOpenAICompatibleModels(payload)).toEqual(['gpt-6.1-sol', 'gpt-6-luna']);
  });

  it('strips the models/ prefix from Gemini ids and keeps only generateContent models', () => {
    const payload = {
      models: [
        { name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
        { name: 'models/gemini-embedding-001' },
      ],
    };
    expect(parseGeminiModels(payload)).toEqual(['gemini-3.8-flash']);
  });

  it('reads Anthropic data[].id', () => {
    expect(parseAnthropicModels({
      data: [{ id: 'claude-sonnet-5.5' }, { id: 'claude-opus-5.5' }],
    })).toEqual(['claude-sonnet-5.5', 'claude-opus-5.5']);
  });

  it('drops OpenRouter batch/free/alias variants that an audit cannot use', () => {
    const payload = {
      data: [
        { id: 'anthropic/claude-sonnet-5.5' },
        { id: 'anthropic/claude-sonnet-5.5:batch' },
        { id: 'meta-llama/llama-4-maverick:free' },
        { id: '~openai/gpt-latest' },
        { id: 'google/gemini-3.8-flash' },
      ],
    };
    expect(parseOpenRouterModels(payload)).toEqual([
      'anthropic/claude-sonnet-5.5',
      'google/gemini-3.8-flash',
    ]);
  });

  it.each([
    ['empty object', {}],
    ['null', null],
    ['string', 'nope'],
    ['wrong key', { items: [{ id: 'x' }] }],
  ])('returns [] for a malformed payload (%s)', (_label, payload) => {
    expect(parseOpenAICompatibleModels(payload)).toEqual([]);
  });
});

// ── transport ───────────────────────────────────────────────────────────

describe('fetchModelIds — direct transport', () => {
  it('calls the provider list endpoint with the key in a header, never in the URL', async () => {
    const calls = stubJson({ models: [{ name: 'models/gemini-3.8-flash' }] });
    const ids = await fetchModelIds({ provider: 'google', apiKey: 'AIza-secret' });

    expect(ids).toEqual(['gemini-3.8-flash']);
    expect(calls[0].url).toContain('generativelanguage.googleapis.com/v1beta/models');
    expect(calls[0].url).not.toContain('AIza-secret');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['x-goog-api-key']).toBe('AIza-secret');
    expect(calls[0].init.method).toBe('GET');
  });

  it('sends the Anthropic browser-access headers on the list call too', async () => {
    const calls = stubJson({ data: [{ id: 'claude-sonnet-5.5' }] });
    await fetchModelIds({ provider: 'anthropic', apiKey: 'sk-ant-test' });

    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-ant-test');
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(headers['anthropic-version']).toBe('2023-06-01');
  });

  it('allows the public OpenRouter catalog without a key', async () => {
    const calls = stubJson({ data: [{ id: 'anthropic/claude-sonnet-5.5' }] });
    const ids = await fetchModelIds({ provider: 'openrouter' });

    expect(ids).toEqual(['anthropic/claude-sonnet-5.5']);
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('refuses to call a key-protected provider without a key, before any request', async () => {
    const calls = stubJson({ data: [] });
    await expect(fetchModelIds({ provider: 'openai' }))
      .rejects.toBeInstanceOf(ModelListError);
    expect(calls).toHaveLength(0);
  });

  it('deduplicates ids while preserving provider order', async () => {
    stubJson({ data: [{ id: 'a' }, { id: 'b' }, { id: 'a' }] });
    await expect(fetchModelIds({ provider: 'openai', apiKey: 'sk-test' }))
      .resolves.toEqual(['a', 'b']);
  });
});

describe('fetchModelIds — relay transport', () => {
  it('posts the provider-pinned envelope to /api/models and no provider auth header', async () => {
    const calls = stubJson({ data: [{ id: 'gpt-6.1-sol' }] });
    await fetchModelIds({
      provider: 'openai',
      apiKey: 'sk-test',
      transport: 'relay',
      relayUrl: 'http://127.0.0.1:8787/',
    });

    expect(calls[0].url).toBe(`${RELAY_URL_DEFAULT}/api/models`);
    const envelope = JSON.parse(String(calls[0].init.body)) as Record<string, unknown>;
    expect(envelope.provider).toBe('openai');
    expect(envelope.apiKey).toBe('sk-test');
    expect(envelope.targetUrl).toBe('https://api.openai.com/v1/models');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('rejects a non-loopback relay URL instead of posting the key to it', async () => {
    const calls = stubJson({ data: [] });
    await expect(fetchModelIds({
      provider: 'openai',
      apiKey: 'sk-test',
      transport: 'relay',
      relayUrl: 'http://relay.example.com',
    })).rejects.toThrow(/релея/i);
    expect(calls).toHaveLength(0);
  });
});

describe('fetchModelIds — failures are actionable', () => {
  it.each([
    [401, /Ключ отклонён/],
    [403, /Ключ отклонён/],
    [429, /Слишком много запросов/],
    [404, /список моделей/i],
    [500, /вернул 500/],
  ])('HTTP %i → %s', async (status, pattern) => {
    stubJson({ error: 'nope' }, status);
    await expect(fetchModelIds({ provider: 'openai', apiKey: 'sk-test' }))
      .rejects.toThrow(pattern);
  });

  it('maps a network TypeError to the CORS/relay hint', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(fetchModelIds({ provider: 'openai', apiKey: 'sk-test' }))
      .rejects.toThrow(/CORS|релей/i);
  });

  it('rejects an empty catalog instead of pretending it loaded', async () => {
    stubJson({ data: [] });
    await expect(fetchModelIds({ provider: 'openai', apiKey: 'sk-test' }))
      .rejects.toThrow(/пуст/i);
  });
});

// ── cache ───────────────────────────────────────────────────────────────

describe('catalog cache', () => {
  beforeEach(() => { installLocalStorage(); });

  it('stores ids with a timestamp and reads them back', () => {
    writeCachedModels('openai', ['gpt-6.1-sol'], 1_000);
    expect(readCachedModels('openai', MODEL_CACHE_TTL_MS, 2_000))
      .toEqual({ ids: ['gpt-6.1-sol'], fetchedAt: 1_000 });
  });

  it('expires entries older than the TTL', () => {
    writeCachedModels('openai', ['gpt-6.1-sol'], 1_000);
    expect(readCachedModels('openai', MODEL_CACHE_TTL_MS, 1_000 + MODEL_CACHE_TTL_MS + 1)).toBeNull();
  });

  it('never returns another provider’s list', () => {
    writeCachedModels('openai', ['gpt-6.1-sol'], 1_000);
    expect(readCachedModels('google', MODEL_CACHE_TTL_MS, 1_100)).toBeNull();
  });

  it('survives malformed cache content', () => {
    const store = installLocalStorage();
    store.set('universe-audit-model-catalog-v1', '{not json');
    expect(readCachedModels('openai')).toBeNull();
  });

  it('clearModelCache removes every entry', () => {
    writeCachedModels('openai', ['gpt-6.1-sol'], 1_000);
    clearModelCache();
    expect(readCachedModels('openai', MODEL_CACHE_TTL_MS, 1_100)).toBeNull();
  });
});

// ── orchestration ───────────────────────────────────────────────────────

describe('loadModelCatalog', () => {
  beforeEach(() => { installLocalStorage(); });

  it('returns the live list and caches it', async () => {
    stubJson({ data: [{ id: 'gpt-6.1-sol' }] });
    const result = await loadModelCatalog({ provider: 'openai', apiKey: 'sk-test' });

    expect(result.source).toBe('api');
    expect(result.ids).toEqual(['gpt-6.1-sol']);
    expect(result.error).toBeUndefined();
    expect(readCachedModels('openai')?.ids).toEqual(['gpt-6.1-sol']);
  });

  it('answers from a fresh cache without a network call when preferCache is set', async () => {
    writeCachedModels('openai', ['cached-model']);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await loadModelCatalog({ provider: 'openai', apiKey: 'sk-test', preferCache: true });
    expect(result).toMatchObject({ source: 'cache', ids: ['cached-model'] });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('falls back to a stale cache and reports why the refresh failed', async () => {
    writeCachedModels('openai', ['cached-model'], 1);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })));

    const result = await loadModelCatalog({ provider: 'openai', apiKey: 'sk-test' });
    expect(result.source).toBe('cache');
    expect(result.ids).toEqual(['cached-model']);
    expect(result.error).toMatch(/500/);
  });

  it('falls back to the bundled list when nothing was ever cached', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })));

    const result = await loadModelCatalog({ provider: 'openai', apiKey: 'sk-test' });
    expect(result.source).toBe('fallback');
    expect(result.ids).toEqual(PREFERRED_MODELS.openai);
    expect(result.error).toBeTruthy();
  });
});

// ── shipped catalog consistency ─────────────────────────────────────────

describe('bundled fallback catalogs', () => {
  it('every provider default model exists in its own fallback list', () => {
    const checked: string[] = [];
    for (const [provider, config] of Object.entries(LLM_PROVIDERS)) {
      if (provider === 'custom') continue;
      const list = PREFERRED_MODELS[provider as keyof typeof PREFERRED_MODELS];
      expect(list, `${provider} has no fallback list`).toBeDefined();
      expect(list, `${provider} default ${config.defaultModel} missing from fallback`).toContain(config.defaultModel);
      checked.push(provider);
    }
    expect(checked.length).toBeGreaterThan(10);
  });

  it('no fallback catalog carries a batch/free variant id', () => {
    for (const ids of Object.values(PREFERRED_MODELS)) {
      for (const id of ids) {
        expect(id).not.toMatch(/:batch|:free/);
      }
    }
  });
});
