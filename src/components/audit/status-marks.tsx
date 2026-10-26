import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Статус критерия кодируется формой, а не только цветом:
 *   PASS — сплошная заливка, FAIL — контур, INSUFFICIENT_DATA — штриховка.
 */
export type CellStatus = 'PASS' | 'FAIL' | 'INSUFFICIENT_DATA';

export const CELL_LABEL: Record<CellStatus, string> = {
  PASS: 'Выполнено',
  FAIL: 'Не выполнено',
  INSUFFICIENT_DATA: 'Нет данных',
};

const CELL_CLASS: Record<CellStatus, string> = {
  PASS: 'bg-severity-success',
  FAIL: 'bg-transparent ring-[1.5px] ring-inset ring-severity-critical',
  INSUFFICIENT_DATA:
    'bg-[repeating-linear-gradient(45deg,var(--border)_0_2px,transparent_2px_4px)] ring-1 ring-inset ring-border',
};

export function StatusMark({ status, className }: { status: CellStatus; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block size-3 shrink-0 rounded-[1px] align-[-1px]', CELL_CLASS[status], className)}
    />
  );
}

export function StatusLabel({ status, compact }: { status: CellStatus; compact?: boolean }) {
  const tone =
    status === 'PASS'
      ? 'text-severity-success'
      : status === 'FAIL'
        ? 'text-severity-critical'
        : 'text-muted-foreground';
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm font-medium', tone)}>
      <StatusMark status={status} />
      {/* compact: на узких экранах слово уходит из вида, но остаётся для скринридера */}
      <span className={compact ? 'max-sm:sr-only' : undefined}>{CELL_LABEL[status]}</span>
    </span>
  );
}
