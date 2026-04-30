// Settings hook for managing LLM provider, API key, and proxy URL in localStorage
// All config is client-side — no environment variables or server-side references
import { create } from 'zustand';
import type { LLMProvider } from '@/lib/llm-client';

const SETTINGS_STORAGE_KEY = 'universe-audit-settings';

// Provider-specific default RPM limits (requests per minute)
const PROVIDER_RPM_DEFAULTS: Record<string, number> = {
  zai: 10,
  openai: 60,
  anthropic: 60,
  google: 15,
  mistral: 30,
  deepseek: 30,
  qwen: 30,
  kimi: 30,
  groq: 30,
  openrouter: 60,
  huggingface: 10,
  together: 30,
  xai: 30,
  custom: 10,
};

export interface AppSettings {
  provider: LLMProvider;
  apiKey: string | null;
  model: string | null;
  proxyUrl: string;
  rpmLimit: number;
}

interface SettingsState extends AppSettings {
  isLoaded: boolean;

  // Actions
  loadSettings: () => void;
  setProvider: (provider: LLMProvider) => void;
  setApiKey: (key: string | null) => void;
  setModel: (model: string | null) => void;
  setProxyUrl: (url: string) => void;
  setRpmLimit: (limit: number) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  clearSettings: () => void;
}

// Default proxy URL placeholder — users MUST replace <your-subdomain> with their actual Cloudflare Workers subdomain.
// If the URL still contains '<your-subdomain>', the proxy will not work.
const PROXY_URL_PLACEHOLDER = '<your-subdomain>';
const DEFAULT_PROXY_URL = `https://audit-proxy.${PROXY_URL_PLACEHOLDER}.workers.dev`;

/** Check if the proxy URL is still the unconfigured placeholder */
export function isProxyUrlPlaceholder(url: string): boolean {
  return url.includes(PROXY_URL_PLACEHOLDER);
}

const DEFAULT_SETTINGS: AppSettings = {
  provider: 'zai',
  apiKey: null,
  model: null,
  proxyUrl: DEFAULT_PROXY_URL,
  rpmLimit: PROVIDER_RPM_DEFAULTS.zai,
};

export const useSettings = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,
  isLoaded: false,

  loadSettings: () => {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<AppSettings>;
        const provider = parsed.provider || DEFAULT_SETTINGS.provider;
        set({
          provider,
          apiKey: parsed.apiKey || null,
          model: parsed.model || null,
          proxyUrl: parsed.proxyUrl || DEFAULT_PROXY_URL,
          rpmLimit: parsed.rpmLimit || PROVIDER_RPM_DEFAULTS[provider] || DEFAULT_SETTINGS.rpmLimit,
          isLoaded: true,
        });
      } else {
        set({ ...DEFAULT_SETTINGS, isLoaded: true });
      }
    } catch {
      set({ ...DEFAULT_SETTINGS, isLoaded: true });
    }
  },

  setProvider: (provider: LLMProvider) => {
    const state = get();
    const newSettings = {
      ...state,
      provider,
      model: null, // Reset model when provider changes
      rpmLimit: PROVIDER_RPM_DEFAULTS[provider] || state.rpmLimit,
    };
    saveToStorage(newSettings);
    set(newSettings);
  },

  setApiKey: (apiKey: string | null) => {
    const state = get();
    const newSettings = { ...state, apiKey };
    saveToStorage(newSettings);
    set(newSettings);
  },

  setModel: (model: string | null) => {
    const state = get();
    const newSettings = { ...state, model };
    saveToStorage(newSettings);
    set(newSettings);
  },

  setProxyUrl: (proxyUrl: string) => {
    const state = get();
    const newSettings = { ...state, proxyUrl };
    saveToStorage(newSettings);
    set(newSettings);
  },

  setRpmLimit: (rpmLimit: number) => {
    const state = get();
    const newSettings = { ...state, rpmLimit };
    saveToStorage(newSettings);
    set(newSettings);
  },

  updateSettings: (settings: Partial<AppSettings>) => {
    const state = get();
    const newSettings = { ...state, ...settings };
    saveToStorage(newSettings);
    set(newSettings);
  },

  clearSettings: () => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(SETTINGS_STORAGE_KEY);
      set({ ...DEFAULT_SETTINGS });
    } catch {
      console.error('Failed to clear settings from localStorage');
    }
  },
}));

// Helper to save to localStorage
function saveToStorage(settings: AppSettings) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
      provider: settings.provider,
      apiKey: settings.apiKey,
      model: settings.model,
      proxyUrl: settings.proxyUrl,
      rpmLimit: settings.rpmLimit,
    }));
  } catch {
    console.error('Failed to save settings to localStorage');
  }
}

// Hook that auto-loads settings on mount (client-side only)
export const useAppSettings = () => {
  const {
    provider, apiKey, model, proxyUrl, rpmLimit, isLoaded,
    loadSettings, setProvider, setApiKey, setModel, setProxyUrl, setRpmLimit,
    updateSettings, clearSettings,
  } = useSettings();

  // Load on first use
  if (!isLoaded && typeof window !== 'undefined') {
    loadSettings();
  }

  return {
    provider,
    apiKey,
    model,
    proxyUrl,
    rpmLimit,
    isLoaded,
    setProvider,
    setApiKey,
    setModel,
    setProxyUrl,
    setRpmLimit,
    updateSettings,
    clearSettings,
  };
};


