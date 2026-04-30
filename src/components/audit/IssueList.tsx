'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, AlertCircle, Info, Wrench, CheckCircle2 } from 'lucide-react';
import type { Issue, Severity, PatchType } from '@/lib/audit/types';
import { t } from '@/lib/i18n/ru';

interface IssueListProps {
  issues: Issue[];
}

const SEVERITY_LABELS: Record<Severity, string> = {
  critical: t.issues.severityCritical,
  major: t.issues.severityMajor,
  minor: t.issues.severityMinor,
  cosmetic: t.issues.severityCosmetic,
};

const SEVERITY_CONFIG: Record<Severity, { icon: React.ReactNode; color: string; bg: string }> = {
  critical: {
    icon: <AlertCircle className="h-4 w-4" />,
    color: 'text-red-500',
    bg: 'bg-red-500/10 border-red-500/30',
  },
  major: {
    icon: <AlertTriangle className="h-4 w-4" />,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10 border-orange-500/30',
  },
  minor: {
    icon: <Info className="h-4 w-4" />,
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10 border-yellow-500/30',
  },
  cosmetic: {
    icon: <Info className="h-4 w-4" />,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10 border-blue-500/30',
  },
};

const PATCH_COLORS: Record<PatchType, string> = {
  conservative: 'bg-blue-500/10 border-blue-500/30 text-blue-600',
  compromise: 'bg-purple-500/10 border-purple-500/30 text-purple-600',
  radical: 'bg-red-500/10 border-red-500/30 text-red-600',
};

const PATCH_LABELS: Record<PatchType, string> = {
  conservative: t.issues.conservative,
  compromise: t.issues.compromise,
  radical: t.issues.radical,
};

function IssueCard({ issue }: { issue: Issue }) {
  const severityConfig = SEVERITY_CONFIG[issue.severity];

  return (
    <Card className={`border ${severityConfig.bg}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <span className={`flex items-center gap-1 ${severityConfig.color}`}>
                {severityConfig.icon}
                {issue.id}
              </span>
            </CardTitle>
            <Badge
              variant={issue.severity === 'critical' ? 'destructive' : issue.severity === 'major' ? 'default' : 'secondary'}
            >
              {SEVERITY_LABELS[issue.severity]}
            </Badge>
          </div>
          <span className="text-xs font-mono text-muted-foreground">{issue.location}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Diagnosis */}
        <p className="text-sm">{issue.diagnosis}</p>

        {/* Axes */}
        <div className="grid grid-cols-3 gap-4 p-3 bg-muted/50 rounded-lg">
          <div className="text-center">
            <div className={`text-2xl font-bold ${issue.axes.criticality >= 7 ? 'text-red-500' : issue.axes.criticality >= 4 ? 'text-orange-500' : 'text-green-500'}`}>
              {issue.axes.criticality}
            </div>
            <div className="text-xs text-muted-foreground">{t.issues.criticality}</div>
            <div className="w-full h-1 bg-muted rounded mt-1">
              <div
                className={`h-full rounded ${issue.axes.criticality >= 7 ? 'bg-red-500' : issue.axes.criticality >= 4 ? 'bg-orange-500' : 'bg-green-500'}`}
                style={{ width: `${(issue.axes.criticality / 10) * 100}%` }}
              />
            </div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${issue.axes.risk >= 7 ? 'text-red-500' : issue.axes.risk >= 4 ? 'text-orange-500' : 'text-green-500'}`}>
              {issue.axes.risk}
            </div>
            <div className="text-xs text-muted-foreground">{t.issues.risk}</div>
            <div className="w-full h-1 bg-muted rounded mt-1">
              <div
                className={`h-full rounded ${issue.axes.risk >= 7 ? 'bg-red-500' : issue.axes.risk >= 4 ? 'bg-orange-500' : 'bg-green-500'}`}
                style={{ width: `${(issue.axes.risk / 10) * 100}%` }}
              />
            </div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${issue.axes.time_cost >= 7 ? 'text-red-500' : issue.axes.time_cost >= 4 ? 'text-orange-500' : 'text-green-500'}`}>
              {issue.axes.time_cost}
            </div>
            <div className="text-xs text-muted-foreground">{t.issues.timeCost}</div>
            <div className="w-full h-1 bg-muted rounded mt-1">
              <div
                className={`h-full rounded ${issue.axes.time_cost >= 7 ? 'bg-red-500' : issue.axes.time_cost >= 4 ? 'bg-orange-500' : 'bg-green-500'}`}
                style={{ width: `${(issue.axes.time_cost / 10) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Patches Tabs */}
        <Tabs defaultValue={issue.recommended} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            {(['conservative', 'compromise', 'radical'] as const).map((type) => (
              <TabsTrigger key={type} value={type} className="text-xs">
                {PATCH_LABELS[type]}
              </TabsTrigger>
            ))}
          </TabsList>

          {(['conservative', 'compromise', 'radical'] as const).map((type) => {
            const patch = issue.patches[type];
            const isRecommended = issue.recommended === type;

            return (
              <TabsContent key={type} value={type} className="mt-3">
                <div className={`p-3 rounded-lg border ${PATCH_COLORS[type]}`}>
                  {isRecommended && (
                    <div className="flex items-center gap-1 mb-2">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-xs font-medium">{t.issues.recommendedApproach}</span>
                    </div>
                  )}

                  <p className="text-sm mb-2">{patch.description}</p>

                  {patch.impact && (
                    <div className="text-xs mb-2">
                      <span className="font-medium">{t.issues.impact}</span> {patch.impact}
                    </div>
                  )}

                  {patch.snippet && (
                    <pre className="text-xs bg-muted/50 p-2 rounded overflow-x-auto mb-2 font-mono">
                      {patch.snippet}
                    </pre>
                  )}

                  {patch.risks && patch.risks.length > 0 && (
                    <div className="text-xs mb-2">
                      <span className="font-medium">{t.issues.risks}</span>
                      <ul className="list-disc list-inside ml-2 mt-1">
                        {patch.risks.map((risk, i) => (
                          <li key={i}>{risk}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {patch.tests && patch.tests.length > 0 && (
                    <div className="text-xs">
                      <span className="font-medium">{t.issues.verificationTests}</span>
                      <ul className="list-disc list-inside ml-2 mt-1">
                        {patch.tests.map((test, i) => (
                          <li key={i}>{test}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {patch.sideEffects && patch.sideEffects.length > 0 && (
                    <div className="text-xs mt-2">
                      <span className="font-medium">{t.issues.sideEffects}</span>
                      <ul className="list-disc list-inside ml-2 mt-1">
                        {patch.sideEffects.map((effect, i) => (
                          <li key={i}>{effect}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </TabsContent>
            );
          })}
        </Tabs>

        {/* Reasoning */}
        {issue.reasoning && (
          <div className="text-xs text-muted-foreground italic">
            {issue.reasoning}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function IssueList({ issues }: IssueListProps) {
  if (issues.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 rounded-full bg-green-500/10">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <div>
              <h3 className="text-lg font-medium">{t.issues.noIssues}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t.issues.noIssuesDesc}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group issues by severity
  const criticalIssues = issues.filter(i => i.severity === 'critical');
  const majorIssues = issues.filter(i => i.severity === 'major');
  const minorIssues = issues.filter(i => i.severity === 'minor' || i.severity === 'cosmetic');

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <span className="font-medium">{t.issues.countIssues.replace('{count}', String(issues.length))}</span>
        </div>
        {criticalIssues.length > 0 && (
          <Badge variant="destructive">{t.issues.criticalCount.replace('{count}', String(criticalIssues.length))}</Badge>
        )}
        {majorIssues.length > 0 && (
          <Badge variant="default">{t.issues.majorCount.replace('{count}', String(majorIssues.length))}</Badge>
        )}
        {minorIssues.length > 0 && (
          <Badge variant="secondary">{t.issues.minorCount.replace('{count}', String(minorIssues.length))}</Badge>
        )}
      </div>

      {/* Critical Issues */}
      {criticalIssues.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-red-500">
            <AlertCircle className="h-5 w-5" />
            {t.issues.criticalIssues}
          </h3>
          <div className="space-y-4">
            {criticalIssues.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </div>
        </div>
      )}

      {/* Major Issues */}
      {majorIssues.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-orange-500">
            <AlertTriangle className="h-5 w-5" />
            {t.issues.majorIssues}
          </h3>
          <div className="space-y-4">
            {majorIssues.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </div>
        </div>
      )}

      {/* Minor Issues */}
      {minorIssues.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-yellow-500">
            <Info className="h-5 w-5" />
            {t.issues.minorIssues}
          </h3>
          <div className="space-y-4">
            {minorIssues.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default IssueList;
