/**
 * Persistence and run-lifecycle tests for the audit store (useAuditStateV3).
 *
 * The store is exercised through its public actions against a fake `window`
 * (vitest runs in the node environment, so `window`/`localStorage` are supplied
 * per test before the store module is imported).
 *
 * Regression under test: localStorage.setItem throws QuotaExceededError once the
 * persisted snapshot exceeds the browser budget. zustand's persist does not catch
 * it, so the exception escaped every state setter and saving silently stopped.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { AuditStateV3 } from '@/hooks/useAuditStateV3';
import { t } from '@/lib/i18n/ru';

type StoreHook = typeof import('@/hooks/useAuditStateV3')['useAuditStateV3'];

interface FakeStorageOptions {
  failReads?: boolean;
  /** When true, setItem behaves like a full localStorage (QuotaExceededError). */
  failWrites?: boolean;
}

function createFakeStorage(options: FakeStorageOptions = {}) {
  const data = new Map<string, string>();
  const storage = {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    getItem: (name: string) => {
      if (options.failReads) throw new Error('SecurityError');
      return data.get(name) ?? null;
    },
    setItem: (name: string, value: string) => {
      if (options.failWrites) {
        const error = new Error('QuotaExceededError');
        error.name = 'QuotaExceededError';
        throw error;
      }
      data.set(name, value);
    },
    removeItem: (name: string) => {
      data.delete(name);
    },
  };
  return { storage: storage as unknown as Storage, options, data };
}

async function loadStore(storage: Storage): Promise<StoreHook> {
  (globalThis as unknown as { window?: unknown }).window = { localStorage: storage };
  vi.resetModules();
  const storeModule = await import('@/hooks/useAuditStateV3');
  return storeModule.useAuditStateV3;
}

const MATERIAL = { label: 'Лор-библия', text: 'Текст артефакта' };

beforeEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
});

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
  vi.resetModules();
});

describe('useAuditStateV3 — localStorage quota', () => {
  it('does not throw when the snapshot exceeds the quota and flags the draft as unsaved', async () => {
    const fake = createFakeStorage({ failWrites: true });
    const store = await loadStore(fake.storage);

    expect(() => store.getState().setMaterials([MATERIAL])).not.toThrow();

    // The edit must still apply — a failed write is not a failed interaction.
    expect(store.getState().materials).toEqual([MATERIAL]);
    expect(store.getState().storageError).toBe(t.form.storageError);
  });

  it('keeps the last successfully saved snapshot when a later write fails', async () => {
    const fake = createFakeStorage();
    const store = await loadStore(fake.storage);

    store.getState().setMaterials([MATERIAL]);
    const saved = fake.data.get('audit-state-v3');
    expect(saved).toBeTruthy();

    fake.options.failWrites = true;
    store.getState().setMaterials([MATERIAL, { label: 'Второй', text: 'ещё текст' }]);

    expect(fake.data.get('audit-state-v3')).toBe(saved);
    expect(store.getState().materials).toHaveLength(2);
    expect(store.getState().storageError).toBe(t.form.storageError);
  });

  it('clears the warning once storage accepts writes again', async () => {
    const fake = createFakeStorage({ failWrites: true });
    const store = await loadStore(fake.storage);

    store.getState().setInputText('черновик');
    expect(store.getState().storageError).not.toBeNull();

    fake.options.failWrites = false;
    store.getState().setInputText('черновик 2');

    expect(store.getState().storageError).toBeNull();
    expect(fake.data.get('audit-state-v3')).toContain('черновик 2');
  });

  it('survives a storage that throws on read', async () => {
    const fake = createFakeStorage({ failReads: true });
    const store = await loadStore(fake.storage);

    await expect(store.persist.rehydrate()).resolves.toBeUndefined();
    expect(store.getState().phase).toBe('idle');
  });
});

describe('useAuditStateV3 — persisted shape', () => {
  it('never writes the LLM API key to localStorage', async () => {
    const fake = createFakeStorage();
    const store = await loadStore(fake.storage);

    store.getState().setLlmConfig({
      provider: 'openai',
      model: 'gpt-test',
      apiKey: 'sk-secret-value',
    });
    // Any state write flushes the persisted snapshot.
    store.getState().setInputText('черновик');

    const saved = fake.data.get('audit-state-v3') ?? '';
    expect(saved).not.toBe('');
    expect(saved).not.toContain('sk-secret-value');
    expect(saved).not.toContain('apiKey');
    expect(saved).not.toMatch(/sk-/);
    // The live config may keep the key in memory; only persistence must not.
    expect(store.getState().llmConfig?.apiKey).toBe('sk-secret-value');
  });
});

describe('useAuditStateV3 — cancelling a run', () => {
  function seedDraft(store: StoreHook) {
    store.getState().setInputText('Авторский концепт');
    store.getState().setGuided({ genre: 'тёмное фэнтези' });
    store.getState().setMaterials([MATERIAL]);
    store.getState().setMediaType('game');
  }

  it('abortAudit drops the run but keeps the author draft', async () => {
    const fake = createFakeStorage();
    const store = await loadStore(fake.storage);
    seedDraft(store);

    store.getState().startAudit();
    store.getState().setBlockResult(1, {
      blockNumber: 1,
      markdown: '# Блок 1',
      weaknessesSummary: '',
      meta: {
        elapsedMs: 10,
        tokensUsed: null,
        model: 'test',
        temperature: 0.2,
        completionStatus: 'complete',
      },
    } satisfies Parameters<AuditStateV3['setBlockResult']>[1]);

    const running = store.getState();
    expect(running.phase).toBe('running');
    expect(running.inputText).toBe('Авторский концепт');

    store.getState().abortAudit();

    const state = store.getState();
    expect(state.phase).toBe('idle');
    expect(state.block1).toBeNull();
    expect(state.currentBlock).toBe(0);
    // Draft survives cancelling — the user cancels a run, not their own work.
    expect(state.inputText).toBe('Авторский концепт');
    expect(state.guided).toEqual({ genre: 'тёмное фэнтези' });
    expect(state.materials).toEqual([MATERIAL]);
    expect(state.mediaType).toBe('game');
  });

  it('reset still clears both the run and the draft', async () => {
    const fake = createFakeStorage();
    const store = await loadStore(fake.storage);
    seedDraft(store);
    store.getState().startAudit();

    store.getState().reset();

    const state = store.getState();
    expect(state.phase).toBe('idle');
    expect(state.inputText).toBe('');
    expect(state.guided).toEqual({});
    expect(state.materials).toEqual([]);
    expect(state.mediaType).toBe('narrative');
  });
});
