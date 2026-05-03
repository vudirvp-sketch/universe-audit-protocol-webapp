// Cloudflare Worker: Provider-aware CORS proxy for LLM API calls
// No storage. No logging. No API keys stored.
// Pass-through proxy with provider routing.
//
// v2: Added server-side 429 retry with exponential backoff (2 retries).
// v3: Added X-No-Retry header support — test connections can skip retries
//     for instant feedback instead of waiting through multiple retry cycles.

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
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Z-AI-From, X-No-Retry, x-api-key, anthropic-version',
  'Access-Control-Max-Age': '86400',
};

// Server-side retry configuration for transient errors (429 + 5xx)
// Total max wait for 429: 3s + 9s = 12s
// Total max wait for 5xx: 2s + 5s = 7s
// All within 30s Worker timeout
const MAX_429_RETRIES = 2;
const RETRY_BACKOFF_MS = [3000, 9000]; // 3s, 9s
const MAX_5XX_RETRIES = 2;
const RETRY_5XX_BACKOFF_MS = [2000, 5000]; // 2s, 5s

/**
 * Sleep for the specified number of milliseconds.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if a 429 response body indicates a model-not-found or deprecated-model
 * error. Returns true if the 429 is actually a model error (not rate limit).
 * @param {string} body - Response body text
 * @param {string} provider - Provider identifier
 * @returns {boolean}
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
 * 503 = Service Unavailable (model overloaded, usually temporary)
 * 502 = Bad Gateway (upstream timeout, usually temporary)
 * @param {number} status - HTTP status code
 * @returns {boolean}
 */
function isTransient5xx(status) {
  return status === 503 || status === 502;
}

/**
 * Attempt a fetch with automatic retry for 429 rate limits and 5xx transient errors.
 * Returns the final Response object (may still be 429/5xx if all retries exhausted).
 * Skips 429 retries if the body indicates a model-not-found error.
 * For 5xx errors, retries with exponential backoff since they are typically temporary.
 * @param {string} url - Target URL
 * @param {RequestInit} options - Fetch options
 * @param {number} max429Retries - Maximum number of 429 retries (default: MAX_429_RETRIES)
 * @param {number} max5xxRetries - Maximum number of 5xx retries (default: MAX_5XX_RETRIES)
 * @param {string} provider - Provider identifier (for 429 body inspection)
 */
async function fetchWithRetry(url, options, max429Retries = MAX_429_RETRIES, max5xxRetries = MAX_5XX_RETRIES, provider = '') {
  let lastResponse = null;
  let retry5xxAttempt = 0;

  for (let attempt429 = 0; ; attempt429++) {
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
 * Check if a 429 response body indicates a model-not-found or deprecated-model
 * error rather than a genuine rate limit. Google Gemini API returns 429 with
 * a body like {"error":{"code":429,"message":"...model not found..."}} when
 * the requested model does not exist or has been sunset. We convert this to
 * 400 (Bad Request) so the client does not retry indefinitely.
 *
 * @param {number} status - HTTP status of the upstream response
 * @param {string} body - Response body text from upstream
 * @param {string} provider - Provider identifier (e.g. 'google')
 * @returns {{ status: number, body: string }} - Possibly rewritten status/body
 */
function rewrite429IfModelNotFound(status, body, provider) {
  if (status !== 429) return { status, body };

  // Only Google is known to return 429 for missing models
  if (provider !== 'google') return { status, body };

  try {
    const parsed = JSON.parse(body);
    const msg = (parsed?.error?.message || '').toLowerCase();
    // Google error patterns for missing/deprecated models
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

    // Only allow POST
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Check if client wants to skip server-side 429 retries (e.g. for test connections)
    const skipRetry = request.headers.get('X-No-Retry') === 'true';

    try {
      // Parse the proxy request body
      const { provider, apiKey, targetUrl, payload } = await request.json();

      if (!apiKey || !targetUrl || !payload) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: apiKey, targetUrl, payload' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
        );
      }

      // Select provider config (default to openai-compatible)
      const config = PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS.openai;
      const transformed = config.transformRequest({
        body: JSON.stringify({ targetUrl, payload }),
        apiKey,
      });

      // Forward to target — with or without retry based on X-No-Retry header
      const max429Retries = skipRetry ? 0 : MAX_429_RETRIES;
      const max5xxRetries = skipRetry ? 0 : MAX_5XX_RETRIES;
      const response = await fetchWithRetry(transformed.targetUrl, {
        method: 'POST',
        headers: transformed.headers,
        body: transformed.body,
      }, max429Retries, max5xxRetries, provider);

      // Return with CORS headers
      const responseData = await response.text();

      // Rewrite 429 → 400 if the body indicates a missing/deprecated model
      // rather than a genuine rate limit (Google-specific quirk)
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

      return new Response(rewritten.body, {
        status: rewritten.status,
        headers: responseHeaders,
      });
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Proxy request failed', details: String(error) }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      );
    }
  },
};
