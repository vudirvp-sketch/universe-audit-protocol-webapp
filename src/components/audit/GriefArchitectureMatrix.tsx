'use client';

import * as React from 'react';
import { useAuditState } from '@/hooks/useAuditState';
import { GRIEF_STAGES } from '@/lib/audit/protocol-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { GriefStage, GriefLevel, GriefMatrixCell } from '@/lib/audit/types';
import { t } from '@/lib/i18n/ru';

const GRIEF_LEVELS: GriefLevel[] = ['character', 'location', 'mechanic', 'act'];
const GRIEF_STAGE_KEYS: GriefStage[] = ['denial', 'anger', 'bargaining', 'depression', 'acceptance'];

const LEVEL_LABELS: Partial<Record<GriefLevel | 'world' | 'society' | 'scene', string>> = {
  character: t.grief.levelLabels.character,
  location: t.grief.levelLabels.location,
  mechanic: t.grief.levelLabels.mechanic,
  act: t.grief.levelLabels.act,
  world: t.grief.levelLabels.world,
  society: t.grief.levelLabels.society,
  scene: t.grief.levelLabels.scene,
};

const CONFIDENCE_COLORS = {
  high: 'bg-green-500/10 border-green-500/50',
  medium: 'bg-yellow-500/10 border-yellow-500/50',
  low: 'bg-orange-500/10 border-orange-500/50',
  absent: 'bg-muted/50 border-muted',
};

const CONFIDENCE_BADGE_COLORS = {
  high: 'bg-green-500 text-white',
  medium: 'bg-yellow-500 text-black',
  low: 'bg-orange-500 text-white',
  absent: 'bg-muted text-muted-foreground',
};

// ---------------------------------------------------------------------------
// Shared cell editor — used by both desktop and mobile views
// ---------------------------------------------------------------------------

function GriefCellEditor({
  stage,
  level,
  cell,
  onUpdate,
}: {
  stage: GriefStage;
  level: GriefLevel;
  cell: GriefMatrixCell | undefined;
  onUpdate: (stage: GriefStage, level: GriefLevel, updates: Partial<GriefMatrixCell>) => void;
}) {
  const confidence = cell?.confidence || 'absent';

  return (
    <div className={`p-3 rounded-md border ${CONFIDENCE_COLORS[confidence]}`}>
      <div className="flex items-center justify-between mb-2">
        <Label className="text-sm font-medium">{LEVEL_LABELS[level] || level}</Label>
        <Badge className={`text-xs ${CONFIDENCE_BADGE_COLORS[confidence]}`}>
          {t.grief.confidenceLabels[confidence] || confidence}
        </Badge>
      </div>

      <Textarea
        placeholder={t.grief.cellPlaceholder.replace('{stage}', GRIEF_STAGES[stage].nameRu)}
        value={cell?.character || ''}
        onChange={(e) =>
          onUpdate(stage, level, {
            character: e.target.value,
            confidence: e.target.value ? 'medium' : 'absent',
          })
        }
        className="min-h-[60px] text-sm mb-2"
      />

      <Textarea
        placeholder={t.grief.evidencePlaceholder}
        value={cell?.evidence || ''}
        onChange={(e) => onUpdate(stage, level, { evidence: e.target.value })}
        className="min-h-[40px] text-sm"
      />

      <div className="flex items-center gap-2 mt-2">
        <Label className="text-xs text-muted-foreground">{t.grief.confidence}</Label>
        {(['high', 'medium', 'low', 'absent'] as const).map((c) => (
          <Badge
            key={c}
            variant={confidence === c ? 'default' : 'outline'}
            className="text-xs cursor-pointer"
            onClick={() => onUpdate(stage, level, { confidence: c })}
          >
            {t.grief.confidenceLabels[c] || c}
          </Badge>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Desktop view — tabs per stage, full cell grid (unchanged UX)
// ---------------------------------------------------------------------------

function GriefMatrixDesktop() {
  const griefMatrix = useAuditState((state) => state.griefMatrix);
  const setGriefMatrix = useAuditState((state) => state.setGriefMatrix);

  const handleDominantStageChange = (stage: GriefStage) => {
    if (!griefMatrix) return;
    setGriefMatrix({ ...griefMatrix, dominantStage: stage });
  };

  const handleCellUpdate = (stage: GriefStage, level: GriefLevel, updates: Partial<GriefMatrixCell>) => {
    if (!griefMatrix) return;
    const updatedCells = griefMatrix.cells.map((cell) => {
      if (cell.stage === stage && cell.level === level) {
        return { ...cell, ...updates };
      }
      return cell;
    });
    setGriefMatrix({ ...griefMatrix, cells: updatedCells });
  };

  const getCell = (stage: GriefStage, level: GriefLevel): GriefMatrixCell | undefined => {
    return griefMatrix?.cells.find((c) => c.stage === stage && c.level === level);
  };

  const getStageScore = (stage: GriefStage): { filled: number; total: number } => {
    const cells = griefMatrix?.cells.filter((c) => c.stage === stage) || [];
    const filled = cells.filter((c) => c.confidence !== 'absent' && c.character).length;
    return { filled, total: 4 };
  };

  const isDominantStageValid = (): boolean => {
    if (!griefMatrix?.dominantStage) return false;
    const { filled, total } = getStageScore(griefMatrix.dominantStage);
    return filled === total;
  };

  return (
    <>
      {/* Dominant Stage Selector */}
      <div className="mb-4 space-y-2">
        <Label className="text-sm font-medium">{t.grief.dominantStage}</Label>
        <Select
          value={griefMatrix?.dominantStage || ''}
          onValueChange={(v) => handleDominantStageChange(v as GriefStage)}
        >
          <SelectTrigger>
            <SelectValue placeholder={t.grief.dominantStagePlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {GRIEF_STAGE_KEYS.map((stage) => {
              const { filled, total } = getStageScore(stage);
              return (
                <SelectItem key={stage} value={stage}>
                  <div className="flex items-center gap-2">
                    <span>{GRIEF_STAGES[stage].nameRu}</span>
                    <Badge variant="outline" className="text-xs">
                      {filled}/{total}
                    </Badge>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {t.grief.dominantStageHint}
        </p>
      </div>

      {/* Matrix Tabs */}
      <ScrollArea className="h-[400px]">
        <Tabs defaultValue={griefMatrix?.dominantStage || 'denial'}>
          <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
            {GRIEF_STAGE_KEYS.map((stage) => {
              const { filled, total } = getStageScore(stage);
              const isDominant = griefMatrix?.dominantStage === stage;
              return (
                <TabsTrigger
                  key={stage}
                  value={stage}
                  className={`text-xs ${isDominant ? 'bg-primary/20' : ''}`}
                >
                  {GRIEF_STAGES[stage].nameRu}
                  <Badge
                    variant="outline"
                    className={`ml-1 text-xs ${filled === total ? 'bg-green-500/20' : ''}`}
                  >
                    {filled}/{total}
                  </Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {GRIEF_STAGE_KEYS.map((stage) => {
            const stageInfo = GRIEF_STAGES[stage];
            const isDominant = griefMatrix?.dominantStage === stage;

            return (
              <TabsContent key={stage} value={stage} className="mt-4">
                <div className="space-y-4">
                  {/* Stage Info */}
                  <div className={`p-3 rounded-md border ${isDominant ? 'border-primary/50 bg-primary/5' : 'border-muted'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={isDominant ? 'default' : 'outline'}>
                        {stageInfo.nameRu}
                      </Badge>
                      <Badge variant="outline">{stageInfo.nameEn}</Badge>
                      {isDominant && (
                        <Badge className="bg-primary">{t.grief.dominant}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <strong>{t.grief.materialization}</strong> {stageInfo.materialization}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>{t.grief.verification}</strong> {stageInfo.verificationQuestion}
                    </p>
                  </div>

                  {/* 4 Levels */}
                  <div className="space-y-3">
                    {GRIEF_LEVELS.map((level) => (
                      <GriefCellEditor
                        key={level}
                        stage={stage}
                        level={level}
                        cell={getCell(stage, level)}
                        onUpdate={handleCellUpdate}
                      />
                    ))}
                  </div>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </ScrollArea>
    </>
  );
}

// ---------------------------------------------------------------------------
// Mobile view — accordion per stage, levels as compact cards
// Per plan §3.5 / Finding 16: vertical list of cards, one per grief stage,
// levels shown as badges. No horizontal scrolling. Each card expands on tap.
// ---------------------------------------------------------------------------

function GriefMatrixMobile() {
  const griefMatrix = useAuditState((state) => state.griefMatrix);
  const setGriefMatrix = useAuditState((state) => state.setGriefMatrix);

  const handleDominantStageChange = (stage: GriefStage) => {
    if (!griefMatrix) return;
    setGriefMatrix({ ...griefMatrix, dominantStage: stage });
  };

  const handleCellUpdate = (stage: GriefStage, level: GriefLevel, updates: Partial<GriefMatrixCell>) => {
    if (!griefMatrix) return;
    const updatedCells = griefMatrix.cells.map((cell) => {
      if (cell.stage === stage && cell.level === level) {
        return { ...cell, ...updates };
      }
      return cell;
    });
    setGriefMatrix({ ...griefMatrix, cells: updatedCells });
  };

  const getCell = (stage: GriefStage, level: GriefLevel): GriefMatrixCell | undefined => {
    return griefMatrix?.cells.find((c) => c.stage === stage && c.level === level);
  };

  const getStageScore = (stage: GriefStage): { filled: number; total: number } => {
    const cells = griefMatrix?.cells.filter((c) => c.stage === stage) || [];
    const filled = cells.filter((c) => c.confidence !== 'absent' && c.character).length;
    return { filled, total: 4 };
  };

  // Auto-expand the dominant stage accordion
  const defaultAccordionValue = griefMatrix?.dominantStage || 'denial';

  return (
    <div className="space-y-4">
      {/* Dominant Stage Selector — compact on mobile */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">{t.grief.dominantStage}</Label>
        <Select
          value={griefMatrix?.dominantStage || ''}
          onValueChange={(v) => handleDominantStageChange(v as GriefStage)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t.grief.dominantStagePlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {GRIEF_STAGE_KEYS.map((stage) => {
              const { filled, total } = getStageScore(stage);
              return (
                <SelectItem key={stage} value={stage}>
                  <div className="flex items-center gap-2">
                    <span>{GRIEF_STAGES[stage].nameRu}</span>
                    <Badge variant="outline" className="text-xs">
                      {filled}/{total}
                    </Badge>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Accordion — one item per grief stage */}
      <Accordion type="single" collapsible defaultValue={defaultAccordionValue} className="w-full">
        {GRIEF_STAGE_KEYS.map((stage) => {
          const stageInfo = GRIEF_STAGES[stage];
          const isDominant = griefMatrix?.dominantStage === stage;
          const { filled, total } = getStageScore(stage);

          return (
            <AccordionItem key={stage} value={stage}>
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-2 flex-1 pr-2 min-w-0">
                  {/* Stage badge with fill indicator */}
                  <Badge variant={isDominant ? 'default' : 'outline'} className="shrink-0">
                    {stageInfo.nameRu}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-xs shrink-0 ${filled === total ? 'bg-green-500/20' : ''}`}
                  >
                    {filled}/{total}
                  </Badge>
                  {isDominant && (
                    <Badge className="bg-primary text-xs shrink-0">{t.grief.dominant}</Badge>
                  )}
                  {/* Compact level indicators as dots */}
                  <div className="flex items-center gap-1 ml-auto">
                    {GRIEF_LEVELS.map((level) => {
                      const cell = getCell(stage, level);
                      const hasContent = cell?.confidence !== 'absent' && !!cell?.character;
                      return (
                        <div
                          key={level}
                          className={`w-2.5 h-2.5 rounded-full ${
                            hasContent ? 'bg-green-500' : 'bg-muted-foreground/30'
                          }`}
                          title={LEVEL_LABELS[level] || level}
                        />
                      );
                    })}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  {/* Stage info — compact */}
                  <div className={`p-2 rounded-md border text-xs ${isDominant ? 'border-primary/50 bg-primary/5' : 'border-muted'}`}>
                    <p className="text-muted-foreground">
                      <strong>{t.grief.materialization}</strong> {stageInfo.materialization}
                    </p>
                    <p className="text-muted-foreground mt-1">
                      <strong>{t.grief.verification}</strong> {stageInfo.verificationQuestion}
                    </p>
                  </div>

                  {/* Level cards */}
                  {GRIEF_LEVELS.map((level) => (
                    <GriefCellEditor
                      key={level}
                      stage={stage}
                      level={level}
                      cell={getCell(stage, level)}
                      onUpdate={handleCellUpdate}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component — switches between desktop and mobile views
// ---------------------------------------------------------------------------

export function GriefArchitectureMatrix() {
  const griefMatrix = useAuditState((state) => state.griefMatrix);

  const isDominantStageValid = (): boolean => {
    if (!griefMatrix?.dominantStage) return false;
    const cells = griefMatrix.cells.filter((c) => c.stage === griefMatrix.dominantStage);
    const filled = cells.filter((c) => c.confidence !== 'absent' && c.character).length;
    return filled === 4;
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{t.grief.title}</CardTitle>
            <CardDescription>
              {t.grief.description}
            </CardDescription>
          </div>
          {griefMatrix?.dominantStage && (
            <Badge className={isDominantStageValid() ? 'bg-green-500' : 'bg-yellow-500'}>
              {t.grief.dominant} {GRIEF_STAGES[griefMatrix.dominantStage].nameRu}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Desktop: tabs + scroll area (hidden on mobile) */}
        <div className="hidden sm:block">
          <GriefMatrixDesktop />
        </div>

        {/* Mobile: accordion per stage (shown on mobile only) */}
        <div className="block sm:hidden">
          <GriefMatrixMobile />
        </div>
      </CardContent>
    </Card>
  );
}
