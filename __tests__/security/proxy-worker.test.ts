/**
 * Security contract for the CORS proxy Worker (worker/cors-proxy.js).
 *
 * Each test restates a claim from the v9 hardening and would fail on the
 * previous version:
 *  - the proxy is not an open relay (only declared provider hosts are reachable)
 *  - browser origins are allowlisted instead of `Access-Control-Allow-Origin: *`
 *  - the body-size limit is enforced on real bytes, not only Content-Length
 *  - the API key never appears in logs or error bodies
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../../worker/cors-proxy.js';

const API_KEY = 'sk-test-SECRET-key-QW77';
const APP_ORIGIN = 'https://universe-audit-protocol.pages.dev';

function makeRequest(body: unknown, init: { origin?: string | null; headers?: Record<string, string> } = {}): Request {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers || {}),
  };
  if (init.origin !== null) {
    headers['Origin'] = init.origin ?? APP_ORIGIN;
  }
  return new Request('https://proxy.example.workers.dev/', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function proxyBody(overrides: Partial<{ provider: string; apiKey: string; targetUrl: string; payload: string }> = {}) {
  return {
    provider: 'openai',
    apiKey: API_KEY,
    targetUrl: 'https://api.openai.com/v1/chat/completions',
    payload: JSON.stringify({ model: 'gpt-4o-mini', messages: [] }),
    ...overrides,
  };
}

/** A fetch stub that returns a valid OpenAI-shaped JSON response. */
function stubUpstream() {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }));
  return calls;
}

describe('cors-proxy: origin allowlist', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('rejects a POST from an unknown browser origin without echoing CORS headers', async () => {
    const response = await worker.fetch(makeRequest(proxyBody(), { origin: 'https://evil.example' }), {});
    expect(response.status).toBe(403);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    const payload = await response.json() as { error?: string };
    expect(payload.error).toBe('origin_not_allowed');
  });

  it('echoes the allowlisted origin instead of *', async () => {
    stubUpstream();
    const response = await worker.fetch(makeRequest(proxyBody()), {});
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(APP_ORIGIN);
    expect(response.headers.get('Access-Control-Allow-Origin')).not.toBe('*');
  });

  it('rejects a preflight from an unknown origin', async () => {
    const request = new Request('https://proxy.example.workers.dev/', {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example' },
    });
    const response = await worker.fetch(request, {});
    expect(response.status).toBe(403);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('allows a Pages preview subdomain of the same project', async () => {
    stubUpstream();
    const response = await worker.fetch(makeRequest(proxyBody(), { origin: 'https://abc123.universe-audit-protocol.pages.dev' }), {});
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://abc123.universe-audit-protocol.pages.dev');
  });

  it('honours a configured origin allowlist over the defaults', async () => {
    stubUpstream();
    const response = await worker.fetch(makeRequest(proxyBody(), { origin: 'https://audit.example.com' }), {
      ALLOWED_ORIGINS: 'https://audit.example.com',
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://audit.example.com');
  });
});

describe('cors-proxy: target host allowlist (no open relay)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('refuses an arbitrary https host declared as a known provider', async () => {
    stubUpstream();
    const response = await worker.fetch(makeRequest(proxyBody({ targetUrl: 'https://attacker.example/collect' })), {});
    expect(response.status).toBe(400);
    const payload = await response.json() as { error?: string };
    expect(payload.error).toBe('invalid_target_url');
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('refuses a mismatched provider/host pair', async () => {
    stubUpstream();
    const response = await worker.fetch(makeRequest(proxyBody({ provider: 'anthropic' })), {});
    expect(response.status).toBe(400);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('refuses non-https targets', async () => {
    stubUpstream();
    const response = await worker.fetch(makeRequest(proxyBody({ targetUrl: 'http://api.openai.com/v1/chat/completions' })), {});
    expect(response.status).toBe(400);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('refuses targets that embed credentials', async () => {
    stubUpstream();
    const response = await worker.fetch(makeRequest(proxyBody({ targetUrl: 'https://user:pass@api.openai.com/v1/chat/completions' })), {});
    expect(response.status).toBe(400);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('disables custom provider hosts unless ALLOWED_CUSTOM_HOSTS names them', async () => {
    stubUpstream();
    const targetUrl = 'https://llm.internal.example/v1/chat/completions';
    const blocked = await worker.fetch(makeRequest(proxyBody({ provider: 'custom', targetUrl })), {});
    expect(blocked.status).toBe(403);

    const allowed = await worker.fetch(makeRequest(proxyBody({ provider: 'custom', targetUrl })), {
      ALLOWED_CUSTOM_HOSTS: 'llm.internal.example',
    });
    expect(allowed.status).toBe(200);
  });

  it('rejects an unknown provider even for an allowlisted host', async () => {
    stubUpstream();
    const response = await worker.fetch(makeRequest(proxyBody({ provider: 'totally-made-up' })), {});
    expect(response.status).toBe(400);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('forwards an allowlisted request to the provider host with the key in the auth header only', async () => {
    const calls = stubUpstream();
    await worker.fetch(makeRequest(proxyBody()), {});
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.openai.com/v1/chat/completions');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe(`Bearer ${API_KEY}`);
    // The key must not be smuggled into the URL.
    expect(calls[0].url).not.toContain(API_KEY);
  });
});

describe('cors-proxy: body size and input validation', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('rejects an oversized body even when Content-Length is absent', async () => {
    stubUpstream();
    const bigPayload = 'x'.repeat(5000);
    const request = new Request('https://proxy.example.workers.dev/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: APP_ORIGIN },
      body: JSON.stringify(proxyBody({ payload: bigPayload })),
    });
    // Strip Content-Length to simulate a lying/absent header.
    const stripped = new Request(request, { headers: { 'Content-Type': 'application/json', Origin: APP_ORIGIN } });
    const response = await worker.fetch(stripped, { MAX_BODY_SIZE_BYTES: '2048' });
    expect(response.status).toBe(413);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON', async () => {
    const request = new Request('https://proxy.example.workers.dev/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: APP_ORIGIN },
      body: '{not json',
    });
    const response = await worker.fetch(request, {});
    expect(response.status).toBe(400);
  });

  it('rejects a missing provider/apiKey/targetUrl/payload', async () => {
    const response = await worker.fetch(makeRequest({ provider: 'openai' }), {});
    expect(response.status).toBe(400);
  });
});

describe('cors-proxy: key never leaks', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not log the key on success, error, or timeout paths', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    stubUpstream();
    await worker.fetch(makeRequest(proxyBody()), {});

    // Upstream error path
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":{"message":"invalid key"}}', { status: 401 })));
    await worker.fetch(makeRequest(proxyBody()), {});

    // Network failure path
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    await worker.fetch(makeRequest(proxyBody()), {});

    const allLogs = [...logSpy.mock.calls, ...warnSpy.mock.calls, ...errorSpy.mock.calls]
      .map((args) => args.map(String).join(' '))
      .join('\n');
    expect(allLogs).not.toContain(API_KEY);
    // The old proxy logged a masked key that still exposed the last 4 chars.
    expect(allLogs).not.toContain('QW77');
  });

  it('does not echo the key back in proxy error bodies', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    const response = await worker.fetch(makeRequest(proxyBody()), {});
    const text = await response.text();
    expect(response.status).toBe(502);
    expect(text).not.toContain(API_KEY);
  });
});

describe('cors-proxy: health endpoint', () => {
  it('answers GET /health without configuration details', async () => {
    const response = await worker.fetch(new Request('https://proxy.example.workers.dev/health'), {});
    expect(response.status).toBe(200);
    const payload = await response.json() as Record<string, unknown>;
    expect(payload.status).toBe('ok');
    expect(payload.version).toBe('v9');
    expect(payload.config).toBeUndefined();
  });
});
