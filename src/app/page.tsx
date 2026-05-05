'use client';

import * as React from 'react';
import { useAuditStateV2 } from '@/hooks/useAuditStateV2';
import { AuditFormV2 } from '@/components/audit/AuditFormV2';
import { AuditProgressV2 } from '@/components/audit/AuditProgressV2';
import { AuditReportView } from '@/components/audit/AuditReportView';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BookOpen,
  Moon,
  Sun,
  Sparkles,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import { runAuditPipelineV2 } from '@/lib/audit/pipeline-v2';
import { exportToMarkdown, exportToJSON } from '@/lib/audit/export-utils';
import { SettingsDialog } from '@/components/audit/SettingsDialog';
import { useSettings, rehydrateSettings } from '@/hooks/useSettings';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { MediaType, AuditReportV2 } from '@/lib/audit/types-v2';

export default function Home() {
  // =========================================================================
  // HYDRATION GUARD
  // Prevents React Error #185 (hydration mismatch) in static-export Next.js.
  // Same pattern as v10 — skipHydration + rehydrate in useEffect.
  // =========================================================================
  const [isHydrated, setIsHydrated] = React.useState(false);

  React.useEffect(() => {
    useAuditStateV2.persist.rehydrate();
  }, []);

  React.useEffect(() => {
    rehydrateSettings();
  }, []);

  React.useEffect(() => {
    const unsubFinish = useAuditStateV2.persist.onFinishHydration(() => {
      setIsHydrated(true);
    });
    if (useAuditStateV2.persist.hasHydrated()) {
      setIsHydrated(true);
    }
    return unsubFinish;
  }, []);

  // =========================================================================
  // Store selectors
  // =========================================================================
  const phase = useAuditStateV2(s => s.phase);
  const currentStep = useAuditStateV2(s => s.currentStep);
  const step1 = useAuditStateV2(s => s.step1);
  const step2 = useAuditStateV2(s => s.step2);
  const step3 = useAuditStateV2(s => s.step3);
  const meta = useAuditStateV2(s => s.meta);
  const streamingText = useAuditStateV2(s => s.streamingText);
  const error = useAuditStateV2(s => s.error);
  const inputText = useAuditStateV2(s => s.inputText);
  const mediaType = useAuditStateV2(s => s.mediaType);

  const [theme, setTheme] = React.useState<'light' | 'dark'>('dark');
  const [abortController, setAbortController] = React.useState<AbortController | null>(null);
  const { provider, apiKey, model, proxyUrl } = useSettings();
  const [proxyUnavailable, setProxyUnavailable] = React.useState(false);

  // ── Health-check: silent background request to proxy /health endpoint ────
  React.useEffect(() => {
    if (!proxyUrl) return;
    const checkHealth = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(`${proxyUrl}/health`, {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        setProxyUnavailable(!response.ok);
      } catch {
        setProxyUnavailable(true);
      }
    };
    checkHealth();
  }, [proxyUrl]);

  // Toggle theme
  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // =========================================================================
  // Audit pipeline runner
  // =========================================================================
  const startAudit = async (input: { text: string; mediaType: MediaType }) => {
    const currentApiKey = useSettings.getState().apiKey;
    const currentProxyUrl = useSettings.getState().proxyUrl;
    const currentModel = useSettings.getState().model || undefined;
    const currentProvider = useSettings.getState().provider;

    if (!currentApiKey) {
      useAuditStateV2.getState().setError('API-ключ не указан. Откройте Настройки и введите ключ.');
      return;
    }

    if (!currentProxyUrl) {
      useAuditStateV2.getState().setError('URL прокси не настроен. Откройте Настройки.');
      return;
    }

    // Create abort controller for cancellation support
    const controller = new AbortController();
    setAbortController(controller);

    // Initialise pipeline state
    const store = useAuditStateV2.getState();
    store.startAudit();

    try {
      const result = await runAuditPipelineV2(
        {
          text: input.text,
          mediaType: input.mediaType,
        },
        {
          provider: currentProvider,
          apiKey: currentApiKey,
          model: currentModel || '',
          proxyUrl: currentProxyUrl,
        },
        {
          onStepStart: (step) => {
            // Step is starting — clear streaming text for new step
            useAuditStateV2.getState().clearStreamingText();
          },
          onChunk: (step, text) => {
            // Accumulate streaming text in store for live UI
            useAuditStateV2.getState().appendStreamingText(text);
          },
          onStepComplete: (step, result) => {
            // Store the parsed result for this step
            useAuditStateV2.getState().setStepResult(step, result);
          },
          onError: (message) => {
            useAuditStateV2.getState().setError(message);
          },
        },
        controller.signal,
      );

      // Handle final state
      if (result.error) {
        useAuditStateV2.getState().setError(result.error);
      } else if (result.meta) {
        // Store pipeline meta (tokens, timings, etc.) so UI and export can use it
        useAuditStateV2.getState().setMeta(result.meta);
      }
    } catch (err) {
      if (controller.signal.aborted) {
        // User cancelled — reset to idle
        queueMicrotask(() => {
          useAuditStateV2.getState().reset();
        });
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
        queueMicrotask(() => {
          useAuditStateV2.getState().setError(errorMessage);
        });
      }
    } finally {
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

  // Download helper for export
  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // =========================================================================
  // Hydration guard
  // =========================================================================
  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <Sparkles className="h-8 w-8 text-amber-500 mx-auto animate-pulse" />
          <p className="text-sm text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Render
  // =========================================================================
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground">
        {/* Proxy health-check banner */}
        {proxyUnavailable && (
          <div className="bg-amber-600/90 text-white text-center py-2 px-4 text-sm font-medium">
            Прокси недоступен — проверьте интернет или настройки прокси
          </div>
        )}

        {/* Header */}
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-amber-500" />
              <div>
                <h1 className="text-xl font-bold">Universe Audit Protocol</h1>
                <p className="text-xs text-muted-foreground">v11.0</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
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
                onClick={() => useAuditStateV2.getState().reset()}
                disabled={phase === 'running'}
              >
                <RotateCcw className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container py-6">
          {phase === 'idle' ? (
            /* ===== Input Form ===== */
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-2">Universe Audit Protocol</h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Анализ вымышленных миров: от скелета концепта до рекомендаций. 
                  Один запуск — полный отчёт.
                </p>
              </div>

              {/* Protocol Overview Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                  { level: 'L1', name: 'Механизм', question: 'Работает ли мир как система?', icon: '\u2699\uFE0F' },
                  { level: 'L2', name: 'Тело', question: 'Есть ли телесность и последствия?', icon: '\uD83E\uDEC0' },
                  { level: 'L3', name: 'Психика', question: 'Работает ли мир как симптом?', icon: '\uD83E\uDDE0' },
                  { level: 'L4', name: 'Мета', question: 'Задаёт ли вопрос реальной жизни?', icon: '\uD83E\uDE9E' },
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

              <AuditFormV2
                onSubmit={startAudit}
                isLoading={false}
              />
            </div>
          ) : phase === 'error' ? (
            /* ===== Error Screen ===== */
            <div className="max-w-2xl mx-auto text-center space-y-6 py-12">
              <AlertTriangle className="h-16 w-16 text-destructive mx-auto" />
              <h2 className="text-2xl font-bold">Ошибка аудита</h2>
              <p className="text-muted-foreground">
                {error || 'Произошла неизвестная ошибка'}
              </p>
              <div className="flex justify-center gap-4">
                <Button
                  variant="default"
                  onClick={() => useAuditStateV2.getState().reset()}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Новый аудит
                </Button>
                <Button variant="outline" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                  {theme === 'dark' ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                  Сменить тему
                </Button>
              </div>
            </div>
          ) : phase === 'running' ? (
            /* ===== Running — Progress + Progressive Report ===== */
            <div className="max-w-5xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6">
                {/* Left sidebar — progress + controls */}
                <div className="space-y-4">
                  <AuditProgressV2
                    currentStep={currentStep}
                    streamingText={streamingText}
                    onCancel={cancelAudit}
                  />

                  {/* Quick info card */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Конфигурация</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Медиа:</span>
                        <span>{mediaType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Символов:</span>
                        <span>{inputText.length}</span>
                      </div>
                      {step1?.auditMode && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Режим:</span>
                          <span>{step1.auditMode}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Right panel — progressive report */}
                <AuditReportView
                  step1={step1}
                  step2={step2}
                  step3={step3}
                  meta={meta}
                  streamingText={streamingText}
                  isStreaming={phase === 'running'}
                  onNewAudit={() => useAuditStateV2.getState().reset()}
                  onExportMD={() => {
                    if (!step1 || !step2 || !step3 || !meta) return;
                    const report: AuditReportV2 = { step1, step2, step3, meta };
                    const md = exportToMarkdown(report);
                    downloadFile(md, 'audit-report.md', 'text/markdown');
                  }}
                  onExportJSON={() => {
                    if (!step1 || !step2 || !step3 || !meta) return;
                    const report: AuditReportV2 = { step1, step2, step3, meta };
                    const json = exportToJSON(report, meta);
                    downloadFile(json, 'audit-report.json', 'application/json');
                  }}
                  onCopy={() => {
                    if (!step1 || !step2 || !step3 || !meta) return;
                    const report: AuditReportV2 = { step1, step2, step3, meta };
                    const md = exportToMarkdown(report);
                    navigator.clipboard.writeText(md).catch(() => {
                      // Fallback for environments where clipboard API is not available
                    });
                  }}
                />
              </div>
            </div>
          ) : (
            /* ===== Done — Full Report Only ===== */
            <div className="max-w-5xl mx-auto">
              <AuditReportView
                step1={step1}
                step2={step2}
                step3={step3}
                meta={meta}
                streamingText=""
                isStreaming={false}
                onNewAudit={() => useAuditStateV2.getState().reset()}
                onExportMD={() => {
                  if (!step1 || !step2 || !step3 || !meta) return;
                  const report: AuditReportV2 = { step1, step2, step3, meta };
                  const md = exportToMarkdown(report);
                  downloadFile(md, 'audit-report.md', 'text/markdown');
                }}
                onExportJSON={() => {
                  if (!step1 || !step2 || !step3 || !meta) return;
                  const report: AuditReportV2 = { step1, step2, step3, meta };
                  const json = exportToJSON(report, meta);
                  downloadFile(json, 'audit-report.json', 'application/json');
                }}
                onCopy={() => {
                  if (!step1 || !step2 || !step3 || !meta) return;
                  const report: AuditReportV2 = { step1, step2, step3, meta };
                  const md = exportToMarkdown(report);
                  navigator.clipboard.writeText(md).catch(() => {
                    // Fallback for environments where clipboard API is not available
                  });
                }}
              />
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t py-4">
          <div className="container flex items-center justify-between text-sm text-muted-foreground">
            <p>Universe Audit Protocol v11.0</p>
            <div className="flex items-center gap-4">
              <BookOpen className="h-4 w-4" />
              <span>52 критерия | 3 запроса | 4 уровня</span>
            </div>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}
