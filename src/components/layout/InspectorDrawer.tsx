'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { PanelRight, Check } from 'lucide-react';
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
  onExportMD,
  onExportJSON,
  onExportHTML,
}: InspectorDrawerProps) {
  const provider = useSettings(s => s.provider);

  // Verdict color for score display
  const scorePercent = checklistScore?.scorePercent ?? 0;
  const verdictColor =
    scorePercent >= 75 ? 'text-severity-success' :
    scorePercent >= 50 ? 'text-severity-warning' :
    'text-severity-critical';

  const mediaLabel =
    mediaType === 'narrative' ? 'Нарратив' :
    mediaType === 'game' ? 'Игра' :
    mediaType === 'visual' ? 'Визуальное' : 'ТВРПГ';

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
                    <span className="text-muted-foreground">{t.app.block1Label ? `Блок ${i}` : `Block ${i}`}</span>
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
