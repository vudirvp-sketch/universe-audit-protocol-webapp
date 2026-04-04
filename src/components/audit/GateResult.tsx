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
} from 'lucide-react';
import type { GateResult as GateResultType, FixItem } from '@/lib/audit/types';
import { GATE_THRESHOLD } from '@/lib/audit/protocol-data';

interface GateResultCardProps {
  level: 'L1' | 'L2' | 'L3' | 'L4';
  result: GateResultType | null;
  onProceed?: () => void;
}

const LEVEL_INFO = {
  L1: {
    name: 'Mechanism',
    description: 'Does the world work as a system?',
    focus: 'Basic coherence, logic, economy',
  },
  L2: {
    name: 'Body',
    description: 'Is there embodiment and consequences?',
    focus: 'Trust, routine, spatial memory',
  },
  L3: {
    name: 'Psyche',
    description: 'Does the world work as a symptom?',
    focus: 'Grief architecture, character depth',
  },
  L4: {
    name: 'Meta',
    description: 'Does it ask about real life?',
    focus: 'Mirror, cult status, authorship ethics',
  },
};

const SEVERITY_COLORS = {
  critical: 'bg-red-500/10 border-red-500/50 text-red-600',
  major: 'bg-orange-500/10 border-orange-500/50 text-orange-600',
  minor: 'bg-yellow-500/10 border-yellow-500/50 text-yellow-600',
};

const APPROACH_COLORS = {
  conservative: 'bg-blue-500/10 border-blue-500/50',
  compromise: 'bg-purple-500/10 border-purple-500/50',
  radical: 'bg-red-500/10 border-red-500/50',
};

function FixItemCard({ fix }: { fix: FixItem }) {
  return (
    <div className={`p-3 rounded-md border ${SEVERITY_COLORS[fix.severity]}`}>
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="outline" className="text-xs font-mono">
          {fix.id}
        </Badge>
        <Badge className={`text-xs ${fix.severity === 'critical' ? 'bg-red-500' : fix.severity === 'major' ? 'bg-orange-500' : 'bg-yellow-500'}`}>
          {fix.severity}
        </Badge>
        <Badge variant="outline" className="text-xs">
          {fix.type}
        </Badge>
      </div>
      <p className="text-sm mb-2">{fix.description}</p>
      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${APPROACH_COLORS[fix.recommendedApproach]}`}>
        <Wrench className="h-3 w-3" />
        {fix.recommendedApproach} fix recommended
      </div>
    </div>
  );
}

export function GateResultCard({ level, result, onProceed }: GateResultCardProps) {
  const info = LEVEL_INFO[level];

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
            <Badge variant="outline">Pending</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This level has not been evaluated yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const passed = result.passed;
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
              {passed ? 'PASSED' : 'FAILED'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score Breakdown */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Score</span>
            <span>{score}% (threshold: {GATE_THRESHOLD}%)</span>
          </div>
          <Progress value={score} className={`h-3 ${passed ? '[&>div]:bg-green-500' : '[&>div]:bg-red-500'}`} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-2 rounded bg-muted">
            <div className="text-lg font-bold">{result.applicableItems}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div className="p-2 rounded bg-green-500/10">
            <div className="text-lg font-bold text-green-600">{result.passedItems}</div>
            <div className="text-xs text-muted-foreground">Passed</div>
          </div>
          <div className="p-2 rounded bg-red-500/10">
            <div className="text-lg font-bold text-red-600">{result.failedItems}</div>
            <div className="text-xs text-muted-foreground">Failed</div>
          </div>
          <div className="p-2 rounded bg-yellow-500/10">
            <div className="text-lg font-bold text-yellow-600">{result.insufficientDataItems}</div>
            <div className="text-xs text-muted-foreground">No Data</div>
          </div>
        </div>

        {/* Fix List (if failed) */}
        {!passed && result.fixList.length > 0 && (
          <Accordion type="single" collapsible>
            <AccordionItem value="fixes">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span>Prioritized Fix List ({result.fixList.length} items)</span>
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
            Proceed to {level === 'L1' ? 'L2 (Body)' : level === 'L2' ? 'L3 (Psyche)' : level === 'L3' ? 'L4 (Meta)' : 'Final Report'}
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

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
          <h3 className="text-lg font-semibold">Gate Results</h3>
          {failures.length > 0 && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {failures.length} gate(s) failed
            </Badge>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
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
                  <p className="font-medium text-destructive">Audit Stopped</p>
                  <p className="text-sm text-muted-foreground">
                    The audit has been stopped due to failed gate(s). 
                    Fix the issues listed above before proceeding to the next level.
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
              Gate Failure Detected
            </AlertDialogTitle>
            <AlertDialogDescription>
              {failures.length > 0 && (
                <>
                  The <strong>{failures[0].level}</strong> gate failed with a score of{' '}
                  <strong>{failures[0].result.score}%</strong>.
                  <br /><br />
                  According to the Universe Audit Protocol v10.0, each level requires ≥60% 
                  to proceed. The audit has been stopped to prevent analysis on an unstable foundation.
                  <br /><br />
                  Please review the fix list and address the identified issues before continuing.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowFailureDialog(false)}>
              View Fix List
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
