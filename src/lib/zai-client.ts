// Custom ZAI API client that supports runtime API key
// This client allows passing API key dynamically instead of reading from config file

interface ZAIClientConfig {
  apiKey: string;
  baseUrl?: string;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionOptions {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface ChatCompletionResponse {
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

const DEFAULT_BASE_URL = 'https://api.z.ai/v1';

/**
 * Creates a ZAI API client with the provided API key
 * This allows runtime API key configuration instead of file-based config
 */
export function createZAIClient(config: ZAIClientConfig) {
  const { apiKey, baseUrl = DEFAULT_BASE_URL } = config;

  /**
   * Create a chat completion
   */
  async function chatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
    const url = `${baseUrl}/chat/completions`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'X-Z-AI-From': 'Z',
    };

    const requestBody = {
      model: options.model || 'default',
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens,
      stream: false,
      thinking: { type: 'disabled' },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ZAI API error (${response.status}): ${errorText}`);
      }

      return await response.json() as ChatCompletionResponse;
    } catch (error) {
      console.error('ZAI chat completion error:', error);
      throw error;
    }
  }

  return {
    chatCompletion,
    /**
     * Simple chat completions interface (compatible with SDK pattern)
     */
    chat: {
      completions: {
        create: chatCompletion,
      },
    },
  };
}

/**
 * Get ZAI client with fallback to environment variable
 * Priority: provided key > ZAI_API_KEY env var
 */
export async function getZAIClient(apiKey?: string | null) {
  // Use provided key or fall back to environment variable
  const key = apiKey || process.env.ZAI_API_KEY;
  
  if (!key) {
    throw new Error(
      'ZAI API key is required. Either provide it in settings or set ZAI_API_KEY environment variable.'
    );
  }

  return createZAIClient({ apiKey: key });
}

export type ZAIClient = ReturnType<typeof createZAIClient>;
