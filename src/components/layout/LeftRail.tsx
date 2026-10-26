'use client';

import * as React from 'react';
import { cn, pluralRu } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
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
  { index: 3, label: t.app.block3Label, defaultChunks: 3 },
  { index: 4, label: t.app.block4Label, defaultChunks: 3 },
  { index: 5, label: t.app.block5Label, defaultChunks: 2 },
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

function completedBlocks(currentBlock: 0 | 1 | 2 | 3 | 4 | 5, phase: PipelinePhase): number {
  return phase === 'done' ? 5 : BLOCKS.filter(b => b.index < currentBlock).length;
}

/** «4 части», а не «4 частей»: t.rail.parts принимает число и склонённую форму. */
function partsLabel(count: number): string {
  return t.rail.parts
    .replace('{count}', String(count))
    .replace('{unit}', pluralRu(count, t.rail.partUnits));
}

function blockOfLabel(blockIndex: number): string {
  return t.rail.blockOf.replace('{current}', String(blockIndex)).replace('{total}', '5');
}

function scrollToBlock(blockIndex: number): void {
  const el = document.getElementById(`block-${blockIndex}`);
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============================================================
// Collapsed content: счётчик станций, без кругового прогресса
// ============================================================

function CollapsedContent({
  currentBlock,
  phase,
}: {
  currentBlock: 0 | 1 | 2 | 3 | 4 | 5;
  phase: PipelinePhase;
}) {
  const completed = completedBlocks(currentBlock, phase);

  return (
    <div className="flex flex-col items-center gap-3" role="group" aria-label={t.report.progress}>
      <span className="text-xs tabular-nums text-muted-foreground">
        {completed}/5
      </span>
      <ol className="flex flex-col items-center gap-3">
        {BLOCKS.map((block) => {
          const status = getBlockStatus(block.index, currentBlock, phase);
          const isClickable = status === 'completed';

          return (
            <li key={block.index}>
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => scrollToBlock(block.index)}
                aria-label={`${blockOfLabel(block.index)}: ${block.label}`}
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-sm',
                  isClickable && 'cursor-pointer hover:bg-accent',
                )}
              >
                <StatusIndicator status={status} size="sm" />
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ============================================================
// Expanded content: вертикальная волосяная линия со станциями
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
  const isAuditing = currentBlock > 0 && currentBlock <= 5 && phase === 'running';

  const currentBlockInfo = BLOCKS.find(b => b.index === currentBlock);
  const totalChunks = currentBlockTotalChunks ?? currentBlockInfo?.defaultChunks ?? 1;
  const showChunks = totalChunks > 1 && currentBlock > 0;
  const chunkDisplay = showChunks && currentChunkIndex !== undefined
    ? ` (${t.rail.partOf.replace('{current}', String(currentChunkIndex + 1)).replace('{total}', String(totalChunks))})`
    : showChunks
      ? ` (${partsLabel(totalChunks)})`
      : '';

  const progressLabel = phase === 'done'
    ? t.phases.complete
    : currentBlock > 0
      ? `${blockOfLabel(Math.min(currentBlock, 5))}${chunkDisplay}`
      : t.rail.preparing;

  return (
    <div className="space-y-4">
      {/* Строка состояния пайплайна */}
      <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2 text-sm">
        <span className="text-muted-foreground shrink-0">{t.progress.progress}</span>
        <span className="text-right text-muted-foreground">{progressLabel}</span>
      </div>

      {/* Станции на волосяной линии */}
      <div className="relative">
        <span aria-hidden="true" className="absolute bottom-3 left-[4px] top-3 w-px bg-border" />
        <ol>
          {BLOCKS.map((block) => {
            const status = getBlockStatus(block.index, currentBlock, phase);
            const isActive = status === 'in_progress';
            const blockResult = blocks[block.index];
            const chunkLabel = block.defaultChunks > 1 ? ` (${partsLabel(block.defaultChunks)})` : '';
            const elapsedLabel = blockResult?.meta?.elapsedMs
              ? `${(blockResult.meta.elapsedMs / 1000).toFixed(1)}с`
              : '';
            const tokenLabel = blockResult?.meta?.tokensUsed
              ? `${blockResult.meta.tokensUsed.total.toLocaleString()} tok`
              : '';
            const isClickable = status === 'completed';

            return (
              <li key={block.index}>
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => scrollToBlock(block.index)}
                  className={cn(
                    'flex w-full items-start gap-2.5 rounded-sm py-2 text-left',
                    isClickable && 'cursor-pointer hover:bg-accent/40',
                  )}
                >
                  <span className="relative z-10 mt-[7px] flex h-2.5 w-2.5 shrink-0 items-center justify-center bg-background">
                    <StatusIndicator status={status} size="sm" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'block text-sm',
                        isActive
                          ? 'font-semibold text-foreground'
                          : status === 'completed'
                            ? 'text-foreground/80'
                            : 'text-muted-foreground',
                      )}
                    >
                      {block.label}{chunkLabel}
                    </span>
                    {(elapsedLabel || tokenLabel) && (
                      <span className="mt-0.5 flex flex-wrap gap-x-2 font-mono text-xs tabular-nums text-muted-foreground">
                        {elapsedLabel && <span>{elapsedLabel}</span>}
                        {tokenLabel && <span>{tokenLabel}</span>}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Orientation context — audit mode + authorship hypothesis (v16 §2, §4.2) */}
      {orientationContext && (
        <div className="space-y-1 border-t border-border pt-3">
          <p className="text-sm text-muted-foreground">{t.rail.auditContext}</p>
          {orientationContext.auditMode && (
            <div className="flex justify-between gap-2 text-sm">
              <span className="text-muted-foreground shrink-0">{t.rail.mode}</span>
              <span className="text-right">{t.modes[orientationContext.auditMode]}</span>
            </div>
          )}
          {orientationContext.authorshipHypothesis && (
            <div className="space-y-1 pt-1">
              <p className="text-sm text-muted-foreground">{t.rail.authorship}</p>
              <p className="text-sm">{orientationContext.authorshipHypothesis}</p>
            </div>
          )}
        </div>
      )}

      {/* Cancel button */}
      {isAuditing && (
        <div className="flex justify-end border-t border-border pt-3">
          <Button variant="outline" size="sm" className="rounded-sm" onClick={onCancel}>
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
        'hidden md:flex flex-col border-r border-border bg-background transition-[width] duration-200 ease-in-out overflow-hidden shrink-0',
        collapsed ? 'w-16' : 'w-[280px]',
      )}
    >
      {/* Top: brand */}
      <div
        className={cn(
          'flex items-center gap-2 h-14 border-b border-border shrink-0',
          collapsed ? 'justify-center px-2' : 'px-3',
        )}
      >
        <BrandMark size={collapsed ? 20 : 22} />
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{t.rail.brandName}</p>
            <p className="text-xs text-muted-foreground truncate">{t.rail.brandSub}</p>
          </div>
        )}
      </div>

      {/* Stations */}
      <div className="flex-1 overflow-y-auto p-3">
        {collapsed ? (
          <CollapsedContent currentBlock={currentBlock} phase={phase} />
        ) : (
          <div id="rail-progress">
            <ExpandedContent
              currentBlock={currentBlock}
              onCancel={onCancel}
              currentBlockTotalChunks={currentBlockTotalChunks}
              currentChunkIndex={currentChunkIndex}
              blocks={blocks}
              phase={phase}
              orientationContext={orientationContext}
            />
          </div>
        )}
      </div>

      {/* Bottom: collapse toggle */}
      <div className="border-t border-border p-2 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="w-full rounded-sm"
          onClick={onToggleCollapse}
          aria-label={t.report.navigation}
          aria-expanded={!collapsed}
          aria-controls="rail-progress"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
