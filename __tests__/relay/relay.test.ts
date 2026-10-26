/**
 * Contract tests for the local relay (relay/relay.mjs), the replacement for
 * the Cloudflare Worker (worker/cors-proxy.js v9).
 *
 * The relay is exercised in-process: `createRelayHandler` returns an
 * http-style `(req, res)` handler, so the suite needs no listening port and
 * no real network calls to providers (`fetchImpl` is always a stub).
 *
 * Each test names the promise it verifies:
 *  - static export + SPA index fallback, traversal blocked
 *  - DNS-rebinding Host guard, Origin guard, provider/target host pinning
 *  - per-provider auth injection (Bearer / x-api-key / x-goog-api-key)
 *  - env keys override the body key and never reach the client
 *  - body limit enforced on real bytes, SSE forwarding without buffering
 *  - /api/health, Cache-Control: no-store, and no key/body ever logged
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Readable } from 'node:stream';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  ANTHROPIC_VERSION,
  createRelayHandler,
  createRelayServer,
  parseArgs,
  startRelay,
} from '../../relay/relay.mjs';

// ── test harness ────────────────────────────────────────────────────────

const API_KEY = 'sk-test-SECRET-key-QW77';
const ENV_KEY = 'sk-env-GLOBAL-key-NOPE';
const ENV_PROVIDER_KEY = 'sk-env-OPENAI-key-NOPE';
const PAYLOAD_MARKER = 'PAYLOAD-MARKER-77';
const HOST = '127.0.0.1:8787';
const ORIGIN = 'http://127.0.0.1:8787';

interface MockReq extends Readable {
  method: string;
  url: string;
  headers: Record<string, string>;
}

interface MockRes {
  statusCode: number;
  headers: Record<string, string>;
  chunks: Buffer[];
  flushHeaders: () => void;
  writeHead: (status: number, headers?: Record<string, string>) => MockRes;
  write: (chunk: Uint8Array | string) => boolean;
  end: (chunk?: Uint8Array | string) => void;
  bodyText: () => string;
}

type RelayHandler = (req: MockReq, res: MockRes) => Promise<void>;

interface FetchCall {
  url: string;
  init: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal };
}

interface CaptureLogger {
  lines: string[];
  logger: { log: (...args: unknown[]) => void; warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
}

function makeReq(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: string;
} = {}): MockReq {
  const chunks = options.body === undefined ? [] : [Buffer.from(options.body, 'utf8')];
  const req = Readable.from(chunks) as unknown as MockReq;
  req.method = options.method ?? 'GET';
  req.url = options.url ?? '/';
  req.headers = { host: HOST, ...(options.headers ?? {}) };
  return req;
}

function makeRes(): MockRes {
  const res: MockRes = {
    statusCode: 0,
    headers: {},
    chunks: [],
    flushHeaders: () => undefined,
    writeHead(status, headers = {}) {
      res.statusCode = status;
      Object.assign(res.headers, headers);
      return res;
    },
    write(chunk) {
      res.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return true;
    },
    end(chunk) {
      if (chunk !== undefined) {
        res.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
    },
    bodyText() {
      return Buffer.concat(res.chunks).toString('utf8');
    },
  };
  return res;
}

function makeHandler(overrides: {
  rootDir?: string;
  env?: Record<string, string>;
  fetchImpl?: (url: string, init: FetchCall['init']) => Promise<Response>;
  logger?: CaptureLogger['logger'];
} = {}): RelayHandler {
  const handler = createRelayHandler({
    rootDir: overrides.rootDir ?? fixtureRoot,
    env: overrides.env ?? {},
    // The relay calls fetch(url, init) only; cast keeps the test stub narrow.
    fetchImpl: (overrides.fetchImpl ?? stubFetch().fetchImpl) as unknown as typeof fetch,
    logger: overrides.logger ?? silentLogger(),
  });
  return handler as unknown as RelayHandler;
}

async function call(
  handler: RelayHandler,
  req: MockReq,
): Promise<MockRes> {
  const res = makeRes();
  await handler(req, res);
  return res;
}

function json(res: MockRes): Record<string, unknown> {
  return JSON.parse(res.bodyText()) as Record<string, unknown>;
}

function header(res: MockRes, name: string): string | undefined {
  const wanted = name.toLowerCase();
  const key = Object.keys(res.headers).find((candidate) => candidate.toLowerCase() === wanted);
  return key === undefined ? undefined : res.headers[key];
}

function silentLogger(): CaptureLogger['logger'] {
  return { log: () => undefined, warn: () => undefined, error: () => undefined };
}

function captureLogger(): CaptureLogger {
  const lines: string[] = [];
  const push = (...args: unknown[]) => {
    lines.push(args.map((arg) => String(arg)).join(' '));
  };
  return { lines, logger: { log: push, warn: push, error: push } };
}

function stubFetch(
  respond: () => Response | Promise<Response> = () =>
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
) {
  const calls: FetchCall[] = [];
  const fetchImpl = async (url: string, init: FetchCall['init']): Promise<Response> => {
    calls.push({ url, init });
    return respond();
  };
  return { calls, fetchImpl };
}

function llmBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    provider: 'openai',
    apiKey: API_KEY,
    targetUrl: 'https://api.openai.com/v1/chat/completions',
    payload: JSON.stringify({ model: PAYLOAD_MARKER, messages: [] }),
    ...overrides,
  };
}

async function waitFor(predicate: () => boolean, label: string): Promise<void> {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`timed out waiting for ${label}`);
}

// ── fixture ─────────────────────────────────────────────────────────────

let fixtureRoot = '';

beforeAll(async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'relay-fixture-'));
  fixtureRoot = path.join(base, 'out');
  await mkdir(path.join(fixtureRoot, 'assets'), { recursive: true });
  await mkdir(path.join(fixtureRoot, 'nested'), { recursive: true });
  await writeFile(path.join(fixtureRoot, 'index.html'), '<!doctype html><title>relay fixture</title>', 'utf8');
  await writeFile(path.join(fixtureRoot, 'assets', 'app.js'), 'console.log("relay");', 'utf8');
  await writeFile(path.join(fixtureRoot, 'assets', 'app.css'), 'body{color:red}', 'utf8');
  await writeFile(path.join(fixtureRoot, 'assets', 'logo.svg'), '<svg></svg>', 'utf8');
  await writeFile(path.join(fixtureRoot, 'nested', 'index.html'), '<p>nested index</p>', 'utf8');
  await writeFile(path.join(fixtureRoot, 'about.html'), '<p>about page</p>', 'utf8');
  // Sibling of the static root: a traversal attempt must never reach it.
  await writeFile(path.join(base, 'secret.txt'), 'TOP-SECRET', 'utf8');
});

afterAll(async () => {
  if (fixtureRoot) {
    await rm(path.dirname(fixtureRoot), { recursive: true, force: true });
  }
});

// ── static export ───────────────────────────────────────────────────────

describe('relay: static export', () => {
  it('serves index.html at / as text/html', async () => {
    const res = await call(makeHandler(), makeReq({ url: '/' }));
    expect(res.statusCode).toBe(200);
    expect(header(res, 'content-type')).toContain('text/html');
    expect(res.bodyText()).toContain('relay fixture');
  });

  it('serves nested assets with the right Content-Type', async () => {
    const handler = makeHandler();
    const js = await call(handler, makeReq({ url: '/assets/app.js' }));
    expect(js.statusCode).toBe(200);
    expect(header(js, 'content-type')).toContain('text/javascript');
    expect(js.bodyText()).toContain('console.log');

    const css = await call(handler, makeReq({ url: '/assets/app.css' }));
    expect(css.statusCode).toBe(200);
    expect(header(css, 'content-type')).toContain('text/css');

    const svg = await call(handler, makeReq({ url: '/assets/logo.svg' }));
    expect(svg.statusCode).toBe(200);
    expect(header(svg, 'content-type')).toContain('image/svg+xml');
  });

  it('serves a directory index and an extensionless .html route', async () => {
    const handler = makeHandler();
    const nested = await call(handler, makeReq({ url: '/nested/' }));
    expect(nested.statusCode).toBe(200);
    expect(nested.bodyText()).toContain('nested index');

    const about = await call(handler, makeReq({ url: '/about' }));
    expect(about.statusCode).toBe(200);
    expect(about.bodyText()).toContain('about page');
  });

  it('falls back to index.html for an unknown extensionless SPA route', async () => {
    const res = await call(makeHandler(), makeReq({ url: '/some/spa/route' }));
    expect(res.statusCode).toBe(200);
    expect(header(res, 'content-type')).toContain('text/html');
    expect(res.bodyText()).toContain('relay fixture');
  });

  it('returns 404 for a missing asset and never falls back for files', async () => {
    const res = await call(makeHandler(), makeReq({ url: '/assets/missing.js' }));
    expect(res.statusCode).toBe(404);
    expect(res.bodyText()).not.toContain('relay fixture');
  });

  it('answers HEAD with headers and no body', async () => {
    const res = await call(makeHandler(), makeReq({ method: 'HEAD', url: '/assets/app.js' }));
    expect(res.statusCode).toBe(200);
    expect(header(res, 'content-length')).toBe('21');
    expect(res.chunks).toHaveLength(0);
  });

  it('rejects a traversal path outside the static root', async () => {
    const res = await call(makeHandler(), makeReq({ url: '/%2e%2e/secret.txt' }));
    expect([403, 404]).toContain(res.statusCode);
    expect(res.bodyText()).not.toContain('TOP-SECRET');
  });

  it('rejects non-GET/HEAD methods on static paths', async () => {
    const res = await call(makeHandler(), makeReq({ method: 'POST', url: '/' }));
    expect(res.statusCode).toBe(405);
    expect(header(res, 'allow')).toBe('GET, HEAD');
  });
});

// ── DNS rebinding / Host guard ──────────────────────────────────────────

describe('relay: Host guard (DNS rebinding)', () => {
  it('rejects POST /api/llm addressed to a foreign Host and never calls the provider', async () => {
    const { fetchImpl, calls } = stubFetch();
    const res = await call(
      makeHandler({ fetchImpl }),
      makeReq({
        method: 'POST',
        url: '/api/llm',
        headers: { host: 'evil.example', origin: ORIGIN },
        body: JSON.stringify(llmBody()),
      }),
    );
    expect(res.statusCode).toBe(403);
    expect(json(res).error).toBe('host_not_allowed');
    expect(calls).toHaveLength(0);
  });

  it('rejects static requests addressed to a foreign Host too', async () => {
    const res = await call(
      makeHandler(),
      makeReq({ url: '/', headers: { host: 'rebind.attacker.example' } }),
    );
    expect(res.statusCode).toBe(403);
  });

  it('accepts localhost and 127.0.0.1 Hosts, with or without a port', async () => {
    const handler = makeHandler();
    for (const host of ['localhost:8787', 'localhost', '127.0.0.1', '127.0.0.1:9999']) {
      const res = await call(handler, makeReq({ url: '/api/health', headers: { host } }));
      expect(res.statusCode, host).toBe(200);
    }
  });
});

// ── Origin guard ────────────────────────────────────────────────────────

describe('relay: Origin guard', () => {
  it('rejects a foreign Origin with 403 and no CORS echo', async () => {
    const { fetchImpl, calls } = stubFetch();
    const res = await call(
      makeHandler({ fetchImpl }),
      makeReq({
        method: 'POST',
        url: '/api/llm',
        headers: { origin: 'https://evil.example' },
        body: JSON.stringify(llmBody()),
      }),
    );
    expect(res.statusCode).toBe(403);
    expect(json(res).error).toBe('origin_not_allowed');
    expect(header(res, 'access-control-allow-origin')).toBeUndefined();
    expect(calls).toHaveLength(0);
  });

  it('echoes an allowlisted loopback Origin and never uses a wildcard', async () => {
    const { fetchImpl } = stubFetch();
    const res = await call(
      makeHandler({ fetchImpl }),
      makeReq({
        method: 'POST',
        url: '/api/llm',
        headers: { origin: ORIGIN },
        body: JSON.stringify(llmBody()),
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(header(res, 'access-control-allow-origin')).toBe(ORIGIN);
    expect(header(res, 'access-control-allow-origin')).not.toBe('*');
  });

  it('allows a non-browser request without an Origin header (curl / tests)', async () => {
    const { fetchImpl } = stubFetch();
    const res = await call(
      makeHandler({ fetchImpl }),
      makeReq({ method: 'POST', url: '/api/llm', body: JSON.stringify(llmBody()) }),
    );
    expect(res.statusCode).toBe(200);
    expect(header(res, 'access-control-allow-origin')).toBeUndefined();
  });

  it('answers an allowed preflight with CORS headers and a foreign preflight with 403', async () => {
    const handler = makeHandler();
    const allowed = await call(handler, makeReq({ method: 'OPTIONS', url: '/api/llm', headers: { origin: ORIGIN } }));
    expect(allowed.statusCode).toBe(204);
    expect(header(allowed, 'access-control-allow-origin')).toBe(ORIGIN);
    expect(header(allowed, 'access-control-allow-headers')).toContain('Content-Type');

    const foreign = await call(
      handler,
      makeReq({ method: 'OPTIONS', url: '/api/llm', headers: { origin: 'https://evil.example' } }),
    );
    expect(foreign.statusCode).toBe(403);
    expect(header(foreign, 'access-control-allow-origin')).toBeUndefined();
  });

  it('honours extra origins from ALLOWED_ORIGINS', async () => {
    const { fetchImpl } = stubFetch();
    const res = await call(
      makeHandler({ fetchImpl, env: { ALLOWED_ORIGINS: 'https://audit.example.com' } }),
      makeReq({
        method: 'POST',
        url: '/api/llm',
        headers: { origin: 'https://audit.example.com' },
        body: JSON.stringify(llmBody()),
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(header(res, 'access-control-allow-origin')).toBe('https://audit.example.com');
  });
});

// ── provider / target host pinning ──────────────────────────────────────

describe('relay: target host pinning (not an open relay)', () => {
  it('rejects an arbitrary host declared as a known provider without calling fetch', async () => {
    const { fetchImpl, calls } = stubFetch();
    const res = await call(
      makeHandler({ fetchImpl }),
      makeReq({
        method: 'POST',
        url: '/api/llm',
        body: JSON.stringify(llmBody({ targetUrl: 'https://attacker.example/collect' })),
      }),
    );
    expect(res.statusCode).toBe(400);
    expect(json(res).error).toBe('invalid_target_url');
    expect(calls).toHaveLength(0);
  });

  it('rejects a mismatched provider/host pair', async () => {
    const { fetchImpl, calls } = stubFetch();
    const res = await call(
      makeHandler({ fetchImpl }),
      makeReq({
        method: 'POST',
        url: '/api/llm',
        body: JSON.stringify(llmBody({ provider: 'anthropic' })),
      }),
    );
    expect(res.statusCode).toBe(400);
    expect(json(res).error).toBe('invalid_target_url');
    expect(calls).toHaveLength(0);
  });

  it('rejects non-https targets and targets with credentials', async () => {
    const { fetchImpl, calls } = stubFetch();
    const handler = makeHandler({ fetchImpl });

    const http = await call(
      handler,
      makeReq({ method: 'POST', url: '/api/llm', body: JSON.stringify(llmBody({ targetUrl: 'http://api.openai.com/v1/chat/completions' })) }),
    );
    expect(http.statusCode).toBe(400);

    const credentials = await call(
      handler,
      makeReq({
        method: 'POST',
        url: '/api/llm',
        body: JSON.stringify(llmBody({ targetUrl: 'https://user:pass@api.openai.com/v1/chat/completions' })),
      }),
    );
    expect(credentials.statusCode).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('rejects an unknown provider', async () => {
    const { fetchImpl, calls } = stubFetch();
    const res = await call(
      makeHandler({ fetchImpl }),
      makeReq({ method: 'POST', url: '/api/llm', body: JSON.stringify(llmBody({ provider: 'skynet' })) }),
    );
    expect(res.statusCode).toBe(400);
    expect(json(res).error).toBe('unknown_provider');
    expect(calls).toHaveLength(0);
  });

  it('disables custom endpoints unless the host is in ALLOWED_CUSTOM_HOSTS', async () => {
    const { fetchImpl, calls } = stubFetch();
    const body = llmBody({
      provider: 'custom',
      targetUrl: 'https://api.example.com/v1/chat/completions',
    });

    const denied = await call(makeHandler({ fetchImpl }), makeReq({ method: 'POST', url: '/api/llm', body: JSON.stringify(body) }));
    expect(denied.statusCode).toBe(403);
    expect(json(denied).error).toBe('custom_provider_disabled');
    expect(calls).toHaveLength(0);

    const allowed = await call(
      makeHandler({ fetchImpl, env: { ALLOWED_CUSTOM_HOSTS: 'api.example.com' } }),
      makeReq({ method: 'POST', url: '/api/llm', body: JSON.stringify(body) }),
    );
    expect(allowed.statusCode).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.example.com/v1/chat/completions');
    expect(calls[0]?.init.headers?.Authorization).toBe(`Bearer ${API_KEY}`);
  });
});

// ── auth injection per provider ─────────────────────────────────────────

describe('relay: provider auth injection', () => {
  it('injects Authorization: Bearer for OpenAI-compatible providers', async () => {
    const { fetchImpl, calls } = stubFetch();
    const payload = JSON.stringify({ model: PAYLOAD_MARKER, messages: [] });
    const res = await call(
      makeHandler({ fetchImpl }),
      makeReq({
        method: 'POST',
        url: '/api/llm',
        body: JSON.stringify(llmBody({ payload })),
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.init.headers?.Authorization).toBe(`Bearer ${API_KEY}`);
    expect(calls[0]?.init.headers?.['Content-Type']).toContain('application/json');
    expect(calls[0]?.init.body).toBe(payload);
  });

  it('injects x-api-key + anthropic-version for Anthropic and no Authorization', async () => {
    const { fetchImpl, calls } = stubFetch();
    const res = await call(
      makeHandler({ fetchImpl }),
      makeReq({
        method: 'POST',
        url: '/api/llm',
        body: JSON.stringify(
          llmBody({
            provider: 'anthropic',
            targetUrl: 'https://api.anthropic.com/v1/messages',
          }),
        ),
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(calls[0]?.init.headers?.['x-api-key']).toBe(API_KEY);
    expect(calls[0]?.init.headers?.['anthropic-version']).toBe(ANTHROPIC_VERSION);
    expect(calls[0]?.init.headers?.Authorization).toBeUndefined();
  });

  it('injects Google auth as x-goog-api-key and keeps the key out of the URL', async () => {
    const { fetchImpl, calls } = stubFetch();
    const targetUrl =
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
    const res = await call(
      makeHandler({ fetchImpl }),
      makeReq({
        method: 'POST',
        url: '/api/llm',
        body: JSON.stringify(llmBody({ provider: 'google', targetUrl })),
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(calls[0]?.init.headers?.['x-goog-api-key']).toBe(API_KEY);
    expect(calls[0]?.init.headers?.Authorization).toBeUndefined();
    expect(calls[0]?.url).toBe(targetUrl);
    expect(calls[0]?.url).not.toContain('key=');
    expect(new URL(calls[0]?.url ?? '').search).toBe('');
  });

  it('accepts providers the old worker v9 accidentally rejected (zai, mistral) on their own hosts', async () => {
    const { fetchImpl, calls } = stubFetch();
    const handler = makeHandler({ fetchImpl });

    const zai = await call(
      handler,
      makeReq({
        method: 'POST',
        url: '/api/llm',
        body: JSON.stringify(llmBody({ provider: 'zai', targetUrl: 'https://api.z.ai/v1/chat/completions' })),
      }),
    );
    expect(zai.statusCode).toBe(200);
    expect(calls[0]?.init.headers?.Authorization).toBe(`Bearer ${API_KEY}`);

    const mistral = await call(
      handler,
      makeReq({
        method: 'POST',
        url: '/api/llm',
        body: JSON.stringify(llmBody({ provider: 'mistral', targetUrl: 'https://api.mistral.ai/v1/chat/completions' })),
      }),
    );
    expect(mistral.statusCode).toBe(200);
    expect(calls[1]?.init.headers?.Authorization).toBe(`Bearer ${API_KEY}`);
  });
});

// ── env key override ────────────────────────────────────────────────────

describe('relay: API key from env', () => {
  it('lets LLM_API_KEY override the body apiKey', async () => {
    const { fetchImpl, calls } = stubFetch();
    const res = await call(
      makeHandler({ fetchImpl, env: { LLM_API_KEY: ENV_KEY } }),
      makeReq({ method: 'POST', url: '/api/llm', body: JSON.stringify(llmBody()) }),
    );
    expect(res.statusCode).toBe(200);
    expect(calls[0]?.init.headers?.Authorization).toBe(`Bearer ${ENV_KEY}`);
    expect(calls[0]?.init.headers?.Authorization).not.toContain(API_KEY);
  });

  it('prefers LLM_API_KEY_<PROVIDER> over LLM_API_KEY and allows omitting apiKey entirely', async () => {
    const { fetchImpl, calls } = stubFetch();
    const body = llmBody();
    delete (body as { apiKey?: unknown }).apiKey;

    const res = await call(
      makeHandler({ fetchImpl, env: { LLM_API_KEY: ENV_KEY, LLM_API_KEY_OPENAI: ENV_PROVIDER_KEY } }),
      makeReq({ method: 'POST', url: '/api/llm', body: JSON.stringify(body) }),
    );
    expect(res.statusCode).toBe(200);
    expect(calls[0]?.init.headers?.Authorization).toBe(`Bearer ${ENV_PROVIDER_KEY}`);
  });

  it('rejects with 400 when no key is available in the body or env', async () => {
    const { fetchImpl, calls } = stubFetch();
    const body = llmBody();
    delete (body as { apiKey?: unknown }).apiKey;

    const res = await call(
      makeHandler({ fetchImpl }),
      makeReq({ method: 'POST', url: '/api/llm', body: JSON.stringify(body) }),
    );
    expect(res.statusCode).toBe(400);
    expect(json(res).error).toBe('missing_api_key');
    expect(calls).toHaveLength(0);
  });
});

// ── body limit ──────────────────────────────────────────────────────────

describe('relay: body size limit on real bytes', () => {
  it('returns 413 when the actual bytes exceed MAX_BODY_SIZE_BYTES (no Content-Length)', async () => {
    const { fetchImpl, calls } = stubFetch();
    const body = JSON.stringify(llmBody());
    expect(Buffer.byteLength(body, 'utf8')).toBeGreaterThan(120);

    const res = await call(
      makeHandler({ fetchImpl, env: { MAX_BODY_SIZE_BYTES: '120' } }),
      makeReq({ method: 'POST', url: '/api/llm', body }),
    );
    expect(res.statusCode).toBe(413);
    expect(json(res).error).toBe('payload_too_large');
    expect(calls).toHaveLength(0);
  });

  it('returns 413 when a lying/declared Content-Length is already over the limit', async () => {
    const { fetchImpl, calls } = stubFetch();
    const res = await call(
      makeHandler({ fetchImpl, env: { MAX_BODY_SIZE_BYTES: '200' } }),
      makeReq({
        method: 'POST',
        url: '/api/llm',
        headers: { 'content-length': '999999' },
        body: JSON.stringify(llmBody()),
      }),
    );
    expect(res.statusCode).toBe(413);
    expect(calls).toHaveLength(0);
  });

  it('accepts a body below the configured limit', async () => {
    const { fetchImpl, calls } = stubFetch();
    const res = await call(
      makeHandler({ fetchImpl, env: { MAX_BODY_SIZE_BYTES: '4096' } }),
      makeReq({ method: 'POST', url: '/api/llm', body: JSON.stringify(llmBody()) }),
    );
    expect(res.statusCode).toBe(200);
    expect(calls).toHaveLength(1);
  });
});

// ── health + cache headers ──────────────────────────────────────────────

describe('relay: /api/health and no-store', () => {
  it('reports status ok and keyFromEnv=false without a key', async () => {
    const res = await call(makeHandler(), makeReq({ url: '/api/health' }));
    expect(res.statusCode).toBe(200);
    expect(json(res)).toMatchObject({ status: 'ok', keyFromEnv: false });
    expect(header(res, 'cache-control')).toBe('no-store');
  });

  it('reports keyFromEnv=true when an env key is configured', async () => {
    const res = await call(
      makeHandler({ env: { LLM_API_KEY_OPENAI: ENV_PROVIDER_KEY } }),
      makeReq({ url: '/api/health' }),
    );
    expect(res.statusCode).toBe(200);
    expect(json(res).keyFromEnv).toBe(true);
  });

  it('marks /api/llm success and error responses no-store', async () => {
    const { fetchImpl } = stubFetch();
    const handler = makeHandler({ fetchImpl });

    const ok = await call(
      handler,
      makeReq({ method: 'POST', url: '/api/llm', body: JSON.stringify(llmBody()) }),
    );
    expect(header(ok, 'cache-control')).toBe('no-store');

    const bad = await call(
      handler,
      makeReq({ method: 'POST', url: '/api/llm', body: JSON.stringify(llmBody({ provider: 'skynet' })) }),
    );
    expect(header(bad, 'cache-control')).toBe('no-store');
  });

  it('rejects POST /api/health with 405', async () => {
    const res = await call(makeHandler(), makeReq({ method: 'POST', url: '/api/health' }));
    expect(res.statusCode).toBe(405);
  });
});

// ── streaming passthrough ───────────────────────────────────────────────

describe('relay: streaming passthrough', () => {
  it('forwards SSE bytes as they arrive without buffering the stream', async () => {
    const encoder = new TextEncoder();
    let upstreamController: ReadableStreamDefaultController<Uint8Array> | undefined;
    const upstreamStream = new ReadableStream<Uint8Array>({
      start(controller) {
        upstreamController = controller;
      },
    });
    const fetchImpl = async (): Promise<Response> =>
      new Response(upstreamStream, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });

    const handler = makeHandler({ fetchImpl });
    const req = makeReq({
      method: 'POST',
      url: '/api/llm',
      headers: { accept: 'text/event-stream', 'content-type': 'application/json' },
      body: JSON.stringify(llmBody()),
    });
    const res = makeRes();
    const finished = handler(req, res);

    await waitFor(() => res.statusCode === 200 && upstreamController !== undefined, 'stream headers');
    expect(header(res, 'content-type')).toContain('text/event-stream');
    expect(header(res, 'cache-control')).toContain('no-store');

    upstreamController?.enqueue(encoder.encode('data: one\n\n'));
    // The first chunk must reach the client before the upstream stream closes:
    // that is the "do not buffer" part of the contract.
    await waitFor(() => res.bodyText().includes('data: one'), 'first SSE chunk');
    expect(res.bodyText()).toBe('data: one\n\n');

    upstreamController?.enqueue(encoder.encode('data: two\n\n'));
    upstreamController?.close();
    await finished;

    expect(res.bodyText()).toBe('data: one\n\ndata: two\n\n');
  });

  it('buffers an upstream error status instead of streaming it', async () => {
    const fetchImpl = async (): Promise<Response> =>
      new Response(JSON.stringify({ error: { message: 'quota' } }), {
        status: 429,
        headers: { 'content-type': 'application/json' },
      });
    const handler = makeHandler({ fetchImpl, env: {} });
    const res = await call(
      handler,
      makeReq({
        method: 'POST',
        url: '/api/llm',
        headers: { accept: 'text/event-stream' },
        body: JSON.stringify(llmBody()),
      }),
    );
    expect(res.statusCode).toBe(429);
    expect(res.bodyText()).toContain('quota');
    expect(header(res, 'cache-control')).toBe('no-store');
  });
});

// ── timeouts / upstream errors ──────────────────────────────────────────

describe('relay: timeouts and upstream failures', () => {
  it('returns 504 when the provider does not answer before PROVIDER_TIMEOUT_MS', async () => {
    const fetchImpl = (...args: unknown[]): Promise<Response> => {
      const init = args[1] as FetchCall['init'];
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    };
    const res = await call(
      makeHandler({ fetchImpl: fetchImpl as unknown as (url: string, init: FetchCall['init']) => Promise<Response>, env: { PROVIDER_TIMEOUT_MS: '20' } }),
      makeReq({ method: 'POST', url: '/api/llm', body: JSON.stringify(llmBody()) }),
    );
    expect(res.statusCode).toBe(504);
    expect(json(res).error).toBe('timeout');
  });

  it('returns 502 without leaking details when the provider fetch fails', async () => {
    const fetchImpl = async (): Promise<Response> => {
      throw new TypeError(`fetch failed for ${API_KEY}`);
    };
    const res = await call(
      makeHandler({ fetchImpl }),
      makeReq({ method: 'POST', url: '/api/llm', body: JSON.stringify(llmBody()) }),
    );
    expect(res.statusCode).toBe(502);
    expect(json(res).error).toBe('network');
    expect(res.bodyText()).not.toContain(API_KEY);
  });
});

// ── logging discipline ──────────────────────────────────────────────────

describe('relay: logs never contain keys or bodies', () => {
  it('does not log the body key, the env key, or the payload on success', async () => {
    const capture = captureLogger();
    const { fetchImpl } = stubFetch();
    const res = await call(
      makeHandler({
        fetchImpl,
        logger: capture.logger,
        env: { LLM_API_KEY_OPENAI: ENV_PROVIDER_KEY },
      }),
      makeReq({ method: 'POST', url: '/api/llm', body: JSON.stringify(llmBody()) }),
    );
    expect(res.statusCode).toBe(200);

    const logged = capture.lines.join('\n');
    expect(capture.lines.length).toBeGreaterThan(0);
    expect(logged).not.toContain(API_KEY);
    expect(logged).not.toContain(ENV_PROVIDER_KEY);
    expect(logged).not.toContain(ENV_KEY);
    expect(logged).not.toContain(PAYLOAD_MARKER);
  });

  it('does not log keys on rejected or failing requests', async () => {
    const capture = captureLogger();
    const fetchImpl = async (): Promise<Response> => {
      throw new TypeError(`boom ${API_KEY}`);
    };
    const handler = makeHandler({ fetchImpl, logger: capture.logger });

    await call(
      handler,
      makeReq({ method: 'POST', url: '/api/llm', body: JSON.stringify(llmBody({ targetUrl: 'https://attacker.example' })) }),
    );
    await call(
      handler,
      makeReq({ method: 'POST', url: '/api/llm', body: JSON.stringify(llmBody()) }),
    );

    const logged = capture.lines.join('\n');
    expect(logged).not.toContain(API_KEY);
    expect(logged).not.toContain(PAYLOAD_MARKER);
  });
});

// ── CLI contract ────────────────────────────────────────────────────────

describe('relay: CLI contract', () => {
  it('parses --port / --dir and defaults', () => {
    expect(parseArgs([])).toMatchObject({ port: 8787, dir: 'out', help: false });
    expect(parseArgs(['--port', '9999', '--dir', 'dist'])).toMatchObject({ port: 9999, dir: 'dist' });
    expect(parseArgs(['--port=9000', '--dir=build'])).toMatchObject({ port: 9000, dir: 'build' });
    expect(parseArgs(['--help'])).toMatchObject({ help: true });
  });

  it('startRelay binds loopback only and serves /api/health over real HTTP', async () => {
    const { fetchImpl } = stubFetch();
    const { server, port } = await startRelay({
      port: 0,
      dir: fixtureRoot,
      env: {},
      fetchImpl,
      logger: silentLogger(),
    });
    try {
      const address = server.address();
      expect(typeof address).toBe('object');
      expect(address && typeof address === 'object' ? address.address : '').toBe('127.0.0.1');

      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      expect(response.status).toBe(200);
      const payload = (await response.json()) as { status?: string; keyFromEnv?: boolean };
      expect(payload.status).toBe('ok');
      expect(payload.keyFromEnv).toBe(false);

      const staticResponse = await fetch(`http://127.0.0.1:${port}/`);
      expect(staticResponse.status).toBe(200);
      expect(await staticResponse.text()).toContain('relay fixture');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('createRelayServer returns a server that is not listening yet', () => {
    const server = createRelayServer({ rootDir: fixtureRoot, env: {}, logger: silentLogger() });
    expect(server.listening).toBe(false);
  });
});
