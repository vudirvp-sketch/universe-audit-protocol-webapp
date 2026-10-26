'use client';

import * as React from 'react';
import { useAuditStateV3 } from '@/hooks/useAuditStateV3';
import { AuditFormV2 } from '@/components/audit/AuditFormV2';
import type { AuditFormSubmitInput } from '@/components/audit/AuditFormV2';
import { AuditReportViewV3 } from '@/components/audit/AuditReportViewV3';
import { LeftRail } from '@/components/layout/LeftRail';
import { MobileProgressFAB } from '@/components/layout/MobileProgressFAB';
import { InspectorDrawer } from '@/components/layout/InspectorDrawer';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  BookOpen,
  Clock,
  Globe,
  Moon,
  Network,
  Sun,
  Sparkles,
  RotateCcw,
  AlertTriangle,
  PanelRight,
  Sidebar,
  Users,
} from 'lucide-react';
import { runAuditPipelineV3 } from '@/lib/audit/pipeline-v3';
import { exportV3ToMarkdown, exportAuditJSON, exportAuditHTML } from '@/lib/audit/export-utils';
import { extractOrientationContext } from '@/lib/audit/context-bridge';
import { SettingsDialog } from '@/components/audit/SettingsDialog';
import { useSettings, rehydrateSettings } from '@/hooks/useSettings';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { PipelineStateV3 } from '@/lib/audit/types-v3';
import type { AuditStateV3 } from '@/hooks/useAuditStateV3';
import { t } from '@/lib/i18n/ru';

// ============================================================
// Helper: build PipelineStateV3 from AuditStateV3
// ============================================================

function buildPipelineState(state: AuditStateV3): PipelineStateV3 {
  return {
    phase: state.phase,
    currentBlock: state.currentBlock,
    block1: state.block1,
    block2: state.block2,
    block3: state.block3,
    block4: state.block4,
    block5: state.block5,
    orientationContext: state.orientationContext,
    accumulatedWeaknesses: [],
    verdict: state.verdict,
    // `meta` only exists once the pipeline finished, but the Inspector allows
    // exporting mid-run; fall back to what is known so JSON keeps the input text.
    meta: state.meta ?? {
      inputText: state.inputText,
      mediaType: state.mediaType,
      elapsedMs: 0,
      tokensUsed: { prompt: 0, completion: 0, total: 0 },
    },
    error: state.error,
  };
}

// ============================================================
// Five coupled audit dimensions — v16 §3
// ============================================================

const DIMENSION_ICONS = {
  world: Globe,
  systemic: Network,
  human: Users,
  experience: BookOpen,
  memory: Clock,
} as const;

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
  const currentBlockTotalChunks = useAuditStateV3(s => s.currentBlockTotalChunks);
  const currentChunkIndex = useAuditStateV3(s => s.currentChunkIndex);
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
  const verdict = useAuditStateV3(s => s.verdict);
  const storageError = useAuditStateV3(s => s.storageError);

  const [theme, setTheme] = React.useState<'light' | 'dark'>('dark');
  const [abortController, setAbortController] = React.useState<AbortController | null>(null);
  const transport = useSettings((s) => s.transport);
  const relayUrl = useSettings((s) => s.relayUrl);
  const [relayUnavailable, setRelayUnavailable] = React.useState(false);

  // New state: inspector drawer + sidebar collapse
  const [inspectorOpen, setInspectorOpen] = React.useState(false);
  const sidebarCollapsed = useSettings(s => s.sidebarCollapsed);
  const setSidebarCollapsed = useSettings(s => s.setSidebarCollapsed);

  const toggleSidebar = React.useCallback(() => {
    setSidebarCollapsed(!sidebarCollapsed);
  }, [sidebarCollapsed, setSidebarCollapsed]);

  const closeInspector = React.useCallback(() => {
    setInspectorOpen(false);
  }, []);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    phase,
    toggleSidebar,
    closeInspector,
  });

  // ── Local relay health-check (only when the relay transport is selected) ──
  React.useEffect(() => {
    if (transport !== 'relay' || !relayUrl) {
      setRelayUnavailable(false);
      return;
    }
    const checkHealth = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const base = relayUrl.replace(/\/+$/, '');
        const response = await fetch(`${base}/api/health`, {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        setRelayUnavailable(!response.ok);
      } catch {
        setRelayUnavailable(true);
      }
    };
    checkHealth();
  }, [transport, relayUrl]);

  // Toggle theme
  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // =========================================================================
  // Audit pipeline runner
  // =========================================================================
  const startAudit = async (input: AuditFormSubmitInput) => {
    const currentApiKey = useSettings.getState().apiKey;
    const currentTransport = useSettings.getState().transport;
    const currentRelayUrl = useSettings.getState().relayUrl;
    const currentModel = useSettings.getState().model || undefined;
    const currentProvider = useSettings.getState().provider;

    // In relay mode the key may live in the relay's env (LLM_API_KEY): send a
    // placeholder and let the relay substitute it. Direct mode needs a real key.
    const effectiveKey = currentApiKey || (currentTransport === 'relay' ? 'env' : '');

    if (!effectiveKey) {
      useAuditStateV3.getState().setError('API-ключ не указан. Откройте Настройки и введите ключ.');
      return;
    }

    if (currentTransport === 'relay' && !currentRelayUrl) {
      useAuditStateV3.getState().setError('URL локального релея не задан. Откройте Настройки.');
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
          referenceComparison: useSettings.getState().referenceComparison,
          guided: input.guided,
          materials: input.materials,
        },
        {
          provider: currentProvider,
          apiKey: effectiveKey,
          model: currentModel || '',
          transport: currentTransport,
          relayUrl: currentRelayUrl,
          baseUrl: useSettings.getState().baseUrl || undefined,
          customContextWindow: useSettings.getState().customContextWindow || undefined,
          customMaxOutputTokens: useSettings.getState().customMaxOutputTokens || undefined,
          customSupportsJSONMode: useSettings.getState().customSupportsJSONMode,
          rpmLimit: useSettings.getState().rpmLimit || undefined,
        },
        {
          onBlockStart: (blockNum, totalChunks, chunkIndex) => {
            useAuditStateV3.getState().clearStreamingText();
            if (totalChunks !== undefined && chunkIndex !== undefined) {
              useAuditStateV3.getState().setChunkProgress(totalChunks, chunkIndex);
            }
          },
          onChunk: (blockNum, text) => {
            useAuditStateV3.getState().appendStreamingText(text);
          },
          onBlockComplete: (blockNum, result) => {
            useAuditStateV3.getState().setBlockResult(blockNum, result);
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
      } else {
        if (result.meta) {
          useAuditStateV3.getState().setMeta(result.meta);
        }
        if (result.orientationContext) {
          useAuditStateV3.getState().setOrientationContext(result.orientationContext);
        }
        // Qualitative verdict (v16 §26.S) — null when extraction failed
        useAuditStateV3.getState().setVerdict(result.verdict);
      }
    } catch (err) {
      if (controller.signal.aborted) {
        // Cancel drops the run, not the author's draft (input, framing, artefacts).
        useAuditStateV3.getState().abortAudit();
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
        useAuditStateV3.getState().setError(errorMessage);
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
    // Revoking in the same tick can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const blocks = [null, block1, block2, block3, block4, block5] as const;

  // Export handlers (passed to InspectorDrawer)
  const exportHandlers = React.useMemo(() => {
    const currentState = () => buildPipelineState(useAuditStateV3.getState());
    const currentExtras = () => {
      const state = useAuditStateV3.getState();
      return { guided: state.guided, materials: state.materials };
    };
    return {
      onExportMD: () => {
        const md = exportV3ToMarkdown(currentState(), currentExtras());
        downloadFile(md, 'audit-report.md', 'text/markdown');
      },
      onExportJSON: () => {
        const json = exportAuditJSON(currentState(), currentExtras());
        downloadFile(json, 'audit-report.json', 'application/json');
      },
      onExportHTML: () => {
        const html = exportAuditHTML(currentState(), currentExtras());
        downloadFile(html, 'audit-report.html', 'text/html');
      },
    };
  }, []);

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

  const showRailButtons = phase === 'running' || phase === 'done';

  // =========================================================================
  // Render
  // =========================================================================
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground">
        {/* Local relay health-check banner (relay transport only) */}
        {relayUnavailable && (
          <div className="bg-severity-warning/90 text-white text-center py-2 px-4 text-sm font-medium">
            {t.settings.proxyHealthCheckBanner}
          </div>
        )}

        {/* Persistence failure banner — the draft on screen is no longer saved */}
        {storageError && (
          <div role="alert" className="bg-severity-critical/90 text-white text-center py-2 px-4 text-sm font-medium">
            {storageError}
          </div>
        )}

        {/* Header / Topbar */}
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-amber-500" />
              <div>
                <h1 className="text-xl font-bold">Universe Audit Protocol</h1>
                <p className="text-sm text-muted-foreground">{t.app.version}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Rail toggle — only during running/done */}
              {showRailButtons && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={toggleSidebar}
                    >
                      <Sidebar className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t.tooltips.navigation}</TooltipContent>
                </Tooltip>
              )}

              {/* Inspector button — only during running/done */}
              {showRailButtons && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setInspectorOpen(true)}
                    >
                      <PanelRight className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t.tooltips.inspector}</TooltipContent>
                </Tooltip>
              )}

              {/* Theme toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
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
                </TooltipTrigger>
                <TooltipContent>{t.tooltips.changeTheme}</TooltipContent>
              </Tooltip>

              {/* Settings */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <SettingsDialog />
                  </span>
                </TooltipTrigger>
                <TooltipContent>{t.tooltips.settings}</TooltipContent>
              </Tooltip>

              {/* New Audit / Reset */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => useAuditStateV3.getState().reset()}
                    disabled={phase === 'running'}
                  >
                    <RotateCcw className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t.tooltips.newAudit}</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </header>

        {/* Main Content */}
        {phase === 'idle' ? (
          /* ===== Input Form (idle state) ===== */
          <main className="container py-6">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-2">Universe Audit Protocol</h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Аудит вымышленных миров: от скелета концепта до качественного
                  вердикта. Пять блоков — полный отчёт без числовых оценок.
                </p>
              </div>

              {/* Five coupled audit dimensions — v16 §3 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                {(Object.keys(t.levels) as (keyof typeof t.levels)[]).map((key) => {
                  const dimension = t.levels[key];
                  const Icon = DIMENSION_ICONS[key];
                  return (
                    <div
                      key={key}
                      className="p-4 rounded-lg border bg-card hover:border-amber-500/30 transition-colors"
                    >
                      <Icon className="h-5 w-5 text-amber-500 mb-2" />
                      <div className="text-sm font-semibold mb-1">{dimension.name}</div>
                      <p className="text-xs text-muted-foreground mb-1">{dimension.question}</p>
                      <p className="text-xs text-muted-foreground/70">{dimension.focus}</p>
                    </div>
                  );
                })}
              </div>

              <AuditFormV2
                onSubmit={startAudit}
                isLoading={false}
              />
            </div>
          </main>
        ) : phase === 'error' ? (
          /* ===== Error Screen ===== */
          <main className="container py-6">
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
          </main>
        ) : (
          /* ===== Running / Done — Three-Panel Layout ===== */
          <div className="flex min-h-[calc(100vh-3.5rem)]">
            <LeftRail
              currentBlock={currentBlock}
              onCancel={cancelAudit}
              currentBlockTotalChunks={currentBlockTotalChunks || undefined}
              currentChunkIndex={currentChunkIndex || undefined}
              blocks={[...blocks]}
              phase={phase}
              orientationContext={orientationContext}
              collapsed={sidebarCollapsed}
              onToggleCollapse={toggleSidebar}
            />
            <main className="flex-1 min-w-0 py-6 px-4 md:px-8">
              <AuditReportViewV3
                blocks={[...blocks]}
                meta={meta}
                currentBlock={currentBlock}
                streamingText={streamingText}
                phase={phase}
                verdict={verdict}
                orientationContext={orientationContext}
              />
            </main>
          </div>
        )}

        {/* Mobile FAB — only during running/done */}
        {(phase === 'running' || phase === 'done') && (
          <MobileProgressFAB
            currentBlock={currentBlock}
            blocks={[...blocks]}
            phase={phase}
            onCancel={cancelAudit}
            currentBlockTotalChunks={currentBlockTotalChunks || undefined}
            currentChunkIndex={currentChunkIndex || undefined}
            orientationContext={orientationContext}
          />
        )}

        {/* Inspector Drawer */}
        <InspectorDrawer
          open={inspectorOpen}
          onOpenChange={setInspectorOpen}
          meta={meta}
          blocks={[...blocks]}
          verdict={verdict}
          orientationContext={orientationContext}
          mediaType={mediaType}
          currentBlock={currentBlock}
          streamingText={streamingText}
          onExportMD={exportHandlers.onExportMD}
          onExportJSON={exportHandlers.onExportJSON}
          onExportHTML={exportHandlers.onExportHTML}
        />

        {/* Footer */}
        <footer className="border-t py-4">
          <div className="container flex items-center justify-between text-sm text-muted-foreground">
            <p>{`Universe Audit Protocol ${t.app.version}`}</p>
            <div className="flex items-center gap-4">
              <BookOpen className="h-4 w-4" />
              <span>{t.app.footerStats}</span>
            </div>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}
