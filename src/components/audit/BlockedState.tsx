'use client';

import * as React from 'react';
import { useAuditState } from '@/hooks/useAuditState';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  AlertTriangle,
  Download,
  Copy,
  Check,
  RotateCcw,
  Wrench,
  ShieldAlert,
  ShieldX,
  Zap,
} from 'lucide-react';
import { t } from '@/lib/i18n/ru';
import type { GateResult, FixItem } from '@/lib/audit/types';

// ---------------------------------------------------------------------------
// Patch type labels in Russian
// ---------------------------------------------------------------------------

const PATCH_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  conservative: { label: t.blocked.patchConservative, icon: <ShieldAlert className="h-4 w-4" /> },
  compromise: { label: t.blocked.patchCompromise, icon: <Wrench className="h-4 w-4" /> },
  radical: { label: t.blocked.patchRadical, icon: <Zap className="h-4 w-4" /> },
};

// ---------------------------------------------------------------------------
// BlockedState component
// ---------------------------------------------------------------------------

export function BlockedState() {
  const phase = useAuditState((s) => s.phase);
  const error = useAuditState((s) => s.error);
  const gateResults = useAuditState((s) => s.gateResults);
  const issues = useAuditState((s) => s.issues);
  const reset = useAuditState((s) => s.reset);

  const [copied, setCopied] = React.useState(false);

  // Only show when blocked
  if (phase !== 'blocked') return null;

  // Find the failed gate
  const failedGate = findFailedGate(gateResults);
  const failedLevel = failedGate?.level || '';
  const failedScore = failedGate?.score || 0;

  // Get critical issues for this blockage
  const criticalIssues = issues.filter(
    (i) => i.severity === 'critical' || i.severity === 'major'
  );

  // Copy recommendations
  const handleCopy = async () => {
    const text = criticalIssues
      .map((i) => `${i.id}: ${i.diagnosis}\n${t.blocked.impact} ${i.patches[i.recommended]?.description || i.patches.compromise.description}`)
      .join('\n\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download current results as JSON
  const handleDownload = () => {
    const data = {
      phase,
      error,
      gateResults,
      issues: criticalIssues,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audit-blocked-results.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="border-red-500/50 bg-red-500/5">
      <CardHeader>
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-8 w-8 text-red-500" />
          <div>
            <CardTitle className="text-xl text-red-500">
              {t.gates.blockedTitle.replace('{level}', failedLevel)}
            </CardTitle>
            <CardDescription>
              {t.gates.blockedDescription
                .replace('{threshold}', String(failedScore))
                .replace('{level}', failedLevel)}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Error message */}
        {error && (
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Failed criteria */}
        {criticalIssues.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">{t.blocked.failedCriteria}</h4>
            {criticalIssues.slice(0, 10).map((issue) => (
              <div
                key={issue.id}
                className="p-2 rounded border border-red-500/20 bg-red-500/5"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs font-mono">
                    {issue.id}
                  </Badge>
                  <Badge
                    variant={
                      issue.severity === 'critical' ? 'destructive' : 'secondary'
                    }
                    className="text-xs"
                  >
                    {issue.severity}
                  </Badge>
                </div>
                <p className="text-sm">{issue.diagnosis}</p>

                {/* Three patch variants */}
                {issue.patches && (
                  <Tabs defaultValue="compromise" className="mt-2">
                    <TabsList className="h-7">
                      {(['conservative', 'compromise', 'radical'] as const).map(
                        (type) => (
                          <TabsTrigger
                            key={type}
                            value={type}
                            className="text-xs px-2 h-5"
                          >
                            {PATCH_LABELS[type]?.label || type}
                          </TabsTrigger>
                        )
                      )}
                    </TabsList>
                    {(['conservative', 'compromise', 'radical'] as const).map(
                      (type) => (
                        <TabsContent key={type} value={type} className="mt-1">
                          <p className="text-xs text-muted-foreground">
                            {issue.patches[type]?.description || t.blocked.noDescription}
                          </p>
                          {issue.patches[type]?.impact && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {t.blocked.impact} {issue.patches[type].impact}
                            </p>
                          )}
                        </TabsContent>
                      )
                    )}
                  </Tabs>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Weakness test explanation */}
        <div className="p-3 rounded-md bg-muted">
          <p className="text-sm font-medium">{t.blocked.whyImportant}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {t.blocked.whyImportantExplanation}
          </p>
        </div>

        <Separator />

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <Button variant="default" onClick={reset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            {t.blocked.editAndRestart}
          </Button>
          <Button variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            {t.blocked.downloadResults}
          </Button>
          <Button variant="outline" onClick={handleCopy}>
            {copied ? (
              <Check className="h-4 w-4 mr-2" />
            ) : (
              <Copy className="h-4 w-4 mr-2" />
            )}
            {copied ? t.blocked.copied : t.blocked.copyRecommendations}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findFailedGate(
  gateResults: Record<string, GateResult | null>
): GateResult | null {
  for (const level of ['L1', 'L2', 'L3', 'L4']) {
    const result = gateResults[level];
    if (result && result.halt) return result;
  }
  // Return the last evaluated gate even if not explicitly halted
  for (const level of ['L4', 'L3', 'L2', 'L1']) {
    const result = gateResults[level];
    if (result) return result;
  }
  return null;
}
