'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { StatusIndicator, type BlockStatus } from './StatusIndicator';
import type { BlockResult, OrientationContext, PipelinePhase } from '@/lib/audit/types-v3';

interface AuditProgressV3Props {
  currentBlock: 0 | 1 | 2 | 3 | 4 | 5;
  onCancel: () => void;
  /** Total chunks for the current block (if chunked execution) */
  currentBlockTotalChunks?: number;
  /** Current chunk index (0-based) within the current block */
  currentChunkIndex?: number;
  blocks: (BlockResult | null)[];
  phase: PipelinePhase;
  orientationContext?: OrientationContext | null;
}

const BLOCKS = [
  { index: 1, label: 'Ориентация', defaultChunks: 1 },
  { index: 2, label: 'Механизм (L1)', defaultChunks: 4 },
  { index: 3, label: 'Тело + Психика (L2+L3)', defaultChunks: 2 },
  { index: 4, label: 'Мета (L4)', defaultChunks: 1 },
  { index: 5, label: 'Синтез + Рекомендации', defaultChunks: 1 },
] as const;

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

export function AuditProgressV3({
  currentBlock,
  onCancel,
  currentBlockTotalChunks,
  currentChunkIndex,
  blocks,
  phase,
  orientationContext,
}: AuditProgressV3Props) {
  // Progress: show completed blocks / total, not current block / total
  const completedBlocks = phase === 'done'
    ? 5
    : BLOCKS.filter(b => b.index < currentBlock).length;
  const progressPercent = Math.round((completedBlocks / 5) * 100);
  const isAuditing = currentBlock > 0 && currentBlock <= 5 && phase === 'running';

  // Determine the chunk display for the current block
  const currentBlockInfo = BLOCKS.find(b => b.index === currentBlock);
  const totalChunks = currentBlockTotalChunks ?? currentBlockInfo?.defaultChunks ?? 1;
  const showChunks = totalChunks > 1 && currentBlock > 0;
  const chunkDisplay = showChunks && currentChunkIndex !== undefined
    ? ` (часть ${currentChunkIndex + 1}/${totalChunks})`
    : showChunks
      ? ` (${totalChunks} частей)`
      : '';

  // Title changes based on phase
  const cardTitle = phase === 'done' ? 'Навигация по отчёту' : 'Прогресс аудита v3';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{cardTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Прогресс</span>
            <span>{phase === 'done' ? 'Завершено' : currentBlock > 0 ? `Блок ${Math.min(currentBlock, 5)} из 5${chunkDisplay}` : 'Подготовка...'}</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Block indicators — with timing, tokens, and click-to-scroll */}
        <div className="space-y-1">
          {BLOCKS.map((block) => {
            const status = getBlockStatus(block.index, currentBlock, phase);
            const isActive = status === 'in_progress';
            const isChunked = block.defaultChunks > 1;
            const chunkLabel = isChunked ? ` (${block.defaultChunks} части)` : '';
            const blockResult = blocks[block.index];

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
                onKeyDown={(e) => {
                  if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                    const el = document.getElementById(`block-${block.index}`);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
              >
                <StatusIndicator status={status} size="sm" />
                <span className="text-sm font-medium flex-1">{block.label}{chunkLabel}</span>
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

        {/* Orientation context section */}
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

        {/* Cancel button — only during running phase */}
        {isAuditing && (
          <div className="flex justify-end">
            <Button variant="destructive" size="sm" onClick={onCancel}>
              Отменить аудит
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
