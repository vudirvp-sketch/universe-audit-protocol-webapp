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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { GriefStage, GriefLevel, GriefMatrixCell } from '@/lib/audit/types';

const GRIEF_LEVELS: GriefLevel[] = ['character', 'location', 'mechanic', 'act'];
const GRIEF_STAGE_KEYS: GriefStage[] = ['denial', 'anger', 'bargaining', 'depression', 'acceptance'];

const LEVEL_LABELS: Record<GriefLevel, string> = {
  character: 'Character',
  location: 'Location',
  mechanic: 'Mechanic/Action',
  act: 'Narrative Act',
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

export function GriefArchitectureMatrix() {
  const griefMatrix = useAuditState((state) => state.griefMatrix);
  const setGriefMatrix = useAuditState((state) => state.setGriefMatrix);

  const handleDominantStageChange = (stage: GriefStage) => {
    setGriefMatrix({
      ...griefMatrix!,
      dominantStage: stage,
    });
  };

  const handleCellUpdate = (stage: GriefStage, level: GriefLevel, updates: Partial<GriefMatrixCell>) => {
    if (!griefMatrix) return;

    const updatedCells = griefMatrix.cells.map((cell) => {
      if (cell.stage === stage && cell.level === level) {
        return { ...cell, ...updates };
      }
      return cell;
    });

    setGriefMatrix({
      ...griefMatrix,
      cells: updatedCells,
    });
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
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Grief Architecture Matrix</CardTitle>
            <CardDescription>
              5 stages × 4 levels of materialization
            </CardDescription>
          </div>
          {griefMatrix?.dominantStage && (
            <Badge className={isDominantStageValid() ? 'bg-green-500' : 'bg-yellow-500'}>
              Dominant: {GRIEF_STAGES[griefMatrix.dominantStage].nameEn}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Dominant Stage Selector */}
        <div className="mb-4 space-y-2">
          <Label className="text-sm font-medium">Dominant Grief Stage</Label>
          <Select
            value={griefMatrix?.dominantStage || ''}
            onValueChange={(v) => handleDominantStageChange(v as GriefStage)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select dominant stage..." />
            </SelectTrigger>
            <SelectContent>
              {GRIEF_STAGE_KEYS.map((stage) => {
                const { filled, total } = getStageScore(stage);
                return (
                  <SelectItem key={stage} value={stage}>
                    <div className="flex items-center gap-2">
                      <span>{GRIEF_STAGES[stage].nameEn}</span>
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
            The dominant stage must have all 4 levels filled
          </p>
        </div>

        {/* Matrix */}
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
                    {GRIEF_STAGES[stage].nameEn}
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
                          {stageInfo.nameEn}
                        </Badge>
                        <Badge variant="outline">{stageInfo.nameRu}</Badge>
                        {isDominant && (
                          <Badge className="bg-primary">DOMINANT</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        <strong>Materialization:</strong> {stageInfo.materialization}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <strong>Verification:</strong> {stageInfo.verificationQuestion}
                      </p>
                    </div>

                    {/* 4 Levels */}
                    <div className="space-y-3">
                      {GRIEF_LEVELS.map((level) => {
                        const cell = getCell(stage, level);
                        const confidence = cell?.confidence || 'absent';

                        return (
                          <div
                            key={level}
                            className={`p-3 rounded-md border ${CONFIDENCE_COLORS[confidence]}`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <Label className="text-sm font-medium">{LEVEL_LABELS[level]}</Label>
                              <Badge className={`text-xs ${CONFIDENCE_BADGE_COLORS[confidence]}`}>
                                {confidence}
                              </Badge>
                            </div>
                            
                            <Textarea
                              placeholder={`Who/what embodies ${stage} at this level?`}
                              value={cell?.character || ''}
                              onChange={(e) =>
                                handleCellUpdate(stage, level, {
                                  character: e.target.value,
                                  confidence: e.target.value ? 'medium' : 'absent',
                                })
                              }
                              className="min-h-[60px] text-sm mb-2"
                            />
                            
                            <Textarea
                              placeholder="Evidence from narrative..."
                              value={cell?.evidence || ''}
                              onChange={(e) =>
                                handleCellUpdate(stage, level, { evidence: e.target.value })
                              }
                              className="min-h-[40px] text-sm"
                            />
                            
                            <div className="flex items-center gap-2 mt-2">
                              <Label className="text-xs text-muted-foreground">Confidence:</Label>
                              {(['high', 'medium', 'low', 'absent'] as const).map((c) => (
                                <Badge
                                  key={c}
                                  variant={confidence === c ? 'default' : 'outline'}
                                  className="text-xs cursor-pointer"
                                  onClick={() => handleCellUpdate(stage, level, { confidence: c })}
                                >
                                  {c}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
