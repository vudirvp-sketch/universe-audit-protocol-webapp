'use client';

import * as React from 'react';
import { useAuditState } from '@/hooks/useAuditState';
import { AuditForm } from '@/components/audit/AuditForm';
import { AuditProgress } from '@/components/audit/AuditProgress';
import { ChecklistDisplay } from '@/components/audit/ChecklistDisplay';
import { GriefArchitectureMatrix } from '@/components/audit/GriefArchitectureMatrix';
import { GateResults } from '@/components/audit/GateResult';
import { ReportDisplay } from '@/components/audit/ReportDisplay';
import { IssueList } from '@/components/audit/IssueList';
import { WhatForChains } from '@/components/audit/WhatForChains';
import { GenerativeOutputDisplay } from '@/components/audit/GenerativeOutput';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import {
  BookOpen,
  Github,
  Moon,
  Sun,
  Sparkles,
  FileText,
  ListChecks,
  Heart,
  BarChart3,
  RotateCcw,
  Settings,
  Key,
  AlertTriangle,
  Link2,
} from 'lucide-react';
import type { MediaType, AuthorProfileAnswers, AuditPhase, AuthorProfile, Skeleton, ScreeningResult, GateResult, Issue, ChainResult, GenerativeOutput, NextAction } from '@/lib/audit/types';
import { runAuditPipeline, type PipelineState } from '@/lib/audit/pipeline';
import { SettingsDialog } from '@/components/audit/SettingsDialog';
import { useSettings } from '@/hooks/useSettings';
import { t } from '@/lib/i18n/ru';

export default function Home() {
  const {
    phase,
    inputText,
    mediaType,
    auditMode,
    authorAnswers,
    isLoading,
    error,
    issues,
    whatForChains,
    generativeOutput,
    setPhase,
    setLoading,
    setError,
    setAuthorProfile,
    setSkeleton,
    setScreeningResult,
    setGateResult,
    setChecklist,
    setGriefMatrix,
    setReport,
    setIssues,
    setWhatForChains,
    setGenerativeOutput,
    setNextActions,
    setFinalScore,
    reset,
  } = useAuditState();

  const [theme, setTheme] = React.useState<'light' | 'dark'>('dark');
  const [abortController, setAbortController] = React.useState<AbortController | null>(null);
  const { provider, apiKey, model, proxyUrl, loadSettings, isLoaded } = useSettings();

  // Load settings on mount
  React.useEffect(() => {
    if (!isLoaded) {
      loadSettings();
    }
  }, [isLoaded, loadSettings]);

  // Toggle theme
  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Run full audit analysis via client-side pipeline
  const startAudit = async () => {
    if (!inputText.trim()) return;

    if (!apiKey) {
      setError('API ключ не указан. Откройте настройки и введите API ключ.');
      setPhase('failed');
      return;
    }

    if (!proxyUrl) {
      setError('URL прокси не указан. Откройте настройки и введите URL вашего Cloudflare Worker.');
      setPhase('failed');
      return;
    }

    // Create abort controller for cancellation support
    const controller = new AbortController();
    setAbortController(controller);

    setLoading(true);
    setError(null);
    setPhase('input_validation');

    try {
      const result = await runAuditPipeline(
        {
          narrative: inputText,
          mediaType,
          authorAnswers: authorAnswers ?? undefined,
        },
        {
          provider,
          apiKey,
          model,
          proxyUrl,
        },
        (phase: AuditPhase, state: PipelineState) => {
          // Per-step progress callback — update Zustand store in real time
          setPhase(phase);
        },
        controller.signal,
      );

      // Update state with pipeline results using properly typed setters
      if (result.authorProfile) {
        setAuthorProfile(result.authorProfile);
      }
      if (result.skeleton) {
        // Orchestrator may return SkeletonExtractionResult from skeleton-extraction module
        // or canonical Skeleton from types.ts. Both share compatible shape for UI display.
        setSkeleton(result.skeleton as unknown as Skeleton);
      }
      if (result.screeningResult) {
        setScreeningResult(result.screeningResult);
      }
      if (result.gateResults) {
        if (result.gateResults.L1) setGateResult('L1', result.gateResults.L1);
        if (result.gateResults.L2) setGateResult('L2', result.gateResults.L2);
        if (result.gateResults.L3) setGateResult('L3', result.gateResults.L3);
        if (result.gateResults.L4) setGateResult('L4', result.gateResults.L4);
      }
      if (result.issues && result.issues.length > 0) {
        setIssues(result.issues);
      }
      if (result.whatForChains && result.whatForChains.length > 0) {
        setWhatForChains(result.whatForChains);
      }
      if (result.generativeOutput) {
        setGenerativeOutput(result.generativeOutput);
      }
      if (result.nextActions && result.nextActions.length > 0) {
        setNextActions(result.nextActions);
      }
      if (result.finalScore) {
        setFinalScore(result.finalScore);
      }

      // Set phase based on result
      if (result.error) {
        setPhase(result.phase === 'blocked' ? 'blocked' : 'failed');
        setError(result.error);
      } else {
        setPhase('complete');
      }

    } catch (err) {
      // Check if cancelled
      if (abortController?.signal.aborted) {
        setPhase('cancelled');
        setError(null);
      } else {
        console.error('Audit error:', err);
        setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        setPhase('failed');
      }
    } finally {
      setLoading(false);
      setAbortController(null);
    }
  };

  // Cancel running audit
  const cancelAudit = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-amber-500" />
            <div>
              <h1 className="text-xl font-bold">Протокол Аудита Вселенной</h1>
              <p className="text-xs text-muted-foreground">v10.0</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden sm:flex">
              <BookOpen className="h-3 w-3 mr-1" />
              52 критерия
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
            <SettingsDialog />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => reset()}
              disabled={isLoading}
            >
              <RotateCcw className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
        {phase === 'idle' ? (
          /* Input Form Phase */
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2">Аудит вашей вселенной</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                {t.homeDescription}
              </p>
            </div>

            {/* Protocol Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { level: 'L1', name: 'Механизм', question: 'Работает ли мир как система?', icon: '⚙️' },
                { level: 'L2', name: 'Тело', question: 'Есть ли воплощённость?', icon: '🫀' },
                { level: 'L3', name: 'Психика', question: 'Работает ли как симптом?', icon: '🧠' },
                { level: 'L4', name: 'Мета', question: 'Спрашивает ли о реальной жизни?', icon: '🪞' },
              ].map((item) => (
                <Card key={item.level} className="text-center">
                  <CardHeader className="pb-2">
                    <div className="text-2xl mb-1">{item.icon}</div>
                    <CardTitle className="text-sm">{item.level}: {item.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground">{item.question}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <AuditForm />
          </div>
        ) : (
          /* Analysis Phase */
          <ResizablePanelGroup direction="horizontal" className="min-h-[calc(100vh-8rem)]">
            {/* Left Panel - Progress & Input Summary */}
            <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
              <div className="p-4 space-y-4 h-full overflow-auto">
                <AuditProgress />

                {/* Quick Stats */}
                <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Конфигурация</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Медиа:</span>
                        <Badge variant="outline">{mediaType}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Режим:</span>
                        <Badge variant="outline">{auditMode || 'определение...'}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Ввод:</span>
                        <span>{inputText.length} символов</span>
                      </div>
                    </CardContent>
                  </Card>

                {/* Cancel / Reset Buttons */}
                <div className="space-y-2">
                  {isLoading && (
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={cancelAudit}
                    >
                      Отменить аудит
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => reset()}
                    disabled={isLoading}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Новый аудит
                  </Button>
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Right Panel - Results */}
            <ResizablePanel defaultSize={75}>
              <div className="p-4 h-full overflow-auto">
                <Tabs defaultValue="report" className="h-full">
                  <TabsList className="mb-4 flex-wrap h-auto gap-1">
                    <TabsTrigger value="report" className="flex items-center gap-1">
                      <FileText className="h-4 w-4" />
                      Отчёт
                    </TabsTrigger>
                    <TabsTrigger value="gates" className="flex items-center gap-1">
                      <BarChart3 className="h-4 w-4" />
                      Гейты
                    </TabsTrigger>
                    <TabsTrigger value="issues" className="flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4" />
                      Проблемы
                      {issues.length > 0 && (
                        <Badge variant="destructive" className="ml-1 h-4 px-1 text-xs">
                          {issues.length}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="chains" className="flex items-center gap-1">
                      <Link2 className="h-4 w-4" />
                      Цепочки
                    </TabsTrigger>
                    <TabsTrigger value="generative" className="flex items-center gap-1">
                      <Sparkles className="h-4 w-4" />
                      Генерация
                    </TabsTrigger>
                    <TabsTrigger value="checklist" className="flex items-center gap-1">
                      <ListChecks className="h-4 w-4" />
                      Чеклист
                    </TabsTrigger>
                    <TabsTrigger value="grief" className="flex items-center gap-1">
                      <Heart className="h-4 w-4" />
                      Горе-матрица
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="report" className="h-full">
                    <ReportDisplay />
                  </TabsContent>

                  <TabsContent value="gates" className="h-full">
                    <GateResults />
                  </TabsContent>

                  <TabsContent value="issues" className="h-full">
                    <IssueList issues={issues} />
                  </TabsContent>

                  <TabsContent value="chains" className="h-full">
                    <WhatForChains chains={whatForChains} />
                  </TabsContent>

                  <TabsContent value="generative" className="h-full">
                    <GenerativeOutputDisplay output={generativeOutput} />
                  </TabsContent>

                  <TabsContent value="checklist" className="h-full">
                    <ChecklistDisplay />
                  </TabsContent>

                  <TabsContent value="grief" className="h-full">
                    <GriefArchitectureMatrix />
                  </TabsContent>
                </Tabs>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t py-4">
        <div className="container flex items-center justify-between text-sm text-muted-foreground">
          <p>
            Протокол Аудита Вселенной v10.0 — На основе протокола &quot;АУДИТ_ВСЕЛЕННОЙ_v10.0.md&quot;
          </p>
          <div className="flex items-center gap-4">
            <span>4 уровня • 52 критерия • Порог зависит от режима</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
