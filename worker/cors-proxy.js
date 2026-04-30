// Cloudflare Worker: Provider-aware CORS proxy for LLM API calls
// No storage. No logging. No API keys stored.
// Pass-through proxy with provider routing.
//
// v2: Added server-side 429 retry with exponential backoff (2 retries).
// This reduces client round-trips and handles brief provider rate limiting
// transparently without exceeding the 30s Worker timeout.

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
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Z-AI-From, x-api-key, anthropic-version',
  'Access-Control-Max-Age': '86400',
};

// Server-side 429 retry configuration
// Total max wait: 3s + 9s = 12s (well within 30s Worker timeout)
const MAX_429_RETRIES = 2;
const RETRY_BACKOFF_MS = [3000, 9000]; // 3s, 9s

/**
 * Sleep for the specified number of milliseconds.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Attempt a fetch with automatic 429 retry and exponential backoff.
 * Returns the final Response object (may still be 429 if all retries exhausted).
 */
async function fetchWith429Retry(url, options) {
  let lastResponse = null;

  for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt++) {
    lastResponse = await fetch(url, options);

    // If not 429, return immediately
    if (lastResponse.status !== 429) {
      return lastResponse;
    }

    // If this was the last retry attempt, return the 429 response
    if (attempt >= MAX_429_RETRIES) {
      return lastResponse;
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
      waitMs = RETRY_BACKOFF_MS[attempt] || 9000;
    }

    // Cap wait at 10s per attempt to stay within Worker timeout budget
    waitMs = Math.min(waitMs, 10000);

    // Read and discard the 429 response body to free the connection
    try { await lastResponse.text(); } catch (_) { /* ignore */ }

    await sleep(waitMs);
  }

  return lastResponse;
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

      // Forward to target with 429 retry
      const response = await fetchWith429Retry(transformed.targetUrl, {
        method: 'POST',
        headers: transformed.headers,
        body: transformed.body,
      });

      // Return with CORS headers
      const responseData = await response.text();

      // Build response headers — preserve content-type and add CORS
      const responseHeaders = {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
        ...CORS_HEADERS,
      };

      // If 429, add a helpful header so the client knows the proxy already retried
      if (response.status === 429) {
        responseHeaders['X-Proxy-Retried'] = String(MAX_429_RETRIES);
      }

      return new Response(responseData, {
        status: response.status,
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
