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
  },

  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyPrefix: 'sk-',
    defaultModel: 'gpt-4o-mini',
  },

  anthropic: {
    name: 'Anthropic (Claude)',
    baseUrl: 'https://api.anthropic.com/v1',
    apiKeyPrefix: 'sk-ant-',
    defaultModel: 'claude-3-5-sonnet-20241022',
  },

  google: {
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.0-flash',
  },

  mistral: {
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    apiKeyPrefix: 'sk-',
    defaultModel: 'mistral-large-latest',
  },

  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKeyPrefix: 'sk-',
    defaultModel: 'deepseek-chat',
  },

  qwen: {
    name: 'Alibaba Qwen (通义千问)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKeyPrefix: 'sk-',
    defaultModel: 'qwen-turbo',
  },

  kimi: {
    name: 'Moonshot Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    apiKeyPrefix: 'sk-',
    defaultModel: 'moonshot-v1-8k',
  },

  groq: {
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKeyPrefix: 'gsk_',
    defaultModel: 'llama-3.3-70b-versatile',
  },

  openrouter: {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-3.5-sonnet',
    headers: {
      'HTTP-Referer': 'https://universe-audit-protocol.pages.dev',
      'X-Title': 'Universe Audit Protocol',
    },
  },

  huggingface: {
    name: 'Hugging Face',
    baseUrl: 'https://api-inference.huggingface.co/models',
    defaultModel: 'meta-llama/Llama-3.2-3B-Instruct',
  },

  together: {
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Llama-3.2-3B-Instruct-Turbo',
  },

  xai: {
    name: 'xAI (Grok)',
    baseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-beta',
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
      return JSON.stringify({
        model: effectiveModel,
        max_tokens: options.max_tokens || 4096,
        messages: nonSystemMessages,
        system: systemMessage?.content,
      });
    }

    case 'google': {
      // Google Gemini API format
      const systemContent = options.messages.find(m => m.role === 'system')?.content;
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
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.max_tokens || 2048,
        },
      });
    }

    case 'huggingface': {
      // HuggingFace Inference API format
      return JSON.stringify({
        inputs: options.messages.map(m => `${m.role}: ${m.content}`).join('\n'),
        parameters: {
          temperature: options.temperature ?? 0.7,
          max_new_tokens: options.max_tokens || 2048,
          return_full_text: false,
        },
      });
    }

    default: {
      // OpenAI-compatible format (openai, deepseek, groq, openrouter, mistral, zai, etc.)
      return JSON.stringify({
        model: effectiveModel,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens,
        stream: false,
      });
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
      return {
        id: String(r.id || 'unknown'),
        object: 'chat.completion',
        created: Date.now(),
        model: String(r.model || 'claude'),
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: String((r.content as Array<Record<string, unknown>>)?.[0]?.text || ''),
          },
          finish_reason: r.stop_reason === 'end_turn' ? 'stop' : String(r.stop_reason || 'stop'),
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
      return {
        id: 'gemini-' + Date.now(),
        object: 'chat.completion',
        created: Date.now(),
        model: 'gemini',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: text || '',
          },
          finish_reason: finishReason === 'STOP' ? 'stop' : (finishReason || 'stop'),
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
 */
export function createLLMClient(config: LLMClientConfig) {
  const providerConfig = LLM_PROVIDERS[config.provider];
  const model = config.model || providerConfig.defaultModel;

  /**
   * Make a chat completion request via the CORS proxy
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
      throw new Error(`No target URL for provider "${config.provider}". Set baseUrl in settings.`);
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
        'CORS proxy URL is not configured. Set it in Settings → Proxy URL. ' +
        'Deploy the Worker from the worker/ directory first.'
      );
    }

    try {
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proxyRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${providerConfig.name} proxy error (${response.status}): ${errorText}`);
      }

      const responseData = await response.json();

      // Normalize provider-specific response into standard format
      const normalized = normalizeProviderResponse(config.provider, responseData);

      return normalized;

    } catch (error) {
      console.error(`${providerConfig.name} chat completion error:`, error);
      throw error;
    }
  }

  return {
    chatCompletion,
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
