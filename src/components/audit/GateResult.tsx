'use client';

import * as React from 'react';
import { useAuditState, useGateFailures } from '@/hooks/useAuditState';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  Wrench,
  AlertCircle,
  BarChart3,
} from 'lucide-react';
import type { GateResult as GateResultType, FixItem } from '@/lib/audit/types';
import { getGateThreshold } from '@/lib/audit/types';
import { t } from '@/lib/i18n/ru';

interface GateResultCardProps {
  level: 'L1' | 'L2' | 'L3' | 'L4';
  result: GateResultType | null;
  onProceed?: () => void;
}

const LEVEL_INFO: Record<string, { name: string; description: string; focus: string }> = {
  L1: {
    name: t.levels.L1.name,
    description: t.levels.L1.description,
    focus: t.levels.L1.focus,
  },
  L2: {
    name: t.levels.L2.name,
    description: t.levels.L2.description,
    focus: t.levels.L2.focus,
  },
  L3: {
    name: t.levels.L3.name,
    description: t.levels.L3.description,
    focus: t.levels.L3.focus,
  },
  L4: {
    name: t.levels.L4.name,
    description: t.levels.L4.description,
    focus: t.levels.L4.focus,
  },
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/10 border-red-500/50 text-red-600',
  major: 'bg-orange-500/10 border-orange-500/50 text-orange-600',
  minor: 'bg-yellow-500/10 border-yellow-500/50 text-yellow-600',
  cosmetic: 'bg-gray-500/10 border-gray-500/50 text-gray-600',
};

const APPROACH_COLORS = {
  conservative: 'bg-blue-500/10 border-blue-500/50',
  compromise: 'bg-purple-500/10 border-purple-500/50',
  radical: 'bg-red-500/10 border-red-500/50',
};

const APPROACH_LABELS: Record<string, string> = {
  conservative: t.issues.conservative,
  compromise: t.issues.compromise,
  radical: t.issues.radical,
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: t.issues.severityCritical,
  major: t.issues.severityMajor,
  minor: t.issues.severityMinor,
  cosmetic: t.issues.severityCosmetic,
};

const FIX_TYPE_LABELS: Record<string, string> = {
  motivation: t.gates.fixTypeMotivation,
  competence: t.gates.fixTypeCompetence,
  scale: t.gates.fixTypeScale,
  resources: t.gates.fixTypeResources,
  memory: t.gates.fixTypeMemory,
  ideology: t.gates.fixTypeIdeology,
  time: t.gates.fixTypeTime,
};

function FixItemCard({ fix }: { fix: FixItem }) {
  return (
    <div className={`p-3 rounded-md border ${SEVERITY_COLORS[fix.severity]}`}>
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="outline" className="text-xs font-mono">
          {fix.id}
        </Badge>
        <Badge className={`text-xs ${fix.severity === 'critical' ? 'bg-red-500' : fix.severity === 'major' ? 'bg-orange-500' : 'bg-yellow-500'}`}>
          {SEVERITY_LABELS[fix.severity] || fix.severity}
        </Badge>
        <Badge variant="outline" className="text-xs">
          {FIX_TYPE_LABELS[fix.type] || fix.type}
        </Badge>
      </div>
      <p className="text-sm mb-2">{fix.description}</p>
      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${APPROACH_COLORS[fix.recommendedApproach]}`}>
        <Wrench className="h-3 w-3" />
        {t.gates.fixRecommended.replace('{approach}', APPROACH_LABELS[fix.recommendedApproach] || fix.recommendedApproach)}
      </div>
    </div>
  );
}

function getProceedTarget(level: 'L1' | 'L2' | 'L3' | 'L4'): string {
  switch (level) {
    case 'L1': return t.gates.proceedL2;
    case 'L2': return t.gates.proceedL3;
    case 'L3': return t.gates.proceedL4;
    case 'L4': return t.gates.proceedFinal;
  }
}

export const GateResultCard = React.memo(function GateResultCard({ level, result, onProceed }: GateResultCardProps) {
  const info = LEVEL_INFO[level];
  const auditMode = useAuditState((s) => s.auditMode) ?? 'conflict';
  const modeThreshold = getGateThreshold(auditMode, level);

  if (!result) {
    return (
      <Card className="opacity-50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="text-muted-foreground">{level}:</span> {info.name}
              </CardTitle>
              <CardDescription>{info.description}</CardDescription>
            </div>
            <Badge variant="outline">{t.gates.pending}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t.gates.notEvaluated}
          </p>
        </CardContent>
      </Card>
    );
  }

  const passed = result.passed ?? result.status === 'passed';
  const score = result.score;

  return (
    <Card className={passed ? 'border-green-500/30' : 'border-red-500/30'}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="text-muted-foreground">{level}:</span> {info.name}
              {passed ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
            </CardTitle>
            <CardDescription>{info.description}</CardDescription>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${passed ? 'text-green-500' : 'text-red-500'}`}>
              {score}%
            </div>
            <Badge variant={passed ? 'default' : 'destructive'}>
              {passed ? t.gates.passed : t.gates.failed}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score Breakdown */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t.gates.scoreLabel}</span>
            <span>{score}% ({t.gates.threshold.replace('{value}', String(modeThreshold))})</span>
          </div>
          <Progress value={score} className={`h-3 ${passed ? '[&>div]:bg-green-500' : '[&>div]:bg-red-500'}`} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="p-2 rounded bg-muted">
            <div className="text-lg font-bold">{result.applicableItems}</div>
            <div className="text-xs text-muted-foreground">{t.gates.total}</div>
          </div>
          <div className="p-2 rounded bg-green-500/10">
            <div className="text-lg font-bold text-green-600">{result.passedItems}</div>
            <div className="text-xs text-muted-foreground">{t.gates.passedItems}</div>
          </div>
          <div className="p-2 rounded bg-red-500/10">
            <div className="text-lg font-bold text-red-600">{result.failedItems}</div>
            <div className="text-xs text-muted-foreground">{t.gates.failedItems}</div>
          </div>
          <div className="p-2 rounded bg-yellow-500/10">
            <div className="text-lg font-bold text-yellow-600">{result.insufficientDataItems}</div>
            <div className="text-xs text-muted-foreground">{t.gates.noData}</div>
          </div>
        </div>

        {/* BLOCK-LEVEL BREAKDOWN (RULE_8) */}
        {result.metadata?.breakdown && Object.keys(result.metadata.breakdown).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              {t.gates.blockBreakdown}
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(result.metadata.breakdown).map(([block, blockScore]) => (
                <div
                  key={block}
                  className={`flex justify-between text-sm p-2 rounded border ${
                    typeof blockScore === 'string' && blockScore.includes('FAIL')
                      ? 'bg-red-500/10 border-red-500/30'
                      : typeof blockScore === 'string' && blockScore.includes('PASS')
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-muted border-border'
                  }`}
                >
                  <span className="font-mono text-xs">{block}</span>
                  <span className="font-mono text-xs font-medium">{String(blockScore)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Conditions Breakdown */}
        {result.conditions && result.conditions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">{t.gates.conditions}</h4>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {result.conditions.slice(0, 10).map((condition) => (
                <div
                  key={condition.id}
                  className={`flex items-center gap-2 text-xs p-2 rounded ${
                    condition.passed ? 'bg-green-500/10' : 'bg-red-500/10'
                  }`}
                >
                  {condition.passed ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-500" />
                  )}
                  <span className="font-mono">{condition.id}</span>
                  <span className="text-muted-foreground truncate flex-1">{condition.message}</span>
                </div>
              ))}
              {result.conditions.length > 10 && (
                <p className="text-xs text-muted-foreground text-center">
                  {t.gates.moreConditions.replace('{count}', String(result.conditions.length - 10))}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Reliability Warning */}
        {(result.metadata?.isUnreliable || (result.insufficientDataItems && result.applicableItems && result.insufficientDataItems / result.applicableItems > 0.3)) && (
          <div className="flex items-start gap-3 p-3 rounded-md bg-amber-500/10 border border-amber-500/30">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-600">{t.gates.unreliableResult}</p>
              <p className="text-xs text-muted-foreground">
                {t.gates.unreliableResultDesc
                  .replace('{insufficient}', String(result.insufficientDataItems ?? 0))
                  .replace('{total}', String(result.applicableItems ?? 0))}
              </p>
            </div>
          </div>
        )}

        {/* Fix List (if failed) */}
        {!passed && result.fixList && result.fixList.length > 0 && (
          <Accordion type="single" collapsible>
            <AccordionItem value="fixes">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span>{t.gates.fixList.replace('{count}', String(result.fixList.length))}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  {result.fixList.map((fix) => (
                    <FixItemCard key={fix.id} fix={fix} />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {/* Proceed Button (if passed) */}
        {passed && onProceed && (
          <Button onClick={onProceed} className="w-full">
            {t.gates.proceedTo.replace('{target}', getProceedTarget(level))}
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
});

export function GateResults() {
  const gateResults = useAuditState((state) => state.gateResults);
  const failures = useGateFailures();
  const [showFailureDialog, setShowFailureDialog] = React.useState(false);

  // Show failure dialog if there are gate failures
  React.useEffect(() => {
    if (failures.length > 0) {
      setShowFailureDialog(true);
    }
  }, [failures.length]);

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t.gates.title}</h3>
          {failures.length > 0 && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {t.gates.gatesFailed.replace('{count}', String(failures.length))}
            </Badge>
          )}
        </div>

        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          {(['L1', 'L2', 'L3', 'L4'] as const).map((level) => (
            <GateResultCard
              key={level}
              level={level}
              result={gateResults[level]}
            />
          ))}
        </div>

        {/* Critical Notice */}
        {failures.length > 0 && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">{t.gates.auditStopped}</p>
                  <p className="text-sm text-muted-foreground">
                    {t.gates.auditStoppedDesc}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Failure Dialog */}
      <AlertDialog open={showFailureDialog} onOpenChange={setShowFailureDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              {t.gates.gateFailureDetected}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {failures.length > 0 && (
                <span>
                  {t.gates.gateFailureDesc
                    .replace('{level}', failures[0].level)
                    .replace('{score}', String(failures[0].result.score))
                    .replace(/<[^>]*>/g, '')}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowFailureDialog(false)}>
              {t.gates.viewFixList}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
