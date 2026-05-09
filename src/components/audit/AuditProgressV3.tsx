'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface AuditProgressV3Props {
  currentBlock: 0 | 1 | 2 | 3 | 4 | 5;
  onCancel: () => void;
  /** Total chunks for the current block (if chunked execution) */
  currentBlockTotalChunks?: number;
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
): 'waiting' | 'in_progress' | 'completed' {
  if (blockIndex < currentBlock) return 'completed';
  if (blockIndex === currentBlock) return 'in_progress';
  return 'waiting';
}

function StatusIcon({ status }: { status: 'waiting' | 'in_progress' | 'completed' }) {
  switch (status) {
    case 'in_progress':
      return <span className="text-lg leading-none" role="img" aria-label="В процессе">⏳</span>;
    case 'completed':
      return <span className="text-lg leading-none" role="img" aria-label="Завершено">✅</span>;
    case 'waiting':
      return <span className="text-lg leading-none" role="img" aria-label="Ожидание">⬜</span>;
  }
}

export function AuditProgressV3({ currentBlock, onCancel, currentBlockTotalChunks }: AuditProgressV3Props) {
  const progressPercent = currentBlock === 0 ? 0 : Math.round((currentBlock / 5) * 100);
  const isAuditing = currentBlock > 0 && currentBlock <= 5;

  // Determine the chunk display for the current block
  const currentBlockInfo = BLOCKS.find(b => b.index === currentBlock);
  const totalChunks = currentBlockTotalChunks ?? currentBlockInfo?.defaultChunks ?? 1;
  const showChunks = totalChunks > 1 && currentBlock > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Прогресс аудита v3</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Прогресс</span>
            <span>{currentBlock > 0 ? `Блок ${Math.min(currentBlock, 5)} из 5${showChunks ? ` (${totalChunks} частей)` : ''}` : 'Подготовка...'}</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Block indicators */}
        <div className="space-y-1">
          {BLOCKS.map((block) => {
            const status = getBlockStatus(block.index, currentBlock);
            const isActive = status === 'in_progress';
            const isChunked = block.defaultChunks > 1;
            const chunkLabel = isChunked ? ` (${block.defaultChunks} части)` : '';

            return (
              <div
                key={block.index}
                className={`flex items-center gap-3 p-2 rounded-md transition-colors ${
                  isActive ? 'bg-accent' : status === 'completed' ? 'opacity-70' : 'opacity-50'
                }`}
              >
                <StatusIcon status={status} />
                <span className="text-sm font-medium">{block.label}{chunkLabel}</span>
              </div>
            );
          })}
        </div>

        {/* Cancel button */}
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
