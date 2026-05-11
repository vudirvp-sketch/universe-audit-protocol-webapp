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

function StreamingIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5 text-severity-streaming">
      <span className="inline-block h-2 w-2 rounded-full bg-severity-streaming animate-pulse" />
      <span className="text-sm">{t.report.streaming}</span>
    </span>
  );
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
    <header className="sticky top-14 z-10 -mx-4 md:-mx-8 px-4 md:px-8 py-3 border-b bg-background/95 backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StatusIndicator status={status} />
          <h2 className="text-xl font-semibold">
            {t.report.blockPrefix || 'БЛОК'} {blockNumber}: {label}
          </h2>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {result?.meta?.elapsedMs && <span>{(result.meta.elapsedMs / 1000).toFixed(1)}с</span>}
          {isStreaming && <StreamingIndicator />}
        </div>
      </div>
    </header>
  );
}
