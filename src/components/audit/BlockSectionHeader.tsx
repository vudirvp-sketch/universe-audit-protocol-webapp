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
 * Шапка блока: липкая, одной линией, по ширине текстовой колонки.
 *
 * Номер блока — вторичным текстом, название — обычным начертанием 600:
 * это раздел документа, а не карточка. Название переносится, а не обрезается:
 * это смысловой заголовок, а не метаданные.
 *
 * `top-[57px]` — высота верхней панели (h-14 + hairline). Смещение задано
 * числом, а не классом `top-14`, иначе заголовок на 1 px заезжает под панель.
 */
export function BlockSectionHeader({ blockNumber, label, result, isStreaming }: BlockSectionHeaderProps) {
  const status = getBlockStatus(result, isStreaming);
  const elapsedMs = result?.meta?.elapsedMs;
  const truncated = result?.meta?.completionStatus === 'partial';

  return (
    <header className="sticky top-[57px] z-10 border-y border-border bg-background py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="translate-y-[-1px]">
            <StatusIndicator status={status} label={STATUS_LABEL[status]} />
          </span>
          <h2 className="text-lg font-semibold leading-snug text-balance md:text-xl">
            <span className="font-normal text-muted-foreground">
              {t.report.blockPrefix} {blockNumber}.
            </span>{' '}
            {label}
          </h2>
        </div>
        <div className="shrink-0 text-sm tabular-nums text-muted-foreground">
          {isStreaming ? (
            t.report.streaming
          ) : (
            <span className="flex items-baseline gap-2">
              {typeof elapsedMs === 'number' && elapsedMs > 0 && (
                <span>{(elapsedMs / 1000).toFixed(1)} с</span>
              )}
              {truncated && (
                <span className="text-severity-warning" title={t.report.truncatedHint}>
                  {t.report.truncated}
                </span>
              )}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
