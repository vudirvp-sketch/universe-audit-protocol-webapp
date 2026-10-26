'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { PanelRight, FileText } from 'lucide-react';
import type {
  AuditVerdict,
  BlockResult,
  OrientationContext,
  PipelineMeta,
  MediaType,
  PipelineLogEntry,
} from '@/lib/audit/types-v3';
import {
  bandSeverity,
  bandValueLabel,
  confidenceSeverity,
  severityTextClass,
} from '@/lib/audit/verdict-display';
import { useSettings } from '@/hooks/useSettings';
import { StatusIndicator } from '@/components/audit/StatusIndicator';
import { PipelineLogSection } from '@/components/audit/PipelineLog';
import { t } from '@/lib/i18n/ru';

// ============================================================
// Props
// ============================================================

interface InspectorDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meta: PipelineMeta | null;
  blocks: (BlockResult | null)[];
  verdict: AuditVerdict | null;
  orientationContext?: OrientationContext | null;
  mediaType: MediaType;
  currentBlock: 0 | 1 | 2 | 3 | 4 | 5;
  streamingText: string;
  /** Timestamped pipeline events — request boundaries, pauses, retries */
  log?: PipelineLogEntry[];
  onExportMD: () => void;
  onExportJSON: () => void;
  onExportHTML: () => void;
}

// ============================================================
// Helper components
// ============================================================

/** Секция инспектора: заголовок обычным регистром, разделение — волосяная линия. */
function InspectorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0">
      <h3 className="mb-2 text-sm text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function MetaRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right break-words tabular-nums">{value}</span>
    </div>
  );
}

// ============================================================
// Main component
// ============================================================

export function InspectorDrawer({
  open,
  onOpenChange,
  meta,
  blocks,
  verdict,
  orientationContext,
  mediaType,
  currentBlock,
  streamingText,
  log = [],
  onExportMD,
  onExportJSON,
  onExportHTML,
}: InspectorDrawerProps) {
  const provider = useSettings(s => s.provider);

  // Debug section state
  const [showRawMarkdown, setShowRawMarkdown] = React.useState(false);

  const mediaLabel =
    mediaType === 'narrative' ? t.form.mediaNarrative :
    mediaType === 'game' ? t.form.mediaGame :
    mediaType === 'visual' ? t.form.mediaVisual : t.form.mediaTtrpg;

  const auditModeLabel = orientationContext?.auditMode
    ? t.modes[orientationContext.auditMode]
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[320px] sm:max-w-[320px] p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <PanelRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            {t.report.inspector}
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1">
          <div className="px-4 py-4">
            {/* Session section */}
            <InspectorSection title={t.report.session}>
              <MetaRow label={t.report.model} value={blocks[5]?.meta?.model || blocks[4]?.meta?.model || blocks[3]?.meta?.model || blocks[2]?.meta?.model || blocks[1]?.meta?.model} />
              <MetaRow label={t.report.provider} value={provider} />
              <MetaRow label={t.report.media} value={mediaLabel} />
              <MetaRow label={t.rail.mode} value={auditModeLabel} />
              {meta?.tokensUsed && (
                <MetaRow label={t.report.tokens} value={`${meta.tokensUsed.total.toLocaleString()}`} />
              )}
              {meta?.elapsedMs != null && (
                <MetaRow label={t.report.time} value={`${(meta.elapsedMs / 1000).toFixed(1)}с`} />
              )}
            </InspectorSection>

            {/* Authorship hypothesis — v16 §4.2 (a hypothesis, not a label) */}
            {orientationContext?.authorshipHypothesis && (
              <InspectorSection title={t.rail.authorship}>
                <p className="text-sm leading-snug">{orientationContext.authorshipHypothesis}</p>
              </InspectorSection>
            )}

            {/* Export section — три действия в одном ритме */}
            <InspectorSection title={t.report.export}>
              <div className="flex flex-col gap-2">
                <Button variant="outline" size="sm" className="justify-start rounded-sm" onClick={onExportMD}>
                  Markdown
                </Button>
                <Button variant="outline" size="sm" className="justify-start rounded-sm" onClick={onExportJSON}>
                  JSON
                </Button>
                <Button variant="outline" size="sm" className="justify-start rounded-sm" onClick={onExportHTML}>
                  HTML
                </Button>
              </div>
            </InspectorSection>

            {/* Pipeline journal — what actually happened, second by second */}
            <section className="border-t border-border py-4">
              <PipelineLogSection entries={log} />
            </section>

            {/* Pipeline section */}
            <InspectorSection title={t.report.pipeline}>
              {([1, 2, 3, 4, 5] as const).map(i => {
                const block = blocks[i];
                return (
                  <div key={i} className="flex items-baseline justify-between gap-3 py-1 text-sm">
                    <span className="text-muted-foreground shrink-0">
                      {t.rail.blockShort.replace('{current}', String(i))}
                    </span>
                    <div className="flex items-center gap-2">
                      {block?.meta?.tokensUsed && (
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          {block.meta.tokensUsed.total.toLocaleString()} tok
                        </span>
                      )}
                      {block?.meta?.elapsedMs && (
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          {(block.meta.elapsedMs / 1000).toFixed(1)}с
                        </span>
                      )}
                      <span className="flex w-3 items-center justify-center">
                        <StatusIndicator status={block ? 'completed' : 'waiting'} size="sm" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </InspectorSection>

            {/* Verdict + capability frontier — v16 §26.S / §22 */}
            <InspectorSection title={t.report.assessment}>
              {!verdict ? (
                <p className="text-sm text-muted-foreground">{t.verdict.pending}</p>
              ) : verdict.bands.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.verdict.fallback}</p>
              ) : (
                <div className="space-y-2">
                  <ul className="space-y-1">
                    {verdict.bands.map(band => (
                      <li key={band.key} className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">{t.verdict.bands[band.key] ?? band.label}</span>
                        <span className={cn('font-medium text-right', severityTextClass(bandSeverity(band)))}>
                          {bandValueLabel(band.value)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {verdict.confidence && (
                    <div className="flex items-baseline justify-between gap-3 border-t border-border pt-1 text-sm">
                      <span className="text-muted-foreground">{t.verdict.confidence}</span>
                      <span className={cn('font-medium text-right', severityTextClass(confidenceSeverity(verdict.confidence)))}>
                        {bandValueLabel(verdict.confidence)}
                      </span>
                    </div>
                  )}

                  {verdict.frontier && (
                    <div className="border-t border-border pt-2">
                      <p className="mb-1 text-sm text-muted-foreground">{t.verdict.frontier}</p>
                      <ul className="space-y-0.5">
                        {(Object.keys(verdict.frontier) as (keyof typeof verdict.frontier)[]).map(key => (
                          <li key={key} className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="text-muted-foreground">{t.verdict.frontierLabels[key]}</span>
                            <span className="font-mono tabular-nums">{verdict.frontier?.[key]}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </InspectorSection>

            {/* Debug section */}
            <InspectorSection title={t.report.debug}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRawMarkdown(!showRawMarkdown)}
                aria-pressed={showRawMarkdown}
                className="justify-start rounded-sm"
              >
                <FileText className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                {t.report.rawMarkdown}
              </Button>
              {showRawMarkdown && (
                <div className="mt-2 max-h-[40vh] overflow-auto rounded-sm border border-border bg-muted/30 p-3">
                  <pre className="text-xs font-mono whitespace-pre-wrap break-words text-muted-foreground">
                    {currentBlock > 0 && currentBlock <= 5
                      ? streamingText || blocks[currentBlock]?.markdown || t.report.noData
                      : t.report.noData}
                  </pre>
                </div>
              )}
            </InspectorSection>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
