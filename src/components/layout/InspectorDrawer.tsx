'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { PanelRight, Check, FileText, Code } from 'lucide-react';
import type { BlockResult, PipelineMeta, ChecklistScoreResult, MediaType } from '@/lib/audit/types-v3';
import { useSettings } from '@/hooks/useSettings';
import { t } from '@/lib/i18n/ru';

// ============================================================
// Props
// ============================================================

interface InspectorDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meta: PipelineMeta | null;
  blocks: (BlockResult | null)[];
  checklistScore: ChecklistScoreResult | null;
  mediaType: MediaType;
  currentBlock: 0 | 1 | 2 | 3 | 4 | 5;
  streamingText: string;
  onExportMD: () => void;
  onExportJSON: () => void;
  onExportHTML: () => void;
}

// ============================================================
// Helper components
// ============================================================

function InspectorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{title}</h3>
      {children}
      <div className="border-t mt-3" />
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
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
  checklistScore,
  mediaType,
  currentBlock,
  streamingText,
  onExportMD,
  onExportJSON,
  onExportHTML,
}: InspectorDrawerProps) {
  const provider = useSettings(s => s.provider);

  // Debug section state
  const [showRawMarkdown, setShowRawMarkdown] = React.useState(false);

  // Verdict color for score display
  const scorePercent = checklistScore?.scorePercent ?? 0;
  const verdictColor =
    scorePercent >= 75 ? 'text-severity-success' :
    scorePercent >= 50 ? 'text-severity-warning' :
    'text-severity-critical';

  const mediaLabel =
    mediaType === 'narrative' ? t.form.mediaNarrative :
    mediaType === 'game' ? t.form.mediaGame :
    mediaType === 'visual' ? t.form.mediaVisual : t.form.mediaTtrpg;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[320px] sm:max-w-[320px] p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-2 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <PanelRight className="h-4 w-4" />
            {t.report.inspector}
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Session section */}
            <InspectorSection title={t.report.session}>
              <MetaRow label={t.report.model} value={blocks[5]?.meta?.model || blocks[4]?.meta?.model || blocks[3]?.meta?.model || blocks[2]?.meta?.model || blocks[1]?.meta?.model} />
              <MetaRow label={t.report.provider} value={provider} />
              <MetaRow label={t.report.media} value={mediaLabel} />
              {meta?.tokensUsed && (
                <MetaRow label={t.report.tokens} value={`${meta.tokensUsed.total.toLocaleString()}`} />
              )}
              {meta?.elapsedMs != null && (
                <MetaRow label={t.report.time} value={`${(meta.elapsedMs / 1000).toFixed(1)}с`} />
              )}
            </InspectorSection>

            {/* Export section */}
            <InspectorSection title={t.report.export}>
              <div className="flex flex-col gap-2">
                <Button variant="outline" size="sm" onClick={onExportMD}>Markdown</Button>
                <Button variant="outline" size="sm" onClick={onExportJSON}>JSON</Button>
                <Button variant="outline" size="sm" onClick={onExportHTML}>HTML</Button>
              </div>
            </InspectorSection>

            {/* Pipeline section */}
            <InspectorSection title={t.report.pipeline}>
              {([1, 2, 3, 4, 5] as const).map(i => {
                const block = blocks[i];
                return (
                  <div key={i} className="flex items-center justify-between text-sm py-1">
                    <span className="text-muted-foreground">{t.report.blockPrefix} {i}</span>
                    <div className="flex items-center gap-2">
                      {block?.meta?.tokensUsed && (
                        <span className="text-xs text-muted-foreground">
                          {block.meta.tokensUsed.total.toLocaleString()} tok
                        </span>
                      )}
                      {block?.meta?.elapsedMs && (
                        <span className="text-xs text-muted-foreground">
                          {(block.meta.elapsedMs / 1000).toFixed(1)}с
                        </span>
                      )}
                      {block ? (
                        <Check className="h-3 w-3 text-severity-success" />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </InspectorSection>

            {/* Debug section */}
            <InspectorSection title={t.report.debug}>
              <div className="flex flex-col gap-2">
                <Button
                  variant={showRawMarkdown ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setShowRawMarkdown(!showRawMarkdown)}
                  className="flex items-center gap-2"
                >
                  <FileText className="h-3.5 w-3.5" />
                  {t.report.rawMarkdown}
                </Button>
              </div>
              {showRawMarkdown && (
                <div className="mt-2 rounded-lg bg-muted/50 p-3 overflow-x-auto max-h-[40vh] overflow-y-auto">
                  <pre className="text-xs font-mono whitespace-pre-wrap break-words text-muted-foreground">
                    {currentBlock > 0 && currentBlock <= 5
                      ? streamingText || blocks[currentBlock]?.markdown || t.report.noData
                      : t.report.noData}
                  </pre>
                </div>
              )}
            </InspectorSection>

            {/* Checklist score summary */}
            {checklistScore && (
              <InspectorSection title={t.report.assessment}>
                <div className="text-center py-2">
                  <span className={cn('text-3xl font-bold', verdictColor)}>
                    {checklistScore.scorePercent}%
                  </span>
                  <p className="text-sm text-muted-foreground mt-1">
                    {checklistScore.fulfilled}/{checklistScore.totalApplicable} {t.report.criteria}
                  </p>
                </div>
              </InspectorSection>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
