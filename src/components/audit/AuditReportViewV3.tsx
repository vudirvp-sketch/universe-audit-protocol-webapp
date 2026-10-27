'use client';

/**
 * AuditReportViewV3 — Continuous document-style report renderer.
 *
 * All 5 blocks render as continuous sections in a single scrollable document.
 * No collapsible toggles, no max-height restrictions.
 * Markdown rendered with custom components (callouts, code blocks).
 *
 * v16: the legacy checklist score is replaced by the qualitative verdict
 * (§26.S) plus the Block 1 fast screen (§6).
 *
 * Reading behaviour: the document grows while the model writes, but the
 * viewport follows the bottom only while the reader is already there — see
 * `useStickToBottom`. Scrolling up detaches the follow, and a floating control
 * brings the reader back to the newest text.
 */

import * as React from 'react';
import type {
  AuditVerdict,
  BlockResult,
  OrientationContext,
  PipelineMeta,
  PipelinePhase,
} from '@/lib/audit/types-v3';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowDown } from 'lucide-react';
import { AuditVerdictCard } from './AuditScoreCard';
import { FastScreenCard } from './FastScreenCard';
import { BlockSectionHeader } from './BlockSectionHeader';
import { markdownComponents } from '@/lib/markdown-components';
import { useStickToBottom } from '@/hooks/useStickToBottom';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n/ru';

// ============================================================
// Props
// ============================================================

interface AuditReportViewV3Props {
  blocks: (BlockResult | null)[];
  meta: PipelineMeta | null;
  currentBlock: 0 | 1 | 2 | 3 | 4 | 5;
  streamingText: string;
  phase: PipelinePhase;
  verdict?: AuditVerdict | null;
  orientationContext?: OrientationContext | null;
}

// ============================================================
// Block labels
// ============================================================

const BLOCK_LABELS = [
  '', // index 0 unused
  t.app.block1Label,
  t.app.block2Label,
  t.app.block3Label,
  t.app.block4Label,
  t.app.block5Label,
] as const;

// ============================================================
// Streaming placeholder
// ============================================================

function StreamingPlaceholder() {
  return (
    <div className="flex items-center gap-2 py-4 text-muted-foreground">
      <span
        className="inline-block size-2.5 rounded-[1px] bg-severity-streaming animate-pulse"
        aria-hidden="true"
      />
      <span className="text-sm">{t.app.streamingInProgress}</span>
    </div>
  );
}

// ============================================================
// Audited concept — collapsed to two lines, expandable on demand.
// A clipped concept is metadata being truncated, but the author must be
// able to see what the audit was actually run on.
// ============================================================

function AuditedConcept({ text }: { text: string }) {
  const [expanded, setExpanded] = React.useState(false);
  const isLong = text.length > 260;

  return (
    <header className="mb-10">
      <p className="text-sm text-muted-foreground">{t.report.auditedConcept}</p>
      <p
        className={cn(
          'mt-1 text-[0.9375rem] leading-snug text-balance',
          !expanded && isLong && 'line-clamp-2',
        )}
      >
        {text}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="mt-1 text-sm text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
        >
          {expanded ? t.report.hideFullConcept : t.report.showFullConcept}
        </button>
      )}
    </header>
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
  verdict,
  orientationContext,
}: AuditReportViewV3Props) {
  const isRunning = phase === 'running';
  const isDone = phase === 'done';

  const { following, jumpToLatest } = useStickToBottom(isRunning, streamingText.length);

  return (
    <article className="min-w-0">
      {/* Шапка документа: отчёт начинается с того, что аудируется */}
      {meta?.inputText && <AuditedConcept text={meta.inputText} />}

      {/* Verdict + fast screen — visible only when the audit is done */}
      {isDone && verdict && <AuditVerdictCard verdict={verdict} mediaType={meta?.mediaType} />}
      {isDone && !verdict && (
        <p className="mb-10 text-sm text-muted-foreground">{t.verdict.fallback}</p>
      )}
      {isDone && orientationContext && <FastScreenCard orientationContext={orientationContext} />}

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
            className="scroll-mt-28 py-8 first:pt-0"
          >
            <BlockSectionHeader
              blockNumber={blockNum}
              label={BLOCK_LABELS[blockNum]}
              result={result}
              isStreaming={isStreamingThis}
            />
            <div className="report prose prose-lg mt-6">
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
          </section>
        );
      })}

      {/* Detached-follow control: the reader scrolled up while text was still
          arriving. It is the only way back to the newest text — no hijacking. */}
      {isRunning && !following && (
        <button
          type="button"
          onClick={jumpToLatest}
          className="fixed bottom-4 right-4 z-30 flex min-h-10 items-center gap-2 rounded-sm border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-accent md:bottom-6 md:right-6"
        >
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
          {t.report.jumpToLatest}
        </button>
      )}
    </article>
  );
}
