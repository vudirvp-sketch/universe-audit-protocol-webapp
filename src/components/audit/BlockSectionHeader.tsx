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

interface BlockSectionHeaderProps {
  blockNumber: 1 | 2 | 3 | 4 | 5;
  label: string;
  result: BlockResult | null;
  isStreaming: boolean;
}

export function BlockSectionHeader({ blockNumber, label, result, isStreaming }: BlockSectionHeaderProps) {
  const status = getBlockStatus(result, isStreaming);

  return (
    <header className="sticky top-14 z-10 -mx-4 md:-mx-8 px-4 md:px-8 py-3 border-b bg-background">
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <StatusIndicator status={status} />
          <h2 className="text-xl font-semibold truncate">
            <span className="text-muted-foreground font-medium">{t.report.blockPrefix} {blockNumber}.</span>{' '}
            {label}
          </h2>
        </div>
        <div className="shrink-0 text-sm text-muted-foreground tabular-nums">
          {isStreaming
            ? t.report.streaming
            : result?.meta?.elapsedMs
              ? `${(result.meta.elapsedMs / 1000).toFixed(1)} с`
              : null}
        </div>
      </div>
    </header>
  );
}
