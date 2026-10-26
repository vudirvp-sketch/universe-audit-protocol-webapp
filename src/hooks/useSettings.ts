// Settings hook for managing LLM provider, API key, and proxy URL
// Uses Zustand persist middleware with skipHydration (same pattern as useAuditState)
// to prevent React hydration mismatch in static-export Next.js apps.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { LLM_PROVIDERS } from '@/lib/llm-client';
import type { LLMProvider } from '@/lib/llm-client';
import { createSafeStorage } from '@/lib/safe-storage';

const SETTINGS_STORAGE_KEY = 'universe-audit-settings';
// When the user opts into "do not persist the key", it lives only in the
// current tab's sessionStorage (survives reload, dies with the tab) instead of
// long-lived localStorage. localStorage never receives the key in that mode.
const SESSION_KEY_STORAGE = 'universe-audit-session-api-key';

function readSessionKey(): string | null {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    return window.sessionStorage.getItem(SESSION_KEY_STORAGE);
  } catch {
    return null;
  }
}

function writeSessionKey(key: string | null): void {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    if (key) {
      window.sessionStorage.setItem(SESSION_KEY_STORAGE, key);
    } else {
      window.sessionStorage.removeItem(SESSION_KEY_STORAGE);
    }
  } catch {
    // Storage may be unavailable (private mode, disabled cookies) — the key
    // still works in memory for this page load.
  }
}

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
  // Custom provider base URL (for 'custom' provider type)
  baseUrl: string | null;
  // Custom model capabilities (user override, advanced settings)
  customContextWindow: number | null;
  customMaxOutputTokens: number | null;
  customSupportsJSONMode: boolean | null;
  // Audit feature flags
  referenceComparison: boolean;
  // When true, the API key is kept in sessionStorage only (never written to
  // the long-lived localStorage settings entry).
  keyMemoryOnly: boolean;
  // UI state
  sidebarCollapsed: boolean;
}

interface SettingsState extends AppSettings {
  isLoaded: boolean;

  // Actions
  setProvider: (provider: LLMProvider) => void;
  setApiKey: (key: string | null) => void;
  setModel: (model: string | null) => void;
  setProxyUrl: (url: string) => void;
  setRpmLimit: (limit: number) => void;
  setBaseUrl: (url: string | null) => void;
  setCustomContextWindow: (value: number | null) => void;
  setCustomMaxOutputTokens: (value: number | null) => void;
  setCustomSupportsJSONMode: (value: boolean | null) => void;
  setReferenceComparison: (value: boolean) => void;
  setKeyMemoryOnly: (value: boolean) => void;
  setSidebarCollapsed: (value: boolean) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  clearSettings: () => void;
}

// Default proxy URL — pre-configured CORS proxy for this app.
// This proxy is already deployed and working. Do not change unless
// you are self-hosting your own proxy.
export const PROXY_URL_DEFAULT = 'https://universe-audit-proxy.vudirvp.workers.dev';
const PROXY_URL_PLACEHOLDER = '<your-subdomain>';

// One adapter for the lifetime of the module: a failed write must not throw out
// of every settings setter (quota / private mode), and the failure flag has to
// survive across calls.
const settingsStorage = createSafeStorage(
  () => (typeof window === 'undefined' ? null : window.localStorage),
);

/** Check if the proxy URL is still the unconfigured placeholder */
export function isProxyUrlPlaceholder(url: string): boolean {
  return url.includes(PROXY_URL_PLACEHOLDER);
}

/**
 * Get the default model for a given provider.
 * Single source of truth — always reads from LLM_PROVIDERS.
 */
function getDefaultModelForProvider(provider: LLMProvider): string {
  return LLM_PROVIDERS[provider]?.defaultModel || 'default';
}

const DEFAULT_SETTINGS: AppSettings = {
  provider: 'google',
  apiKey: null,
  model: getDefaultModelForProvider('google'),  // gemini-2.5-flash — synced with LLM_PROVIDERS
  proxyUrl: PROXY_URL_DEFAULT,
  rpmLimit: PROVIDER_RPM_DEFAULTS.google,
  baseUrl: null,
  customContextWindow: null,
  customMaxOutputTokens: null,
  customSupportsJSONMode: null,
  referenceComparison: false,
  keyMemoryOnly: false,
  sidebarCollapsed: false,
};

/**
 * Build the object written to localStorage. In session-only mode the key is
 * replaced by null — the real key is mirrored to sessionStorage by setApiKey
 * and setKeyMemoryOnly. Exported for tests: this is the security boundary.
 */
export function selectPersistedSettings(state: AppSettings): AppSettings {
  return {
    provider: state.provider,
    apiKey: state.keyMemoryOnly ? null : state.apiKey,
    model: state.model,
    proxyUrl: state.proxyUrl,
    rpmLimit: state.rpmLimit,
    baseUrl: state.baseUrl,
    customContextWindow: state.customContextWindow,
    customMaxOutputTokens: state.customMaxOutputTokens,
    customSupportsJSONMode: state.customSupportsJSONMode,
    referenceComparison: state.referenceComparison,
    keyMemoryOnly: state.keyMemoryOnly,
    sidebarCollapsed: state.sidebarCollapsed,
  };
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,
      isLoaded: false,

      setProvider: (provider: LLMProvider) => {
        set({
          provider,
          model: getDefaultModelForProvider(provider), // Auto-set from LLM_PROVIDERS
          rpmLimit: PROVIDER_RPM_DEFAULTS[provider] || get().rpmLimit,
        });
      },

      setApiKey: (apiKey: string | null) => {
        set({ apiKey });
        // Mirror to sessionStorage in session-only mode; make sure a previous
        // session copy cannot outlive a key change in normal mode.
        if (get().keyMemoryOnly) {
          writeSessionKey(apiKey);
        } else {
          writeSessionKey(null);
        }
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

      setBaseUrl: (baseUrl: string | null) => {
        set({ baseUrl });
      },

      setCustomSupportsJSONMode: (customSupportsJSONMode: boolean | null) => {
        set({ customSupportsJSONMode });
      },

      setReferenceComparison: (referenceComparison: boolean) => {
        set({ referenceComparison });
      },

      setKeyMemoryOnly: (keyMemoryOnly: boolean) => {
        const currentKey = get().apiKey;
        if (keyMemoryOnly) {
          // Keep the key usable in this tab without writing it to localStorage.
          writeSessionKey(currentKey);
        } else {
          writeSessionKey(null);
        }
        set({ keyMemoryOnly });
      },

      setSidebarCollapsed: (sidebarCollapsed: boolean) => {
        set({ sidebarCollapsed });
      },

      updateSettings: (settings: Partial<AppSettings>) => {
        set(settings);
      },

      clearSettings: () => {
        writeSessionKey(null);
        set({ ...DEFAULT_SETTINGS, isLoaded: true });
      },
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      // CRITICAL: skipHydration prevents React Error #185 (hydration mismatch).
      // Same pattern as useAuditState — rehydrate() is called in useEffect in page.tsx.
      skipHydration: true,
      // Storage can throw (private mode, quota). A failed write must not escape
      // every settings setter — the key and provider simply stay unsaved.
      storage: createJSONStorage(() => settingsStorage),
      // Only persist AppSettings fields (not isLoaded or action functions).
      // selectPersistedSettings drops the API key in session-only mode.
      partialize: (state) => selectPersistedSettings(state),
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
            // Migration: auto-upgrade outdated default models
            // gemini-2.0-flash → gemini-2.5-flash (Google's recommended default)
            if (state.provider === 'google' && state.model === 'gemini-2.0-flash') {
              state.model = 'gemini-2.5-flash';
            }
            // claude-3-5-sonnet-20241022 → claude-sonnet-4-6 (Anthropic's recommended default)
            if (state.provider === 'anthropic' && (state.model === 'claude-3-5-sonnet-20241022' || state.model === 'claude-3-5-sonnet')) {
              state.model = 'claude-sonnet-4-6';
            }
            // If model is null, set from provider's defaultModel
            if (!state.model) {
              state.model = getDefaultModelForProvider(state.provider);
            }
            // Session-only key: localStorage intentionally has no key, restore
            // it from sessionStorage for this tab.
            if (state.keyMemoryOnly) {
              state.apiKey = readSessionKey();
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
