'use client';

import * as React from 'react';
import type { BlockResult } from '@/lib/audit/types-v3';
import { StatusIndicator, type BlockStatus } from './StatusIndicator';
import { t } from '@/lib/i18n/ru';

function getBlockStatus(result: BlockResult | null, isStreaming: boolean): BlockStatus {
  if (result) return 'completed';
  if (isStreaming) return 'in_progress';
  return 'waiting';
}

const STATUS_LABEL: Record<BlockStatus, string> = {
  waiting: t.report.waiting,
  in_progress: t.report.streamingFull,
  completed: t.report.completed,
};

interface BlockSectionHeaderProps {
  blockNumber: 1 | 2 | 3 | 4 | 5;
  label: string;
  result: BlockResult | null;
  isStreaming: boolean;
}

/**
 * Шапка блока: липкая, одной линией. Номер блока — вторичным текстом,
 * название — обычным начертанием 600: это раздел документа, а не карточка.
 */
export function BlockSectionHeader({ blockNumber, label, result, isStreaming }: BlockSectionHeaderProps) {
  const status = getBlockStatus(result, isStreaming);
  const elapsedMs = result?.meta?.elapsedMs;

  return (
    <header className="sticky top-14 z-10 -mx-4 md:-mx-8 px-4 md:px-8 py-3 border-y bg-background">
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <StatusIndicator status={status} label={STATUS_LABEL[status]} />
          <h2 className="truncate text-xl font-semibold">
            <span className="font-normal text-muted-foreground">
              {t.report.blockPrefix} {blockNumber}.
            </span>{' '}
            {label}
          </h2>
        </div>
        <div className="shrink-0 text-sm tabular-nums text-muted-foreground">
          {isStreaming ? (
            t.report.streaming
          ) : typeof elapsedMs === 'number' && elapsedMs > 0 ? (
            `${(elapsedMs / 1000).toFixed(1)} с`
          ) : null}
        </div>
      </div>
    </header>
  );
}
