/**
 * AuditReportViewV3 — Continuous document-style report renderer.
 *
 * All 5 blocks render as continuous sections in a single scrollable document.
 * No collapsible toggles, no max-height restrictions.
 * Markdown rendered with custom components (callouts, code blocks).
 */

'use client';

import * as React from 'react';
import type { BlockResult, PipelineMeta, PipelinePhase, ChecklistScoreResult } from '@/lib/audit/types-v3';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AuditScoreCard } from './AuditScoreCard';
import { ChecklistScoreCard } from './ChecklistScoreCard';
import { BlockSectionHeader } from './BlockSectionHeader';
import { markdownComponents } from '@/lib/markdown-components';

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
// Streaming placeholder
// ============================================================

function StreamingPlaceholder() {
  return (
    <div className="flex items-center gap-2 text-muted-foreground py-4">
      <span className="inline-block h-2 w-2 rounded-full bg-severity-streaming animate-pulse" />
      <span className="text-sm">Генерация ответа...</span>
    </div>
  );
}

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
}: AuditReportViewV3Props) {
  const isRunning = phase === 'running';
  const isDone = phase === 'done';

  // Auto-scroll during streaming
  const streamEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isRunning && streamEndRef.current) {
      streamEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [streamingText, isRunning]);

  return (
    <article className="max-w-[84ch] mx-auto">
      {/* Score cards — visible only when audit is done and score exists */}
      {isDone && checklistScore && mediaType && (
        <>
          <AuditScoreCard score={checklistScore} mediaType={mediaType} />
          <ChecklistScoreCard score={checklistScore} />
        </>
      )}

      {/* 5 block sections — continuous document */}
      {([1, 2, 3, 4, 5] as const).map((blockNum) => {
        const result = blocks[blockNum] ?? null;
        const isStreamingThis = isRunning && currentBlock === blockNum;
        const shouldShow = result !== null || isStreamingThis;
        if (!shouldShow) return null;

        return (
          <section
            key={blockNum}
            id={`block-${blockNum}`}
            className="scroll-mt-16 py-6 first:pt-0"
          >
            <BlockSectionHeader
              blockNumber={blockNum}
              label={BLOCK_LABELS[blockNum]}
              result={result}
              isStreaming={isStreamingThis}
            />
            <div className="prose prose-lg dark:prose-invert max-w-none">
              {isStreamingThis && streamingText ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {streamingText}
                </ReactMarkdown>
              ) : result?.markdown ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {result.markdown}
                </ReactMarkdown>
              ) : isStreamingThis ? (
                <StreamingPlaceholder />
              ) : null}
            </div>
            {/* Scroll anchor for streaming auto-scroll */}
            {isStreamingThis && <div ref={streamEndRef} />}
          </section>
        );
      })}
    </article>
  );
}
