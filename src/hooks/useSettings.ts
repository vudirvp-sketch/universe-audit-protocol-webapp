// Settings hook for managing LLM provider, API key, and proxy URL in localStorage
// All config is client-side — no environment variables or server-side references
import React from 'react';
import { create } from 'zustand';
import type { LLMProvider } from '@/lib/llm-client';

const SETTINGS_STORAGE_KEY = 'universe-audit-settings';

// Provider-specific default RPM limits (requests per minute)
const PROVIDER_RPM_DEFAULTS: Record<string, number> = {
  zai: 3,       // Free tier is very limited — 3 RPM is realistic
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

// Default proxy URL — the CORS proxy Worker is deployed at this URL.
// Cloudflare Workers subdomain: vudirvp
// If you redeploy to a different account, update this URL accordingly.
const PROXY_URL_DEFAULT = 'https://universe-audit-proxy.vudirvp.workers.dev';
const PROXY_URL_PLACEHOLDER = '<your-subdomain>';

/** Check if the proxy URL is still the unconfigured placeholder */
export function isProxyUrlPlaceholder(url: string): boolean {
  return url.includes(PROXY_URL_PLACEHOLDER);
}

const DEFAULT_SETTINGS: AppSettings = {
  provider: 'zai',
  apiKey: null,
  model: null,
  proxyUrl: PROXY_URL_DEFAULT,
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
          proxyUrl: parsed.proxyUrl || PROXY_URL_DEFAULT,
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
      set({ ...DEFAULT_SETTINGS, isLoaded: true });
    } catch {
      // Silently fail — localStorage may be unavailable
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
    // Silently fail — localStorage may be unavailable
  }
}

// Hook that auto-loads settings on mount (client-side only)
export const useAppSettings = () => {
  const {
    provider, apiKey, model, proxyUrl, rpmLimit, isLoaded,
    loadSettings, setProvider, setApiKey, setModel, setProxyUrl, setRpmLimit,
    updateSettings, clearSettings,
  } = useSettings();

  // Save on first use — via useEffect, not during render
  React.useEffect(() => {
    if (!isLoaded && typeof window !== 'undefined') {
      loadSettings();
    }
  }, [isLoaded, loadSettings]);

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


