// Cloudflare Worker: Provider-aware CORS proxy for LLM API calls.
// No storage. The API key is only held in memory while a request is in flight.
// Pass-through proxy with provider routing.
//
// v2: server-side 429 retry with exponential backoff (2 retries).
// v3: X-No-Retry header support — test connections can skip retries.
// v4: rate limiting by IP, body size limit, targetUrl validation,
//     explicit timeout with AbortController, health-check endpoint.
// v5: read config from wrangler.toml [vars] via the `env` parameter.
// v7: streaming idle timeout injects a graceful SSE error event.
// v8: streaming passthrough preserves the upstream Content-Type.
// v9 SECURITY HARDENING (this version):
//   - CORS is no longer `*`: only allowlisted app origins are echoed back.
//     Other origins are rejected before any provider request is made.
//   - targetUrl is no longer "any https host": every request must target the
//     provider it declares (`provider` → fixed host allowlist). Custom
//     endpoints are allowed only for hosts explicitly listed in the
//     ALLOWED_CUSTOM_HOSTS env var. This closes the open-relay / SSRF use of
//     this Worker.
//   - Body size is enforced on the actual received bytes, not only on the
//     client-supplied Content-Length header.
//   - Streaming stall timeout now fires even when the upstream sends nothing
//     (previously the timeout flag was only noticed after a chunk arrived).
//   - The API key is never written to logs in any form (was masked before).
//   - Upstream hop-by-hop/encoding headers are not copied onto proxied
//     responses; error bodies are returned with a clean Content-Type.
//
// Config via wrangler.toml [vars] (all optional):
//   MAX_REQUESTS_PER_MINUTE, MAX_BODY_SIZE_BYTES,
//   PROVIDER_TIMEOUT_MS, PROVIDER_STREAMING_TIMEOUT_MS,
//   ALLOWED_ORIGINS (comma-separated browser origins),
//   ALLOWED_CUSTOM_HOSTS (comma-separated hostnames for provider=custom).

const PROVIDER_CONFIGS = {
  openai: {
    // OpenAI, DeepSeek, Groq, Mistral, Together, xAI, Z.AI, Qwen, Kimi
    // All use: Authorization header + /v1/chat/completions
    transformRequest: ({ body, apiKey }) => {
      const parsed = JSON.parse(body);
      return {
        targetUrl: parsed.targetUrl,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: parsed.payload,
      };
    },
  },
  openrouter: {
    // OpenRouter uses Authorization header + requires HTTP-Referer and X-Title
    transformRequest: ({ body, apiKey }) => {
      const parsed = JSON.parse(body);
      return {
        targetUrl: parsed.targetUrl,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://universe-audit-protocol.pages.dev',
          'X-Title': 'Universe Audit Protocol',
        },
        body: parsed.payload,
      };
    },
  },
  anthropic: {
    transformRequest: ({ body, apiKey }) => {
      const parsed = JSON.parse(body);
      return {
        targetUrl: parsed.targetUrl,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2024-10-22',  // required for claude-sonnet-4-6+ (extended thinking, etc.)
        },
        body: parsed.payload,
      };
    },
  },
  google: {
    transformRequest: ({ body, apiKey }) => {
      const parsed = JSON.parse(body);
      // Google passes the API key in the query string, not a header
      const url = new URL(parsed.targetUrl);
      url.searchParams.set('key', apiKey);
      return {
        targetUrl: url.toString(),
        headers: { 'Content-Type': 'application/json' },
        body: parsed.payload,
      };
    },
  },
};

/**
 * Every known provider may only be called on its own API host.
 * Anything else is rejected — the proxy is not a general-purpose relay.
 */
const PROVIDER_HOSTS = {
  openai: ['api.openai.com'],
  anthropic: ['api.anthropic.com'],
  google: ['generativelanguage.googleapis.com'],
  mistral: ['api.mistral.ai'],
  deepseek: ['api.deepseek.com'],
  qwen: ['dashscope.aliyuncs.com'],
  kimi: ['api.moonshot.cn'],
  groq: ['api.groq.com'],
  openrouter: ['openrouter.ai'],
  huggingface: ['api-inference.huggingface.co'],
  together: ['api.together.xyz'],
  xai: ['api.x.ai'],
  zai: ['api.z.ai'],
};

// Browser origins allowed to call this proxy. Preview deployments
// (<hash>.universe-audit-protocol.pages.dev) are matched by pattern when the
// operator has not configured an explicit list.
const DEFAULT_ALLOWED_ORIGINS = [
  'https://universe-audit-protocol.pages.dev',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];
const PAGES_PREVIEW_ORIGIN_RE = /^https:\/\/[a-z0-9-]+\.universe-audit-protocol\.pages\.dev$/;

const CORS_ALLOW_METHODS = 'POST, OPTIONS';
const CORS_ALLOW_HEADERS = 'Content-Type, Accept, X-No-Retry';

// Server-side retry configuration for transient errors (429 + 5xx)
const MAX_429_RETRIES = 2;
const RETRY_BACKOFF_MS = [3000, 9000]; // 3s, 9s
const MAX_5XX_RETRIES = 2;
const RETRY_5XX_BACKOFF_MS = [2000, 5000]; // 2s, 5s

// Default configuration values — can be overridden via wrangler.toml [vars]
const DEFAULT_MAX_REQUESTS_PER_MINUTE = 60;
const DEFAULT_MAX_BODY_SIZE = 2 * 1024 * 1024; // 2MB

// Timeout for buffered (non-streaming) requests to provider.
// Cloudflare Workers free plan has NO hard wall-clock timeout for HTTP requests.
// The 10ms CPU time limit does NOT apply to I/O wait (fetch, stream reading).
const DEFAULT_PROVIDER_TIMEOUT_MS = 300_000;

// Maximum time between two bytes of a streaming response. If the upstream goes
// silent for this long, the proxy aborts it and (for SSE) injects an error event.
const DEFAULT_STREAMING_TIMEOUT_MS = 300_000;

// Proxy version for health-check
const PROXY_VERSION = 'v9';

// Proxy start time for uptime calculation
const PROXY_START_TIME = Date.now();

// Rate limiting state (in-memory, per-isolate)
const ipRateLimitMap = new Map(); // IP → { count, resetAt }

/**
 * Sleep for the specified number of milliseconds.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Parse a comma-separated env var into a trimmed, non-empty list. */
function parseCsv(value) {
  if (!value || typeof value !== 'string') return [];
  return value.split(',').map(part => part.trim()).filter(Boolean);
}

/**
 * Resolve the value to echo in Access-Control-Allow-Origin.
 * Returns null when the caller's origin is not allowlisted.
 * A missing Origin header (curl, server-to-server, CI health checks) is not a
 * browser context: it is passed through without CORS headers, but the target
 * host allowlist still applies.
 */
function resolveAllowedOrigin(origin, env) {
  if (!origin) return null;
  const configured = parseCsv(env && env.ALLOWED_ORIGINS);
  const allowlist = configured.length > 0 ? configured : DEFAULT_ALLOWED_ORIGINS;
  if (allowlist.includes(origin)) return origin;
  if (configured.length === 0 && PAGES_PREVIEW_ORIGIN_RE.test(origin)) return origin;
  return null;
}

/**
 * Build the CORS headers for a response. Never returns `*`.
 */
function corsHeaders(origin) {
  const headers = {
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': CORS_ALLOW_METHODS,
    'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS,
    'Access-Control-Max-Age': '86400',
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

/**
 * Build a JSON response with CORS + no-store headers.
 */
function jsonResponse(status, payload, origin, extraHeaders) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(extraHeaders || {}),
      ...corsHeaders(origin),
    },
  });
}

/**
 * Check if a 429 response body indicates a model-not-found or deprecated-model
 * error. Returns true if the 429 is actually a model error (not rate limit).
 */
function is429ModelNotFound(body, provider) {
  if (provider !== 'google') return false;
  try {
    const parsed = JSON.parse(body);
    const msg = (parsed?.error?.message || '').toLowerCase();
    return (
      msg.includes('model not found') ||
      msg.includes('not found for version') ||
      msg.includes('does not exist') ||
      msg.includes('is not available') ||
      msg.includes('has been deprecated') ||
      msg.includes('model is not supported')
    );
  } catch (_) {
    return false;
  }
}

/**
 * Check if an HTTP status is a transient server error worth retrying.
 */
function isTransient5xx(status) {
  return status === 503 || status === 502;
}

/**
 * Check rate limit for a given IP. Returns true if the request is allowed.
 */
function checkRateLimit(ip, maxRequestsPerMinute) {
  // Periodic cleanup to prevent memory leak
  if (ipRateLimitMap.size > 1000) pruneExpiredRateLimits();
  const now = Date.now();
  const entry = ipRateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    // New window
    ipRateLimitMap.set(ip, { count: 1, resetAt: now + 60000 });
    return true;
  }

  if (entry.count >= maxRequestsPerMinute) {
    return false; // Rate limit exceeded
  }

  entry.count++;
  return true;
}

// Prune expired entries to prevent memory leak
function pruneExpiredRateLimits() {
  const now = Date.now();
  for (const [ip, entry] of ipRateLimitMap) {
    if (now > entry.resetAt) {
      ipRateLimitMap.delete(ip);
    }
  }
}

/**
 * Validate the targetUrl against the declared provider.
 *
 * Rules:
 *  - must be https://
 *  - must not contain credentials (user:pass@)
 *  - must not use a non-default port
 *  - for a known provider: hostname must be one of PROVIDER_HOSTS[provider]
 *  - for provider=custom: hostname must be listed in ALLOWED_CUSTOM_HOSTS
 *
 * This is what keeps the Worker from being an open relay: a caller cannot make
 * it POST to an arbitrary host, only to the API host of the provider it claims.
 */
function validateTargetUrl(targetUrl, provider, env) {
  if (!targetUrl || typeof targetUrl !== 'string') {
    return { valid: false, error: 'targetUrl is required' };
  }

  if (!targetUrl.startsWith('https://')) {
    return { valid: false, error: 'targetUrl must start with https://' };
  }

  let url;
  try {
    url = new URL(targetUrl);
  } catch (e) {
    return { valid: false, error: 'Invalid targetUrl' };
  }

  if (url.username || url.password) {
    return { valid: false, error: 'targetUrl must not contain credentials' };
  }
  if (url.port && url.port !== '443') {
    return { valid: false, error: 'targetUrl must use the default https port' };
  }

  const hostname = url.hostname.toLowerCase();

  if (provider === 'custom' || !PROVIDER_HOSTS[provider]) {
    const customHosts = parseCsv(env && env.ALLOWED_CUSTOM_HOSTS);
    if (customHosts.includes(hostname)) {
      return { valid: true };
    }
    return {
      valid: false,
      error:
        'Custom provider endpoints are disabled on this proxy. ' +
        'Deploy your own proxy (see worker/README.md) and set ALLOWED_CUSTOM_HOSTS ' +
        'to the exact hostname, or pick a built-in provider.',
    };
  }

  const allowedHosts = PROVIDER_HOSTS[provider];
  if (!allowedHosts.includes(hostname)) {
    return {
      valid: false,
      error: `targetUrl host "${hostname}" is not the API host of provider "${provider}"`,
    };
  }

  return { valid: true };
}

/**
 * Attempt a fetch with automatic retry for 429 rate limits and 5xx transient errors.
 * Returns the final Response object (may still be 429/5xx if all retries exhausted).
 *
 * Retryable responses are re-wrapped with a clean Content-Type so that a decoded
 * body is never paired with the upstream's Content-Encoding/Content-Length.
 */
async function fetchWithRetry(url, options, max429Retries = MAX_429_RETRIES, max5xxRetries = MAX_5XX_RETRIES, provider = '') {
  let lastResponse = null;
  let retry5xxAttempt = 0;

  let totalAttempts = 0;
  const MAX_TOTAL_ATTEMPTS = max429Retries + max5xxRetries + 2;
  for (let attempt429 = 0; totalAttempts < MAX_TOTAL_ATTEMPTS; attempt429++) {
    totalAttempts++;
    lastResponse = await fetch(url, options);

    // --- Handle 5xx transient errors (503, 502) ---
    if (isTransient5xx(lastResponse.status) && retry5xxAttempt < max5xxRetries) {
      const waitMs = Math.min(RETRY_5XX_BACKOFF_MS[retry5xxAttempt] || 5000, 10000);
      console.warn(`[Proxy 5xx] ${lastResponse.status} from upstream — retry ${retry5xxAttempt + 1}/${max5xxRetries} in ${waitMs}ms`);
      await sleep(waitMs);
      retry5xxAttempt++;
      attempt429--; // Don't count 5xx retries against 429 budget
      continue;
    }

    // --- Handle 429 rate limit ---
    if (lastResponse.status === 429) {
      // Read body to check if this is a model-not-found error disguised as 429
      const bodyText = await lastResponse.text();
      if (is429ModelNotFound(bodyText, provider)) {
        return cleanRetryResponse(lastResponse.status, bodyText);
      }

      // If 429 retries exhausted, return the 429 response
      if (attempt429 >= max429Retries) {
        return cleanRetryResponse(lastResponse.status, bodyText);
      }

      // Determine wait time: prefer Retry-After header, fall back to backoff schedule
      const retryAfterHeader = lastResponse.headers.get('retry-after');
      let waitMs;

      if (retryAfterHeader) {
        const parsed = parseInt(retryAfterHeader, 10);
        if (!isNaN(parsed) && parsed > 0) {
          waitMs = parsed * 1000;
        } else {
          const retryDate = new Date(retryAfterHeader).getTime();
          waitMs = Math.max(1000, retryDate - Date.now());
        }
      } else {
        waitMs = RETRY_BACKOFF_MS[attempt429] || 9000;
      }

      waitMs = Math.min(waitMs, 10000);
      await sleep(waitMs);
      continue;
    }

    // --- Non-retryable status: return immediately ---
    return lastResponse;
  }
}

/**
 * Re-wrap an already-consumed upstream response with a body only, dropping
 * content-encoding/length headers that would no longer describe the bytes.
 */
function cleanRetryResponse(status, bodyText) {
  return new Response(bodyText, {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/**
 * Rewrite 429 → 400 if the body indicates a missing/deprecated model
 * rather than a genuine rate limit (Google-specific quirk).
 */
function rewrite429IfModelNotFound(status, body, provider) {
  if (status !== 429) return { status, body };
  if (provider !== 'google') return { status, body };

  try {
    const parsed = JSON.parse(body);
    const msg = (parsed?.error?.message || '').toLowerCase();
    if (
      msg.includes('model not found') ||
      msg.includes('not found for version') ||
      msg.includes('does not exist') ||
      msg.includes('is not available') ||
      msg.includes('has been deprecated') ||
      msg.includes('model is not supported')
    ) {
      return {
        status: 400,
        body: JSON.stringify({
          error: {
            code: 400,
            message:
              'Модель не найдена или устарела. Проверьте название модели в настройках. ' +
              'Актуальные модели: https://ai.google.dev/gemini-api/docs/models',
            status: 'INVALID_ARGUMENT',
          },
        }),
      };
    }
  } catch (_) {
    // Body is not JSON — leave as-is
  }

  return { status, body };
}

/**
 * Read a numeric env variable with fallback default.
 * Env vars from wrangler.toml [vars] are always strings.
 */
function readEnvInt(env, key, defaultValue) {
  if (env && env[key] !== undefined && env[key] !== null) {
    const parsed = parseInt(env[key], 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return defaultValue;
}

export default {
  async fetch(request, env, ctx) {
    // Read configuration from env (wrangler.toml [vars]) with fallbacks
    const maxRequestsPerMinute = readEnvInt(env, 'MAX_REQUESTS_PER_MINUTE', DEFAULT_MAX_REQUESTS_PER_MINUTE);
    const maxBodySize = readEnvInt(env, 'MAX_BODY_SIZE_BYTES', DEFAULT_MAX_BODY_SIZE);
    const providerTimeoutMs = readEnvInt(env, 'PROVIDER_TIMEOUT_MS', DEFAULT_PROVIDER_TIMEOUT_MS);
    const streamingTimeoutMs = readEnvInt(env, 'PROVIDER_STREAMING_TIMEOUT_MS', DEFAULT_STREAMING_TIMEOUT_MS);

    const origin = request.headers.get('Origin') || '';
    const allowedOrigin = resolveAllowedOrigin(origin, env);

    // ── CORS preflight ──────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      // Reject preflights from origins that are not allowlisted.
      if (origin && !allowedOrigin) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, { headers: corsHeaders(allowedOrigin) });
    }

    // ── Health-check endpoint — GET /health ─────────────────────────
    if (request.method === 'GET') {
      const url = new URL(request.url);
      if (url.pathname === '/health') {
        const uptime = Math.round((Date.now() - PROXY_START_TIME) / 1000);
        return jsonResponse(200, {
          status: 'ok',
          version: PROXY_VERSION,
          uptime_seconds: uptime,
        }, allowedOrigin);
      }
      return new Response('Method not allowed', { status: 405, headers: corsHeaders(allowedOrigin) });
    }

    // Only allow POST
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders(allowedOrigin) });
    }

    // ── Origin check for actual requests ────────────────────────────
    // Browser requests must come from an allowlisted app origin. Requests
    // without an Origin header are not browser-initiated; they still face the
    // provider host allowlist below.
    if (origin && !allowedOrigin) {
      return jsonResponse(403, {
        error: 'origin_not_allowed',
        message:
          'Этот прокси не обслуживает запросы с вашего домена. ' +
          'Добавьте его в ALLOWED_ORIGINS своего прокси (см. worker/README.md).',
      }, null);
    }

    // ── Rate limiting by IP ──────────────────────────────────────────
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!checkRateLimit(clientIp, maxRequestsPerMinute)) {
      return jsonResponse(429, {
        error: 'rate_limit',
        message: 'Слишком много запросов. Подождите минуту и попробуйте снова.',
      }, allowedOrigin, { 'Retry-After': '60' });
    }

    // ── Body size check (header + actual bytes) ─────────────────────
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > maxBodySize) {
      return jsonResponse(413, {
        error: 'payload_too_large',
        message: 'Слишком большой запрос (максимум 2MB). Текст будет разбит на части автоматически (chunking).',
      }, allowedOrigin);
    }

    // Check if client wants to skip server-side 429 retries (e.g. for test connections)
    const skipRetry = request.headers.get('X-No-Retry') === 'true';

    // Check if this is a streaming request
    const isStreaming = request.headers.get('Accept') === 'text/event-stream';

    const startTime = Date.now();

    try {
      // Read the body as text first so the real size can be enforced
      // (Content-Length can be omitted or lie).
      const rawBody = await request.text();
      if (new TextEncoder().encode(rawBody).length > maxBodySize) {
        return jsonResponse(413, {
          error: 'payload_too_large',
          message: 'Слишком большой запрос (максимум 2MB). Текст будет разбит на части автоматически (chunking).',
        }, allowedOrigin);
      }

      let parsedBody;
      try {
        parsedBody = JSON.parse(rawBody);
      } catch (_) {
        return jsonResponse(400, { error: 'invalid_json', message: 'Тело запроса должно быть корректным JSON.' }, allowedOrigin);
      }

      const { provider, apiKey, targetUrl, payload } = parsedBody || {};

      if (!provider || typeof provider !== 'string') {
        return jsonResponse(400, { error: 'missing_provider', message: 'Поле provider обязательно.' }, allowedOrigin);
      }
      if (!apiKey || !targetUrl || !payload) {
        return jsonResponse(400, { error: 'missing_fields', message: 'Missing required fields: apiKey, targetUrl, payload' }, allowedOrigin);
      }
      if (typeof targetUrl !== 'string' || typeof payload !== 'string') {
        return jsonResponse(400, { error: 'invalid_fields', message: 'targetUrl и payload должны быть строками.' }, allowedOrigin);
      }

      // Select provider config. `custom` talks to an OpenAI-compatible endpoint.
      const isKnownProvider = provider === 'custom' || Boolean(PROVIDER_CONFIGS[provider]);
      if (!isKnownProvider) {
        return jsonResponse(400, {
          error: 'unknown_provider',
          message: `Провайдер «${provider}» не поддерживается этим прокси.`,
        }, allowedOrigin);
      }

      // ── Validate targetUrl against the declared provider ─────────
      const urlValidation = validateTargetUrl(targetUrl, provider, env);
      if (!urlValidation.valid) {
        const isCustomDisabled = urlValidation.error.includes('Custom provider endpoints are disabled');
        return jsonResponse(isCustomDisabled ? 403 : 400, {
          error: isCustomDisabled ? 'custom_provider_disabled' : 'invalid_target_url',
          message: urlValidation.error,
        }, allowedOrigin);
      }

      const config = PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS.openai;

      const transformed = config.transformRequest({
        body: JSON.stringify({ targetUrl, payload }),
        apiKey,
      });

      // ── Build fetch options with timeout ──────────────────────────
      const controller = new AbortController();
      const fetchOptions = {
        method: 'POST',
        headers: transformed.headers,
        body: transformed.body,
        signal: controller.signal,
      };

      // Timeout: full response time for buffered requests, idle time between
      // chunks for streaming ones. On expiry the upstream fetch is aborted.
      let timeoutId = setTimeout(() => {
        try { controller.abort(); } catch (_) { /* already aborted */ }
      }, isStreaming ? streamingTimeoutMs : providerTimeoutMs);

      let response;

      try {
        response = await fetchWithRetry(transformed.targetUrl, fetchOptions, skipRetry ? 0 : MAX_429_RETRIES, skipRetry ? 0 : MAX_5XX_RETRIES, provider);
      } catch (fetchError) {
        clearTimeout(timeoutId);

        // Handle AbortError (timeout)
        if (fetchError && fetchError.name === 'AbortError') {
          console.error(`[Proxy Timeout] Provider ${provider} did not respond within ${isStreaming ? streamingTimeoutMs : providerTimeoutMs}ms`);
          return jsonResponse(504, {
            error: 'timeout',
            message: `Провайдер не ответил за ${Math.round(providerTimeoutMs / 1000)} секунд. Попробуйте ещё раз или выберите другую модель.`,
          }, allowedOrigin);
        }

        // Handle DNS/Network errors (TypeError: fetch failed)
        if (fetchError instanceof TypeError) {
          console.error(`[Proxy Network] Cannot connect to provider ${provider}`);
          return jsonResponse(502, {
            error: 'network',
            message: 'Не удалось подключиться к провайдеру. Проверьте URL API и доступность сервиса.',
          }, allowedOrigin);
        }

        // Unknown fetch error — never echo internals (they can contain the key
        // for query-string providers such as Google).
        console.error(`[Proxy Error] provider=${provider} name=${fetchError && fetchError.name}`);
        return jsonResponse(502, {
          error: 'network',
          message: 'Не удалось выполнить запрос к провайдеру. Попробуйте ещё раз.',
        }, allowedOrigin);
      }

      clearTimeout(timeoutId);

      // ── Streaming passthrough ─────────────────────────────────────
      if (isStreaming && response.ok && response.body) {
        const elapsedMs = Date.now() - startTime;
        const upstreamContentType = response.headers.get('Content-Type') || '';
        const isActuallySSE = upstreamContentType.includes('text/event-stream');

        console.log(`[Proxy Stream] ${provider} — streaming started in ${elapsedMs}ms (upstream CT: ${upstreamContentType || 'unknown'})`);

        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const reader = response.body.getReader();
        const encoder = new TextEncoder();

        (async () => {
          let stalled = false;
          try {
            while (true) {
              // Race the read against the idle timeout so a silent upstream
              // cannot hold the stream open forever.
              let idleTimer;
              const outcome = await Promise.race([
                reader.read().then((result) => ({ kind: 'read', result })),
                new Promise((resolve) => {
                  idleTimer = setTimeout(() => resolve({ kind: 'timeout' }), streamingTimeoutMs);
                }),
              ]);
              clearTimeout(idleTimer);

              if (outcome.kind === 'timeout') {
                stalled = true;
                try { reader.cancel(); } catch (_) { /* ignore */ }
                try { controller.abort(); } catch (_) { /* ignore */ }
                break;
              }

              const { done, value } = outcome.result;
              if (done) break;
              await writer.write(value);
            }
          } catch (pipeError) {
            console.warn(`[Proxy Stream] Pipe error: ${pipeError && pipeError.message ? pipeError.message : pipeError}`);
          } finally {
            if (stalled && isActuallySSE) {
              // Inject a graceful SSE error event the client can surface.
              try {
                const timeoutEvent = `event: error\ndata: ${JSON.stringify({
                  error: 'stream_timeout',
                  message: `Стриминг прерван: провайдер не ответил за ${Math.round(streamingTimeoutMs / 1000)} секунд. Попробуйте более быструю модель или уменьшите текст.`,
                })}\n\n`;
                await writer.write(encoder.encode(timeoutEvent));
              } catch (_) { /* writer already closed */ }
            }
            try { await writer.close(); } catch (_) { /* already closed */ }
            try { reader.releaseLock(); } catch (_) { /* already released */ }
          }
        })();

        return new Response(readable, {
          status: response.status,
          headers: {
            'Content-Type': isActuallySSE ? 'text/event-stream' : upstreamContentType || 'application/json',
            'Cache-Control': 'no-cache, no-store',
            'X-Content-Type-Options': 'nosniff',
            ...corsHeaders(allowedOrigin),
          },
        });
      }

      // ── Streaming request but upstream returned an error ──────────
      if (isStreaming && !response.ok) {
        const errorBody = await response.text();
        const rewritten = rewrite429IfModelNotFound(response.status, errorBody, provider);

        console.warn(`[Proxy Stream] ${provider} → ${rewritten.status} (upstream error) in ${Date.now() - startTime}ms`);

        return new Response(rewritten.body, {
          status: rewritten.status,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
            ...corsHeaders(allowedOrigin),
          },
        });
      }

      // ── Buffered response ─────────────────────────────────────────
      const responseData = await response.text();

      // Rewrite 429 → 400 if the body indicates a missing/deprecated model
      const rewritten = rewrite429IfModelNotFound(response.status, responseData, provider);

      const responseHeaders = {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        ...corsHeaders(allowedOrigin),
      };

      // If 429 or 5xx, add a helpful header so the client knows the proxy already retried
      if (rewritten.status === 429 || isTransient5xx(rewritten.status)) {
        responseHeaders['X-Proxy-Retried'] = String(skipRetry ? 0 : (rewritten.status === 429 ? MAX_429_RETRIES : MAX_5XX_RETRIES));
      }

      const elapsedMs = Date.now() - startTime;
      const logLevel = rewritten.status >= 400 ? 'warn' : 'log';
      console[logLevel](`[Proxy] ${provider} → ${rewritten.status} in ${elapsedMs}ms`);

      return new Response(rewritten.body, {
        status: rewritten.status,
        headers: responseHeaders,
      });
    } catch (error) {
      const elapsedMs = Date.now() - startTime;
      // Log the type only — error messages from URL construction can contain
      // the provider API key (Google puts it in the query string).
      console.error(`[Proxy Error] ${error && error.name ? error.name : 'Error'} in ${elapsedMs}ms`);
      return jsonResponse(500, {
        error: 'proxy_error',
        message: 'Внутренняя ошибка прокси. Попробуйте ещё раз или проверьте настройки.',
      }, allowedOrigin);
    }
  },
};
