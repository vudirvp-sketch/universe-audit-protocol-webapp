'use client';

import * as React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { BlockResult, OrientationContext, PipelinePhase } from '@/lib/audit/types-v3';
import { StatusIndicator, type BlockStatus } from '@/components/audit/StatusIndicator';
import { BLOCKS, ExpandedContent } from './LeftRail';
import { t } from '@/lib/i18n/ru';

// ============================================================
// Props
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

// ============================================================
// Component
// ============================================================

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

  const status: BlockStatus =
    phase === 'done' ? 'completed' : phase === 'running' ? 'in_progress' : 'waiting';

  const completedBlocks = phase === 'done'
    ? 5
    : BLOCKS.filter(b => b.index < currentBlock).length;

  const blockLabel = t.rail.blockOf
    .replace('{current}', String(currentBlock))
    .replace('{total}', '5');

  return (
    <>
      <button
        type="button"
        aria-label={`${t.report.progress}: ${blockLabel}`}
        className="fixed bottom-4 left-4 z-40 md:hidden flex min-h-10 items-center gap-2 rounded-sm border border-border bg-card px-3 py-2"
        onClick={() => setOpen(true)}
      >
        <StatusIndicator status={status} size="sm" />
        <span className="text-sm text-foreground">{t.rail.blockShort.replace('{current}', String(currentBlock))}</span>
        <span className="text-xs tabular-nums text-muted-foreground">{completedBlocks}/5</span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-md p-0 max-h-[70vh]">
          <SheetHeader className="px-4 pt-4 pb-3 border-b border-border">
            <SheetTitle className="text-base">{t.report.progress}</SheetTitle>
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
