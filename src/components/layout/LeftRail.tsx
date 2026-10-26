'use client';

import * as React from 'react';
import { cn, pluralRu } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import type { BlockResult, OrientationContext, PipelinePhase } from '@/lib/audit/types-v3';
import { StatusIndicator, type BlockStatus } from '@/components/audit/StatusIndicator';
import { t } from '@/lib/i18n/ru';

// ============================================================
// Types
// ============================================================

interface LeftRailProps {
  currentBlock: 0 | 1 | 2 | 3 | 4 | 5;
  onCancel: () => void;
  currentBlockTotalChunks?: number;
  currentChunkIndex?: number;
  blocks: (BlockResult | null)[];
  phase: PipelinePhase;
  orientationContext?: OrientationContext | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

// ============================================================
// Constants (shared with MobileProgressFAB)
// ============================================================

export const BLOCKS = [
  { index: 1, label: t.app.block1Label, defaultChunks: 1 },
  { index: 2, label: t.app.block2Label, defaultChunks: 4 },
  { index: 3, label: t.app.block3Label, defaultChunks: 2 },
  { index: 4, label: t.app.block4Label, defaultChunks: 1 },
  { index: 5, label: t.app.block5Label, defaultChunks: 1 },
] as const;

// ============================================================
// Helpers
// ============================================================

function getBlockStatus(
  blockIndex: number,
  currentBlock: 0 | 1 | 2 | 3 | 4 | 5,
  phase: PipelinePhase,
): BlockStatus {
  if (phase === 'done') return 'completed';
  if (blockIndex < currentBlock) return 'completed';
  if (blockIndex === currentBlock) return 'in_progress';
  return 'waiting';
}

// ============================================================
// Collapsed content
// ============================================================

function CollapsedContent({
  currentBlock,
  blocks,
  phase,
}: {
  currentBlock: 0 | 1 | 2 | 3 | 4 | 5;
  blocks: (BlockResult | null)[];
  phase: PipelinePhase;
}) {
  const completedBlocks = phase === 'done'
    ? 5
    : BLOCKS.filter(b => b.index < currentBlock).length;
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm font-semibold tabular-nums" aria-label={`Готово ${completedBlocks} из 5`}>
        {completedBlocks}/5
      </p>

      {/* 5 block dots */}
      <div className="flex flex-col items-center gap-2">
        {BLOCKS.map((block) => {
          const status = getBlockStatus(block.index, currentBlock, phase);
          const isActive = status === 'in_progress';
          const isClickable = status === 'completed';

          return (
            <button
              key={block.index}
              className={cn(
                'rounded-sm p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive && 'bg-accent',
                isClickable ? 'cursor-pointer hover:bg-accent' : 'cursor-default',
              )}
              aria-label={`${t.report.blockPrefix || 'Блок'} ${block.index}: ${block.label}`}
              onClick={() => {
                if (isClickable) {
                  const el = document.getElementById(`block-${block.index}`);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              title={`${t.report.blockPrefix || 'БЛОК'} ${block.index}: ${block.label}`}
            >
              <StatusIndicator status={status} size="md" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Expanded content (progress bar, block list, orientation context, cancel button)
// Exported for reuse by MobileProgressFAB.
// ============================================================

export function ExpandedContent({
  currentBlock,
  onCancel,
  currentBlockTotalChunks,
  currentChunkIndex,
  blocks,
  phase,
  orientationContext,
}: Omit<LeftRailProps, 'collapsed' | 'onToggleCollapse'>) {
  const completedBlocks = phase === 'done'
    ? 5
    : BLOCKS.filter(b => b.index < currentBlock).length;
  const progressPercent = Math.round((completedBlocks / 5) * 100);
  const isAuditing = currentBlock > 0 && currentBlock <= 5 && phase === 'running';

  const currentBlockInfo = BLOCKS.find(b => b.index === currentBlock);
  const totalChunks = currentBlockTotalChunks ?? currentBlockInfo?.defaultChunks ?? 1;
  const showChunks = totalChunks > 1 && currentBlock > 0;
  const chunkDisplay = showChunks && currentChunkIndex !== undefined
    ? ` (${t.rail.partOf.replace('{current}', String(currentChunkIndex + 1)).replace('{total}', String(totalChunks))})`
    : showChunks
      ? ` (${t.rail.parts.replace('{count}', String(totalChunks)).replace('{unit}', pluralRu(totalChunks, ['часть', 'части', 'частей']))})`
      : '';

  const progressLabel = phase === 'done'
    ? t.phases.complete
    : currentBlock > 0
      ? `${t.rail.blockOf.replace('{current}', String(Math.min(currentBlock, 5))).replace('{total}', '5')}${chunkDisplay}`
      : t.rail.preparing;

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{t.progress.progress}</span>
          <span>{progressLabel}</span>
        </div>
        <Progress value={progressPercent} className="h-1 rounded-none" />
      </div>

      {/* Block list — вертикальная линия со станциями */}
      <ol className="relative">
        <span aria-hidden="true" className="absolute left-[5px] top-2 bottom-2 w-px bg-border" />
        {BLOCKS.map((block) => {
          const status = getBlockStatus(block.index, currentBlock, phase);
          const isActive = status === 'in_progress';
          const blockResult = blocks[block.index];
          const isChunked = block.defaultChunks > 1;
          const chunkLabel = isChunked ? `${t.rail.parts.replace('{count}', String(block.defaultChunks)).replace('{unit}', pluralRu(block.defaultChunks, ['часть', 'части', 'частей']))}` : '';
          const elapsedLabel = blockResult?.meta?.elapsedMs
            ? `${(blockResult.meta.elapsedMs / 1000).toFixed(1)} с`
            : '';
          const tokenLabel = blockResult?.meta?.tokensUsed
            ? `${blockResult.meta.tokensUsed.total.toLocaleString('ru-RU')} ток.`
            : '';
          const isClickable = status === 'completed';
          const sub = [chunkLabel, elapsedLabel, tokenLabel].filter(Boolean).join(', ');

          const body = (
            <>
              <span className="mt-[3px] bg-background">
                <StatusIndicator status={status} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block text-sm leading-snug', isActive ? 'font-semibold' : 'font-medium', status === 'waiting' && 'text-muted-foreground')}>
                  {block.label}
                </span>
                {sub && <span className="block text-xs tabular-nums text-muted-foreground">{sub}</span>}
              </span>
            </>
          );

          return (
            <li key={block.index} className="relative">
              {isClickable ? (
                <button
                  type="button"
                  className="flex w-full items-start gap-3 rounded-sm py-2 text-left outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => {
                    document.getElementById(`block-${block.index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  {body}
                </button>
              ) : (
                <div className="flex items-start gap-3 py-2" aria-current={isActive ? 'step' : undefined}>{body}</div>
              )}
            </li>
          );
        })}
      </ol>

      {/* Orientation context */}
      {orientationContext && (
        <div className="pt-2 border-t space-y-1">
          <p className="text-sm font-semibold">{t.rail.auditContext}</p>
          {orientationContext.auditMode && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t.rail.mode}:</span>
              <span>{orientationContext.auditMode}</span>
            </div>
          )}
          {orientationContext.authorProfileType && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t.rail.profile}:</span>
              <span>{orientationContext.authorProfileType}</span>
            </div>
          )}
        </div>
      )}

      {/* Cancel button */}
      {isAuditing && (
        <div className="flex justify-end">
          <Button variant="destructive" size="sm" onClick={onCancel}>
            {t.app.cancelAudit}
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Main LeftRail component
// ============================================================

export function LeftRail({
  currentBlock,
  onCancel,
  currentBlockTotalChunks,
  currentChunkIndex,
  blocks,
  phase,
  orientationContext,
  collapsed,
  onToggleCollapse,
}: LeftRailProps) {
  return (
    <div
      className={cn(
        'hidden md:flex flex-col border-r bg-card transition-[width] duration-200 ease-in-out overflow-hidden shrink-0',
        collapsed ? 'w-16' : 'w-[280px]',
      )}
    >
      {/* Progress section */}
      <div className="flex-1 overflow-y-auto p-4">
        {collapsed ? (
          <CollapsedContent currentBlock={currentBlock} blocks={blocks} phase={phase} />
        ) : (
          <ExpandedContent
            currentBlock={currentBlock}
            onCancel={onCancel}
            currentBlockTotalChunks={currentBlockTotalChunks}
            currentChunkIndex={currentChunkIndex}
            blocks={blocks}
            phase={phase}
            orientationContext={orientationContext}
          />
        )}
      </div>

      {/* Bottom: Toggle button */}
      <div className="border-t p-2 shrink-0">
        <Button variant="ghost" size="icon" className="w-full" onClick={onToggleCollapse} aria-label={collapsed ? 'Развернуть панель' : 'Свернуть панель'}>
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
