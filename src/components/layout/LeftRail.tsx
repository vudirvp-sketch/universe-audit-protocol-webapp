'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Sparkles, ChevronRight, ChevronLeft } from 'lucide-react';
import type { BlockResult, OrientationContext, PipelinePhase } from '@/lib/audit/types-v3';
import { StatusIndicator, type BlockStatus } from '@/components/audit/StatusIndicator';

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
// Constants
// ============================================================

const BLOCKS = [
  { index: 1, label: 'Ориентация', defaultChunks: 1 },
  { index: 2, label: 'Механизм (L1)', defaultChunks: 4 },
  { index: 3, label: 'Тело + Психика (L2+L3)', defaultChunks: 2 },
  { index: 4, label: 'Мета (L4)', defaultChunks: 1 },
  { index: 5, label: 'Синтез + Рекомендации', defaultChunks: 1 },
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
// Small circular progress SVG for collapsed mode
// ============================================================

function MiniCircularProgress({ percent, size = 40 }: { percent: number; size?: number }) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  const colorClass =
    percent >= 75 ? 'stroke-severity-success' :
    percent >= 50 ? 'stroke-severity-warning' :
    'stroke-severity-critical';

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/20"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className={colorClass}
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
    </svg>
  );
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
  const progressPercent = Math.round((completedBlocks / 5) * 100);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Mini circular progress */}
      <div className="relative">
        <MiniCircularProgress percent={progressPercent} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold">{progressPercent}%</span>
        </div>
      </div>

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
                'rounded-full p-0',
                isActive && 'ring-2 ring-amber-500',
                isClickable && 'cursor-pointer hover:opacity-80',
              )}
              onClick={() => {
                if (isClickable) {
                  const el = document.getElementById(`block-${block.index}`);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              title={`Блок ${block.index}: ${block.label}`}
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
// Expanded content (reuses AuditProgressV3 logic without Card wrapper)
// ============================================================

function ExpandedContent({
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
    ? ` (часть ${currentChunkIndex + 1}/${totalChunks})`
    : showChunks
      ? ` (${totalChunks} частей)`
      : '';

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Прогресс</span>
          <span>{phase === 'done' ? 'Завершено' : currentBlock > 0 ? `Блок ${Math.min(currentBlock, 5)} из 5${chunkDisplay}` : 'Подготовка...'}</span>
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      {/* Block list */}
      <div className="space-y-1">
        {BLOCKS.map((block) => {
          const status = getBlockStatus(block.index, currentBlock, phase);
          const isActive = status === 'in_progress';
          const blockResult = blocks[block.index];
          const isChunked = block.defaultChunks > 1;
          const chunkLabel = isChunked ? ` (${block.defaultChunks} части)` : '';
          const elapsedLabel = blockResult?.meta?.elapsedMs
            ? `${(blockResult.meta.elapsedMs / 1000).toFixed(1)}с`
            : '';
          const tokenLabel = blockResult?.meta?.tokensUsed
            ? `${blockResult.meta.tokensUsed.total.toLocaleString()} tok`
            : '';
          const isClickable = status === 'completed';

          return (
            <div
              key={block.index}
              className={cn(
                'flex items-center gap-3 p-2 rounded-md transition-colors',
                isClickable ? 'cursor-pointer hover:bg-accent/50' : '',
                isActive ? 'bg-accent' : status === 'completed' ? 'opacity-70' : 'opacity-50',
              )}
              onClick={() => {
                if (isClickable) {
                  const el = document.getElementById(`block-${block.index}`);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              role={isClickable ? 'button' : undefined}
              tabIndex={isClickable ? 0 : undefined}
            >
              <StatusIndicator status={status} size="sm" />
              <span className="text-sm font-medium flex-1 truncate">{block.label}{chunkLabel}</span>
              {elapsedLabel && (
                <span className="text-sm text-muted-foreground">{elapsedLabel}</span>
              )}
              {tokenLabel && (
                <span className="text-sm text-muted-foreground">{tokenLabel}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Orientation context */}
      {orientationContext && (
        <div className="pt-2 border-t space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Контекст аудита</p>
          {orientationContext.auditMode && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Режим:</span>
              <span>{orientationContext.auditMode}</span>
            </div>
          )}
          {orientationContext.authorProfileType && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Профиль:</span>
              <span>{orientationContext.authorProfileType}</span>
            </div>
          )}
        </div>
      )}

      {/* Cancel button */}
      {isAuditing && (
        <div className="flex justify-end">
          <Button variant="destructive" size="sm" onClick={onCancel}>
            Отменить аудит
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
      {/* Top: Logo/Brand */}
      <div className="flex items-center gap-2 px-3 h-14 border-b shrink-0">
        {collapsed ? (
          <Sparkles className="h-5 w-5 text-amber-500 shrink-0" />
        ) : (
          <>
            <Sparkles className="h-5 w-5 text-amber-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">Universe Audit</p>
              <p className="text-xs text-muted-foreground truncate">PROTOCOL</p>
            </div>
          </>
        )}
      </div>

      {/* Progress section */}
      <div className="flex-1 overflow-y-auto p-3">
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
        <Button variant="ghost" size="icon" className="w-full" onClick={onToggleCollapse}>
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Mobile FAB (floating action button)
// ============================================================

interface MobileProgressFABProps {
  currentBlock: 0 | 1 | 2 | 3 | 4 | 5;
  blocks: (BlockResult | null)[];
  phase: PipelinePhase;
  onCancel: () => void;
  currentBlockTotalChunks?: number;
  currentChunkIndex?: number;
  orientationContext?: OrientationContext | null;
}

export function MobileProgressFAB({
  currentBlock,
  blocks,
  phase,
  onCancel,
  currentBlockTotalChunks,
  currentChunkIndex,
  orientationContext,
}: MobileProgressFABProps) {
  const [open, setOpen] = React.useState(false);

  const completedBlocks = phase === 'done'
    ? 5
    : BLOCKS.filter(b => b.index < currentBlock).length;
  const progressPercent = Math.round((completedBlocks / 5) * 100);
  const isRunning = phase === 'running';

  return (
    <>
      <button
        className="fixed bottom-4 left-4 z-40 md:hidden flex items-center gap-2 bg-card border rounded-full px-3 py-2 shadow-lg"
        onClick={() => setOpen(true)}
      >
        {isRunning ? (
          <span className="inline-block h-2 w-2 rounded-full bg-severity-streaming animate-pulse" />
        ) : (
          <StatusIndicator status="completed" size="sm" />
        )}
        <span className="text-sm font-medium">Блок {currentBlock}/5</span>
        <span className="text-xs text-muted-foreground">{progressPercent}%</span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-xl p-0 max-h-[70vh]">
          <SheetHeader className="px-4 pt-4 pb-2 border-b">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Прогресс аудита
            </SheetTitle>
          </SheetHeader>
          <div className="p-4 overflow-y-auto max-h-[60vh]">
            <ExpandedContent
              currentBlock={currentBlock}
              onCancel={() => { onCancel(); setOpen(false); }}
              currentBlockTotalChunks={currentBlockTotalChunks}
              currentChunkIndex={currentChunkIndex}
              blocks={blocks}
              phase={phase}
              orientationContext={orientationContext}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
