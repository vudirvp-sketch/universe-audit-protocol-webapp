'use client';

import * as React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { BrandMark } from '@/components/BrandMark';
import type { BlockResult, OrientationContext, PipelinePhase } from '@/lib/audit/types-v3';
import { StatusIndicator } from '@/components/audit/StatusIndicator';
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

  const completedBlocks = phase === 'done'
    ? 5
    : BLOCKS.filter(b => b.index < currentBlock).length;
  const progressPercent = Math.round((completedBlocks / 5) * 100);
  const isRunning = phase === 'running';

  return (
    <>
      <button
        className="fixed bottom-4 left-4 z-40 md:hidden flex items-center gap-2 bg-card border rounded-sm px-3 py-2"
        onClick={() => setOpen(true)}
      >
        {isRunning ? (
          <StatusIndicator status="in_progress" size="sm" />
        ) : (
          <StatusIndicator status="completed" size="sm" />
        )}
        <span className="text-sm font-medium">{t.rail.blockShort.replace('{current}', String(currentBlock))}</span>
        <span className="text-xs text-muted-foreground">{progressPercent}%</span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-xl p-0 max-h-[70vh]">
          <SheetHeader className="px-4 pt-4 pb-2 border-b">
            <SheetTitle className="flex items-center gap-2">
              <BrandMark size={20} />
              {t.report.progress}
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
