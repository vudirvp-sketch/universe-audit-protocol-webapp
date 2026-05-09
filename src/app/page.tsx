'use client';

import * as React from 'react';
import { useAuditStateV3 } from '@/hooks/useAuditStateV3';
import { AuditFormV2 } from '@/components/audit/AuditFormV2';
import { AuditProgressV3 } from '@/components/audit/AuditProgressV3';
import { AuditReportViewV3 } from '@/components/audit/AuditReportViewV3';
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
import { runAuditPipelineV3 } from '@/lib/audit/pipeline-v3';
import { exportV3ToMarkdown } from '@/lib/audit/export-utils';
import { extractOrientationContext } from '@/lib/audit/context-bridge';
import { SettingsDialog } from '@/components/audit/SettingsDialog';
import { useSettings, rehydrateSettings } from '@/hooks/useSettings';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { MediaType } from '@/lib/audit/types-v3';

export default function Home() {
  // =========================================================================
  // HYDRATION GUARD
  // =========================================================================
  const [isHydrated, setIsHydrated] = React.useState(false);

  React.useEffect(() => {
    useAuditStateV3.persist.rehydrate();
  }, []);

  React.useEffect(() => {
    rehydrateSettings();
  }, []);

  React.useEffect(() => {
    const unsubFinish = useAuditStateV3.persist.onFinishHydration(() => {
      setIsHydrated(true);
    });
    if (useAuditStateV3.persist.hasHydrated()) {
      setIsHydrated(true);
    }
    return unsubFinish;
  }, []);

  // =========================================================================
  // Store selectors
  // =========================================================================
  const phase = useAuditStateV3(s => s.phase);
  const currentBlock = useAuditStateV3(s => s.currentBlock);
  const block1 = useAuditStateV3(s => s.block1);
  const block2 = useAuditStateV3(s => s.block2);
  const block3 = useAuditStateV3(s => s.block3);
  const block4 = useAuditStateV3(s => s.block4);
  const block5 = useAuditStateV3(s => s.block5);
  const meta = useAuditStateV3(s => s.meta);
  const streamingText = useAuditStateV3(s => s.streamingText);
  const error = useAuditStateV3(s => s.error);
  const inputText = useAuditStateV3(s => s.inputText);
  const mediaType = useAuditStateV3(s => s.mediaType);
  const orientationContext = useAuditStateV3(s => s.orientationContext);

  const [theme, setTheme] = React.useState<'light' | 'dark'>('dark');
  const [abortController, setAbortController] = React.useState<AbortController | null>(null);
  const { provider, apiKey, model, proxyUrl, baseUrl } = useSettings();
  const [proxyUnavailable, setProxyUnavailable] = React.useState(false);

  // ── Health-check ────
  React.useEffect(() => {
    if (!proxyUrl) return;
    const checkHealth = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const base = proxyUrl.replace(/\/+$/, '');
        const response = await fetch(`${base}/health`, {
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
      useAuditStateV3.getState().setError('API-ключ не указан. Откройте Настройки и введите ключ.');
      return;
    }

    if (!currentProxyUrl) {
      useAuditStateV3.getState().setError('URL прокси не настроен. Откройте Настройки.');
      return;
    }

    const controller = new AbortController();
    setAbortController(controller);

    const store = useAuditStateV3.getState();
    store.startAudit();

    try {
      const result = await runAuditPipelineV3(
        {
          text: input.text,
          mediaType: input.mediaType,
        },
        {
          provider: currentProvider,
          apiKey: currentApiKey,
          model: currentModel || '',
          proxyUrl: currentProxyUrl,
          baseUrl: useSettings.getState().baseUrl || undefined,
        },
        {
          onBlockStart: (blockNum) => {
            useAuditStateV3.getState().clearStreamingText();
          },
          onChunk: (blockNum, text) => {
            useAuditStateV3.getState().appendStreamingText(text);
          },
          onBlockComplete: (blockNum, result) => {
            useAuditStateV3.getState().setBlockResult(blockNum, result);
            // Sync orientation context after Block 1 so the sidebar shows mode/profile immediately
            if (blockNum === 1) {
              const ctx = extractOrientationContext(result.markdown);
              useAuditStateV3.getState().setOrientationContext(ctx);
            }
          },
          onError: (message) => {
            useAuditStateV3.getState().setError(message);
          },
        },
        controller.signal,
      );

      if (result.error) {
        useAuditStateV3.getState().setError(result.error);
      } else if (result.meta) {
        useAuditStateV3.getState().setMeta(result.meta);
      }
    } catch (err) {
      if (controller.signal.aborted) {
        queueMicrotask(() => {
          useAuditStateV3.getState().reset();
        });
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
        queueMicrotask(() => {
          useAuditStateV3.getState().setError(errorMessage);
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

  // Download helper
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

  const blocks = [null, block1, block2, block3, block4, block5];

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
                <p className="text-xs text-muted-foreground">v3.0</p>
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
                onClick={() => useAuditStateV3.getState().reset()}
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
                  Пять блоков — полный отчёт.
                </p>
              </div>

              {/* Protocol Overview Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                  { level: 'L1', name: 'Механизм', question: 'Работает ли мир как система?', icon: '\u2699\uFE0F' },
                  { level: 'L2+L3', name: 'Тело + Психика', question: 'Есть ли телесность и последствия?', icon: '\uD83E\uDEC0' },
                  { level: 'L4', name: 'Мета', question: 'Задаёт ли вопрос реальной жизни?', icon: '\uD83E\uDE9E' },
                  { level: 'L5', name: 'Синтез', question: 'Что конкретно исправить?', icon: '\uD83D\uDD27' },
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
                  onClick={() => useAuditStateV3.getState().reset()}
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
                  <AuditProgressV3
                    currentBlock={currentBlock}
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
                      {orientationContext?.auditMode && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Режим:</span>
                          <span>{orientationContext.auditMode}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Right panel — progressive report */}
                <AuditReportViewV3
                  blocks={blocks}
                  meta={meta}
                  currentBlock={currentBlock}
                  streamingText={streamingText}
                  phase={phase}
                  onNewAudit={() => useAuditStateV3.getState().reset()}
                />
              </div>
            </div>
          ) : (
            /* ===== Done — Full Report Only ===== */
            <div className="max-w-5xl mx-auto">
              <AuditReportViewV3
                blocks={blocks}
                meta={meta}
                currentBlock={currentBlock}
                streamingText=""
                phase={phase}
                onExportMD={() => {
                  const md = exportV3ToMarkdown(blocks);
                  downloadFile(md, 'audit-report.md', 'text/markdown');
                }}
                onNewAudit={() => useAuditStateV3.getState().reset()}
              />
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t py-4">
          <div className="container flex items-center justify-between text-sm text-muted-foreground">
            <p>Universe Audit Protocol v3.0</p>
            <div className="flex items-center gap-4">
              <BookOpen className="h-4 w-4" />
              <span>5 блоков | 4 уровня</span>
            </div>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}
