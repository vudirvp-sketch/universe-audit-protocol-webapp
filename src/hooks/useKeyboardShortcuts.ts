'use client';

import * as React from 'react';
import type { PipelinePhase } from '@/lib/audit/types-v3';

interface UseKeyboardShortcutsOptions {
  phase: PipelinePhase;
  toggleSidebar: () => void;
  closeInspector: () => void;
}

export function useKeyboardShortcuts({
  phase,
  toggleSidebar,
  closeInspector,
}: UseKeyboardShortcutsOptions) {
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // [ — toggle sidebar
      if (e.key === '[') {
        e.preventDefault();
        toggleSidebar();
      }

      // Escape — close inspector drawer
      if (e.key === 'Escape') {
        closeInspector();
      }

      // 1-5 — scroll to block (during running/done)
      if (e.key >= '1' && e.key <= '5' && (phase === 'running' || phase === 'done')) {
        const blockNum = parseInt(e.key) as 1 | 2 | 3 | 4 | 5;
        const el = document.getElementById(`block-${blockNum}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, toggleSidebar, closeInspector]);
}
