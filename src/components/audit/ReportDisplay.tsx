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

const CLASSIFICATION_LABELS = {
  cult_masterpiece: 'Культовый шедевр',
  powerful: 'Мощный нарратив',
  living_weak_soul: 'Живой мир, слабая душа',
  decoration: 'Декорация',
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
            <h2 className="text-2xl font-bold">Отчёт аудита</h2>
            <p className="text-muted-foreground">Протокол Аудита Вселенной v10.0</p>
          </div>
          <Badge className={CLASSIFICATION_COLORS[humanReadable.classification]}>
            {CLASSIFICATION_LABELS[humanReadable.classification]}
          </Badge>
        </div>

        {/* 1. Audit Mode */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">1. Режим аудита</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className="text-lg">
              {humanReadable.auditMode.toUpperCase()}
            </Badge>
            <p className="text-sm text-muted-foreground mt-2">
              {humanReadable.auditMode === 'conflict' && 'Западная структура, Путешествие Героя, конфликт как драйвер'}
              {humanReadable.auditMode === 'kishō' && 'Структура без конфликта, смена перспективы как драйвер'}
              {humanReadable.auditMode === 'hybrid' && 'Архитектура Горя как основа, антагонист как симптом'}
            </p>
          </CardContent>
        </Card>

        {/* 2. Author Profile */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">2. Профиль автора</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-lg">
                {humanReadable.authorProfile.type.toUpperCase()}
              </Badge>
              <span className="text-2xl font-bold">{humanReadable.authorProfile.percentage}%</span>
              <Badge variant="secondary">{humanReadable.authorProfile.confidence === 'high' ? 'высокая' : humanReadable.authorProfile.confidence === 'medium' ? 'средняя' : 'низкая'} уверенность</Badge>
            </div>
            <div className="mt-3 space-y-1">
              <p className="text-sm"><strong>Главные риски:</strong></p>
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
            <CardTitle className="text-base">3. Извлечённый скелет</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {isLegacySkeleton(humanReadable.skeleton) ? (
                // Legacy skeleton format
                <>
                  {[
                    { label: 'Тематический закон', value: humanReadable.skeleton.thematicLaw },
                    { label: 'Корневая травма', value: humanReadable.skeleton.rootTrauma },
                    { label: 'Хамартия', value: humanReadable.skeleton.hamartia },
                    { label: '3 Столпа', value: humanReadable.skeleton.pillars?.join(' → ') },
                    { label: 'Эмоциональный двигатель', value: humanReadable.skeleton.emotionalEngine },
                    { label: 'Авторский запрет', value: humanReadable.skeleton.authorProhibition },
                    { label: 'Целевой опыт', value: humanReadable.skeleton.targetExperience },
                    { label: 'Центральный вопрос', value: humanReadable.skeleton.centralQuestion },
                  ].map((item) => (
                    <div key={item.label}>
                      <Label className="text-xs text-muted-foreground">{item.label}</Label>
                      <p className="text-sm">{item.value || <span className="text-muted-foreground italic">Не извлечено</span>}</p>
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
                      <p className="text-sm">{element.value || <span className="text-muted-foreground italic">Not extracted</span>}</p>
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
            <CardTitle className="text-base">4. Быстрый скрининг</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {[
                { q: 'Закон как правило?', a: humanReadable.screening.question1_thematicLaw },
                { q: 'Мир без героя?', a: humanReadable.screening.question2_worldWithoutProtagonist },
                { q: 'Воплощённость?', a: humanReadable.screening.question3_embodiment },
                { q: 'Хамартия определена?', a: humanReadable.screening.question4_hamartia },
                { q: 'Болезненный выбор?', a: humanReadable.screening.question5_painfulChoice },
                { q: 'Логика антагониста?', a: humanReadable.screening.question6_antagonistLogic },
                { q: 'Финал необратим?', a: humanReadable.screening.question7_finalIrreversible },
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
            <CardTitle className="text-base">5. Результаты гейтов</CardTitle>
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
            <CardTitle className="text-base">6. Оценки по измерениям</CardTitle>
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
                7. Критические проблемы
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
            <CardTitle className="text-base">14. Итоговый балл</CardTitle>
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
            <CardTitle className="text-base">15. Приоритетные действия</CardTitle>
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
          {copied ? 'Скопировано!' : 'Копировать'}
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="h-4 w-4 mr-2" />
          Скачать JSON
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
            <p className="text-muted-foreground">Отчёт ещё не сгенерирован</p>
            <p className="text-sm text-muted-foreground">
              Завершите аудит для просмотра полного отчёта
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Отчёт аудита</CardTitle>
        <CardDescription>
          Читаемый анализ и структурированный JSON-вывод
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="human">
          <TabsList className="w-full">
            <TabsTrigger value="human" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Читаемый отчёт
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
