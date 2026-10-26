'use client';

import * as React from 'react';
import type { PipelinePhase } from '@/lib/audit/types-v3';

interface UseKeyboardShortcutsOptions {
  phase: PipelinePhase;
  toggleSidebar: () => void;
  closeInspector: () => void;
}

/** What a single key press asks the workspace to do. */
export type ShortcutAction =
  | { type: 'none' }
  | { type: 'toggle-sidebar' }
  | { type: 'close-inspector' }
  | { type: 'scroll-to-block'; block: 1 | 2 | 3 | 4 | 5 };

/**
 * Pure key matcher.
 *
 * The bracket is matched by physical `code` as well as by `key`: on the Russian
 * (and any non-US) layout the key labelled `[` produces `х`, so matching only
 * `e.key` made the shortcut dead for RU-layout users.
 */
export function matchShortcut(
  event: Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey'>,
  phase: PipelinePhase,
): ShortcutAction {
  if (event.ctrlKey || event.metaKey || event.altKey) return { type: 'none' };

  if (event.key === '[' || event.code === 'BracketLeft') return { type: 'toggle-sidebar' };
  if (event.key === 'Escape') return { type: 'close-inspector' };

  if (phase === 'running' || phase === 'done') {
    if (event.key >= '1' && event.key <= '5') {
      return { type: 'scroll-to-block', block: Number(event.key) as 1 | 2 | 3 | 4 | 5 };
    }
  }

  return { type: 'none' };
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLElement) return target.isContentEditable;
  return false;
}

export function useKeyboardShortcuts({
  phase,
  toggleSidebar,
  closeInspector,
}: UseKeyboardShortcutsOptions) {
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (isTypingTarget(e.target)) return;

      const action = matchShortcut(e, phase);
      switch (action.type) {
        case 'toggle-sidebar':
          e.preventDefault();
          toggleSidebar();
          break;
        case 'close-inspector':
          closeInspector();
          break;
        case 'scroll-to-block': {
          const el = document.getElementById(`block-${action.block}`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, toggleSidebar, closeInspector]);
}
