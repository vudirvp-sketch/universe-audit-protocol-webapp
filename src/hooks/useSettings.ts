// Settings hook for managing LLM provider, API key, and proxy URL
// Uses Zustand persist middleware with skipHydration (same pattern as useAuditState)
// to prevent React hydration mismatch in static-export Next.js apps.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LLMProvider } from '@/lib/llm-client';

const SETTINGS_STORAGE_KEY = 'universe-audit-settings';

// Provider-specific default RPM limits (requests per minute)
const PROVIDER_RPM_DEFAULTS: Record<string, number> = {
  zai: 3,       // Free tier is very limited — 3 RPM is realistic
  openai: 60,
  anthropic: 60,
  google: 10,      // Free tier is often 10-15 RPM
  mistral: 30,
  deepseek: 30,
  qwen: 30,
  kimi: 30,
  groq: 20,        // Free tier has burst limits
  openrouter: 30,  // Free models have lower limits
  huggingface: 5,  // Often overloaded
  together: 15,
  xai: 30,
  custom: 10,
};

export interface AppSettings {
  provider: LLMProvider;
  apiKey: string | null;
  model: string | null;
  proxyUrl: string;
  rpmLimit: number;
  // Custom model capabilities (user override, advanced settings)
  customContextWindow: number | null;
  customMaxOutputTokens: number | null;
  customSupportsJSONMode: boolean | null;
}

interface SettingsState extends AppSettings {
  isLoaded: boolean;

  // Actions
  setProvider: (provider: LLMProvider) => void;
  setApiKey: (key: string | null) => void;
  setModel: (model: string | null) => void;
  setProxyUrl: (url: string) => void;
  setRpmLimit: (limit: number) => void;
  setCustomContextWindow: (value: number | null) => void;
  setCustomMaxOutputTokens: (value: number | null) => void;
  setCustomSupportsJSONMode: (value: boolean | null) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  clearSettings: () => void;
}

// Default proxy URL — pre-configured CORS proxy for this app.
// If you are self-hosting, update this URL to point to your own proxy.
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
  customContextWindow: null,
  customMaxOutputTokens: null,
  customSupportsJSONMode: null,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,
      isLoaded: false,

      setProvider: (provider: LLMProvider) => {
        set({
          provider,
          model: null, // Reset model when provider changes
          rpmLimit: PROVIDER_RPM_DEFAULTS[provider] || get().rpmLimit,
        });
      },

      setApiKey: (apiKey: string | null) => {
        set({ apiKey });
      },

      setModel: (model: string | null) => {
        set({ model });
      },

      setProxyUrl: (proxyUrl: string) => {
        set({ proxyUrl });
      },

      setRpmLimit: (rpmLimit: number) => {
        set({ rpmLimit });
      },

      setCustomContextWindow: (customContextWindow: number | null) => {
        set({ customContextWindow });
      },

      setCustomMaxOutputTokens: (customMaxOutputTokens: number | null) => {
        set({ customMaxOutputTokens });
      },

      setCustomSupportsJSONMode: (customSupportsJSONMode: boolean | null) => {
        set({ customSupportsJSONMode });
      },

      updateSettings: (settings: Partial<AppSettings>) => {
        set(settings);
      },

      clearSettings: () => {
        set({ ...DEFAULT_SETTINGS, isLoaded: true });
      },
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      // CRITICAL: skipHydration prevents React Error #185 (hydration mismatch).
      // Same pattern as useAuditState — rehydrate() is called in useEffect in page.tsx.
      skipHydration: true,
      // Only persist AppSettings fields (not isLoaded or action functions)
      partialize: (state) => ({
        provider: state.provider,
        apiKey: state.apiKey,
        model: state.model,
        proxyUrl: state.proxyUrl,
        rpmLimit: state.rpmLimit,
        customContextWindow: state.customContextWindow,
        customMaxOutputTokens: state.customMaxOutputTokens,
        customSupportsJSONMode: state.customSupportsJSONMode,
      }),
      // After rehydration, mark as loaded and apply defaults for missing fields
      onRehydrateStorage: () => {
        return (state) => {
          if (state) {
            // Apply PROXY_URL_DEFAULT if proxyUrl is empty
            if (!state.proxyUrl) {
              state.proxyUrl = PROXY_URL_DEFAULT;
            }
            // Apply provider-specific RPM if rpmLimit is 0 or missing
            if (!state.rpmLimit || state.rpmLimit <= 0) {
              state.rpmLimit = PROVIDER_RPM_DEFAULTS[state.provider] || PROVIDER_RPM_DEFAULTS.zai;
            }
            state.isLoaded = true;
          }
        };
      },
    }
  )
);

// Exported for use in page.tsx to trigger rehydration on mount
export const rehydrateSettings = () => {
  useSettings.persist.rehydrate();
};

// Exported to check hydration status
export const hasSettingsHydrated = () => {
  return useSettings.persist.hasHydrated();
};
