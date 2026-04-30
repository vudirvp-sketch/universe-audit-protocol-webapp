'use client';

import * as React from 'react';
import { useAuditState } from '@/hooks/useAuditState';
import type { AuditReport } from '@/lib/audit/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Download,
  Copy,
  Check,
  FileText,
  Code,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { t } from '@/lib/i18n/ru';
import { Label } from '@/components/ui/label';

// Classification display helpers
const CLASSIFICATION_COLORS: Record<string, string> = {
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

// Derive classification from percentage — MUST match scoring-algorithm.ts thresholds
// scoring-algorithm.ts (calculateOverallScore): 90/75/55
function getClassification(percentage: number): string {
  if (percentage >= 90) return 'cult_masterpiece';
  if (percentage >= 75) return 'powerful';
  if (percentage >= 55) return 'living_weak_soul';
  return 'decoration';
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

  const percentage = report.finalScore?.percentage ?? 0;
  const classification = getClassification(percentage);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{t.report.title}</CardTitle>
        <CardDescription>
          {t.report.protocolVersion} — {report.generatedAt}
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
            <HumanReadableReport report={report} classification={classification} percentage={percentage} />
          </TabsContent>

          <TabsContent value="json" className="mt-4">
            <JsonReport report={report} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Human-readable report view — uses flat AuditReport from pipeline
// ---------------------------------------------------------------------------

function HumanReadableReport({
  report,
  classification,
  percentage,
}: {
  report: AuditReport;
  classification: string;
  percentage: number;
}) {
  const [copied, setCopied] = React.useState(false);
  const [promptCopied, setPromptCopied] = React.useState(false);

  // Generate markdown text from the report for download/copy
  const generateMarkdown = React.useCallback(() => {
    const lines: string[] = [];
    lines.push(`# ${t.report.title}`);
    lines.push(`${t.report.protocolVersion}\n`);

    if (report.auditMode) {
      lines.push(`## ${t.report.auditMode}`);
      lines.push(report.auditMode.toUpperCase() + '\n');
    }

    if (report.authorProfile) {
      lines.push(`## ${t.report.authorProfile}`);
      lines.push(`- **${t.report.confidenceLabel}**: ${report.authorProfile.confidence}`);
      lines.push(`- **%**: ${report.authorProfile.percentage}%`);
      if (report.authorProfile.mainRisks.length > 0) {
        lines.push(`- **${t.report.mainRisks}** ${report.authorProfile.mainRisks.join(', ')}`);
      }
      lines.push('');
    }

    if (report.skeleton) {
      lines.push(`## ${t.report.skeleton}`);
      lines.push(`**${report.skeleton.status}**\n`);
      for (const el of report.skeleton.elements) {
        lines.push(`- **${el.name}**: ${el.value || t.report.notExtracted}`);
      }
      lines.push('');
    }

    if (report.screeningResult) {
      lines.push(`## ${t.report.screening}`);
      lines.push(`**${report.screeningResult.recommendation}**\n`);
      lines.push('');
    }

    lines.push(`## ${t.report.gateResults}`);
    for (const level of ['L1', 'L2', 'L3', 'L4'] as const) {
      const gate = report.gateResults[level];
      lines.push(`- **${level}**: ${gate?.score || 0}% ${gate?.passed ? '✅' : '❌'}`);
    }
    lines.push('');

    if (report.issues.length > 0) {
      lines.push(`## ${t.report.criticalHoles} (${report.issues.length})`);
      for (const issue of report.issues) {
        lines.push(`- [${issue.id}] **${issue.severity}**: ${issue.diagnosis}`);
      }
      lines.push('');
    }

    if (report.finalScore) {
      lines.push(`## ${t.report.finalScore}`);
      lines.push(`**${report.finalScore.total}** (${percentage}%)`);
      lines.push(`**${CLASSIFICATION_LABELS[classification] || classification}**`);
    }

    return lines.join('\n');
  }, [report, classification, percentage]);

  const handleDownloadMarkdown = () => {
    const md = generateMarkdown();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audit-report.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyMarkdown = async () => {
    const md = generateMarkdown();
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPrompt = async () => {
    // Build the final prompt that the user can paste into an LLM chat to continue
    const promptParts: string[] = [];
    promptParts.push('Продолжи аудит следующего концепта:\n');
    if (report.skeleton) {
      promptParts.push('## Скелет:');
      for (const el of report.skeleton.elements) {
        promptParts.push(`- ${el.name}: ${el.value || 'не извлечено'}`);
      }
      promptParts.push('');
    }
    for (const level of ['L1', 'L2', 'L3', 'L4'] as const) {
      const gate = report.gateResults[level];
      if (gate) {
        promptParts.push(`## ${level}: ${gate.score}% ${gate.passed ? 'ПРОЙДЕН' : 'НЕ ПРОЙДЕН'}`);
        for (const c of gate.conditions.filter(c => !c.passed)) {
          promptParts.push(`- ❌ ${c.id}: ${c.message || ''}`);
        }
        promptParts.push('');
      }
    }
    if (report.issues.length > 0) {
      promptParts.push('## Проблемы:');
      for (const issue of report.issues) {
        promptParts.push(`- [${issue.id}] ${issue.severity}: ${issue.diagnosis}`);
      }
    }

    await navigator.clipboard.writeText(promptParts.join('\n'));
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
  };

  return (
    <ScrollArea className="h-[600px] pr-4">
      <div className="space-y-6">
        {/* Action buttons — plan Section 3.4 */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyMarkdown}>
            {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            {copied ? t.report.copied : t.report.copy}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadMarkdown}>
            <Download className="h-4 w-4 mr-2" />
            {t.report.downloadMarkdown}
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyPrompt} title={t.report.copyPromptHint}>
            {promptCopied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            {promptCopied ? t.report.copied : t.report.copyPrompt}
          </Button>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{t.report.title}</h2>
            <p className="text-muted-foreground">{t.report.protocolVersion}</p>
          </div>
          <Badge className={CLASSIFICATION_COLORS[classification]}>
            {CLASSIFICATION_LABELS[classification] || classification}
          </Badge>
        </div>

        {/* 1. Audit Mode */}
        {report.auditMode && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t.report.auditMode}</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline" className="text-lg">
                {report.auditMode.toUpperCase()}
              </Badge>
              <p className="text-sm text-muted-foreground mt-2">
                {report.auditMode === 'conflict' && t.report.conflictModeDesc}
                {report.auditMode === 'kishō' && t.report.kishoModeDesc}
                {report.auditMode === 'hybrid' && t.report.hybridModeDesc}
              </p>
            </CardContent>
          </Card>
        )}

        {/* 2. Author Profile */}
        {report.authorProfile && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t.report.authorProfile}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-lg">
                  {report.authorProfile.type.toUpperCase()}
                </Badge>
                <span className="text-2xl font-bold">{report.authorProfile.percentage}%</span>
                <Badge variant="secondary">
                  {report.authorProfile.confidence === 'high' ? t.report.confidenceHigh : report.authorProfile.confidence === 'medium' ? t.report.confidenceMedium : t.report.confidenceLow} {t.report.confidenceLabel}
                </Badge>
              </div>
              <div className="mt-3 space-y-1">
                <p className="text-sm"><strong>{t.report.mainRisks}</strong></p>
                <ul className="text-sm text-muted-foreground list-disc list-inside">
                  {report.authorProfile.mainRisks.map((risk, i) => (
                    <li key={i}>{risk}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 3. Skeleton */}
        {report.skeleton && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t.report.skeleton}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={report.skeleton.status === 'COMPLETE' ? 'default' : 'destructive'}>
                    {report.skeleton.status}
                  </Badge>
                </div>
                {report.skeleton.elements.map((element) => (
                  <div key={element.id}>
                    <Label className="text-xs text-muted-foreground">{element.name}</Label>
                    <p className="text-sm">{element.value || <span className="text-muted-foreground italic">{t.report.notExtracted}</span>}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 4. Screening */}
        {report.screeningResult && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t.report.screening}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { q: t.report.screeningQuestions.q1, a: report.screeningResult.question1_thematicLaw },
                  { q: t.report.screeningQuestions.q2, a: report.screeningResult.question2_worldWithoutProtagonist },
                  { q: t.report.screeningQuestions.q3, a: report.screeningResult.question3_embodiment },
                  { q: t.report.screeningQuestions.q4, a: report.screeningResult.question4_hamartia },
                  { q: t.report.screeningQuestions.q5, a: report.screeningResult.question5_painfulChoice },
                  { q: t.report.screeningQuestions.q6, a: report.screeningResult.question6_antagonistLogic },
                  { q: t.report.screeningQuestions.q7, a: report.screeningResult.question7_finalIrreversible },
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
                variant={report.screeningResult.recommendation === 'ready_for_audit' ? 'default' : 'destructive'}
                className="mt-3"
              >
                {report.screeningResult.recommendation.replace(/_/g, ' ')}
              </Badge>
            </CardContent>
          </Card>
        )}

        {/* 5. Gate Results */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t.report.gateResults}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['L1', 'L2', 'L3', 'L4'] as const).map((level) => {
                const gate = report.gateResults[level];
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

        {/* 6. Gate Score Breakdown */}
        {Object.keys(report.scores).length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t.report.scores}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(report.scores).map(([key, value]) => (
                  <div key={key} className="p-2 rounded bg-muted text-center">
                    <div className="text-lg font-bold">{value}%</div>
                    <div className="text-xs text-muted-foreground">{key}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 7. Issues Summary */}
        {report.issues.length > 0 && (
          <Card className="border-destructive/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Badge variant="destructive">{report.issues.length}</Badge>
                {t.report.criticalHoles}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {report.issues.slice(0, 5).map((issue) => (
                  <div key={issue.id} className="p-2 rounded border border-destructive/30">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs font-mono">{issue.id}</Badge>
                      <Badge variant="destructive" className="text-xs">{issue.severity}</Badge>
                    </div>
                    <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{issue.diagnosis}</ReactMarkdown>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 8. Final Score */}
        {report.finalScore && (
          <Card className="border-primary/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t.report.finalScore}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-4xl font-bold">
                    {report.finalScore.total}
                  </div>
                  <div className="text-lg text-muted-foreground">{percentage}%</div>
                </div>
                <Badge className={`${CLASSIFICATION_COLORS[classification] || ''} text-lg px-4 py-2`}>
                  {CLASSIFICATION_LABELS[classification] || classification}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}

// ---------------------------------------------------------------------------
// JSON report view — serializes flat AuditReport directly
// ---------------------------------------------------------------------------

function JsonReport({
  report,
}: {
  report: AuditReport;
}) {
  const [copied, setCopied] = React.useState(false);

  const jsonString = JSON.stringify(report, null, 2);

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
