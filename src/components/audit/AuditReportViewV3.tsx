/**
 * AuditReportViewV3 — 5 collapsible sections with react-markdown rendering.
 *
 * Each block's output is rendered as free-form markdown via ReactMarkdown.
 * No structured card rendering, no emoji verdicts, no criterion assessments.
 */

'use client';

import * as React from 'react';
import type { BlockResult, PipelineMeta, PipelinePhase, ChecklistScoreResult } from '@/lib/audit/types-v3';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AuditScoreCard } from './AuditScoreCard';
import { ChecklistScoreCard } from './ChecklistScoreCard';

// ============================================================
// Props
// ============================================================

interface AuditReportViewV3Props {
  blocks: (BlockResult | null)[];
  meta: PipelineMeta | null;
  currentBlock: 0 | 1 | 2 | 3 | 4 | 5;
  streamingText: string;
  phase: PipelinePhase;
  checklistScore?: ChecklistScoreResult | null;
  mediaType?: 'narrative' | 'game' | 'visual' | 'ttrpg';
  onExportMD?: () => void;
  onExportJSON?: () => void;
  onExportHTML?: () => void;
  onNewAudit?: () => void;
}

// ============================================================
// Block labels
// ============================================================

const BLOCK_LABELS = [
  '', // index 0 unused
  'ОРИЕНТАЦИЯ',
  'МЕХАНИЗМ (L1)',
  'ТЕЛО + ПСИХИКА (L2+L3)',
  'МЕТА (L4)',
  'СИНТЕЗ + РЕКОМЕНДАЦИИ',
] as const;

// ============================================================
// Main component
// ============================================================

export function AuditReportViewV3({
  blocks,
  meta,
  currentBlock,
  streamingText,
  phase,
  checklistScore,
  mediaType,
  onExportMD,
  onExportJSON,
  onExportHTML,
  onNewAudit,
}: AuditReportViewV3Props) {
  const isRunning = phase === 'running';
  const isDone = phase === 'done';

  return (
    <div className="space-y-4">
      {/* Score cards — visible only when audit is done and score exists */}
      {isDone && checklistScore && mediaType && (
        <>
          <AuditScoreCard score={checklistScore} mediaType={mediaType} />
          <ChecklistScoreCard score={checklistScore} />
        </>
      )}

      {/* 5 block sections */}
      {([1, 2, 3, 4, 5] as const).map((blockNum) => {
        const result = blocks[blockNum] ?? null;
        const isStreamingThis = isRunning && currentBlock === blockNum;
        const isStreamingAny = isRunning && currentBlock >= blockNum;
        const shouldShow = result !== null || isStreamingThis;

        if (!shouldShow && !isStreamingAny) return null;

        return (
          <AuditBlockSection
            key={blockNum}
            blockNumber={blockNum}
            label={BLOCK_LABELS[blockNum]}
            result={result}
            isStreaming={isStreamingThis}
            streamingText={isStreamingThis ? streamingText : ''}
          />
        );
      })}

      {/* Meta info */}
      {meta && isDone && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Мета</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground space-y-1">
              <div>Токены: prompt={meta.tokensUsed.prompt}, completion={meta.tokensUsed.completion}, total={meta.tokensUsed.total}</div>
              <div>Время: {(meta.elapsedMs / 1000).toFixed(1)}с</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export + New audit buttons */}
      {isDone && (
        <div className="flex flex-wrap gap-3 justify-center py-4">
          {onExportMD && (
            <Button variant="outline" onClick={onExportMD}>
              Скачать MD
            </Button>
          )}
          {onExportJSON && (
            <Button variant="outline" onClick={onExportJSON}>
              Скачать JSON
            </Button>
          )}
          {onExportHTML && (
            <Button variant="outline" onClick={onExportHTML}>
              Скачать HTML
            </Button>
          )}
          {onNewAudit && (
            <Button variant="default" onClick={onNewAudit}>
              Новый аудит
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// AuditBlockSection — collapsible block with markdown rendering
// ============================================================

function AuditBlockSection({
  blockNumber,
  label,
  result,
  isStreaming,
  streamingText,
}: {
  blockNumber: 1 | 2 | 3 | 4 | 5;
  label: string;
  result: BlockResult | null;
  isStreaming: boolean;
  streamingText: string;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Auto-expand when streaming starts
  React.useEffect(() => {
    if (isStreaming) setIsOpen(true);
  }, [isStreaming]);

  // Auto-scroll during streaming
  React.useEffect(() => {
    if (isStreaming && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [streamingText, isStreaming]);

  const statusIcon = result
    ? '✅'
    : isStreaming
    ? '🔄'
    : '⬜';

  const displayText = isStreaming ? streamingText : (result?.markdown ?? '');

  return (
    <div id={`block-${blockNumber}`} className="border rounded-lg">
      {/* Header — always visible, clickable */}
      <button
        className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">{statusIcon}</span>
          <span className="font-semibold">БЛОК {blockNumber}: {label}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {result?.meta?.elapsedMs && (
            <span>{(result.meta.elapsedMs / 1000).toFixed(1)}с</span>
          )}
          {isStreaming && <span className="animate-pulse">стримится...</span>}
          <span>{isOpen ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Content — collapsible */}
      {isOpen && (
        <div
          ref={contentRef}
          className={`px-4 pb-4 overflow-y-auto prose prose-sm dark:prose-invert max-w-none ${
            isStreaming ? 'max-h-[600px]' : 'max-h-[2000px]'
          }`}
        >
          {displayText ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {displayText}
            </ReactMarkdown>
          ) : (
            <p className="text-muted-foreground italic">Ожидание...</p>
          )}
        </div>
      )}
    </div>
  );
}
