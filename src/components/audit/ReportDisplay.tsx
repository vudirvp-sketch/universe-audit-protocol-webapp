'use client';

import * as React from 'react';
import { useAuditState } from '@/hooks/useAuditState';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Download,
  Copy,
  Check,
  FileText,
  Code,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import type { AuditReport, LegacySkeleton } from '@/lib/audit/types';
import { t } from '@/lib/i18n/ru';
import { Label } from '@/components/ui/label';

// Type guard for LegacySkeleton
function isLegacySkeleton(skeleton: unknown): skeleton is LegacySkeleton {
  return skeleton !== null && typeof skeleton === 'object' && 'thematicLaw' in skeleton;
}

const CLASSIFICATION_COLORS = {
  cult_masterpiece: 'bg-purple-500 text-white',
  powerful: 'bg-green-500 text-white',
  living_weak_soul: 'bg-yellow-500 text-black',
  decoration: 'bg-red-500 text-white',
};

const CLASSIFICATION_LABELS: Record<string, string> = {
  cult_masterpiece: t.report.cult_masterpiece,
  powerful: t.report.powerful,
  living_weak_soul: t.report.living_weak_soul,
  decoration: t.report.decoration,
};

interface HumanReadableReportProps {
  report: AuditReport;
}

function HumanReadableReport({ report }: HumanReadableReportProps) {
  const { humanReadable, jsonData } = report;

  return (
    <ScrollArea className="h-[600px] pr-4">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{t.report.title}</h2>
            <p className="text-muted-foreground">{t.report.protocolVersion}</p>
          </div>
          <Badge className={CLASSIFICATION_COLORS[humanReadable.classification]}>
            {CLASSIFICATION_LABELS[humanReadable.classification] || humanReadable.classification}
          </Badge>
        </div>

        {/* 1. Audit Mode */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t.report.auditMode}</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className="text-lg">
              {humanReadable.auditMode.toUpperCase()}
            </Badge>
            <p className="text-sm text-muted-foreground mt-2">
              {humanReadable.auditMode === 'conflict' && t.report.conflictModeDesc}
              {humanReadable.auditMode === 'kishō' && t.report.kishoModeDesc}
              {humanReadable.auditMode === 'hybrid' && t.report.hybridModeDesc}
            </p>
          </CardContent>
        </Card>

        {/* 2. Author Profile */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t.report.authorProfile}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-lg">
                {humanReadable.authorProfile.type.toUpperCase()}
              </Badge>
              <span className="text-2xl font-bold">{humanReadable.authorProfile.percentage}%</span>
              <Badge variant="secondary">
                {humanReadable.authorProfile.confidence === 'high' ? t.report.confidenceHigh : humanReadable.authorProfile.confidence === 'medium' ? t.report.confidenceMedium : t.report.confidenceLow} {t.report.confidenceLabel}
              </Badge>
            </div>
            <div className="mt-3 space-y-1">
              <p className="text-sm"><strong>{t.report.mainRisks}</strong></p>
              <ul className="text-sm text-muted-foreground list-disc list-inside">
                {humanReadable.authorProfile.mainRisks.map((risk, i) => (
                  <li key={i}>{risk}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* 3. Skeleton */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t.report.skeleton}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {isLegacySkeleton(humanReadable.skeleton) ? (
                // Legacy skeleton format
                <>
                  {[
                    { label: t.report.skeletonLabels.thematicLaw, value: humanReadable.skeleton.thematicLaw },
                    { label: t.report.skeletonLabels.rootTrauma, value: humanReadable.skeleton.rootTrauma },
                    { label: t.report.skeletonLabels.hamartia, value: humanReadable.skeleton.hamartia },
                    { label: t.report.skeletonLabels.pillars, value: humanReadable.skeleton.pillars?.join(' \u2192 ') },
                    { label: t.report.skeletonLabels.emotionalEngine, value: humanReadable.skeleton.emotionalEngine },
                    { label: t.report.skeletonLabels.authorProhibition, value: humanReadable.skeleton.authorProhibition },
                    { label: t.report.skeletonLabels.targetExperience, value: humanReadable.skeleton.targetExperience },
                    { label: t.report.skeletonLabels.centralQuestion, value: humanReadable.skeleton.centralQuestion },
                  ].map((item) => (
                    <div key={item.label}>
                      <Label className="text-xs text-muted-foreground">{item.label}</Label>
                      <p className="text-sm">{item.value || <span className="text-muted-foreground italic">{t.report.notExtracted}</span>}</p>
                    </div>
                  ))}
                </>
              ) : (
                // New skeleton format
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={humanReadable.skeleton.status === 'COMPLETE' ? 'default' : 'destructive'}>
                      {humanReadable.skeleton.status}
                    </Badge>
                  </div>
                  {humanReadable.skeleton.elements.map((element) => (
                    <div key={element.id}>
                      <Label className="text-xs text-muted-foreground">{element.name}</Label>
                      <p className="text-sm">{element.value || <span className="text-muted-foreground italic">{t.report.notExtracted}</span>}</p>
                    </div>
                  ))}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 4. Screening */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t.report.screening}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {[
                { q: t.report.screeningQuestions.q1, a: humanReadable.screening.question1_thematicLaw },
                { q: t.report.screeningQuestions.q2, a: humanReadable.screening.question2_worldWithoutProtagonist },
                { q: t.report.screeningQuestions.q3, a: humanReadable.screening.question3_embodiment },
                { q: t.report.screeningQuestions.q4, a: humanReadable.screening.question4_hamartia },
                { q: t.report.screeningQuestions.q5, a: humanReadable.screening.question5_painfulChoice },
                { q: t.report.screeningQuestions.q6, a: humanReadable.screening.question6_antagonistLogic },
                { q: t.report.screeningQuestions.q7, a: humanReadable.screening.question7_finalIrreversible },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded border">
                  {item.a ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm">{item.q}</span>
                </div>
              ))}
            </div>
            <Badge
              variant={humanReadable.screening.recommendation === 'ready_for_audit' ? 'default' : 'destructive'}
              className="mt-3"
            >
              {humanReadable.screening.recommendation.replace(/_/g, ' ')}
            </Badge>
          </CardContent>
        </Card>

        {/* 5. Gate Results */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t.report.gateResults}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2">
              {['L1', 'L2', 'L3', 'L4'].map((level) => {
                const gate = humanReadable.gates[level as keyof typeof humanReadable.gates];
                return (
                  <div
                    key={level}
                    className={`p-3 rounded text-center ${
                      gate?.passed ? 'bg-green-500/10 border border-green-500/30' :
                      gate ? 'bg-red-500/10 border border-red-500/30' : 'bg-muted'
                    }`}
                  >
                    <div className="text-lg font-bold">{gate?.score || 0}%</div>
                    <div className="text-xs text-muted-foreground">{level}</div>
                    {gate?.passed ? (
                      <CheckCircle2 className="h-4 w-4 mx-auto text-green-500 mt-1" />
                    ) : gate ? (
                      <XCircle className="h-4 w-4 mx-auto text-red-500 mt-1" />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 6. Scores */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t.report.scores}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-2">
              {Object.entries(humanReadable.scores).map(([key, value]) => (
                <div key={key} className="p-2 rounded bg-muted text-center">
                  <div className="text-lg font-bold">{value}/5</div>
                  <div className="text-xs text-muted-foreground capitalize">{key}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 7. Critical Holes */}
        {humanReadable.criticalHoles.length > 0 && (
          <Card className="border-destructive/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                {t.report.criticalHoles}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {humanReadable.criticalHoles.slice(0, 5).map((hole) => (
                  <div key={hole.id} className="p-2 rounded border border-destructive/30">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs font-mono">{hole.id}</Badge>
                      <Badge variant="destructive" className="text-xs">{hole.severity}</Badge>
                    </div>
                    <p className="text-sm">{hole.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 14. Final Score */}
        <Card className="border-primary/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t.report.finalScore}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-4xl font-bold">
                  {humanReadable.finalScore}/{jsonData.audit_meta.applicable_items}
                </div>
                <div className="text-lg text-muted-foreground">{humanReadable.finalPercentage}%</div>
              </div>
              <Badge className={`${CLASSIFICATION_COLORS[humanReadable.classification]} text-lg px-4 py-2`}>
                {CLASSIFICATION_LABELS[humanReadable.classification] || humanReadable.classification}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* 15. Priority Actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t.report.priorityActions}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {humanReadable.priorityActions.map((action, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded bg-muted">
                  <Badge variant="outline">{i + 1}</Badge>
                  <p className="text-sm">{action}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}

interface JsonReportProps {
  report: AuditReport;
}

function JsonReport({ report }: JsonReportProps) {
  const [copied, setCopied] = React.useState(false);

  const jsonString = JSON.stringify(report.jsonData, null, 2);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audit-report.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
          {copied ? t.report.copied : t.report.copy}
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="h-4 w-4 mr-2" />
          {t.report.downloadJson}
        </Button>
      </div>
      <ScrollArea className="h-[550px]">
        <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto">
          {jsonString}
        </pre>
      </ScrollArea>
    </div>
  );
}

export function ReportDisplay() {
  const report = useAuditState((state) => state.report);

  if (!report) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-[400px]">
          <div className="text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t.report.notGenerated}</p>
            <p className="text-sm text-muted-foreground">
              {t.report.notGeneratedHint}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{t.report.title}</CardTitle>
        <CardDescription>
          {t.report.protocolVersion}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="human">
          <TabsList className="w-full">
            <TabsTrigger value="human" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t.report.humanReadable}
            </TabsTrigger>
            <TabsTrigger value="json" className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              {t.report.jsonView}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="human" className="mt-4">
            <HumanReadableReport report={report} />
          </TabsContent>

          <TabsContent value="json" className="mt-4">
            <JsonReport report={report} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
