/**
 * Local relay for the Universe Audit Protocol web app.
 *
 * Implements the "static export + local relay" deployment plan:
 *
 *   - serves the Next.js static export (`out/` by default),
 *   - proxies `POST /api/llm` to a pinned provider API host,
 *   - injects provider auth (Bearer / x-api-key / x-goog-api-key),
 *   - can keep the API key out of the browser entirely (LLM_API_KEY env),
 *   - binds 127.0.0.1 only and rejects DNS-rebinding Hosts / foreign Origins.
 *
 * Node >= 18, ESM, zero dependencies.
 *
 * CLI:
 *   node relay/relay.mjs [--port 8787] [--dir out]
 *
 * Library:
 *   import { createRelayHandler, createRelayServer } from './relay/relay.mjs'
 */

import http from 'node:http';
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const RELAY_VERSION = 'relay-v1';
export const DEFAULT_PORT = 8787;
export const DEFAULT_ROOT_DIR = 'out';
export const DEFAULT_MAX_BODY_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
export const PROVIDER_TIMEOUT_MS = 300_000; // 300 s (matches worker v9)
// 2023-06-01 is the only API version Anthropic accepts (the old 2024-10-22 was
// a beta-header date, not a version).
export const ANTHROPIC_VERSION = '2023-06-01';

/**
 * Every known provider may only be called on its own API host.
 * Same map as worker v9 — the relay is not a general-purpose proxy.
 */
export const PROVIDER_HOSTS = Object.freeze({
  openai: Object.freeze(['api.openai.com']),
  anthropic: Object.freeze(['api.anthropic.com']),
  google: Object.freeze(['generativelanguage.googleapis.com']),
  deepseek: Object.freeze(['api.deepseek.com']),
  groq: Object.freeze(['api.groq.com']),
  openrouter: Object.freeze(['openrouter.ai']),
  mistral: Object.freeze(['api.mistral.ai']),
  // International and China-region hosts are both pinned: a user may hold a key
  // for either region, and neither host can be reached through the other one.
  qwen: Object.freeze(['dashscope-intl.aliyuncs.com', 'dashscope.aliyuncs.com']),
  kimi: Object.freeze(['api.moonshot.ai', 'api.moonshot.cn']),
  xai: Object.freeze(['api.x.ai']),
  together: Object.freeze(['api.together.xyz']),
  huggingface: Object.freeze(['api-inference.huggingface.co']),
  zai: Object.freeze(['api.z.ai']),
});

/** Providers accepted by POST /api/llm (`custom` needs ALLOWED_CUSTOM_HOSTS). */
export const PROVIDER_IDS = Object.freeze([...Object.keys(PROVIDER_HOSTS), 'custom']);

const MIME_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
});

// ── small helpers ───────────────────────────────────────────────────────

/** Parse a comma-separated env var into a trimmed, non-empty list. */
function parseCsv(value) {
  if (!value || typeof value !== 'string') return [];
  return value.split(',').map((part) => part.trim()).filter(Boolean);
}

/** Read a strictly positive integer env var, else the default. */
function readEnvInt(env, key, defaultValue) {
  const raw = env ? env[key] : undefined;
  if (raw === undefined || raw === null || raw === '') return defaultValue;
  const parsed = Number.parseInt(String(raw), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

function isLoopbackHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
}

/**
 * DNS-rebinding guard: the Host header must name this machine.
 * `localhost`, `127.0.0.1` and `[::1]`, each optionally with a port.
 * A missing Host (HTTP/1.0, non-browser clients) is allowed — it cannot be a
 * poisoned browser Host — while the target-host allowlist below still applies.
 */
function hostHeaderAllowed(hostHeader) {
  if (!hostHeader) return true;
  const host = String(hostHeader).trim().toLowerCase();
  if (host.startsWith('[')) {
    const end = host.indexOf(']');
    if (end === -1) return false;
    return host.slice(0, end + 1) === '[::1]';
  }
  const colon = host.lastIndexOf(':');
  const hostname = colon === -1 ? host : host.slice(0, colon);
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function mimeFor(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function envKeyNameForProvider(provider) {
  return `LLM_API_KEY_${String(provider).toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
}

function readKey(env, name) {
  const value = env ? env[name] : undefined;
  return typeof value === 'string' ? value.trim() : '';
}

/** True when some env var can supply a key (health check signal, no value). */
function hasAnyEnvKey(env) {
  if (!env) return false;
  if (readKey(env, 'LLM_API_KEY')) return true;
  return Object.keys(env).some(
    (name) => /^LLM_API_KEY_[A-Z0-9_]+$/.test(name) && readKey(env, name),
  );
}

/**
 * Which key to use: provider-specific env > global env > body apiKey.
 * Returns `{ key, source }` or null when no key is available.
 * `source` is safe to log (`env:provider`, `env`, `body`) — the key is not.
 */
function resolveApiKey(provider, bodyApiKey, env) {
  const providerKey = readKey(env, envKeyNameForProvider(provider));
  if (providerKey) return { key: providerKey, source: 'env:provider' };
  const globalKey = readKey(env, 'LLM_API_KEY');
  if (globalKey) return { key: globalKey, source: 'env' };
  const bodyKey = typeof bodyApiKey === 'string' ? bodyApiKey.trim() : '';
  return bodyKey ? { key: bodyKey, source: 'body' } : null;
}

// ── HTTP helpers ────────────────────────────────────────────────────────

/** CORS headers. Never returns `*`; only echoes an allowlisted origin. */
function corsHeaders(origin) {
  const headers = {
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, X-No-Retry',
    'Access-Control-Max-Age': '86400',
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

/** Resolve the Origin header: null when absent/disallowed, else the origin. */
function resolveAllowedOrigin(originHeader, extraOrigins) {
  if (!originHeader || typeof originHeader !== 'string') return null;
  if (extraOrigins.includes(originHeader)) return originHeader;
  try {
    const url = new URL(originHeader);
    if ((url.protocol === 'http:' || url.protocol === 'https:') && isLoopbackHost(url.hostname)) {
      return originHeader;
    }
  } catch {
    // "null" or garbage — not a browser origin we trust.
  }
  return null;
}

function sendJson(res, status, payload, origin, extraHeaders) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...(extraHeaders || {}),
    ...corsHeaders(origin),
  });
  res.end(body);
}

function sendText(res, status, body, extraHeaders) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...(extraHeaders || {}),
  });
  res.end(body);
}

function payloadTooLarge(maxBodySize) {
  return {
    error: 'payload_too_large',
    message: `Request body exceeds the relay limit of ${maxBodySize} bytes.`,
  };
}

/**
 * Read the request body, enforcing the limit on the real received bytes
 * (Content-Length can be missing or wrong). Resolves:
 *   { tooLarge: true } | { error: true } | { tooLarge: false, text }
 */
function readBody(req, limit) {
  return new Promise((resolve) => {
    if (!req || typeof req.on !== 'function') {
      resolve({ tooLarge: false, error: true });
      return;
    }
    const chunks = [];
    let size = 0;
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    req.on('data', (chunk) => {
      if (settled) return; // keep draining, ignore bytes after the verdict
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buf.length;
      if (size > limit) {
        finish({ tooLarge: true, size });
        return;
      }
      chunks.push(buf);
    });
    req.on('end', () => {
      finish({ tooLarge: false, size, text: Buffer.concat(chunks).toString('utf8') });
    });
    req.on('error', () => {
      finish({ tooLarge: false, error: true });
    });
  });
}

/**
 * Validate targetUrl against the declared provider.
 * https only, no credentials, default port, host pinned to the provider
 * (or to ALLOWED_CUSTOM_HOSTS when provider === 'custom').
 */
function validateTargetUrl(targetUrl, provider, customHosts) {
  if (!targetUrl || typeof targetUrl !== 'string') {
    return { valid: false, code: 'missing_fields', error: 'targetUrl is required' };
  }
  if (!targetUrl.startsWith('https://')) {
    return { valid: false, code: 'invalid_target_url', error: 'targetUrl must start with https://' };
  }
  let url;
  try {
    url = new URL(targetUrl);
  } catch {
    return { valid: false, code: 'invalid_target_url', error: 'Invalid targetUrl' };
  }
  if (url.username || url.password) {
    return { valid: false, code: 'invalid_target_url', error: 'targetUrl must not contain credentials' };
  }
  if (url.port && url.port !== '443') {
    return { valid: false, code: 'invalid_target_url', error: 'targetUrl must use the default https port' };
  }

  const hostname = url.hostname.toLowerCase();

  if (provider === 'custom' || !PROVIDER_HOSTS[provider]) {
    if (customHosts.includes(hostname)) {
      return { valid: true, url: url.toString() };
    }
    return {
      valid: false,
      code: 'custom_provider_disabled',
      error:
        'Custom provider endpoints are disabled on this relay. ' +
        'Set ALLOWED_CUSTOM_HOSTS to the exact hostname, or pick a built-in provider.',
    };
  }

  if (!PROVIDER_HOSTS[provider].includes(hostname)) {
    return {
      valid: false,
      code: 'invalid_target_url',
      error: `targetUrl host "${hostname}" is not the API host of provider "${provider}"`,
    };
  }

  return { valid: true, url: url.toString() };
}

/**
 * Provider auth injection. Google uses the x-goog-api-key header — the key is
 * never put into the URL (no query string, no logs, no Referer leaks).
 */
export function buildUpstreamHeaders(provider, apiKey) {
  const headers = { 'Content-Type': 'application/json' };
  if (provider === 'anthropic') {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = ANTHROPIC_VERSION;
  } else if (provider === 'google') {
    headers['x-goog-api-key'] = apiKey;
  } else if (provider === 'openrouter') {
    headers.Authorization = `Bearer ${apiKey}`;
    headers['HTTP-Referer'] = 'https://universe-audit-protocol.pages.dev';
    headers['X-Title'] = 'Universe Audit Protocol';
  } else {
    // openai, deepseek, groq, mistral, qwen, kimi, xai, together,
    // huggingface, zai, custom (OpenAI-compatible endpoints).
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

// ── static file serving ─────────────────────────────────────────────────

async function isFile(filePath) {
  try {
    const info = await stat(filePath);
    return info.isFile();
  } catch {
    return false;
  }
}

/**
 * Resolve a request path to a file inside rootDir:
 * exact file → `<path>.html` → `<path>/index.html` → SPA fallback
 * (`index.html`) for extensionless navigations. Never leaves rootDir.
 */
async function resolveStaticFile(rootDir, target, pathname) {
  const candidates = [];
  if (pathname.endsWith('/')) {
    candidates.push(path.join(target, 'index.html'));
  } else {
    candidates.push(target);
    if (!path.extname(target)) {
      candidates.push(`${target}.html`);
      candidates.push(path.join(target, 'index.html'));
    }
  }
  for (const candidate of candidates) {
    if (await isFile(candidate)) return candidate;
  }
  if (!path.extname(target) || pathname.endsWith('/')) {
    const index = path.join(rootDir, 'index.html');
    if (await isFile(index)) return index;
  }
  return null;
}

async function handleStatic(req, res, ctx) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    sendText(res, 405, 'Method not allowed', { Allow: 'GET, HEAD' });
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url || '/', 'http://127.0.0.1').pathname);
  } catch {
    sendText(res, 400, 'Bad Request');
    return;
  }
  if (pathname.includes('\0')) {
    sendText(res, 400, 'Bad Request');
    return;
  }

  const relative = pathname.replace(/^\/+/, '');
  const normalized = path.normalize(relative);
  if (
    normalized === '..' ||
    normalized.startsWith(`..${path.sep}`) ||
    path.isAbsolute(normalized)
  ) {
    sendText(res, 403, 'Forbidden');
    return;
  }
  const target = path.resolve(ctx.rootDir, normalized);
  if (target !== ctx.rootDir && !target.startsWith(ctx.rootDir + path.sep)) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  const filePath = await resolveStaticFile(ctx.rootDir, target, pathname);
  if (!filePath) {
    sendText(res, 404, '404 Not Found');
    return;
  }

  let data;
  try {
    data = await readFile(filePath);
  } catch {
    sendText(res, 404, '404 Not Found');
    return;
  }

  res.writeHead(200, {
    'Content-Type': mimeFor(filePath),
    'Content-Length': String(data.length),
    'X-Content-Type-Options': 'nosniff',
  });
  if (method === 'HEAD') res.end();
  else res.end(data);
}

// ── /api/llm ────────────────────────────────────────────────────────────

function buildTimeoutResponse(timeoutMs) {
  return {
    error: 'timeout',
    message: `Provider did not respond within ${Math.round(timeoutMs / 1000)} seconds. Try again or pick another model.`,
  };
}

/** Map an upstream fetch failure to a relay response, without leaking details. */
function sendUpstreamFailure(res, error, origin, ctx, provider) {
  const name = error && error.name ? String(error.name) : 'Error';
  if (name === 'AbortError' || name === 'TimeoutError') {
    ctx.logger.error(`[relay] llm provider=${provider} result=timeout`);
    sendJson(res, 504, buildTimeoutResponse(ctx.timeoutMs), origin);
    return;
  }
  // Log the type only: provider/network error messages can embed request URLs.
  ctx.logger.error(`[relay] llm provider=${provider} result=network_error error=${name}`);
  sendJson(
    res,
    502,
    {
      error: 'network',
      message: 'Could not reach the provider. Check your network and the target URL.',
    },
    origin,
  );
}

async function pipeStreamingResponse(res, upstream, ctx, provider, origin, startTime) {
  const contentType = upstream.headers.get('content-type') || 'text/event-stream';
  res.writeHead(upstream.status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-cache, no-store',
    'X-Content-Type-Options': 'nosniff',
    ...corsHeaders(origin),
  });
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const reader = upstream.body.getReader();
  let bytes = 0;
  let stalled = false;

  try {
    for (;;) {
      let idleTimer;
      // Idle timeout: the upstream may send nothing and hold the stream open.
      const outcome = await Promise.race([
        reader.read().then((result) => ({ kind: 'read', result })),
        new Promise((resolve) => {
          idleTimer = setTimeout(() => resolve({ kind: 'timeout' }), ctx.timeoutMs);
        }),
      ]).finally(() => clearTimeout(idleTimer));

      if (outcome.kind === 'timeout') {
        stalled = true;
        try {
          await reader.cancel();
        } catch {
          // already cancelled
        }
        break;
      }
      const { done, value } = outcome.result;
      if (done) break;
      const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
      bytes += chunk.length;
      res.write(chunk); // forward as it arrives — never buffer the whole stream
    }
  } catch (error) {
    ctx.logger.warn(
      `[relay] llm provider=${provider} stream_error error=${error && error.name ? error.name : 'Error'}`,
    );
  } finally {
    res.end();
    ctx.logger.log(
      `[relay] llm provider=${provider} stream=true` +
        `${stalled ? ' result=stream_timeout' : ' result=ok'}` +
        ` bytes=${bytes} ms=${Date.now() - startTime}`,
    );
  }
}

async function handleLlm(req, res, ctx, origin) {
  // Cheap pre-check on Content-Length; real bytes are enforced below.
  const declaredLength = Number.parseInt(String(req.headers['content-length'] || ''), 10);
  if (Number.isFinite(declaredLength) && declaredLength > ctx.maxBodySize) {
    sendJson(res, 413, payloadTooLarge(ctx.maxBodySize), origin);
    return;
  }

  const bodyResult = await readBody(req, ctx.maxBodySize);
  if (bodyResult.tooLarge) {
    sendJson(res, 413, payloadTooLarge(ctx.maxBodySize), origin);
    return;
  }
  if (bodyResult.error) {
    sendJson(res, 400, { error: 'invalid_body', message: 'Could not read the request body.' }, origin);
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(bodyResult.text);
  } catch {
    sendJson(
      res,
      400,
      { error: 'invalid_json', message: 'Request body must be valid JSON.' },
      origin,
    );
    return;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    sendJson(
      res,
      400,
      { error: 'invalid_json', message: 'Request body must be a JSON object.' },
      origin,
    );
    return;
  }

  const { provider, apiKey, targetUrl, payload } = parsed;

  if (!provider || typeof provider !== 'string') {
    sendJson(res, 400, { error: 'missing_provider', message: 'Field provider is required.' }, origin);
    return;
  }
  if (!PROVIDER_IDS.includes(provider)) {
    sendJson(
      res,
      400,
      {
        error: 'unknown_provider',
        message: `Provider "${provider}" is not supported by this relay.`,
      },
      origin,
    );
    return;
  }
  if (typeof targetUrl !== 'string' || !targetUrl) {
    sendJson(res, 400, { error: 'missing_fields', message: 'Field targetUrl is required.' }, origin);
    return;
  }
  if (typeof payload !== 'string' || !payload) {
    sendJson(
      res,
      400,
      { error: 'missing_fields', message: 'Field payload must be a non-empty JSON string.' },
      origin,
    );
    return;
  }

  const resolvedKey = resolveApiKey(provider, apiKey, ctx.env);
  if (!resolvedKey) {
    sendJson(
      res,
      400,
      {
        error: 'missing_api_key',
        message:
          'No API key: send apiKey in the body or set LLM_API_KEY / LLM_API_KEY_<PROVIDER> for the relay.',
      },
      origin,
    );
    return;
  }

  const target = validateTargetUrl(targetUrl, provider, ctx.customHosts);
  if (!target.valid) {
    const status = target.code === 'custom_provider_disabled' ? 403 : 400;
    sendJson(res, status, { error: target.code, message: target.error }, origin);
    return;
  }

  const accept = String(req.headers.accept || '');
  const wantsStream = accept.includes('text/event-stream');
  const headers = buildUpstreamHeaders(provider, resolvedKey.key);
  const startTime = Date.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    try {
      controller.abort();
    } catch {
      // already aborted
    }
  }, ctx.timeoutMs);

  let upstream;
  try {
    upstream = await ctx.fetchImpl(target.url, {
      method: 'POST',
      headers,
      body: payload,
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    sendUpstreamFailure(res, error, origin, ctx, provider);
    return;
  }

  // Streaming passthrough — headers are out, the body is forwarded chunk by
  // chunk. The overall timer is replaced by the idle timer in the pipe.
  if (wantsStream && upstream.ok && upstream.body) {
    clearTimeout(timeoutId);
    ctx.logger.log(
      `[relay] llm provider=${provider} keySource=${resolvedKey.source} streaming_started` +
        ` ms=${Date.now() - startTime}`,
    );
    await pipeStreamingResponse(res, upstream, ctx, provider, origin, startTime);
    return;
  }

  let text;
  try {
    text = await upstream.text();
  } catch (error) {
    clearTimeout(timeoutId);
    sendUpstreamFailure(res, error, origin, ctx, provider);
    return;
  }
  clearTimeout(timeoutId);

  const status = upstream.status;
  const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8';

  if (status === 204 || status === 304) {
    res.writeHead(status, { 'Cache-Control': 'no-store', ...corsHeaders(origin) });
    res.end();
  } else {
    res.writeHead(status, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...corsHeaders(origin),
    });
    res.end(text);
  }

  ctx.logger.log(
    `[relay] llm provider=${provider} keySource=${resolvedKey.source}` +
      ` status=${status} stream=false ms=${Date.now() - startTime}`,
  );
}

// ── /api/models ─────────────────────────────────────────────────────────

/** Providers whose model list is public (no key needed). */
export const PUBLIC_MODEL_LIST_PROVIDERS = Object.freeze(['openrouter']);

/**
 * Forward `GET {provider list endpoint}` and return the provider's JSON as-is.
 * The browser parses it, so the relay never needs a copy of each provider's
 * schema — and the target host is pinned to the declared provider exactly like
 * /api/llm, which keeps this from becoming a general-purpose GET proxy.
 */
async function handleModels(req, res, ctx, origin) {
  const bodyResult = await readBody(req, ctx.maxBodySize);
  if (bodyResult.tooLarge) {
    sendJson(res, 413, payloadTooLarge(ctx.maxBodySize), origin);
    return;
  }
  if (bodyResult.error) {
    sendJson(res, 400, { error: 'invalid_body', message: 'Could not read the request body.' }, origin);
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(bodyResult.text);
  } catch {
    sendJson(res, 400, { error: 'invalid_json', message: 'Request body must be valid JSON.' }, origin);
    return;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    sendJson(res, 400, { error: 'invalid_json', message: 'Request body must be a JSON object.' }, origin);
    return;
  }

  const { provider, apiKey, targetUrl } = parsed;

  if (!provider || typeof provider !== 'string') {
    sendJson(res, 400, { error: 'missing_provider', message: 'Field provider is required.' }, origin);
    return;
  }
  if (!PROVIDER_IDS.includes(provider)) {
    sendJson(res, 400, { error: 'unknown_provider', message: `Provider "${provider}" is not supported by this relay.` }, origin);
    return;
  }
  if (typeof targetUrl !== 'string' || !targetUrl) {
    sendJson(res, 400, { error: 'missing_fields', message: 'Field targetUrl is required.' }, origin);
    return;
  }

  const target = validateTargetUrl(targetUrl, provider, ctx.customHosts);
  if (!target.valid) {
    const status = target.code === 'custom_provider_disabled' ? 403 : 400;
    sendJson(res, status, { error: target.code, message: target.error }, origin);
    return;
  }

  const resolvedKey = resolveApiKey(provider, apiKey, ctx.env);
  const keylessAllowed = PUBLIC_MODEL_LIST_PROVIDERS.includes(provider);
  if (!resolvedKey && !keylessAllowed) {
    sendJson(
      res,
      400,
      {
        error: 'missing_api_key',
        message:
          'No API key: send apiKey in the body or set LLM_API_KEY / LLM_API_KEY_<PROVIDER> for the relay.',
      },
      origin,
    );
    return;
  }

  const headers = resolvedKey ? buildUpstreamHeaders(provider, resolvedKey.key) : { Accept: 'application/json' };
  headers.Accept = 'application/json';
  const startTime = Date.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    try {
      controller.abort();
    } catch {
      // already aborted
    }
  }, ctx.timeoutMs);

  let upstream;
  try {
    upstream = await ctx.fetchImpl(target.url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    sendUpstreamFailure(res, error, origin, ctx, provider);
    return;
  }

  let text;
  try {
    text = await upstream.text();
  } catch (error) {
    clearTimeout(timeoutId);
    sendUpstreamFailure(res, error, origin, ctx, provider);
    return;
  }
  clearTimeout(timeoutId);

  res.writeHead(upstream.status, {
    'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...corsHeaders(origin),
  });
  res.end(text);

  ctx.logger.log(
    `[relay] models provider=${provider} keySource=${resolvedKey ? resolvedKey.source : 'none'}` +
      ` status=${upstream.status} ms=${Date.now() - startTime}`,
  );
}

// ── request routing ─────────────────────────────────────────────────────

async function handleApi(req, res, ctx, method, pathname) {
  const originHeader = req.headers.origin;
  const allowedOrigin = resolveAllowedOrigin(originHeader, ctx.extraOrigins);

  // A browser request from an unknown origin is rejected before any provider
  // request is made. A missing Origin is a non-browser caller (curl, tests).
  if (originHeader && !allowedOrigin) {
    sendJson(
      res,
      403,
      {
        error: 'origin_not_allowed',
        message: 'This relay does not serve requests from that browser origin.',
      },
      null,
    );
    return;
  }

  if (method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(allowedOrigin));
    res.end();
    return;
  }

  if (pathname === '/api/health') {
    if (method !== 'GET') {
      sendJson(res, 405, { error: 'method_not_allowed' }, allowedOrigin, { Allow: 'GET, OPTIONS' });
      return;
    }
    sendJson(
      res,
      200,
      {
        status: 'ok',
        keyFromEnv: hasAnyEnvKey(ctx.env),
        version: RELAY_VERSION,
        uptime_seconds: Math.round((Date.now() - ctx.startedAt) / 1000),
      },
      allowedOrigin,
    );
    return;
  }

  if (pathname === '/api/llm') {
    if (method !== 'POST') {
      sendJson(res, 405, { error: 'method_not_allowed' }, allowedOrigin, {
        Allow: 'POST, OPTIONS',
      });
      return;
    }
    await handleLlm(req, res, ctx, allowedOrigin);
    return;
  }

  if (pathname === '/api/models') {
    if (method !== 'POST') {
      sendJson(res, 405, { error: 'method_not_allowed' }, allowedOrigin, {
        Allow: 'POST, OPTIONS',
      });
      return;
    }
    await handleModels(req, res, ctx, allowedOrigin);
    return;
  }

  sendJson(res, 404, { error: 'not_found' }, allowedOrigin);
}

async function handleRequest(req, res, ctx) {
  const method = (req.method || 'GET').toUpperCase();
  const headers = req.headers || {};

  if (!hostHeaderAllowed(headers.host)) {
    sendJson(
      res,
      403,
      {
        error: 'host_not_allowed',
        message: 'This relay only accepts requests addressed to localhost / 127.0.0.1.',
      },
      null,
    );
    return;
  }

  let pathname;
  try {
    pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;
  } catch {
    sendJson(res, 400, { error: 'invalid_url' }, null);
    return;
  }

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    await handleApi(req, res, ctx, method, pathname);
    return;
  }

  await handleStatic(req, res, ctx);
}

/**
 * Build the relay request handler.
 *
 * @param {object} [options]
 * @param {string} [options.rootDir] static export directory (default `out/`)
 * @param {NodeJS.ProcessEnv|Record<string,string>} [options.env] env source (default process.env)
 * @param {typeof fetch} [options.fetchImpl] fetch implementation (tests inject a stub)
 * @param {{log:Function,warn:Function,error:Function}} [options.logger] log sink
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void>}
 */
export function createRelayHandler(options = {}) {
  const env = options.env || process.env;
  const rootDir = path.resolve(options.rootDir || DEFAULT_ROOT_DIR);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const logger = options.logger || console;

  const ctx = {
    env,
    rootDir,
    maxBodySize: readEnvInt(env, 'MAX_BODY_SIZE_BYTES', DEFAULT_MAX_BODY_SIZE_BYTES),
    timeoutMs: readEnvInt(env, 'PROVIDER_TIMEOUT_MS', PROVIDER_TIMEOUT_MS),
    extraOrigins: parseCsv(env.ALLOWED_ORIGINS),
    customHosts: parseCsv(env.ALLOWED_CUSTOM_HOSTS).map((host) => host.toLowerCase()),
    fetchImpl,
    logger,
    startedAt: Date.now(),
  };

  return function relayHandler(req, res) {
    return handleRequest(req, res, ctx);
  };
}

/**
 * Build an http.Server around the relay handler (not listening yet).
 * The CLI binds it to 127.0.0.1; tests may listen on port 0.
 */
export function createRelayServer(options = {}) {
  return http.createServer(createRelayHandler(options));
}

/**
 * Start the relay on 127.0.0.1 (loopback only — never 0.0.0.0).
 * Resolves to `{ server, port, url, rootDir }`.
 */
export async function startRelay(options = {}) {
  const port = options.port === undefined ? DEFAULT_PORT : options.port;
  const rootDir = path.resolve(options.dir || DEFAULT_ROOT_DIR);
  const server = createRelayServer({ ...options, rootDir });
  await new Promise((resolve, reject) => {
    const onError = (error) => {
      server.removeListener('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.removeListener('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, '127.0.0.1');
  });
  const address = server.address();
  const boundPort = address && typeof address === 'object' ? address.port : port;
  return { server, port: boundPort, url: `http://127.0.0.1:${boundPort}`, rootDir };
}

// ── CLI ─────────────────────────────────────────────────────────────────

function parsePort(raw) {
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid --port value: ${raw}`);
  }
  return port;
}

/** Parse CLI args: `[--port 8787] [--dir out]`, `--port=8787`, `--help`. */
export function parseArgs(argv) {
  const result = { port: DEFAULT_PORT, dir: DEFAULT_ROOT_DIR, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--port' || arg === '-p') {
      result.port = parsePort(argv[i + 1]);
      i += 1;
    } else if (arg.startsWith('--port=')) {
      result.port = parsePort(arg.slice('--port='.length));
    } else if (arg === '--dir' || arg === '-d') {
      result.dir = argv[i + 1] || DEFAULT_ROOT_DIR;
      i += 1;
    } else if (arg.startsWith('--dir=')) {
      result.dir = arg.slice('--dir='.length) || DEFAULT_ROOT_DIR;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return result;
}

const USAGE = `Usage: node relay/relay.mjs [--port 8787] [--dir out]

Serves the Next.js static export and proxies POST /api/llm to LLM providers.
POST /api/models forwards a provider's GET model-list call (same host pinning).

Options:
  --port, -p <port>  loopback port to listen on (default ${DEFAULT_PORT})
  --dir, -d <path>   static export directory (default ${DEFAULT_ROOT_DIR})
  --help, -h         show this help

Env:
  LLM_API_KEY                key injected server-side (overrides body apiKey)
  LLM_API_KEY_<PROVIDER>     per-provider key (e.g. LLM_API_KEY_OPENAI)
  ALLOWED_CUSTOM_HOSTS       comma-separated hosts allowed for provider=custom
  ALLOWED_ORIGINS            extra browser origins allowed to call /api/llm
  MAX_BODY_SIZE_BYTES        request body limit (default ${DEFAULT_MAX_BODY_SIZE_BYTES})
  PROVIDER_TIMEOUT_MS        upstream timeout (default ${PROVIDER_TIMEOUT_MS})`;

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`[relay] ${error.message}`);
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }
  if (args.help) {
    console.log(USAGE);
    return;
  }

  const dir = path.resolve(args.dir);
  const { server, url, rootDir } = await startRelay({ port: args.port, dir });
  console.log(`[relay] ${RELAY_VERSION} listening on ${url}`);
  console.log(`[relay] static root: ${rootDir}`);
  console.log(`[relay] LLM_API_KEY from env: ${hasAnyEnvKey(process.env) ? 'yes' : 'no'}`);
  if (!(await isFile(path.join(rootDir, 'index.html')))) {
    console.warn(
      `[relay] warning: ${rootDir} has no index.html — build first: node .\\node_modules\\next\\dist\\bin\\next build`,
    );
  }

  const shutdown = () => {
    console.log('[relay] shutting down');
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// ── entry point ─────────────────────────────────────────────────────────

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]).toLowerCase() : '';
const modulePath = fileURLToPath(import.meta.url).toLowerCase();
if (invokedPath && invokedPath === modulePath) {
  main().catch((error) => {
    console.error(`[relay] fatal: ${error && error.message ? error.message : error}`);
    process.exitCode = 1;
  });
}
