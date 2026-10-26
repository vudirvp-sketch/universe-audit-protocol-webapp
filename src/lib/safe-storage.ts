import type { StateStorage } from 'zustand/middleware';

/**
 * localStorage.setItem throws QuotaExceededError once a persisted snapshot
 * (audit draft + guided framing + artefacts + five block reports, or the
 * settings record) exceeds the browser budget. zustand's persist middleware
 * does not catch it, so the exception escapes every state setter: the edit is
 * applied in memory, saving silently stops, and the next reload loses it.
 *
 * Wrapping the backing Storage turns a write failure into a callback instead
 * of an exception, so the app stays usable and the UI can tell the user.
 */
export function createSafeStorage(
  getBacking: () => Storage | null,
  onFailure: (message: string | null) => void = () => {},
): StateStorage {
  let failed = false;
  return {
    getItem: (name) => {
      try {
        return getBacking()?.getItem(name) ?? null;
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        const backing = getBacking();
        if (!backing) return;
        backing.setItem(name, value);
        if (failed) {
          failed = false;
          onFailure(null);
        }
      } catch {
        if (!failed) {
          failed = true;
          onFailure('storage_write_failed');
        }
      }
    },
    removeItem: (name) => {
      try {
        getBacking()?.removeItem(name);
      } catch {
        // nothing to clean up when storage itself is unavailable
      }
    },
  };
}
