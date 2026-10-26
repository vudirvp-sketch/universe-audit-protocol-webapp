'use client';

import { cn } from '@/lib/utils';

export type BlockStatus = 'waiting' | 'in_progress' | 'completed';

const STATUS_LABEL: Record<BlockStatus, string> = {
  waiting: 'Ожидает',
  in_progress: 'Идёт',
  completed: 'Готово',
};

/** Маркер блока: контур — ожидает, контур с точкой — идёт, заливка — готово. */
export function StatusIndicator({ status, size = 'md' }: { status: BlockStatus; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'size-2.5' : 'size-3';
  const look =
    status === 'completed'
      ? 'bg-severity-success'
      : status === 'in_progress'
        ? 'bg-transparent ring-[1.5px] ring-inset ring-severity-streaming after:absolute after:inset-[3px] after:bg-severity-streaming after:animate-pulse'
        : 'bg-transparent ring-[1.5px] ring-inset ring-muted-foreground/50';

  return (
    <span
      role="img"
      aria-label={STATUS_LABEL[status]}
      className={cn('relative inline-block shrink-0 rounded-[1px]', sizeClass, look)}
    />
  );
}
