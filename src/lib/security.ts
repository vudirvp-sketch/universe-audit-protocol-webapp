// Security utilities for API routes

/**
 * Extract API key from request headers or body
 * Priority: X-API-Key header > Authorization header > body.apiKey
 * 
 * Using headers is more secure than body because:
 * 1. Headers are less likely to be logged by intermediaries
 * 2. Headers don't appear in browser history
 * 3. Standard practice for API authentication
 */
export function extractApiKey(request: Request, body?: { apiKey?: string | null }): string | null {
  // Priority 1: X-API-Key header (recommended)
  const headerApiKey = request.headers.get('X-API-Key');
  if (headerApiKey) {
    return headerApiKey;
  }

  // Priority 2: Authorization Bearer header
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Priority 3: Body (legacy support, but less secure)
  // ⚠️ WARNING: API keys in request body may be logged by Vercel/proxies
  return body?.apiKey || null;
}

/**
 * Redact sensitive information from objects for logging
 */
export function redactSensitive<T>(obj: T, keys: string[] = ['apiKey', 'key', 'token', 'password']): T {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitive(item, keys)) as T;
  }

  const redacted = { ...obj } as Record<string, unknown>;
  for (const key of keys) {
    if (key in redacted) {
      redacted[key] = '***REDACTED***';
    }
  }

  // Recursively redact nested objects
  for (const [key, value] of Object.entries(redacted)) {
    if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitive(value, keys);
    }
  }

  return redacted as T;
}

/**
 * Validate API key format for different providers
 */
export function validateApiKeyFormat(provider: string, apiKey: string | null): { valid: boolean; error?: string } {
  if (!apiKey) {
    return { valid: false, error: 'API key is required' };
  }

  // Minimum length check
  if (apiKey.length < 10) {
    return { valid: false, error: 'API key appears to be too short' };
  }

  // Provider-specific format hints (warning only, not enforced)
  const formatHints: Record<string, { prefix?: string; minLength: number }> = {
    openai: { prefix: 'sk-', minLength: 20 },
    anthropic: { prefix: 'sk-ant-', minLength: 20 },
    groq: { prefix: 'gsk_', minLength: 20 },
    google: { minLength: 20 },
    mistral: { prefix: 'sk-', minLength: 20 },
  };

  const hint = formatHints[provider];
  if (hint?.prefix && !apiKey.startsWith(hint.prefix)) {
    // Just a warning, don't reject
    console.warn(`API key for ${provider} typically starts with ${hint.prefix}`);
  }

  return { valid: true };
}

/**
 * Simple in-memory rate limiting (for serverless, resets on cold start)
 * For production, use Redis or similar
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 10,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(identifier, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetIn: windowMs };
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetIn: record.resetTime - now };
  }

  record.count++;
  return { allowed: true, remaining: maxRequests - record.count, resetIn: record.resetTime - now };
}

/**
 * Get client identifier for rate limiting
 * Uses IP address from Vercel headers or X-Forwarded-For
 */
export function getClientIdentifier(request: Request): string {
  // Vercel provides the real IP in these headers
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  
  if (forwarded) {
    // x-forwarded-for can be a comma-separated list, take the first (client)
    return forwarded.split(',')[0].trim();
  }
  
  if (realIp) {
    return realIp;
  }

  // Fallback to a hash of user agent + accept-language
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const acceptLang = request.headers.get('accept-language') || '';
  return `ua:${userAgent.slice(0, 50)}:${acceptLang.slice(0, 20)}`;
}

/**
 * Sanitize narrative text to prevent injection attacks
 */
export function sanitizeNarrative(text: string): string {
  // Limit length to prevent DoS
  const MAX_LENGTH = 100000; // 100k chars
  if (text.length > MAX_LENGTH) {
    text = text.slice(0, MAX_LENGTH);
  }

  // Remove potential script injections (basic)
  // Note: The text goes to LLM, not rendered as HTML, but still good practice
  text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  return text.trim();
}

/**
 * Security headers for API responses
 */
export function getSecurityHeaders(): HeadersInit {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  };
}
