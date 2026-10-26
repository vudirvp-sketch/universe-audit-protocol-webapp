/**
 * Key-custody contract: in session-only mode the API key must never reach the
 * long-lived localStorage settings entry (selectPersistedSettings is the
 * boundary the zustand persist middleware uses).
 */
import { describe, expect, it } from 'vitest';
import type { AppSettings } from '@/hooks/useSettings';
import { selectPersistedSettings } from '@/hooks/useSettings';

const BASE: AppSettings = {
  provider: 'google',
  apiKey: 'sk-live-SECRET-1234',
  model: 'gemini-2.5-flash',
  transport: 'relay',
  relayUrl: 'http://127.0.0.1:8787',
  rpmLimit: 10,
  baseUrl: null,
  customContextWindow: null,
  customMaxOutputTokens: null,
  customSupportsJSONMode: null,
  referenceComparison: false,
  keyMemoryOnly: false,
  sidebarCollapsed: false,
};

describe('selectPersistedSettings', () => {
  it('persists the key by default (explicit opt-in to disk)', () => {
    const persisted = selectPersistedSettings(BASE);
    expect(persisted.apiKey).toBe(BASE.apiKey);
  });

  it('drops the key when session-only mode is on', () => {
    const persisted = selectPersistedSettings({ ...BASE, keyMemoryOnly: true });
    expect(persisted.apiKey).toBeNull();
    expect(JSON.stringify(persisted)).not.toContain(BASE.apiKey);
  });

  it('keeps the session-only flag persisted so reload knows where the key lives', () => {
    const persisted = selectPersistedSettings({ ...BASE, keyMemoryOnly: true });
    expect(persisted.keyMemoryOnly).toBe(true);
  });

  it('persists every non-secret setting regardless of the mode', () => {
    const persisted = selectPersistedSettings({ ...BASE, keyMemoryOnly: true });
    expect(persisted.provider).toBe(BASE.provider);
    expect(persisted.model).toBe(BASE.model);
    expect(persisted.transport).toBe(BASE.transport);
    expect(persisted.relayUrl).toBe(BASE.relayUrl);
    expect(persisted.rpmLimit).toBe(BASE.rpmLimit);
  });
});
