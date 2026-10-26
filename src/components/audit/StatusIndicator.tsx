'use client';

import { cn } from '@/lib/utils';

export type BlockStatus = 'waiting' | 'in_progress' | 'completed';

/**
 * Станция блока: смысл несёт форма, а не цвет.
 *
 *   waiting     — волосяной контур
 *   in_progress — контур + внутренняя точка (единственное место с пульсом)
 *   completed   — сплошная заливка severity-success
 *
 * Обычно декоративный: подпись станции рядом всегда текстовая. Где маркер
 * единственный носитель состояния (шапка блока), передаётся `label` —
 * тогда он становится accessible image с этим именем.
 */
export function StatusIndicator({
  status,
  size = 'md',
  label,
}: {
  status: BlockStatus;
  size?: 'sm' | 'md';
  label?: string;
}) {
  return (
    <span
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      className={cn(
        'relative inline-block shrink-0 rounded-[1px] align-[-1px]',
        size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3',
        status === 'completed' && 'bg-severity-success',
        status === 'in_progress' && 'ring-1 ring-inset ring-severity-streaming',
        status === 'waiting' && 'ring-1 ring-inset ring-border',
      )}
    >
      {status === 'in_progress' && (
        <span className="absolute inset-[2px] animate-pulse rounded-[1px] bg-severity-streaming" />
      )}
    </span>
  );
}
