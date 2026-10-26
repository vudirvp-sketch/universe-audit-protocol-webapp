'use client';

import * as React from 'react';
import { useAuditStateV3 } from '@/hooks/useAuditStateV3';
import { AuditFormV2 } from '@/components/audit/AuditFormV2';
import { AuditReportViewV3 } from '@/components/audit/AuditReportViewV3';
import { LeftRail } from '@/components/layout/LeftRail';
import { MobileProgressFAB } from '@/components/layout/MobileProgressFAB';
import { InspectorDrawer } from '@/components/layout/InspectorDrawer';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  RotateCcw,
  PanelRight,
  PanelLeft,
} from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { runAuditPipelineV3 } from '@/lib/audit/pipeline-v3';
import { exportV3ToMarkdown, exportAuditJSON, exportAuditHTML } from '@/lib/audit/export-utils';
import { extractOrientationContext } from '@/lib/audit/context-bridge';
import { SettingsDialog } from '@/components/audit/SettingsDialog';
import { useSettings, rehydrateSettings } from '@/hooks/useSettings';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { MediaType, PipelineStateV3 } from '@/lib/audit/types-v3';
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
    checklistScore: state.checklistScore,
    meta: state.meta!,
    error: state.error,
  };
}

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
  const checklistScore = useAuditStateV3(s => s.checklistScore);

  const [abortController, setAbortController] = React.useState<AbortController | null>(null);
  const { provider, apiKey, model, proxyUrl, baseUrl } = useSettings();
  const [proxyUnavailable, setProxyUnavailable] = React.useState(false);

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
          referenceComparison: useSettings.getState().referenceComparison,
        },
        {
          provider: currentProvider,
          apiKey: currentApiKey,
          model: currentModel || '',
          proxyUrl: currentProxyUrl,
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
        if (result.checklistScore) {
          useAuditStateV3.getState().setChecklistScore(result.checklistScore);
        }
      }
    } catch (err) {
      if (controller.signal.aborted) {
        useAuditStateV3.getState().reset();
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
    URL.revokeObjectURL(url);
  };

  // Export handlers (passed to InspectorDrawer)
  const exportHandlers = React.useMemo(() => ({
    onExportMD: () => {
      const md = exportV3ToMarkdown(blocks);
      downloadFile(md, 'audit-report.md', 'text/markdown');
    },
    onExportJSON: () => {
      const state = useAuditStateV3.getState();
      const pipelineState = buildPipelineState(state);
      const json = exportAuditJSON(pipelineState, state.checklistScore);
      downloadFile(json, 'audit-report.json', 'application/json');
    },
    onExportHTML: () => {
      const state = useAuditStateV3.getState();
      const pipelineState = buildPipelineState(state);
      const html = exportAuditHTML(pipelineState, state.checklistScore);
      downloadFile(html, 'audit-report.html', 'text/html');
    },
  }), [block1, block2, block3, block4, block5]);

  // =========================================================================
  // Hydration guard
  // =========================================================================
  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div role="status" className="flex flex-col items-center gap-3">
          <BrandMark size={32} />
          <p className="text-sm text-muted-foreground">Загрузка…</p>
        </div>
      </div>
    );
  }

  const blocks = [null, block1, block2, block3, block4, block5];
  const showRailButtons = phase === 'running' || phase === 'done';

  // =========================================================================
  // Render
  // =========================================================================
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground">
        {/* Proxy health-check banner */}
        {proxyUnavailable && (
          <div role="alert" className="bg-severity-warning text-severity-warning-foreground text-center py-2 px-4 text-sm font-medium">
            Прокси недоступен — проверьте интернет или настройки прокси
          </div>
        )}

        {/* Header / Topbar */}
        <header className="sticky top-0 z-50 border-b bg-background">
          <div className="flex h-14 items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-3">
              <BrandMark />
              <h1 className="text-base font-semibold leading-none">
                Протокол аудита вселенной
                <span className="ml-2 text-sm font-normal text-muted-foreground">{t.app.version}</span>
              </h1>
            </div>
            <div className="flex items-center gap-1">
              {showRailButtons && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label={t.tooltips.navigation}>
                      <PanelLeft className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t.tooltips.navigation}</TooltipContent>
                </Tooltip>
              )}

              {showRailButtons && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => setInspectorOpen(true)} aria-label={t.tooltips.inspector}>
                      <PanelRight className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t.tooltips.inspector}</TooltipContent>
                </Tooltip>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <SettingsDialog />
                  </span>
                </TooltipTrigger>
                <TooltipContent>{t.tooltips.settings}</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => useAuditStateV3.getState().reset()}
                    disabled={phase === 'running'}
                    aria-label={t.tooltips.newAudit}
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
          <main className="mx-auto w-full max-w-6xl px-4 py-10 md:px-6 md:py-14">
            <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-16">
              <div>
                <h2 className="max-w-[22ch] text-4xl font-semibold leading-[1.1] tracking-tight text-balance">
                  Аудит вымышленного мира
                </h2>
                <p className="mt-4 mb-10 max-w-[56ch] text-muted-foreground">
                  Вставьте описание концепта. Пять блоков проверят, работает ли мир как система,
                  как устроены персонажи и что исправлять в первую очередь.
                </p>
                <AuditFormV2 onSubmit={startAudit} isLoading={false} />
              </div>

              <aside aria-labelledby="levels-title" className="lg:pt-2">
                <h3 id="levels-title" className="text-base font-semibold">Что проверяется</h3>
                <dl className="mt-4 divide-y border-y">
                  {[
                    { level: 'L1', name: 'Механизм', question: 'Работает ли мир как система?', detail: '17 критериев живого мира' },
                    { level: 'L2, L3', name: 'Тело и психика', question: 'Есть ли телесность и последствия?', detail: '5 слоёв персонажа, архитектура горя' },
                    { level: 'L4', name: 'Мета', question: 'Задаёт ли мир вопрос о реальной жизни?', detail: 'Корнелианская дилемма, зеркало агента' },
                    { level: 'Блок 5', name: 'Синтез', question: 'Что конкретно исправить?', detail: 'Дерево решений, приоритеты, патчи' },
                  ].map((item) => (
                    <div key={item.level} className="grid grid-cols-[4.25rem_1fr] gap-x-3 py-3.5">
                      <dt className="text-sm font-semibold text-muted-foreground">{item.level}</dt>
                      <dd>
                        <p className="text-[0.9375rem] font-semibold leading-snug">{item.name}</p>
                        <p className="mt-0.5 text-sm leading-snug">{item.question}</p>
                        <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{item.detail}</p>
                      </dd>
                    </div>
                  ))}
                </dl>
              </aside>
            </div>
          </main>
        ) : phase === 'error' ? (
          /* ===== Error Screen ===== */
          <main className="mx-auto w-full max-w-2xl px-4 py-14 md:px-6">
            <div role="alert" className="border-l-2 border-severity-critical pl-5">
              <h2 className="text-2xl font-semibold">Аудит остановлен</h2>
              <p className="mt-2 max-w-[60ch] text-muted-foreground">
                {error || 'Произошла неизвестная ошибка'}
              </p>
              <p className="mt-2 max-w-[60ch] text-sm text-muted-foreground">
                Проверьте ключ и прокси в настройках и запустите аудит снова.
              </p>
              <Button className="mt-6" onClick={() => useAuditStateV3.getState().reset()}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Новый аудит
              </Button>
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
              blocks={blocks}
              phase={phase}
              orientationContext={orientationContext}
              collapsed={sidebarCollapsed}
              onToggleCollapse={toggleSidebar}
            />
            <main className="flex-1 min-w-0 py-6 px-4 md:px-8">
              <AuditReportViewV3
                blocks={blocks}
                meta={meta}
                currentBlock={currentBlock}
                streamingText={streamingText}
                phase={phase}
                checklistScore={checklistScore}
                mediaType={mediaType}
              />
            </main>
          </div>
        )}

        {/* Mobile FAB — only during running/done */}
        {(phase === 'running' || phase === 'done') && (
          <MobileProgressFAB
            currentBlock={currentBlock}
            blocks={blocks}
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
          blocks={blocks}
          checklistScore={checklistScore ?? null}
          mediaType={mediaType}
          currentBlock={currentBlock}
          streamingText={streamingText}
          onExportMD={exportHandlers.onExportMD}
          onExportJSON={exportHandlers.onExportJSON}
          onExportHTML={exportHandlers.onExportHTML}
        />

        {/* Footer */}
        <footer className={phase === 'running' || phase === 'done' ? 'border-t py-4 pb-24 md:pb-4' : 'border-t py-4'}>
          <div className="px-4 md:px-6 text-sm text-muted-foreground">
            <p>{t.app.footerStats}</p>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}
