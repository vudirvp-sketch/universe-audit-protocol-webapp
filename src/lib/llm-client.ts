// Universal LLM API client supporting multiple providers
// Routes all requests through a CORS proxy (Cloudflare Worker) for browser compatibility
// No process.env references — all config comes from client-side settings

// ============================================================================
// TYPES
// ============================================================================

export type LLMProvider =
  | 'zai'
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'mistral'
  | 'deepseek'
  | 'qwen'
  | 'kimi'
  | 'groq'
  | 'openrouter'
  | 'huggingface'
  | 'together'
  | 'xai'
  | 'custom';

export interface LLMProviderConfig {
  name: string;
  baseUrl: string;
  apiKeyPrefix?: string;
  defaultModel: string;
  headers?: Record<string, string>;
  /** URL of the provider's model documentation / pricing page */
  modelDocsUrl?: string;
}

export interface ProxyRequest {
  provider: LLMProvider;
  apiKey: string;
  targetUrl: string;
  headers?: Record<string, string>;
  payload: string; // JSON stringified request body for the provider
}

export interface LLMClientConfig {
  provider: LLMProvider;
  apiKey: string;
  model?: string;
  baseUrl?: string; // For custom providers
  proxyUrl?: string; // CORS proxy URL (Cloudflare Worker)
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  /** @deprecated No longer used — client-side retry removed to avoid cascade with proxy retries. */
  maxRateLimitRetries?: number;
  /** AbortSignal to cancel the request (e.g. for timeout). Passed to fetch(). */
  signal?: AbortSignal;
  /** If true, tells the proxy to skip server-side 429 retries (for test connections). */
  skipProxyRetry?: boolean;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ============================================================================
// MODEL CAPABILITIES
// ============================================================================

export interface ModelCapabilities {
  /** Max total tokens (prompt + response) */
  contextWindow: number;
  /** Max tokens the model can generate in a single response */
  maxOutputTokens: number;
  /** Whether response_format: json_object works */
  supportsJSONMode: boolean;
  /** Whether system role messages are supported */
  supportsSystemMessages: boolean;
}

/**
 * Provider-aware default capabilities.
 * Used when a specific model is not found in KNOWN_MODEL_CAPABILITIES.
 * Different providers have different baseline expectations — e.g. Google Gemini
 * models generally support JSON mode and have larger context windows than the
 * most conservative default.
 */
const PROVIDER_DEFAULT_CAPABILITIES: Partial<Record<LLMProvider, ModelCapabilities>> = {
  google:     { contextWindow: 1_000_000, maxOutputTokens: 8192,  supportsJSONMode: true,  supportsSystemMessages: true },
  anthropic:  { contextWindow: 200_000,   maxOutputTokens: 8192,  supportsJSONMode: false, supportsSystemMessages: true },
  openai:     { contextWindow: 128_000,   maxOutputTokens: 16384, supportsJSONMode: true,  supportsSystemMessages: true },
  groq:       { contextWindow: 128_000,   maxOutputTokens: 32768, supportsJSONMode: false, supportsSystemMessages: true },
  deepseek:   { contextWindow: 64_000,    maxOutputTokens: 8192,  supportsJSONMode: true,  supportsSystemMessages: true },
  mistral:    { contextWindow: 128_000,   maxOutputTokens: 8192,  supportsJSONMode: true,  supportsSystemMessages: true },
};

/** Conservative defaults for unknown providers/models — the absolute floor.
 * Updated to 128K context / 8K output — modern models almost all have ≥128K.
 */
const DEFAULT_CAPABILITIES: ModelCapabilities = {
  contextWindow: 128000,
  maxOutputTokens: 8192,
  supportsJSONMode: false,
  supportsSystemMessages: true,
};

/**
 * Known model capabilities indexed by "provider/model" key.
 * The key format is `${provider}/${model}` to avoid ambiguity across providers.
 */
const KNOWN_MODEL_CAPABILITIES: Record<string, ModelCapabilities> = {
  // Google Gemini — full family coverage
  'google/gemini-2.5-flash':       { contextWindow: 1_000_000, maxOutputTokens: 65536, supportsJSONMode: true,  supportsSystemMessages: true },
  'google/gemini-2.5-pro':         { contextWindow: 1_000_000, maxOutputTokens: 65536, supportsJSONMode: true,  supportsSystemMessages: true },
  'google/gemini-2.0-flash':       { contextWindow: 1_000_000, maxOutputTokens: 8192,  supportsJSONMode: true,  supportsSystemMessages: true },
  'google/gemini-2.0-flash-lite':  { contextWindow: 1_000_000, maxOutputTokens: 8192,  supportsJSONMode: true,  supportsSystemMessages: true },
  'google/gemini-1.5-flash':       { contextWindow: 1_000_000, maxOutputTokens: 8192,  supportsJSONMode: true,  supportsSystemMessages: true },
  'google/gemini-1.5-pro':         { contextWindow: 2_000_000, maxOutputTokens: 8192,  supportsJSONMode: true,  supportsSystemMessages: true },
  'google/gemini-1.0-pro':         { contextWindow: 32_000,    maxOutputTokens: 8192,  supportsJSONMode: true,  supportsSystemMessages: true },

  // OpenAI
  'openai/gpt-4o-mini':            { contextWindow: 128_000,   maxOutputTokens: 16384, supportsJSONMode: true,  supportsSystemMessages: true },
  'openai/gpt-4.1-mini':           { contextWindow: 128_000,   maxOutputTokens: 16384, supportsJSONMode: true,  supportsSystemMessages: true },
  'openai/gpt-4o':                 { contextWindow: 128_000,   maxOutputTokens: 16384, supportsJSONMode: true,  supportsSystemMessages: true },
  'openai/gpt-4.1':                { contextWindow: 1_000_000, maxOutputTokens: 32768, supportsJSONMode: true,  supportsSystemMessages: true },

  // Anthropic Claude — use prefill trick for JSON (no native json_object mode)
  'anthropic/claude-sonnet-4-20250514': { contextWindow: 200_000, maxOutputTokens: 16384, supportsJSONMode: false, supportsSystemMessages: true },
  'anthropic/claude-3-5-sonnet':        { contextWindow: 200_000, maxOutputTokens: 8192,  supportsJSONMode: false, supportsSystemMessages: true },
  'anthropic/claude-3-haiku':           { contextWindow: 200_000, maxOutputTokens: 8192,  supportsJSONMode: false, supportsSystemMessages: true },

  // Groq
  'groq/llama-3.3-70b-versatile':  { contextWindow: 128_000,   maxOutputTokens: 32768, supportsJSONMode: false, supportsSystemMessages: true },

  // DeepSeek
  'deepseek/deepseek-chat':        { contextWindow: 64_000,    maxOutputTokens: 8192,  supportsJSONMode: true,  supportsSystemMessages: true },
  'deepseek/deepseek-reasoner':    { contextWindow: 64_000,    maxOutputTokens: 8192,  supportsJSONMode: true,  supportsSystemMessages: true },

  // Mistral
  'mistral/mistral-large-latest':   { contextWindow: 128_000,   maxOutputTokens: 8192,  supportsJSONMode: true,  supportsSystemMessages: true },
};

/**
 * Get the capabilities for a given provider + model combination.
 * For unknown models, uses provider-aware defaults, then conservative defaults.
 *
 * Resolution order:
 *  1. Exact match in KNOWN_MODEL_CAPABILITIES
 *  2. Normalized model name (strips preview/date suffixes)
 *  3. Prefix matching (longest match first)
 *  4. Provider-specific defaults (e.g. Google models generally support JSON mode)
 *  5. Conservative DEFAULT_CAPABILITIES (the absolute floor)
 */

/**
 * Normalize a model name for prefix matching (e.g. "gemini-2.5-flash-preview-05-20" → "gemini-2.5-flash").
 * Strips trailing date/version suffixes that providers often append.
 */
function normalizeModelName(model: string): string {
  if (!model) return '';
  // Strip common preview/date suffixes: -preview-NN-NN, -preview, -NN-NN-NN, etc.
  return model
    .replace(/-preview-\d{2}-\d{2,4}$/, '')   // gemini-2.5-flash-preview-05-20
    .replace(/-preview$/, '')                      // gemini-2.5-flash-preview
    .replace(/-\d{4}-\d{2}-\d{2}$/, '')         // claude-sonnet-4-20250514 → keep as-is (no dash before date)
    .replace(/-\d{8}$/, '')                       // some-20250514
    ;
}

export function getModelCapabilities(provider: LLMProvider, model: string): ModelCapabilities {
  // Try exact match first
  const key = `${provider}/${model}`;
  if (KNOWN_MODEL_CAPABILITIES[key]) {
    return KNOWN_MODEL_CAPABILITIES[key];
  }

  // Try normalized model name (strips preview/date suffixes)
  const normalizedKey = `${provider}/${normalizeModelName(model)}`;
  if (KNOWN_MODEL_CAPABILITIES[normalizedKey]) {
    return KNOWN_MODEL_CAPABILITIES[normalizedKey];
  }

  // Try prefix matching — walk from longest to shortest prefix
  // e.g. "gemini-2.5-flash-exp" matches "gemini-2.5-flash"
  const providerModels = Object.entries(KNOWN_MODEL_CAPABILITIES)
    .filter(([k]) => k.startsWith(`${provider}/`))
    .sort((a, b) => b[0].length - a[0].length); // longest first for best match

  for (const [k, caps] of providerModels) {
    const modelPart = k.slice(provider.length + 1);
    if (model.startsWith(modelPart)) {
      return caps;
    }
  }

  // For Anthropic, all claude-* models share the same capability profile
  if (provider === 'anthropic' && model.startsWith('claude')) {
    return {
      contextWindow: 200_000,
      maxOutputTokens: 16384,
      supportsJSONMode: false,
      supportsSystemMessages: true,
    };
  }

  // Provider-aware defaults — use provider baseline if available
  const providerDefault = PROVIDER_DEFAULT_CAPABILITIES[provider];
  if (providerDefault) {
    return { ...providerDefault };
  }

  // No match — return conservative defaults
  return { ...DEFAULT_CAPABILITIES };
}

/**
 * Clamp a requested maxOutputTokens value to the model's actual maximum.
 * Returns the effective value that should be sent to the API.
 */
export function resolveMaxOutputTokens(
  provider: LLMProvider,
  model: string,
  requestedTokens: number | undefined
): number {
  const caps = getModelCapabilities(provider, model);
  if (requestedTokens === undefined || requestedTokens <= 0) {
    return caps.maxOutputTokens;
  }
  return Math.min(requestedTokens, caps.maxOutputTokens);
}

// ============================================================================
// PREFERRED MODELS per provider
// ============================================================================

/**
 * Recommended models per provider — known-good names with reliable availability.
 * Useful for UI "recommended" badges or default selections.
 */
export const PREFERRED_MODELS: Record<LLMProvider, string[]> = {
  zai:         ['default'],
  openai:      ['gpt-4.1-mini', 'gpt-4o-mini'],
  anthropic:   ['claude-sonnet-4-20250514', 'claude-3-5-sonnet', 'claude-3-haiku'],
  google:      ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'],
  mistral:     ['mistral-large-latest'],
  deepseek:    ['deepseek-chat'],
  qwen:        ['qwen-turbo'],
  kimi:        ['moonshot-v1-8k'],
  groq:        ['llama-3.3-70b-versatile'],
  openrouter:  ['anthropic/claude-sonnet-4'],
  huggingface: ['meta-llama/Llama-3.2-3B-Instruct'],
  together:    ['meta-llama/Llama-3.2-3B-Instruct-Turbo'],
  xai:         ['grok-3-mini-fast'],
  custom:      [],
};

// ============================================================================
// PROVIDER URL MAPPING
// ============================================================================

/**
 * Get the target API URL for a given provider and model.
 * The proxy uses this URL to forward the request.
 */
export function getProviderUrl(provider: LLMProvider, model: string): string {
  switch (provider) {
    case 'openai':      return 'https://api.openai.com/v1/chat/completions';
    case 'anthropic':   return 'https://api.anthropic.com/v1/messages';
    case 'google':      return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    case 'deepseek':    return 'https://api.deepseek.com/v1/chat/completions';
    case 'groq':        return 'https://api.groq.com/openai/v1/chat/completions';
    case 'openrouter':  return 'https://openrouter.ai/api/v1/chat/completions';
    case 'mistral':     return 'https://api.mistral.ai/v1/chat/completions';
    case 'qwen':        return 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
    case 'kimi':        return 'https://api.moonshot.cn/v1/chat/completions';
    case 'xai':         return 'https://api.x.ai/v1/chat/completions';
    case 'together':    return 'https://api.together.xyz/v1/chat/completions';
    case 'huggingface': return `https://api-inference.huggingface.co/models/${model}`;
    case 'zai':         return 'https://api.z.ai/v1/chat/completions';
    default:            return ''; // Custom provider URL entered by user
  }
}

// ============================================================================
// PROVIDER CONFIGURATIONS (display info only — request transformation is in the proxy)
// ============================================================================

export const LLM_PROVIDERS: Record<LLMProvider, LLMProviderConfig> = {
  zai: {
    name: 'Z.AI',
    baseUrl: 'https://api.z.ai/v1',
    defaultModel: 'default',
    headers: { 'X-Z-AI-From': 'Z' },
    modelDocsUrl: 'https://z.ai/docs',
  },

  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyPrefix: 'sk-',
    defaultModel: 'gpt-4.1-mini',
    modelDocsUrl: 'https://platform.openai.com/docs/models',
  },

  anthropic: {
    name: 'Anthropic (Claude)',
    baseUrl: 'https://api.anthropic.com/v1',
    apiKeyPrefix: 'sk-ant-',
    defaultModel: 'claude-sonnet-4-20250514',
    modelDocsUrl: 'https://docs.anthropic.com/en/docs/about-claude/models',
  },

  google: {
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.5-flash',
    modelDocsUrl: 'https://ai.google.dev/gemini-api/docs/models',
  },

  mistral: {
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    apiKeyPrefix: 'sk-',
    defaultModel: 'mistral-large-latest',
    modelDocsUrl: 'https://docs.mistral.ai/getting-started/models/models_overview/',
  },

  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKeyPrefix: 'sk-',
    defaultModel: 'deepseek-chat',
    modelDocsUrl: 'https://api-docs.deepseek.com/quick_start/pricing',
  },

  qwen: {
    name: 'Alibaba Qwen (通义千问)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKeyPrefix: 'sk-',
    defaultModel: 'qwen-turbo',
    modelDocsUrl: 'https://help.aliyun.com/zh/model-studio/getting-started/models',
  },

  kimi: {
    name: 'Moonshot Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    apiKeyPrefix: 'sk-',
    defaultModel: 'moonshot-v1-8k',
    modelDocsUrl: 'https://platform.moonshot.cn/docs/intro',
  },

  groq: {
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKeyPrefix: 'gsk_',
    defaultModel: 'llama-3.3-70b-versatile',
    modelDocsUrl: 'https://console.groq.com/docs/models',
  },

  openrouter: {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-sonnet-4',
    modelDocsUrl: 'https://openrouter.ai/models',
    headers: {
      'HTTP-Referer': 'https://universe-audit-protocol.pages.dev',
      'X-Title': 'Universe Audit Protocol',
    },
  },

  huggingface: {
    name: 'Hugging Face',
    baseUrl: 'https://api-inference.huggingface.co/models',
    defaultModel: 'meta-llama/Llama-3.2-3B-Instruct',
    modelDocsUrl: 'https://huggingface.co/docs/api-inference/index',
  },

  together: {
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Llama-3.2-3B-Instruct-Turbo',
    modelDocsUrl: 'https://docs.together.ai/docs/inference-models',
  },

  xai: {
    name: 'xAI (Grok)',
    baseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-3-mini-fast',
    modelDocsUrl: 'https://docs.x.ai/docs/models',
  },

  custom: {
    name: 'Custom Endpoint',
    baseUrl: '',
    defaultModel: 'default',
  },
};

// ============================================================================
// PROVIDER-SPECIFIC REQUEST BUILDERS
// ============================================================================

/**
 * Build the request body for a given provider.
 * The client always builds the body in the provider's native format.
 * The proxy only handles auth header injection.
 */
function buildProviderRequestBody(
  provider: LLMProvider,
  options: ChatCompletionOptions,
  effectiveModel: string
): string {
  // Resolve maxOutputTokens clamped to model capabilities
  const effectiveMaxTokens = resolveMaxOutputTokens(provider, effectiveModel, options.max_tokens);

  switch (provider) {
    case 'anthropic': {
      // Anthropic Messages API format
      const systemMessage = options.messages.find(m => m.role === 'system');
      const nonSystemMessages = options.messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        }));

      // Anthropic doesn't support response_format: json_object.
      // Prefill trick: append an assistant message with "{" so Claude
      // continues generating valid JSON. This is the standard workaround
      // recommended by Anthropic for structured JSON output.
      // We detect JSON intent by checking if the system prompt requests JSON.
      const systemContent = systemMessage?.content || '';
      const needsJsonPrefill = /ТОЛЬКО\s+валидным\s+JSON|JSON\s+only|ответ.*json/i.test(systemContent);
      if (needsJsonPrefill && nonSystemMessages[nonSystemMessages.length - 1]?.role !== 'assistant') {
        nonSystemMessages.push({ role: 'assistant', content: '{' });
      }

      return JSON.stringify({
        model: effectiveModel,
        max_tokens: effectiveMaxTokens,
        messages: nonSystemMessages,
        system: systemContent,
      });
    }

    case 'google': {
      // Google Gemini API format
      const systemContent = options.messages.find(m => m.role === 'system')?.content;
      const caps = getModelCapabilities(provider, effectiveModel);

      const generationConfig: Record<string, unknown> = {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: effectiveMaxTokens,
      };

      // Only set responseMimeType to application/json if the model supports JSON mode
      if (caps.supportsJSONMode) {
        generationConfig.responseMimeType = 'application/json';
      }

      return JSON.stringify({
        contents: options.messages
          .filter(m => m.role !== 'system')
          .map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          })),
        ...(systemContent
          ? { systemInstruction: { parts: [{ text: systemContent }] } }
          : {}),
        generationConfig,
      });
    }

    case 'huggingface': {
      // HuggingFace Inference API format
      return JSON.stringify({
        inputs: options.messages.map(m => `${m.role}: ${m.content}`).join('\n'),
        parameters: {
          temperature: options.temperature ?? 0.7,
          max_new_tokens: effectiveMaxTokens,
          return_full_text: false,
        },
      });
    }

    default: {
      // OpenAI-compatible format (openai, deepseek, groq, openrouter, mistral, zai, etc.)
      const caps = getModelCapabilities(provider, effectiveModel);
      const body: Record<string, unknown> = {
        model: effectiveModel,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: effectiveMaxTokens,
        stream: false,
      };

      // Only add response_format: json_object if the model supports it
      if (caps.supportsJSONMode) {
        body.response_format = { type: 'json_object' };
      }

      return JSON.stringify(body);
    }
  }
}

/**
 * Transform provider-specific response into the standard ChatCompletionResponse format.
 * This runs client-side after receiving the raw response from the proxy.
 */
function normalizeProviderResponse(
  provider: LLMProvider,
  responseData: unknown
): ChatCompletionResponse {
  switch (provider) {
    case 'anthropic': {
      const r = responseData as Record<string, unknown>;
      // Map Anthropic-specific stop reasons to OpenAI equivalents.
      // Anthropic uses 'end_turn', 'max_tokens', 'stop_sequence', 'tool_use'.
      let anthropicFinishReason: string;
      switch (r.stop_reason) {
        case 'end_turn':      anthropicFinishReason = 'stop'; break;
        case 'max_tokens':    anthropicFinishReason = 'length'; break;
        case 'stop_sequence': anthropicFinishReason = 'stop'; break;
        case 'tool_use':      anthropicFinishReason = 'tool_calls'; break;
        default:              anthropicFinishReason = String(r.stop_reason || 'stop'); break;
      }
      // When we used the JSON prefill trick (assistant message with "{"),
      // Claude's response does NOT include the prefill — we must prepend it
      // so the JSON parser gets a complete object starting with "{".
      const rawContent = String((r.content as Array<Record<string, unknown>>)?.[0]?.text || '');
      // Detect if prefill was used: if the response starts with a key (not "{"),
      // it means we sent a "{" prefill and Claude continued from there.
      const needsPrefillRestore = rawContent.length > 0
        && !rawContent.trimStart().startsWith('{')
        && !rawContent.trimStart().startsWith('[');
      const finalContent = needsPrefillRestore ? '{' + rawContent : rawContent;
      return {
        id: String(r.id || 'unknown'),
        object: 'chat.completion',
        created: Date.now(),
        model: String(r.model || 'claude'),
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: finalContent,
          },
          finish_reason: anthropicFinishReason,
        }],
      };
    }

    case 'google': {
      const r = responseData as Record<string, unknown>;
      const candidates = (r.candidates as Array<Record<string, unknown>>) || [];
      const content = candidates[0]?.content as Record<string, unknown> | undefined;
      const parts = content?.parts as Array<Record<string, unknown>> | undefined;
      const text = parts?.[0]?.text as string | undefined;
      const finishReason = candidates[0]?.finishReason as string | undefined;

      // CRITICAL: Map Gemini-specific finish reasons to OpenAI equivalents.
      // Gemini returns 'MAX_TOKENS' when output is truncated — this MUST map
      // to 'length' so the audit pipeline detects truncation and applies
      // recovery strategies (compressed prompt, token budget rebuild, etc.).
      // Without this mapping, truncated responses silently fail validation
      // and exhaust the retry budget.
      // See: https://ai.google.dev/api/generate-content#finishreason
      let normalizedFinishReason: string;
      switch (finishReason) {
        case 'STOP':       normalizedFinishReason = 'stop'; break;
        case 'MAX_TOKENS': normalizedFinishReason = 'length'; break;  // ← was missing!
        case 'SAFETY':     normalizedFinishReason = 'content_filter'; break;
        case 'RECITATION': normalizedFinishReason = 'content_filter'; break;
        case 'BLOCKLIST':  normalizedFinishReason = 'content_filter'; break;
        case 'PROHIBITED': normalizedFinishReason = 'content_filter'; break;
        case 'SPII':       normalizedFinishReason = 'content_filter'; break;
        case 'MALFORMED_FUNCTION_CALL': normalizedFinishReason = 'tool_call_error'; break;
        default:           normalizedFinishReason = finishReason || 'stop'; break;
      }

      // Handle blocklist / safety filter — extract block reason message if available
      let responseText = text || '';
      if (!responseText && normalizedFinishReason === 'content_filter') {
        const promptFeedback = r.promptFeedback as Record<string, unknown> | undefined;
        const blockReason = promptFeedback?.blockReason as string | undefined;
        const safetyRatings = promptFeedback?.safetyRatings as Array<Record<string, unknown>> | undefined;
        responseText = JSON.stringify({
          _blocked: true,
          blockReason: blockReason || finishReason,
          safetyRatings: safetyRatings || [],
        });
      }

      return {
        id: 'gemini-' + Date.now(),
        object: 'chat.completion',
        created: Date.now(),
        model: 'gemini',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: responseText,
          },
          finish_reason: normalizedFinishReason,
        }],
      };
    }

    case 'huggingface': {
      const r = responseData as Array<Record<string, unknown>>;
      return {
        id: 'hf-' + Date.now(),
        object: 'chat.completion',
        created: Date.now(),
        model: 'huggingface',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: String(r?.[0]?.generated_text || ''),
          },
          finish_reason: 'stop',
        }],
      };
    }

    default: {
      // OpenAI-compatible response — return as-is
      return responseData as ChatCompletionResponse;
    }
  }
}

// ============================================================================
// CLIENT FACTORY
// ============================================================================

/**
 * Creates an LLM API client that routes requests through the CORS proxy.
 * All requests go through the proxy — no direct browser-to-provider calls.
 *
 * IMPORTANT: This client does NOT retry on 429/503/502 errors.
 * The Cloudflare Worker proxy already handles transport-level retries (up to 2).
 * Adding client-side retries on top would cause an exponential cascade:
 *   client_retry × proxy_retry = 3 × 2 = 6 total attempts per logical call,
 *   and with audit-step.ts doing its own logical retries, this could reach
 *   3 × 2 × 3 = 18 API calls for a single failed step.
 * Instead, we throw immediately on transport errors and let the higher layer
 * (audit-step.ts) decide whether to retry for logical reasons (invalid JSON, etc.).
 */
export function createLLMClient(config: LLMClientConfig) {
  const providerConfig = LLM_PROVIDERS[config.provider];
  const model = config.model || providerConfig.defaultModel;

  /**
   * Make a chat completion request via the CORS proxy.
   * No client-side retry loop — the proxy handles transport-level retries.
   */
  async function chatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
    const effectiveModel = options.model || model;

    // Determine target URL
    let targetUrl: string;
    if (config.provider === 'custom' && config.baseUrl) {
      targetUrl = `${config.baseUrl}/chat/completions`;
    } else {
      targetUrl = getProviderUrl(config.provider, effectiveModel);
    }

    if (!targetUrl) {
      throw new Error(`URL провайдера не задан для «${config.provider}». Укажите baseUrl в настройках.`);
    }

    // Build the request body in the provider's native format
    const payload = buildProviderRequestBody(config.provider, options, effectiveModel);

    // Build the proxy request
    const proxyRequest: ProxyRequest = {
      provider: config.provider,
      apiKey: config.apiKey,
      targetUrl,
      payload,
    };

    // Determine proxy URL
    const proxyUrl = config.proxyUrl || '';

    if (!proxyUrl) {
      throw new Error(
        'URL CORS-прокси не настроен. Укажите его в Настройки → Расширенные настройки → URL прокси.'
      );
    }

    // Build fetch headers — include X-No-Retry if test connection wants to skip proxy retries
    const fetchHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (options.skipProxyRetry) {
      fetchHeaders['X-No-Retry'] = 'true';
    }

    // ── Single request attempt ──────────────────────────────────────────
    // The proxy already retries 429/503 server-side. We do NOT retry here
    // to avoid the exponential cascade (client_retry × proxy_retry).
    let response: Response;
    try {
      response = await fetch(proxyUrl, {
        method: 'POST',
        headers: fetchHeaders,
        body: JSON.stringify(proxyRequest),
        signal: options.signal, // AbortSignal — enables real timeout cancellation
      });
    } catch (fetchError: unknown) {
      // Handle proxy-down / network errors with user-friendly messages
      if (fetchError instanceof TypeError) {
        // TypeError: Failed to fetch — proxy unreachable or network error
        throw new Error(
          'Не удалось подключиться к прокси. Проверьте интернет-соединение. ' +
          'Если проблема сохраняется — прокси может быть временно недоступен.'
        );
      }
      if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
        // Request was aborted (timeout or user cancellation)
        throw new Error(
          'Запрос отменён по таймауту. Попробуйте более быструю модель или более короткий текст.'
        );
      }
      // Unknown fetch error — rethrow with context
      throw new Error(
        `Ошибка сети при обращении к прокси: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`
      );
    }

    // ── 504 Gateway Timeout (from proxy) ─────────────────────────────────
    // Proxy timed out waiting for the provider to respond.
    if (response.status === 504) {
      let proxyMessage = '';
      try { const errData = await response.json() as { message?: string }; proxyMessage = errData.message || ''; } catch { /* ignore */ }
      throw new Error(
        proxyMessage ||
        'Таймаут. Модель думает слишком долго. Попробуйте более быструю модель (Gemini Flash, GPT-4o-mini) или более короткий текст.'
      );
    }

    // ── 413 Payload Too Large (from proxy) ──────────────────────────────
    // Request body exceeded the proxy's size limit.
    if (response.status === 413) {
      let proxyMessage = '';
      try { const errData = await response.json() as { message?: string }; proxyMessage = errData.message || ''; } catch { /* ignore */ }
      throw new Error(
        proxyMessage ||
        'Слишком большой запрос. Текст будет разбит на части автоматически (chunking).'
      );
    }

    // ── 429 Rate Limit ──────────────────────────────────────────────────
    // Proxy already retried — throw immediately with actionable advice.
    if (response.status === 429) {
      const proxyRetries = response.headers.get('X-Proxy-Retried');
      const proxyRetryInfo = proxyRetries ? ` (прокси уже пытался ${proxyRetries} раз)` : '';
      throw new Error(
        `Превышен лимит запросов к провайдеру «${providerConfig.name}»${proxyRetryInfo}. ` +
        `Прокси уже делал повторы. Рекомендации:\n` +
        `1. Подождите 1-2 минуты и попробуйте снова\n` +
        `2. Уменьшите RPM-лимит в Настройках (например, до 3)\n` +
        `3. Смените провайдера на того, у кого выше лимиты (Google Gemini, Groq)\n` +
        `4. Используйте платный API-ключ для более высоких лимитов`
      );
    }

    // ── 500 / 502 Proxy Errors ──────────────────────────────────────────
    // Proxy itself had an error (not the provider).
    if (response.status === 500 || response.status === 502) {
      let errorDetail = '';
      try { const errData = await response.json() as { error?: string; message?: string; details?: string }; errorDetail = errData.message || errData.error || errData.details || ''; } catch { /* ignore */ }
      // Distinguish between proxy errors and provider errors
      if (errorDetail.includes('proxy_error') || errorDetail.includes('Внутренняя ошибка прокси')) {
        throw new Error(
          'Прокси временно недоступен. Подождите минуту и попробуйте снова. ' +
          'Если проблема сохраняется — прокси может быть временно недоступен.'
        );
      }
      // Provider-side 502/503 — proxy already retried
      const proxyRetries = response.headers.get('X-Proxy-Retried');
      const proxyRetryInfo = proxyRetries ? ` (прокси уже пытался ${proxyRetries} раз)` : '';
      throw new Error(
        `Провайдер «${providerConfig.name}» временно недоступен (${response.status})${proxyRetryInfo}. ` +
        `Прокси уже делал повторы. Попробуйте позже или смените модель/провайдера.` +
        (errorDetail ? ` Детали: ${errorDetail}` : '')
      );
    }

    // ── 503 Service Unavailable ─────────────────────────────────────────
    if (response.status === 503) {
      const proxyRetries = response.headers.get('X-Proxy-Retried');
      const proxyRetryInfo = proxyRetries ? ` (прокси уже пытался ${proxyRetries} раз)` : '';
      throw new Error(
        `Провайдер «${providerConfig.name}» перегружен (503)${proxyRetryInfo}. ` +
        `Прокси уже делал повторы. Попробуйте позже или смените модель/провайдера.`
      );
    }

    // ── Other non-OK responses ──────────────────────────────────────────
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${providerConfig.name} ошибка прокси (${response.status}): ${errorText}`);
    }

    // ── Success — parse and normalize ───────────────────────────────────
    const responseData = await response.json();
    return normalizeProviderResponse(config.provider, responseData);
  }

  /**
   * Make a streaming chat completion request via the CORS proxy.
   * Returns the full text after streaming completes, calling onChunk
   * for each delta received from the provider.
   *
   * For HuggingFace (which doesn't support streaming), falls back to
   * the buffered chatCompletion method.
   */
  async function chatCompletionStream(
    options: ChatCompletionOptions,
    onChunk: (text: string, delta: string) => void,
  ): Promise<ChatCompletionResponse> {
    const effectiveModel = options.model || model;

    // HuggingFace doesn't support streaming — fallback to buffered
    if (config.provider === 'huggingface') {
      const buffered = await chatCompletion(options);
      const content = buffered.choices?.[0]?.message?.content || '';
      onChunk(content, content);
      return buffered;
    }

    // Determine target URL
    let targetUrl: string;
    if (config.provider === 'custom' && config.baseUrl) {
      targetUrl = `${config.baseUrl}/chat/completions`;
    } else {
      targetUrl = getProviderUrl(config.provider, effectiveModel);
    }

    if (!targetUrl) {
      throw new Error(`URL провайдера не задан для «${config.provider}». Укажите baseUrl в настройках.`);
    }

    // Build the request body with stream: true injected
    const rawPayload = buildProviderRequestBody(config.provider, options, effectiveModel);
    const { streamChatCompletion, enableStreamingInPayload } = await import('./streaming');
    const { payload: streamingPayload, targetUrl: streamingTargetUrl } =
      enableStreamingInPayload(config.provider, rawPayload, targetUrl);

    // Determine proxy URL
    const proxyUrl = config.proxyUrl || '';
    if (!proxyUrl) {
      throw new Error(
        'URL CORS-прокси не настроен. Укажите его в Настройки → Расширенные настройки → URL прокси.'
      );
    }

    // Execute streaming request
    const fullText = await streamChatCompletion({
      provider: config.provider,
      proxyUrl,
      apiKey: config.apiKey,
      targetUrl: streamingTargetUrl,
      payload: streamingPayload,
      signal: options.signal,
      onChunk: (chunk) => {
        onChunk(chunk.text, chunk.delta);
      },
    });

    // Normalize the full text response into ChatCompletionResponse format
    // We already have the full text, so create a synthetic response
    const providerConfig = LLM_PROVIDERS[config.provider];
    return {
      id: `${config.provider}-stream-${Date.now()}`,
      object: 'chat.completion',
      created: Date.now(),
      model: effectiveModel,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: fullText,
        },
        finish_reason: 'stop',
      }],
    };
  }

  return {
    chatCompletion,
    chatCompletionStream,
    provider: config.provider,
    model,
    /**
     * OpenAI-compatible interface
     */
    chat: {
      completions: {
        create: chatCompletion,
      },
    },
  };
}

// ============================================================================
// API KEY VALIDATION (client-side only, no server calls)
// ============================================================================

/**
 * Validate API key format for a provider.
 * Pure client-side validation — checks prefix, length, non-empty.
 * Returns an object with validation result and optional error message.
 */
export function validateApiKey(provider: LLMProvider, apiKey: string): { valid: boolean; error?: string } {
  if (!apiKey || apiKey.trim().length === 0) {
    return { valid: false, error: 'API ключ не указан' };
  }

  if (apiKey.length < 10) {
    return { valid: false, error: 'API ключ слишком короткий' };
  }

  const config = LLM_PROVIDERS[provider];
  if (config.apiKeyPrefix && !apiKey.startsWith(config.apiKeyPrefix)) {
    // Warning but not blocking — some providers accept multiple key formats
    return {
      valid: true,
      error: `Ключ для ${config.name} обычно начинается с "${config.apiKeyPrefix}"`,
    };
  }

  return { valid: true };
}

// ============================================================================
// PROVIDER INFO HELPERS
// ============================================================================

/**
 * Get provider display info
 */
export function getProviderInfo(provider: LLMProvider) {
  const config = LLM_PROVIDERS[provider];
  return {
    id: provider,
    name: config.name,
    defaultModel: config.defaultModel,
    apiKeyPrefix: config.apiKeyPrefix,
    hasFreeTier: ['google', 'groq', 'huggingface', 'openrouter', 'together'].includes(provider),
    modelDocsUrl: config.modelDocsUrl,
  };
}

/**
 * List of all available providers
 */
export const AVAILABLE_PROVIDERS = Object.entries(LLM_PROVIDERS)
  .filter(([id]) => id !== 'custom')
  .map(([id, config]) => ({
    id: id as LLMProvider,
    name: config.name,
    defaultModel: config.defaultModel,
    hasFreeTier: ['google', 'groq', 'huggingface', 'openrouter', 'together'].includes(id),
  }));

export type LLMClient = ReturnType<typeof createLLMClient>;

// ============================================================================
// TOKEN ESTIMATION (re-exported from chunking.ts for convenience)
// ============================================================================

export { estimateTokens, canModelHandleInput } from './chunking';
