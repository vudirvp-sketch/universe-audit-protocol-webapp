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
  RotateCcw,
  PanelRight,
  PanelLeft,
} from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { runAuditPipelineV3 } from '@/lib/audit/pipeline-v3';
import { exportV3ToMarkdown, exportAuditJSON, exportAuditHTML } from '@/lib/audit/export-utils';
import { extractOrientationContext } from '@/lib/audit/context-bridge';
import { SettingsDialog } from '@/components/audit/SettingsDialog';
import { PipelineStatusLine } from '@/components/audit/PipelineLog';
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

const DIMENSION_KEYS = ['world', 'systemic', 'human', 'experience', 'memory'] as const;

/** Store update interval for streamed text (≈16 renders/s). */
const STREAM_FLUSH_INTERVAL_MS = 60;

/** Mirrors the separator the pipeline uses when it joins sub-request results. */
const CHUNK_SEPARATOR = '\n\n---\n\n';

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
  const pipelineLog = useAuditStateV3(s => s.log);
  const pipelineStartedAt = useAuditStateV3(s => s.pipelineStartedAt);

  const [abortController, setAbortController] = React.useState<AbortController | null>(null);

  // =========================================================================
  // STREAM BUFFER
  // =========================================================================
  // SSE deltas arrive every few milliseconds. Writing each one straight into
  // the store re-parses the whole markdown block dozens of times per second,
  // which makes the growing text jitter and burns main-thread time. The buffer
  // coalesces deltas into ~16 store updates per second: still visibly live,
  // but cheap enough to keep the scroll smooth.
  const streamBufferRef = React.useRef('');
  const streamFlushTimerRef = React.useRef<number | null>(null);

  const flushStreamingText = React.useCallback(() => {
    if (streamFlushTimerRef.current !== null) {
      window.clearTimeout(streamFlushTimerRef.current);
      streamFlushTimerRef.current = null;
    }
    const buffered = streamBufferRef.current;
    streamBufferRef.current = '';
    if (buffered) useAuditStateV3.getState().appendStreamingText(buffered);
  }, []);

  const queueStreamingText = React.useCallback(
    (text: string) => {
      if (!text) return;
      streamBufferRef.current += text;
      if (streamFlushTimerRef.current !== null) return;
      streamFlushTimerRef.current = window.setTimeout(() => {
        streamFlushTimerRef.current = null;
        flushStreamingText();
      }, STREAM_FLUSH_INTERVAL_MS);
    },
    [flushStreamingText],
  );

  const dropStreamBuffer = React.useCallback(() => {
    if (streamFlushTimerRef.current !== null) {
      window.clearTimeout(streamFlushTimerRef.current);
      streamFlushTimerRef.current = null;
    }
    streamBufferRef.current = '';
  }, []);

  React.useEffect(() => dropStreamBuffer, [dropStreamBuffer]);

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
    dropStreamBuffer();

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
            // Everything received so far belongs to the block that is ending.
            flushStreamingText();
            const store = useAuditStateV3.getState();
            if (!chunkIndex) {
              store.clearStreamingText();
            } else {
              // A later chunk continues the same section: the text already on
              // screen must stay. The pipeline joins chunks with the same
              // separator, so the live view and the final result agree.
              store.appendStreamingText(CHUNK_SEPARATOR);
            }
            if (totalChunks !== undefined && chunkIndex !== undefined) {
              store.setChunkProgress(totalChunks, chunkIndex);
            }
          },
          onChunk: (blockNum, text) => {
            queueStreamingText(text);
          },
          onBlockComplete: (blockNum, result) => {
            flushStreamingText();
            useAuditStateV3.getState().setBlockResult(blockNum, result);
            if (blockNum === 1) {
              const ctx = extractOrientationContext(result.markdown);
              useAuditStateV3.getState().setOrientationContext(ctx);
            }
          },
          onError: (message) => {
            dropStreamBuffer();
            useAuditStateV3.getState().setError(message);
          },
          onLog: (entry) => {
            useAuditStateV3.getState().appendLog(entry);
          },
        },
        controller.signal,
      );

      // Cancel wins over everything the pipeline returned: the run was stopped
      // on purpose, so the UI must leave the running state instead of waiting
      // for a result the user already abandoned.
      if (controller.signal.aborted) {
        useAuditStateV3.getState().abortAudit();
        return;
      }

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
      // A cancelled run already dropped its text; flushing would resurrect a
      // fragment the user chose to abandon.
      if (controller.signal.aborted) dropStreamBuffer();
      else flushStreamingText();
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
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div role="status" className="flex flex-col items-center gap-3">
          <BrandMark size={32} />
          <p className="text-sm text-muted-foreground">Загрузка…</p>
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
          <div role="alert" className="bg-severity-warning px-4 py-2 text-center text-sm font-medium text-severity-warning-foreground">
            {t.settings.proxyHealthCheckBanner}
          </div>
        )}

        {/* Persistence failure banner — the draft on screen is no longer saved */}
        {storageError && (
          <div role="alert" className="bg-severity-critical px-4 py-2 text-center text-sm font-medium text-severity-critical-foreground">
            {storageError}
          </div>
        )}

        {/* Header / Topbar */}
        <header className="sticky top-0 z-50 border-b bg-background">
          <div className="flex h-14 items-center justify-between px-4 md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <BrandMark />
              <h1 className="truncate text-base font-semibold leading-none">
                {t.app.title}
                <span className="ml-2 text-sm font-normal text-muted-foreground">{t.app.version}</span>
              </h1>
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
                      aria-label={t.tooltips.navigation}
                    >
                      <PanelLeft className="h-5 w-5" />
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
                      aria-label={t.tooltips.inspector}
                    >
                      <PanelRight className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t.tooltips.inspector}</TooltipContent>
                </Tooltip>
              )}

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
                  Вставьте описание концепта. Пять блоков проверят, что в мире истинно,
                  какие у этого последствия и что исправлять в первую очередь.
                </p>
                <AuditFormV2
                  onSubmit={startAudit}
                  isLoading={false}
                />
              </div>

              {/* Five coupled audit dimensions — v16 §3 */}
              <aside aria-labelledby="dimensions-title" className="lg:pt-2">
                <h3 id="dimensions-title" className="text-base font-semibold">Что проверяется</h3>
                <dl className="mt-4 divide-y border-y">
                  {DIMENSION_KEYS.map((key) => {
                    const dimension = t.levels[key];
                    return (
                      <div key={key} className="grid grid-cols-[2.25rem_1fr] gap-x-3 py-3.5">
                        <dt className="text-sm font-semibold tabular-nums text-muted-foreground">
                          {DIMENSION_KEYS.indexOf(key) + 1}
                        </dt>
                        <dd>
                          <p className="text-[0.9375rem] font-semibold leading-snug">{dimension.name}</p>
                          <p className="mt-0.5 text-sm leading-snug">{dimension.question}</p>
                          <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{dimension.focus}</p>
                        </dd>
                      </div>
                    );
                  })}
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
                Проверьте ключ, транспорт и модель в настройках и запустите аудит снова.
              </p>
              {/* Два выхода: вернуться к черновику (без потерь) или начать с нуля */}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button onClick={() => useAuditStateV3.getState().abortAudit()}>
                  {t.app.backToDraft}
                </Button>
                <Button variant="outline" onClick={() => useAuditStateV3.getState().reset()}>
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  {t.app.newAudit}
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
            <main className="min-w-0 flex-1">
              {/* Одна читаемая колонка по центру: до этого отчёт прижимался
                  к рейлу, а справа оставалась пустая половина экрана. */}
              <div className="mx-auto w-full max-w-[54rem] px-4 py-6 md:px-6 md:py-10">
                <PipelineStatusLine
                  entries={pipelineLog}
                  startedAt={pipelineStartedAt}
                  phase={phase}
                />
                <AuditReportViewV3
                  blocks={[...blocks]}
                  meta={meta}
                  currentBlock={currentBlock}
                  streamingText={streamingText}
                  phase={phase}
                  verdict={verdict}
                  orientationContext={orientationContext}
                />
              </div>
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
          log={pipelineLog}
          onExportMD={exportHandlers.onExportMD}
          onExportJSON={exportHandlers.onExportJSON}
          onExportHTML={exportHandlers.onExportHTML}
        />

        {/* Footer — на мобильном оставляет место плавающей кнопке прогресса */}
        <footer
          className={
            phase === 'running' || phase === 'done'
              ? 'border-t py-4 pb-24 md:pb-4'
              : 'border-t py-4'
          }
        >
          <div className="flex items-center justify-between px-4 text-sm text-muted-foreground md:px-6">
            <p>{`${t.app.title} ${t.app.version}`}</p>
            <p className="tabular-nums">{t.app.footerStats}</p>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}
