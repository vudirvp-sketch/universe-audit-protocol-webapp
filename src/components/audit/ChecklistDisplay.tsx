'use client';

import * as React from 'react';
import { useAuditState, useChecklistByBlock } from '@/hooks/useAuditState';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Circle,
  ChevronRight,
} from 'lucide-react';
import type { ChecklistItem, ChecklistItemStatus, AuditLevel } from '@/lib/audit/types';
import { getGateThreshold } from '@/lib/audit/types';
import { MASTER_CHECKLIST } from '@/lib/audit/protocol-data';
import { t } from '@/lib/i18n/ru';

const BLOCK_NAMES: Record<string, string> = t.checklist.blockNames;

/**
 * Get the primary gate level for a checklist block letter.
 * Looks up the first matching item in MASTER_CHECKLIST and returns
 * its level, defaulting to L1 if not found.
 */
function getBlockLevel(block: string): 'L1' | 'L2' | 'L3' | 'L4' {
  const item = MASTER_CHECKLIST.find(i => i.block === block);
  const level = item?.level;
  // Extract the primary L-level from combined levels like 'L1/L2'
  if (level) {
    const match = level.match(/^L(\d)/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n >= 1 && n <= 4) return `L${n}` as 'L1' | 'L2' | 'L3' | 'L4';
    }
  }
  return 'L1';
}

const STATUS_ICONS: Record<ChecklistItemStatus, React.ReactNode> = {
  PASS: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  FAIL: <XCircle className="h-4 w-4 text-red-500" />,
  INSUFFICIENT_DATA: <HelpCircle className="h-4 w-4 text-yellow-500" />,
  PENDING: <Circle className="h-4 w-4 text-muted-foreground" />,
};

const STATUS_LABELS: Record<ChecklistItemStatus, string> = {
  PASS: t.checklist.statusPass,
  FAIL: t.checklist.statusFail,
  INSUFFICIENT_DATA: t.checklist.statusInsufficient,
  PENDING: t.checklist.statusPending,
};

const STATUS_COLORS: Record<ChecklistItemStatus, string> = {
  PASS: 'bg-green-500/10 border-green-500/30',
  FAIL: 'bg-red-500/10 border-red-500/30',
  INSUFFICIENT_DATA: 'bg-yellow-500/10 border-yellow-500/30',
  PENDING: 'bg-muted/50',
};

interface ChecklistItemRowProps {
  item: ChecklistItem;
  onStatusChange: (status: ChecklistItemStatus) => void;
  onEvidenceChange: (evidence: string) => void;
  onUpdateItem: (id: string, updates: Partial<ChecklistItem>) => void;
}

function ChecklistItemRow({ item, onStatusChange, onEvidenceChange, onUpdateItem }: ChecklistItemRowProps) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className={`rounded-md border p-3 ${STATUS_COLORS[item.status]}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{STATUS_ICONS[item.status]}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground">{item.id}</span>
            <Badge variant="outline" className="text-xs">
              {item.level}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {item.tag}
            </Badge>
          </div>
          <p className="text-sm mt-1">{item.text}</p>

          {/* Status Selection */}
          <div className="flex items-center gap-4 mt-2">
            {(['PASS', 'FAIL', 'INSUFFICIENT_DATA'] as const).map((status) => (
              <label key={status} className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={item.status === status}
                  onCheckedChange={(checked) => {
                    if (checked) onStatusChange(status);
                  }}
                  className="h-3.5 w-3.5"
                />
                <span className="text-xs">{STATUS_LABELS[status]}</span>
              </label>
            ))}
          </div>

          {/* Evidence Input */}
          {(item.status === 'PASS' || item.status === 'FAIL') && (
            <div className="mt-3 space-y-2">
              <Label className="text-xs text-muted-foreground">
                {item.status === 'PASS' ? t.checklist.evidenceRequired : t.checklist.evidence}
              </Label>
              <Textarea
                placeholder={t.checklist.evidencePlaceholder}
                value={item.evidence || ''}
                onChange={(e) => onEvidenceChange(e.target.value)}
                className="min-h-[60px] text-sm"
              />
              {item.status === 'PASS' && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t.checklist.functionalRole}</Label>
                  <Textarea
                    placeholder={t.checklist.functionalRolePlaceholder}
                    value={item.functionalRole || ''}
                    onChange={(e) => onUpdateItem(item.id, { functionalRole: e.target.value })}
                    className="min-h-[40px] text-sm"
                  />
                </div>
              )}
            </div>
          )}

          {/* INSUFFICIENT_DATA message */}
          {item.status === 'INSUFFICIENT_DATA' && (
            <div className="mt-2 p-2 rounded bg-yellow-500/10 text-xs text-yellow-700 dark:text-yellow-300">
              {t.checklist.insufficientDataMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ChecklistBlockProps {
  block: string;
  items: ChecklistItem[];
  onUpdateItem: (id: string, updates: Partial<ChecklistItem>) => void;
  level: 'L1' | 'L2' | 'L3' | 'L4';
  auditMode: import('@/lib/audit/types').AuditMode;
}

function ChecklistBlock({ block, items, onUpdateItem, level, auditMode }: ChecklistBlockProps) {
  const passed = items.filter((i) => i.status === 'PASS').length;
  const failed = items.filter((i) => i.status === 'FAIL').length;
  const insufficient = items.filter((i) => i.status === 'INSUFFICIENT_DATA').length;
  const total = items.length;

  const score = total > 0 ? Math.round((passed / total) * 100) : 0;
  const modeThreshold = getGateThreshold(auditMode, level);
  const isPassing = score >= modeThreshold;

  return (
    <AccordionItem value={block}>
      <AccordionTrigger className="hover:no-underline">
        <div className="flex items-center gap-3 w-full pr-4">
          <Badge variant="outline" className="font-mono">
            {block}
          </Badge>
          <span className="font-medium">{BLOCK_NAMES[block] || block}</span>
          <div className="ml-auto flex items-center gap-2">
            <span className={`text-sm font-medium ${isPassing ? 'text-green-500' : 'text-muted-foreground'}`}>
              {passed}/{total}
            </span>
            {failed > 0 && (
              <Badge variant="destructive" className="text-xs">
                {failed} {t.checklist.fail}
              </Badge>
            )}
            {insufficient > 0 && (
              <Badge variant="outline" className="text-xs text-yellow-600">
                {insufficient} ?
              </Badge>
            )}
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-3 pt-2">
          {items.map((item) => (
            <ChecklistItemRow
              key={item.id}
              item={item}
              onStatusChange={(status) => onUpdateItem(item.id, { status })}
              onEvidenceChange={(evidence) => onUpdateItem(item.id, { evidence })}
              onUpdateItem={onUpdateItem}
            />
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export function ChecklistDisplay() {
  const checklistByBlock = useChecklistByBlock();
  const updateChecklistItem = useAuditState((state) => state.updateChecklistItem);
  const auditMode = useAuditState((s) => s.auditMode) ?? 'conflict';

  const blocks = Object.keys(checklistByBlock).sort();

  const totalItems = Object.values(checklistByBlock).flat();
  const passed = totalItems.filter((i) => i.status === 'PASS').length;
  const total = totalItems.length;
  const overallScore = total > 0 ? Math.round((passed / total) * 100) : 0;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{t.checklist.title}</CardTitle>
            <CardDescription>
              {t.checklist.description}
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{overallScore}%</div>
            <div className="text-xs text-muted-foreground">
              {t.checklist.passedCount.replace('{passed}', String(passed)).replace('{total}', String(total))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          <Accordion type="multiple" className="w-full" defaultValue={blocks}>
            {blocks.map((block) => (
              <ChecklistBlock
                key={block}
                block={block}
                items={checklistByBlock[block]}
                onUpdateItem={updateChecklistItem}
                level={getBlockLevel(block)}
                auditMode={auditMode}
              />
            ))}
          </Accordion>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
