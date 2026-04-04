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
import type { AuditReport } from '@/lib/audit/types';

const CLASSIFICATION_COLORS = {
  cult_masterpiece: 'bg-purple-500 text-white',
  powerful: 'bg-green-500 text-white',
  living_weak_soul: 'bg-yellow-500 text-black',
  decoration: 'bg-red-500 text-white',
};

const CLASSIFICATION_LABELS = {
  cult_masterpiece: 'Cult Masterpiece',
  powerful: 'Powerful Narrative',
  living_weak_soul: 'Living World, Weak Soul',
  decoration: 'Decoration',
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
            <h2 className="text-2xl font-bold">Audit Report</h2>
            <p className="text-muted-foreground">Universe Audit Protocol v10.0</p>
          </div>
          <Badge className={CLASSIFICATION_COLORS[humanReadable.classification]}>
            {CLASSIFICATION_LABELS[humanReadable.classification]}
          </Badge>
        </div>

        {/* 1. Audit Mode */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">1. Audit Mode</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className="text-lg">
              {humanReadable.auditMode.toUpperCase()}
            </Badge>
            <p className="text-sm text-muted-foreground mt-2">
              {humanReadable.auditMode === 'conflict' && 'Western structure, Hero\'s Journey, conflict as driver'}
              {humanReadable.auditMode === 'kishō' && 'Structure without conflict, perspective shift as driver'}
              {humanReadable.auditMode === 'hybrid' && 'Grief Architecture as foundation, antagonist as symptom'}
            </p>
          </CardContent>
        </Card>

        {/* 2. Author Profile */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">2. Author Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-lg">
                {humanReadable.authorProfile.type.toUpperCase()}
              </Badge>
              <span className="text-2xl font-bold">{humanReadable.authorProfile.percentage}%</span>
              <Badge variant="secondary">{humanReadable.authorProfile.confidence} confidence</Badge>
            </div>
            <div className="mt-3 space-y-1">
              <p className="text-sm"><strong>Main Risks:</strong></p>
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
            <CardTitle className="text-base">3. Extracted Skeleton</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: 'Thematic Law', value: humanReadable.skeleton.thematicLaw },
                { label: 'Root Trauma', value: humanReadable.skeleton.rootTrauma },
                { label: 'Hamartia', value: humanReadable.skeleton.hamartia },
                { label: '3 Pillars', value: humanReadable.skeleton.pillars?.join(' → ') },
                { label: 'Emotional Engine', value: humanReadable.skeleton.emotionalEngine },
                { label: 'Author Prohibition', value: humanReadable.skeleton.authorProhibition },
                { label: 'Target Experience', value: humanReadable.skeleton.targetExperience },
                { label: 'Central Question', value: humanReadable.skeleton.centralQuestion },
              ].map((item) => (
                <div key={item.label}>
                  <Label className="text-xs text-muted-foreground">{item.label}</Label>
                  <p className="text-sm">{item.value || <span className="text-muted-foreground italic">Not extracted</span>}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 4. Screening */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">4. Quick Screening</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {[
                { q: 'Theme as rule?', a: humanReadable.screening.question1_thematicLaw },
                { q: 'World without hero?', a: humanReadable.screening.question2_worldWithoutProtagonist },
                { q: 'Body present?', a: humanReadable.screening.question3_embodiment },
                { q: 'Hamartia defined?', a: humanReadable.screening.question4_hamartia },
                { q: 'Painful choice?', a: humanReadable.screening.question5_painfulChoice },
                { q: 'Antagonist logic?', a: humanReadable.screening.question6_antagonistLogic },
                { q: 'Final irreversible?', a: humanReadable.screening.question7_finalIrreversible },
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
            <CardTitle className="text-base">5. Gate Results</CardTitle>
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
            <CardTitle className="text-base">6. Dimensional Scores</CardTitle>
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
                7. Critical Issues
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
            <CardTitle className="text-base">14. Final Score</CardTitle>
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
                {CLASSIFICATION_LABELS[humanReadable.classification]}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* 15. Priority Actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">15. Priority Actions</CardTitle>
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

// Import Label component
import { Label } from '@/components/ui/label';

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
          {copied ? 'Copied!' : 'Copy'}
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="h-4 w-4 mr-2" />
          Download JSON
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
            <p className="text-muted-foreground">No report generated yet</p>
            <p className="text-sm text-muted-foreground">
              Complete the audit to see the full report
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Audit Report</CardTitle>
        <CardDescription>
          Human-readable analysis and structured JSON output
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="human">
          <TabsList className="w-full">
            <TabsTrigger value="human" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Human-Readable
            </TabsTrigger>
            <TabsTrigger value="json" className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              JSON
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
