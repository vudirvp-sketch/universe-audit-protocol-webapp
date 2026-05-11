'use client';

import { cn } from '@/lib/utils';

export type BlockStatus = 'waiting' | 'in_progress' | 'completed';

export function StatusIndicator({ status, size = 'md' }: { status: BlockStatus; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5';
  const colorClass =
    status === 'completed' ? 'bg-severity-success' :
    status === 'in_progress' ? 'bg-severity-streaming animate-pulse' :
    'bg-muted-foreground/30';

  return <span className={cn('inline-block rounded-full', sizeClass, colorClass)} />;
}
