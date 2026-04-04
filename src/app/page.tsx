'use client';

import * as React from 'react';
import { useAuditState } from '@/hooks/useAuditState';
import { AuditForm } from '@/components/audit/AuditForm';
import { AuditProgress } from '@/components/audit/AuditProgress';
import { ChecklistDisplay } from '@/components/audit/ChecklistDisplay';
import { GriefArchitectureMatrix } from '@/components/audit/GriefArchitectureMatrix';
import { GateResults } from '@/components/audit/GateResult';
import { ReportDisplay } from '@/components/audit/ReportDisplay';
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
} from 'lucide-react';
import type { MediaType, AuthorProfileAnswers } from '@/lib/audit/types';
import { SettingsDialog } from '@/components/audit/SettingsDialog';
import { useSettings } from '@/hooks/useSettings';

export default function Home() {
  const {
    phase,
    inputText,
    mediaType,
    auditMode,
    authorAnswers,
    isLoading,
    error,
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
    reset,
  } = useAuditState();

  const [theme, setTheme] = React.useState<'light' | 'dark'>('dark');
  const { apiKey, loadApiKey, isLoaded } = useSettings();

  // Load API key on mount
  React.useEffect(() => {
    if (!isLoaded) {
      loadApiKey();
    }
  }, [isLoaded, loadApiKey]);

  // Toggle theme
  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Run full audit analysis
  const runFullAudit = async () => {
    if (!inputText.trim()) return;

    setLoading(true);
    setError(null);
    setPhase('skeleton_extraction');

    try {
      const response = await fetch('/api/audit/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          narrative: inputText,
          mediaType,
          authorAnswers,
          apiKey,
        } as {
          narrative: string;
          mediaType: MediaType;
          authorAnswers?: AuthorProfileAnswers;
          apiKey?: string | null;
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Audit failed');
      }

      // Update state with results
      if (data.auditMode) {
        // setAuditMode(data.auditMode); // Already set
      }
      if (data.authorProfile) {
        setAuthorProfile(data.authorProfile);
      }
      if (data.skeleton) {
        setSkeleton(data.skeleton);
      }
      if (data.screeningResult) {
        setScreeningResult(data.screeningResult);
      }
      if (data.gateResults) {
        if (data.gateResults.L1) setGateResult('L1', data.gateResults.L1);
        if (data.gateResults.L2) setGateResult('L2', data.gateResults.L2);
        if (data.gateResults.L3) setGateResult('L3', data.gateResults.L3);
        if (data.gateResults.L4) setGateResult('L4', data.gateResults.L4);
      }
      if (data.checklist) {
        setChecklist(data.checklist);
      }
      if (data.griefMatrix) {
        setGriefMatrix(data.griefMatrix);
      }
      if (data.report) {
        setReport(data.report);
      }

      // Set phase based on results
      if (data.error) {
        setPhase('failed');
        setError(data.error);
      } else {
        setPhase('complete');
      }

    } catch (err) {
      console.error('Audit error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setPhase('failed');
    } finally {
      setLoading(false);
    }
  };

  // Auto-start audit when phase changes to mode_selection
  React.useEffect(() => {
    if (phase === 'mode_selection' && inputText.trim()) {
      runFullAudit();
    }
  }, [phase]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-amber-500" />
            <div>
              <h1 className="text-xl font-bold">Universe Audit Protocol</h1>
              <p className="text-xs text-muted-foreground">v10.0</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden sm:flex">
              <BookOpen className="h-3 w-3 mr-1" />
              52 Items
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
              <h2 className="text-3xl font-bold mb-2">Audit Your Universe</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                The Universe Audit Protocol evaluates fictional worlds through 4 hierarchical levels:
                Mechanism, Body, Psyche, and Meta. Each level requires ≥60% score to proceed.
              </p>
            </div>

            {/* Protocol Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { level: 'L1', name: 'Mechanism', question: 'Does the world work as a system?', icon: '⚙️' },
                { level: 'L2', name: 'Body', question: 'Is there embodiment?', icon: '🫀' },
                { level: 'L3', name: 'Psyche', question: 'Does it work as a symptom?', icon: '🧠' },
                { level: 'L4', name: 'Meta', question: 'Does it ask about real life?', icon: '🪞' },
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
                {phase !== 'idle' && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Configuration</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Media:</span>
                        <Badge variant="outline">{mediaType}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Mode:</span>
                        <Badge variant="outline">{auditMode || 'detecting'}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Input:</span>
                        <span>{inputText.length} chars</span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Skeleton Quick View */}
                {phase !== 'idle' && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => reset()}
                    disabled={isLoading}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Start New Audit
                  </Button>
                )}
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Right Panel - Results */}
            <ResizablePanel defaultSize={75}>
              <div className="p-4 h-full overflow-auto">
                <Tabs defaultValue="report" className="h-full">
                  <TabsList className="mb-4">
                    <TabsTrigger value="report" className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Report
                    </TabsTrigger>
                    <TabsTrigger value="gates" className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Gates
                    </TabsTrigger>
                    <TabsTrigger value="checklist" className="flex items-center gap-2">
                      <ListChecks className="h-4 w-4" />
                      Checklist
                    </TabsTrigger>
                    <TabsTrigger value="grief" className="flex items-center gap-2">
                      <Heart className="h-4 w-4" />
                      Grief Matrix
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="report" className="h-full">
                    <ReportDisplay />
                  </TabsContent>

                  <TabsContent value="gates" className="h-full">
                    <GateResults />
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
            Universe Audit Protocol v10.0 — Based on the Russian protocol &quot;АУДИТ_ВСЕЛЕННОЙ_v10.0.md&quot;
          </p>
          <div className="flex items-center gap-4">
            <span>4 Levels • 52 Items • 60% Gate Threshold</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
