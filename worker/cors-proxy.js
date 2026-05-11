// Cloudflare Worker: Provider-aware CORS proxy for LLM API calls
// No storage. No API keys stored.
// Pass-through proxy with provider routing.
//
// v2: Added server-side 429 retry with exponential backoff (2 retries).
// v3: Added X-No-Retry header support — test connections can skip retries
//     for instant feedback instead of waiting through multiple retry cycles.
// v4: Added rate limiting by IP, body size limit, targetUrl validation,
//     explicit timeout with AbortController, health-check endpoint,
//     improved error handling with user-friendly messages, masked API key logging.
// v5: Fixed env variable handling — now reads config from wrangler.toml [vars]
//     via the `env` parameter instead of hardcoded constants that shadowed them.
//     Fixed PROVIDER_TIMEOUT_MS default (25s for free plan compatibility).
//     Fixed MAX_BODY_SIZE_BYTES naming mismatch with wrangler.toml.

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
          'anthropic-version': '2024-10-22',  // Updated from 2023-06-01 for claude-sonnet-4-6+ support (extended thinking, etc.)
        },
        body: parsed.payload,
      };
    },
  },
  google: {
    transformRequest: ({ body, apiKey }) => {
      const parsed = JSON.parse(body);
      // Google passes API key in query string, not header
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

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Z-AI-From, X-No-Retry, Accept, x-api-key, anthropic-version',
  'Access-Control-Max-Age': '86400',
};

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
// The Worker stays alive as long as the client is connected. The 10ms CPU time
// limit does NOT apply to I/O wait (fetch, stream reading) — proxy requests
// are overwhelmingly I/O, not CPU. Setting this to 300s (5 minutes) allows
// even the slowest free-tier models (e.g. nvidia/nemotron on OpenRouter) to
// respond without the proxy killing the connection prematurely.
const DEFAULT_PROVIDER_TIMEOUT_MS = 300_000;

// Timeout for streaming requests before we consider the upstream unresponsive.
// Same rationale as PROVIDER_TIMEOUT_MS — no hard wall-clock limit on free plan.
// Once the upstream sends headers (200 OK + Content-Type: text/event-stream),
// the HTTP connection is established and Cloudflare will not kill the Worker.
// 300s gives streaming models ample time even with slow token generation.
const DEFAULT_STREAMING_TIMEOUT_MS = 300_000;

// Known provider domains for targetUrl validation
const KNOWN_PROVIDER_DOMAINS = [
  'api.openai.com', 'api.anthropic.com', 'generativelanguage.googleapis.com',
  'api.mistral.ai', 'api.deepseek.com', 'dashscope.aliyuncs.com',
  'api.moonshot.cn', 'api.groq.com', 'openrouter.ai',
  'api-inference.huggingface.co', 'api.together.xyz', 'api.x.ai', 'api.z.ai'
];

// Proxy version for health-check
const PROXY_VERSION = 'v8';

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

/**
 * Mask an API key for safe logging: show first 4 and last 4 chars only.
 * Short keys (<12 chars) are fully masked.
 */
function maskApiKey(key) {
  if (!key || typeof key !== 'string') return '***';
  if (key.length < 12) return '***masked***';
  return key.slice(0, 4) + '***' + key.slice(-4);
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
 * Validate the targetUrl: must be https://, and domain must be a known
 * provider or any custom URL (user consciously entered it).
 */
function validateTargetUrl(targetUrl) {
  if (!targetUrl || typeof targetUrl !== 'string') {
    return { valid: false, error: 'targetUrl is required' };
  }

  if (!targetUrl.startsWith('https://')) {
    return { valid: false, error: 'targetUrl must start with https://' };
  }

  try {
    const url = new URL(targetUrl);
    const hostname = url.hostname;

    // Check if it's a known provider domain
    const isKnownProvider = KNOWN_PROVIDER_DOMAINS.some(domain => {
      return hostname === domain || hostname.endsWith('.' + domain);
    });

    // For unknown domains, still allow (custom provider) — user knows what they're doing
    if (!isKnownProvider) {
      // Just log it — don't block
      console.log(`[Proxy] Custom targetUrl domain: ${hostname}`);
    }

    return { valid: true };
  } catch (e) {
    return { valid: false, error: `Invalid targetUrl: ${e.message}` };
  }
}

/**
 * Attempt a fetch with automatic retry for 429 rate limits and 5xx transient errors.
 * Returns the final Response object (may still be 429/5xx if all retries exhausted).
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
        return new Response(bodyText, {
          status: 429,
          headers: lastResponse.headers,
        });
      }

      // If 429 retries exhausted, return the 429 response
      if (attempt429 >= max429Retries) {
        return new Response(bodyText, {
          status: lastResponse.status,
          headers: lastResponse.headers,
        });
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

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // Health-check endpoint — GET /health
    if (request.method === 'GET') {
      const url = new URL(request.url);
      if (url.pathname === '/health') {
        const uptime = Math.round((Date.now() - PROXY_START_TIME) / 1000);
        return new Response(
          JSON.stringify({
            status: 'ok',
            version: PROXY_VERSION,
            uptime_seconds: uptime,
            config: {
              maxRequestsPerMinute,
              maxBodySizeMB: Math.round(maxBodySize / (1024 * 1024)),
              providerTimeoutMs,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
        );
      }
      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
    }

    // Only allow POST
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
    }

    // ── Rate limiting by IP ──────────────────────────────────────────
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!checkRateLimit(clientIp, maxRequestsPerMinute)) {
      const retryAfter = 60; // seconds
      return new Response(
        JSON.stringify({
          error: 'rate_limit',
          message: 'Слишком много запросов. Подождите минуту и попробуйте снова.',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfter),
            ...CORS_HEADERS,
          },
        }
      );
    }

    // ── Body size check ──────────────────────────────────────────────
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > maxBodySize) {
      return new Response(
        JSON.stringify({
          error: 'payload_too_large',
          message: 'Слишком большой запрос (максимум 2MB). Текст будет разбит на части автоматически (chunking).',
        }),
        { status: 413, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      );
    }

    // Check if client wants to skip server-side 429 retries (e.g. for test connections)
    const skipRetry = request.headers.get('X-No-Retry') === 'true';

    // Check if this is a streaming request
    const isStreaming = request.headers.get('Accept') === 'text/event-stream';

    const startTime = Date.now();

    try {
      // Parse the proxy request body
      const { provider, apiKey, targetUrl, payload } = await request.json();

      if (!apiKey || !targetUrl || !payload) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: apiKey, targetUrl, payload' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
        );
      }

      // ── Validate targetUrl ───────────────────────────────────────
      const urlValidation = validateTargetUrl(targetUrl);
      if (!urlValidation.valid) {
        return new Response(
          JSON.stringify({ error: 'invalid_target_url', message: urlValidation.error }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
        );
      }

      // Select provider config (default to openai-compatible)
      const config = PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS.openai;
      const transformed = config.transformRequest({
        body: JSON.stringify({ targetUrl, payload }),
        apiKey,
      });

      // ── Build fetch options with timeout ──────────────────────────
      const fetchOptions = {
        method: 'POST',
        headers: transformed.headers,
        body: transformed.body,
      };

      // For buffered (non-streaming) requests, add explicit timeout
      // For streaming requests, no timeout — Worker stays alive while data flows
      let controller = null;
      if (!isStreaming) {
        controller = new AbortController();
        fetchOptions.signal = controller.signal;
      }

      // Forward to target — with or without retry based on X-No-Retry header
      const max429Retries = skipRetry ? 0 : MAX_429_RETRIES;
      const max5xxRetries = skipRetry ? 0 : MAX_5XX_RETRIES;

      let response;
      let timeoutId = null;

      try {
        if (controller) {
          timeoutId = setTimeout(() => controller.abort(), providerTimeoutMs);
        }

        response = await fetchWithRetry(transformed.targetUrl, fetchOptions, max429Retries, max5xxRetries, provider);
      } catch (fetchError) {
        if (timeoutId) clearTimeout(timeoutId);

        // Handle AbortError (timeout)
        if (fetchError.name === 'AbortError') {
          console.error(
            `[Proxy Timeout] Provider ${provider} did not respond within ${providerTimeoutMs}ms — key: ${maskApiKey(apiKey)}`
          );
          return new Response(
            JSON.stringify({
              error: 'timeout',
              message: `Провайдер не ответил за ${Math.round(providerTimeoutMs / 1000)} секунд. Попробуйте ещё раз или выберите другую модель.`,
            }),
            { status: 504, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
          );
        }

        // Handle DNS/Network errors (TypeError: fetch failed)
        if (fetchError instanceof TypeError && fetchError.message.includes('fetch failed')) {
          console.error(`[Proxy Network] Cannot connect to provider ${provider} — key: ${maskApiKey(apiKey)}`);
          return new Response(
            JSON.stringify({
              error: 'network',
              message: 'Не удалось подключиться к провайдеру. Проверьте URL API и доступность сервиса.',
            }),
            { status: 502, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
          );
        }

        // Unknown fetch error
        console.error(`[Proxy Error] ${fetchError.message} — provider: ${provider}, key: ${maskApiKey(apiKey)}`);
        throw fetchError;
      }

      if (timeoutId) clearTimeout(timeoutId);

      // ── Streaming passthrough ─────────────────────────────────────
      if (isStreaming && response.ok && response.body) {
        const elapsedMs = Date.now() - startTime;

        // BUGFIX: Preserve upstream Content-Type instead of always forcing
        // text/event-stream. Some providers return buffered JSON even with
        // stream:true, and forcing text/event-stream causes the client-side
        // SSE parser to fail (it tries to parse JSON as SSE → empty text).
        const upstreamContentType = response.headers.get('Content-Type') || '';
        const isActuallySSE = upstreamContentType.includes('text/event-stream');

        console.log(`[Proxy Stream] ${provider} — streaming started in ${elapsedMs}ms (upstream CT: ${upstreamContentType || 'unknown'}) — key: ${maskApiKey(apiKey)}`);

        // v7 BUGFIX: Add streaming timeout so we can send a graceful error
        // event if the upstream stops sending data. Cloudflare Workers free plan
        // has NO hard wall-clock limit — the Worker stays alive while data flows.
        // This timeout is a safety net for unresponsive upstreams, not a platform
        // limit. When it fires, we inject an SSE error event into the stream.
        let streamTimedOut = false;
        const streamTimeoutId = setTimeout(() => {
          streamTimedOut = true;
          console.warn(`[Proxy Stream] Streaming timeout (${streamingTimeoutMs}ms) — upstream ${provider} did not finish — key: ${maskApiKey(apiKey)}`);
        }, streamingTimeoutMs);

        // Create a TransformStream to inject timeout error event
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const reader = response.body.getReader();

        // Pipe the upstream response through our transform
        // If timeout fires, inject an error SSE event
        (async () => {
          try {
            while (true) {
              if (streamTimedOut) {
                // Inject timeout error as SSE event before closing
                const timeoutEvent = `event: error\ndata: ${JSON.stringify({
                  error: 'stream_timeout',
                  message: `Стриминг прерван: провайдер не ответил за ${Math.round(streamingTimeoutMs / 1000)} секунд. Попробуйте более быструю модель или уменьшите текст.`,
                })}\n\n`;
                await writer.write(new TextEncoder().encode(timeoutEvent));
                break;
              }
              const { done, value } = await reader.read();
              if (done) break;
              await writer.write(value);
            }
          } catch (pipeError) {
            // Upstream stream was closed or errored
            console.warn(`[Proxy Stream] Pipe error: ${pipeError.message || pipeError}`);
          } finally {
            clearTimeout(streamTimeoutId);
            try { await writer.close(); } catch { /* already closed */ }
            try { reader.releaseLock(); } catch { /* already released */ }
          }
        })();

        // Pass through the transformed ReadableStream
        const streamHeaders = {
          'Content-Type': isActuallySSE ? 'text/event-stream' : upstreamContentType || 'application/json',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          ...CORS_HEADERS,
        };

        return new Response(readable, {
          status: response.status,
          headers: streamHeaders,
        });
      }

      // ── Streaming request but upstream returned an error ──────────────
      if (isStreaming && !response.ok) {
        // For streaming requests that got an error, return the error immediately
        // without buffering the full body. Error bodies are typically small.
        const errorBody = await response.text();
        const rewritten = rewrite429IfModelNotFound(response.status, errorBody, provider);

        const elapsedMs = Date.now() - startTime;
        console.warn(
          `[Proxy Stream] ${provider} → ${rewritten.status} (upstream error) in ${elapsedMs}ms — key: ${maskApiKey(apiKey)}`
        );

        return new Response(rewritten.body, {
          status: rewritten.status,
          headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS,
          },
        });
      }

      // ── Buffered response (existing logic) ────────────────────────
      // Return with CORS headers
      const responseData = await response.text();

      // Rewrite 429 → 400 if the body indicates a missing/deprecated model
      const rewritten = rewrite429IfModelNotFound(response.status, responseData, provider);

      // Build response headers — preserve content-type and add CORS
      const responseHeaders = {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
        ...CORS_HEADERS,
      };

      // If 429 or 5xx, add a helpful header so the client knows the proxy already retried
      if (rewritten.status === 429 || isTransient5xx(rewritten.status)) {
        responseHeaders['X-Proxy-Retried'] = String(skipRetry ? 0 : (rewritten.status === 429 ? MAX_429_RETRIES : MAX_5XX_RETRIES));
      }

      // Logging
      const elapsedMs = Date.now() - startTime;
      const logLevel = rewritten.status >= 400 ? 'warn' : 'log';
      console[logLevel](
        `[Proxy] ${provider} → ${rewritten.status} in ${elapsedMs}ms — key: ${maskApiKey(apiKey)}`
      );

      return new Response(rewritten.body, {
        status: rewritten.status,
        headers: responseHeaders,
      });
    } catch (error) {
      const elapsedMs = Date.now() - startTime;
      console.error(`[Proxy Error] ${error.message} in ${elapsedMs}ms`);
      return new Response(
        JSON.stringify({
          error: 'proxy_error',
          message: 'Внутренняя ошибка прокси. Попробуйте ещё раз или проверьте настройки.',
          details: String(error),
        }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      );
    }
  },
};
