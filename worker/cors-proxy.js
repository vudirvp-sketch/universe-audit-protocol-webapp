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

const PROVIDER_CONFIGS = {
  openai: {
    // OpenAI, DeepSeek, Groq, OpenRouter, Mistral, etc.
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
  anthropic: {
    transformRequest: ({ body, apiKey }) => {
      const parsed = JSON.parse(body);
      return {
        targetUrl: parsed.targetUrl,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
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

// Rate limiting: max requests per minute per IP
const MAX_REQUESTS_PER_MINUTE = 60;
const ipRateLimitMap = new Map(); // IP → { count, resetAt }

// Body size limit: 2MB
const MAX_BODY_SIZE = 2 * 1024 * 1024;

// Timeout for buffered (non-streaming) requests to provider.
// IMPORTANT: Cloudflare Workers (free plan) have a 30-second wall-clock limit.
// If you're on the paid Workers Unbound plan, you can increase this to 90+ seconds.
// Set the PROVIDER_TIMEOUT_MS environment variable to override.
const DEFAULT_PROVIDER_TIMEOUT_MS = 55_000; // 55 seconds (leaves margin for Worker overhead)
const PROVIDER_TIMEOUT_MS = parseInt(typeof PROVIDER_TIMEOUT_ENV !== 'undefined' ? PROVIDER_TIMEOUT_ENV : '', 10) || DEFAULT_PROVIDER_TIMEOUT_MS;

// Known provider domains for targetUrl validation
const KNOWN_PROVIDER_DOMAINS = [
  'api.openai.com', 'api.anthropic.com', 'generativelanguage.googleapis.com',
  'api.mistral.ai', 'api.deepseek.com', 'dashscope.aliyuncs.com',
  'api.moonshot.cn', 'api.groq.com', 'openrouter.ai',
  'api-inference.huggingface.co', 'api.together.xyz', 'api.x.ai', 'api.z.ai'
];

// Proxy version for health-check
const PROXY_VERSION = 'v4';

// Proxy start time for uptime calculation
const PROXY_START_TIME = Date.now();

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
function checkRateLimit(ip) {
  // Periodic cleanup to prevent memory leak
  if (ipRateLimitMap.size > 1000) pruneExpiredRateLimits();
  const now = Date.now();
  const entry = ipRateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    // New window
    ipRateLimitMap.set(ip, { count: 1, resetAt: now + 60000 });
    return true;
  }

  if (entry.count >= MAX_REQUESTS_PER_MINUTE) {
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

export default {
  async fetch(request) {
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
          JSON.stringify({ status: 'ok', version: PROXY_VERSION, uptime_seconds: uptime }),
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
    if (!checkRateLimit(clientIp)) {
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
    if (contentLength && parseInt(contentLength) > MAX_BODY_SIZE) {
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
          timeoutId = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
        }

        response = await fetchWithRetry(transformed.targetUrl, fetchOptions, max429Retries, max5xxRetries, provider);
      } catch (fetchError) {
        if (timeoutId) clearTimeout(timeoutId);

        // Handle AbortError (timeout)
        if (fetchError.name === 'AbortError') {
          console.error(`[Proxy Timeout] Provider ${provider} did not respond within ${PROVIDER_TIMEOUT_MS}ms — key: ${maskApiKey(apiKey)}`);
          return new Response(
            JSON.stringify({
              error: 'timeout',
              message: 'Провайдер не ответил за 25 секунд. Попробуйте ещё раз или выберите другую модель.',
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
        console.log(`[Proxy Stream] ${provider} — streaming started in ${elapsedMs}ms — key: ${maskApiKey(apiKey)}`);

        // Pass through the ReadableStream without buffering
        const streamHeaders = {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          ...CORS_HEADERS,
        };

        return new Response(response.body, {
          status: response.status,
          headers: streamHeaders,
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
