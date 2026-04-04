// Settings hook for managing API key in localStorage
import { create } from 'zustand';

const API_KEY_STORAGE_KEY = 'universe-audit-api-key';

interface SettingsState {
  apiKey: string | null;
  isLoaded: boolean;
  
  // Actions
  loadApiKey: () => void;
  setApiKey: (key: string | null) => void;
  clearApiKey: () => void;
}

export const useSettings = create<SettingsState>((set) => ({
  apiKey: null,
  isLoaded: false,
  
  loadApiKey: () => {
    if (typeof window === 'undefined') return;
    
    try {
      const storedKey = localStorage.getItem(API_KEY_STORAGE_KEY);
      set({ 
        apiKey: storedKey || null, 
        isLoaded: true 
      });
    } catch {
      // localStorage might not be available
      set({ apiKey: null, isLoaded: true });
    }
  },
  
  setApiKey: (key: string | null) => {
    if (typeof window === 'undefined') return;
    
    try {
      if (key) {
        localStorage.setItem(API_KEY_STORAGE_KEY, key);
      } else {
        localStorage.removeItem(API_KEY_STORAGE_KEY);
      }
      set({ apiKey: key });
    } catch {
      // localStorage might not be available
      console.error('Failed to save API key to localStorage');
    }
  },
  
  clearApiKey: () => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
      set({ apiKey: null });
    } catch {
      console.error('Failed to clear API key from localStorage');
    }
  },
}));

// Hook that auto-loads API key on mount (client-side only)
export const useApiKey = () => {
  const { apiKey, isLoaded, loadApiKey, setApiKey, clearApiKey } = useSettings();
  
  // Load on first use
  if (!isLoaded && typeof window !== 'undefined') {
    loadApiKey();
  }
  
  return {
    apiKey,
    isLoaded,
    setApiKey,
    clearApiKey,
  };
};
