// Universal LLM API client supporting multiple providers
// Allows runtime configuration of provider and API key

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
  transformRequest?: (body: ChatCompletionOptions) => Record<string, unknown>;
  transformResponse?: (response: unknown) => ChatCompletionResponse;
}

export interface LLMClientConfig {
  provider: LLMProvider;
  apiKey: string;
  model?: string;
  baseUrl?: string; // For custom providers
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
// PROVIDER CONFIGURATIONS
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
    transformRequest: (body) => ({
      model: body.model || 'claude-3-5-sonnet-20241022',
      max_tokens: body.max_tokens || 4096,
      messages: body.messages.map(m => ({
        role: m.role === 'system' ? 'user' : m.role,
        content: m.content,
      })),
      system: body.messages.find(m => m.role === 'system')?.content,
    }),
    transformResponse: (response: unknown) => {
      const r = response as Record<string, unknown>;
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
          finish_reason: 'stop',
        }],
      };
    },
  },

  google: {
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.0-flash',
    transformRequest: (body) => ({
      contents: body.messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
      systemInstruction: body.messages.find(m => m.role === 'system')?.content
        ? { parts: [{ text: body.messages.find(m => m.role === 'system')!.content }] }
        : undefined,
      generationConfig: {
        temperature: body.temperature || 0.7,
        maxOutputTokens: body.max_tokens || 2048,
      },
    }),
    transformResponse: (response: unknown) => {
      const r = response as Record<string, unknown>;
      const candidates = (r.candidates as Array<Record<string, unknown>>) || [];
      const content = candidates[0]?.content as Record<string, unknown> | undefined;
      const parts = content?.parts as Array<Record<string, unknown>> | undefined;
      const text = parts?.[0]?.text as string | undefined;
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
          finish_reason: 'stop',
        }],
      };
    },
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
      'HTTP-Referer': 'https://universe-audit-protocol.vercel.app',
      'X-Title': 'Universe Audit Protocol',
    },
  },

  huggingface: {
    name: 'Hugging Face',
    baseUrl: 'https://api-inference.huggingface.co/models',
    defaultModel: 'meta-llama/Llama-3.2-3B-Instruct',
    transformRequest: (body) => ({
      inputs: body.messages.map(m => `${m.role}: ${m.content}`).join('\n'),
      parameters: {
        temperature: body.temperature || 0.7,
        max_new_tokens: body.max_tokens || 2048,
        return_full_text: false,
      },
    }),
    transformResponse: (response: unknown) => {
      const r = response as Array<Record<string, unknown>>;
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
    },
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
// CLIENT FACTORY
// ============================================================================

/**
 * Creates an LLM API client for the specified provider
 */
export function createLLMClient(config: LLMClientConfig) {
  const providerConfig = LLM_PROVIDERS[config.provider];
  const baseUrl = config.baseUrl || providerConfig.baseUrl;
  const model = config.model || providerConfig.defaultModel;

  /**
   * Make a chat completion request
   */
  async function chatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
    const effectiveModel = options.model || model;
    let url: string;
    let requestBody: Record<string, unknown>;
    let headers: Record<string, string>;

    // Handle provider-specific request formatting
    switch (config.provider) {
      case 'google':
        // Google Gemini uses different URL structure
        url = `${baseUrl}/models/${effectiveModel}:generateContent?key=${config.apiKey}`;
        requestBody = providerConfig.transformRequest!(options);
        headers = { 'Content-Type': 'application/json' };
        break;

      case 'huggingface':
        // Hugging Face uses model in URL
        url = `${baseUrl}/${effectiveModel}`;
        requestBody = providerConfig.transformRequest!(options);
        headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        };
        break;

      default:
        // OpenAI-compatible API
        url = `${baseUrl}/chat/completions`;
        requestBody = providerConfig.transformRequest
          ? providerConfig.transformRequest(options)
          : {
              model: effectiveModel,
              messages: options.messages,
              temperature: options.temperature ?? 0.7,
              max_tokens: options.max_tokens,
              stream: false,
            };
        headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
          ...(providerConfig.headers || {}),
        };
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${providerConfig.name} API error (${response.status}): ${errorText}`);
      }

      const responseData = await response.json();

      // Transform response if needed
      if (providerConfig.transformResponse) {
        return providerConfig.transformResponse(responseData);
      }

      return responseData as ChatCompletionResponse;

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

/**
 * Get LLM client with fallback to environment variables
 */
export async function getLLMClient(
  provider?: LLMProvider | null,
  apiKey?: string | null,
  model?: string | null
) {
  // Default provider
  const effectiveProvider = provider || 'zai';

  // API key priority: parameter > env variable (provider-specific) > generic env
  const key = apiKey
    || (typeof process !== 'undefined' && (
      process.env[`${effectiveProvider.toUpperCase()}_API_KEY`]
      || process.env[`${effectiveProvider.toUpperCase()}_KEY`]
      || process.env.LLM_API_KEY
      || process.env.ZAI_API_KEY
    ))
    || null;

  if (!key) {
    const providerName = LLM_PROVIDERS[effectiveProvider].name;
    throw new Error(
      `API key required for ${providerName}. ` +
      `Provide it in settings or set ${effectiveProvider.toUpperCase()}_API_KEY environment variable.`
    );
  }

  return createLLMClient({
    provider: effectiveProvider,
    apiKey: key,
    model: model || undefined,
  });
}

/**
 * Validate API key format for a provider
 */
export function validateApiKey(provider: LLMProvider, apiKey: string): boolean {
  const config = LLM_PROVIDERS[provider];
  if (!config.apiKeyPrefix) return true; // No prefix requirement
  return apiKey.startsWith(config.apiKeyPrefix) || apiKey.length > 10; // Relax validation
}

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
