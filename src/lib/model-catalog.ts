// Live model discovery.
//
// Every provider publishes its model list at a fixed endpoint. Reading it from
// the app means the settings screen never ships a stale hardcoded catalog: the
// list a user sees is what the provider actually serves today. The hardcoded
// lists in PREFERRED_MODELS remain only as an offline fallback for when the
// list call fails (no key yet, relay down, CORS, network).
//
// Transport follows the rest of the app:
//   - direct — the browser GETs the provider's list URL itself (CORS required);
//   - relay  — POST {relayUrl}/api/models with the same provider-pinned
//              targetUrl the chat path uses, so the relay can forward the call
//              and keep the key server-side (LLM_API_KEY).
//
// Model ids are not secrets, so the cache lives in localStorage with a TTL.

import {
  buildProviderAuthHeaders,
  PREFERRED_MODELS,
  RELAY_URL_DEFAULT,
  validateRelayUrl,
  type LLMProvider,
  type LLMTransport,
} from './llm-client';

// ============================================================================
// PROVIDER LIST ENDPOINTS
// ============================================================================

export interface ModelListTarget {
  /** Absolute URL of the provider's model-list endpoint. */
  url: string;
  /** Extra headers the list call needs beyond provider auth. */
  extraHeaders?: Record<string, string>;
  /** Turn the provider's JSON into model ids. */
  parse: (payload: unknown) => string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readArray(payload: unknown, key: string): Array<Record<string, unknown>> {
  if (!isRecord(payload)) return [];
  const value = payload[key];
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord);
}

/**
 * OpenAI-compatible `GET /models` → `{ data: [{ id }] }`.
 * Non-chat endpoints (embeddings, TTS, image, moderation) are dropped: they
 * cannot answer an audit and would only clutter the picker.
 */
export function parseOpenAICompatibleModels(payload: unknown): string[] {
  const nonChat = /(embed|embedding|whisper|tts|speech|transcri|dall-e|dalle|moderation|rerank|guard|image|audio|ocr)/i;
  return readArray(payload, 'data')
    .map((entry) => String(entry.id || ''))
    .filter((id) => id.length > 0 && !nonChat.test(id));
}

/** Anthropic `GET /v1/models` → `{ data: [{ id, display_name }] }`. */
export function parseAnthropicModels(payload: unknown): string[] {
  return readArray(payload, 'data')
    .map((entry) => String(entry.id || ''))
    .filter(Boolean);
}

/**
 * Gemini `GET /v1beta/models` → `{ models: [{ name: "models/gemini-…",
 * supportedGenerationMethods: [...] }] }`. Keep only ids that can actually
 * generate content; strip the "models/" prefix the API returns.
 */
export function parseGeminiModels(payload: unknown): string[] {
  return readArray(payload, 'models')
    .filter((entry) => {
      const methods = entry.supportedGenerationMethods;
      return !Array.isArray(methods) || (methods as string[]).includes('generateContent');
    })
    .map((entry) => String(entry.name || '').replace(/^models\//, ''))
    // Embedding/vision-only ids occasionally omit supportedGenerationMethods.
    .filter((id) => id.length > 0 && !/embed/i.test(id));
}

/** OpenRouter `GET /api/v1/models` → `{ data: [{ id }] }`, no key required. */
export function parseOpenRouterModels(payload: unknown): string[] {
  return readArray(payload, 'data')
    .map((entry) => String(entry.id || ''))
    // Variants an audit cannot use: :batch is offline-only, :free is a weak
    // sample of the model, "~" ids are rotating aliases. Drop the noise.
    .filter((id) => id.length > 0 && !/:batch|:free|^~/.test(id));
}

/**
 * Where each provider publishes its catalog. Providers without a public list
 * endpoint (Hugging Face inference, custom OpenAI-compatible endpoints) are
 * absent here on purpose: their model ids are deployment-specific.
 */
export const MODEL_LIST_TARGETS: Partial<Record<LLMProvider, ModelListTarget>> = {
  google: {
    // pageSize default is 50: ask for the whole catalog in one call.
    url: 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',
    parse: parseGeminiModels,
  },
  anthropic: {
    url: 'https://api.anthropic.com/v1/models?limit=1000',
    parse: parseAnthropicModels,
  },
  openai: {
    url: 'https://api.openai.com/v1/models',
    parse: parseOpenAICompatibleModels,
  },
  deepseek: {
    url: 'https://api.deepseek.com/models',
    parse: parseOpenAICompatibleModels,
  },
  groq: {
    url: 'https://api.groq.com/openai/v1/models',
    parse: parseOpenAICompatibleModels,
  },
  mistral: {
    url: 'https://api.mistral.ai/v1/models',
    parse: parseOpenAICompatibleModels,
  },
  together: {
    url: 'https://api.together.xyz/v1/models',
    parse: parseOpenAICompatibleModels,
  },
  xai: {
    url: 'https://api.x.ai/v1/models',
    parse: parseOpenAICompatibleModels,
  },
  qwen: {
    url: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/models',
    parse: parseOpenAICompatibleModels,
  },
  kimi: {
    url: 'https://api.moonshot.ai/v1/models',
    parse: parseOpenAICompatibleModels,
  },
  zai: {
    url: 'https://api.z.ai/api/paas/v4/models',
    parse: parseOpenAICompatibleModels,
  },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/models',
    parse: parseOpenRouterModels,
  },
};

/** True when the provider's list endpoint works without an API key. */
export function isPublicModelList(provider: LLMProvider): boolean {
  return provider === 'openrouter';
}

// ============================================================================
// FETCHING
// ============================================================================

export interface FetchModelIdsOptions {
  provider: LLMProvider;
  apiKey?: string;
  transport?: LLMTransport;
  relayUrl?: string;
  signal?: AbortSignal;
  /** Per-call timeout (default 20 s). */
  timeoutMs?: number;
  /** Injection seam for tests. */
  fetchImpl?: typeof fetch;
}

export class ModelListError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelListError';
  }
}

function timeoutSignal(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // Browsers fire 'abort' on both signals; clear the timer when either wins.
  const clear = () => clearTimeout(timer);
  controller.signal.addEventListener('abort', clear, { once: true });
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return controller.signal;
}

function parseProviderModels(provider: LLMProvider, payload: unknown): string[] {
  const target = MODEL_LIST_TARGETS[provider];
  if (!target) return [];
  const ids = target.parse(payload);
  // Deduplicate while preserving provider order.
  return [...new Set(ids)];
}

/**
 * Ask the provider for its current model ids.
 * Throws ModelListError with a Russian, actionable message on failure.
 */
export async function fetchModelIds(options: FetchModelIdsOptions): Promise<string[]> {
  const {
    provider,
    apiKey = '',
    transport = 'direct',
    relayUrl = RELAY_URL_DEFAULT,
    signal,
    timeoutMs = 20_000,
  } = options;
  const doFetch = options.fetchImpl ?? fetch;

  const target = MODEL_LIST_TARGETS[provider];
  if (!target) {
    throw new ModelListError(
      'У этого провайдера нет публичного списка моделей — введите идентификатор модели вручную.',
    );
  }

  let requestUrl: string;
  let requestInit: RequestInit;

  if (transport === 'relay') {
    const relayCheck = validateRelayUrl(relayUrl);
    if (!relayCheck.valid) {
      throw new ModelListError(relayCheck.error || 'Некорректный URL локального релея.');
    }
    requestUrl = `${relayUrl.replace(/\/+$/, '')}/api/models`;
    requestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, apiKey, targetUrl: target.url }),
    };
  } else {
    if (!apiKey && !isPublicModelList(provider)) {
      throw new ModelListError('Сначала укажите API-ключ, чтобы загрузить список моделей.');
    }
    requestUrl = target.url;
    requestInit = {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(apiKey ? buildProviderAuthHeaders(provider, apiKey) : {}),
        ...(target.extraHeaders || {}),
      },
    };
  }

  let response: Response;
  try {
    response = await doFetch(requestUrl, { ...requestInit, signal: timeoutSignal(signal, timeoutMs) });
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    if (name === 'AbortError') {
      throw new ModelListError(
        'Список моделей не загрузился: провайдер не ответил за ' + Math.round(timeoutMs / 1000) + ' с.',
      );
    }
    throw new ModelListError(
      transport === 'relay'
        ? 'Список моделей не загрузился: локальный релей недоступен. Запустите `node relay/relay.mjs`.'
        : 'Список моделей не загрузился: браузер не смог обратиться к API провайдера (CORS или сеть). Переключитесь на локальный релей.',
    );
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ModelListError(`Ключ отклонён при загрузке списка моделей (${response.status}).`);
    }
    if (response.status === 429) {
      throw new ModelListError('Слишком много запросов при загрузке списка моделей (429). Попробуйте позже.');
    }
    if (response.status === 404) {
      throw new ModelListError('Провайдер не отдаёт список моделей по этому адресу (404) — введите модель вручную.');
    }
    throw new ModelListError(`Список моделей не загрузился: провайдер вернул ${response.status}.`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ModelListError('Провайдер вернул не JSON вместо списка моделей.');
  }

  const ids = parseProviderModels(provider, payload);
  if (ids.length === 0) {
    throw new ModelListError('Список моделей пуст — введите идентификатор модели вручную.');
  }
  return ids;
}

// ============================================================================
// CACHE
// ============================================================================

const CATALOG_CACHE_KEY = 'universe-audit-model-catalog-v1';
/** Models change rarely; a day-old list is still useful and costs one request. */
export const MODEL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface CachedModels {
  ids: string[];
  fetchedAt: number;
}

type CatalogCache = Partial<Record<LLMProvider, CachedModels>>;

function readCache(): CatalogCache {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    const raw = window.localStorage.getItem(CATALOG_CACHE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? (parsed as CatalogCache) : {};
  } catch {
    return {};
  }
}

function writeCache(cache: CatalogCache): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Quota / private mode — the live list still works for this page load.
  }
}

/** Cached ids for a provider, or null when absent/expired/malformed. */
export function readCachedModels(
  provider: LLMProvider,
  maxAgeMs: number = MODEL_CACHE_TTL_MS,
  now: number = Date.now(),
): CachedModels | null {
  const entry = readCache()[provider];
  if (!entry || !Array.isArray(entry.ids) || entry.ids.length === 0) return null;
  if (typeof entry.fetchedAt !== 'number' || now - entry.fetchedAt > maxAgeMs) return null;
  return { ids: entry.ids.filter((id): id is string => typeof id === 'string'), fetchedAt: entry.fetchedAt };
}

export function writeCachedModels(
  provider: LLMProvider,
  ids: string[],
  now: number = Date.now(),
): void {
  const cache = readCache();
  cache[provider] = { ids, fetchedAt: now };
  writeCache(cache);
}

export function clearModelCache(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(CATALOG_CACHE_KEY);
    }
  } catch {
    // nothing to clear
  }
}

// ============================================================================
// ORCHESTRATION (used by the settings dialog)
// ============================================================================

/** Offline list: what the app ships when no live list is available. */
export function getStaticModels(provider: LLMProvider): string[] {
  return PREFERRED_MODELS[provider] ?? [];
}

export type ModelCatalogSource = 'cache' | 'api' | 'fallback';

export interface ModelCatalogResult {
  ids: string[];
  source: ModelCatalogSource;
  fetchedAt: number | null;
  /** Present when the live refresh failed and a fallback was used. */
  error?: string;
}

export interface LoadModelCatalogOptions extends FetchModelIdsOptions {
  /** Accept a cached list younger than this (default 24 h); 0 forces a refetch. */
  maxCacheAgeMs?: number;
  /** When true, a fresh cache is returned without any network call. */
  preferCache?: boolean;
}

/**
 * Resolve the model list for a provider: fresh cache → live API → stale cache
 * → built-in fallback. Never throws: the settings screen must stay usable
 * offline, with the reason surfaced as `error`.
 */
export async function loadModelCatalog(
  options: LoadModelCatalogOptions,
): Promise<ModelCatalogResult> {
  const { provider, maxCacheAgeMs = MODEL_CACHE_TTL_MS, preferCache = false } = options;

  if (preferCache) {
    const cached = readCachedModels(provider, maxCacheAgeMs);
    if (cached) return { ids: cached.ids, source: 'cache', fetchedAt: cached.fetchedAt };
  }

  try {
    const ids = await fetchModelIds(options);
    const fetchedAt = Date.now();
    writeCachedModels(provider, ids, fetchedAt);
    return { ids, source: 'api', fetchedAt };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const cached = readCachedModels(provider, Number.POSITIVE_INFINITY);
    if (cached) {
      return { ids: cached.ids, source: 'cache', fetchedAt: cached.fetchedAt, error: message };
    }
    return { ids: getStaticModels(provider), source: 'fallback', fetchedAt: null, error: message };
  }
}
