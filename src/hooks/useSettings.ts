// Settings hook for managing LLM provider and API key in localStorage
import { create } from 'zustand';
import type { LLMProvider } from '@/lib/llm-client';

const SETTINGS_STORAGE_KEY = 'universe-audit-settings';

export interface AppSettings {
  provider: LLMProvider;
  apiKey: string | null;
  model: string | null;
}

interface SettingsState extends AppSettings {
  isLoaded: boolean;

  // Actions
  loadSettings: () => void;
  setProvider: (provider: LLMProvider) => void;
  setApiKey: (key: string | null) => void;
  setModel: (model: string | null) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  clearSettings: () => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  provider: 'zai',
  apiKey: null,
  model: null,
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
        set({
          provider: parsed.provider || DEFAULT_SETTINGS.provider,
          apiKey: parsed.apiKey || null,
          model: parsed.model || null,
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
    const newSettings = { ...state, provider, model: null }; // Reset model when provider changes
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
    }));
  } catch {
    console.error('Failed to save settings to localStorage');
  }
}

// Hook that auto-loads settings on mount (client-side only)
export const useAppSettings = () => {
  const { provider, apiKey, model, isLoaded, loadSettings, setProvider, setApiKey, setModel, updateSettings, clearSettings } = useSettings();

  // Load on first use
  if (!isLoaded && typeof window !== 'undefined') {
    loadSettings();
  }

  return {
    provider,
    apiKey,
    model,
    isLoaded,
    setProvider,
    setApiKey,
    setModel,
    updateSettings,
    clearSettings,
  };
};

// Backwards compatibility alias
export const useApiKey = useAppSettings;
