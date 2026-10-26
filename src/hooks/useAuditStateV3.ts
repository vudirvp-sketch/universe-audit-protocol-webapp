/**
 * Universe Audit Protocol — State Management
 * Zustand store with localStorage persistence.
 * v16: 5-block pipeline, markdown-based results, qualitative verdict.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { t } from '../lib/i18n/ru';
import { createSafeStorage } from '../lib/safe-storage';
import type {
  BlockResult,
  PipelineMeta,
  OrientationContext,
  LLMConfig,
  MediaType,
  PipelinePhase,
  AuditVerdict,
  AuditMaterial,
  GuidedContext,
  PipelineLogEntry,
} from '../lib/audit/types-v3';

// ============================================================
// Store interface
// ============================================================

export interface AuditStateV3 {
  // State
  phase: PipelinePhase;
  currentBlock: 0 | 1 | 2 | 3 | 4 | 5;
  currentBlockTotalChunks: number;
  currentChunkIndex: number;
  block1: BlockResult | null;
  block2: BlockResult | null;
  block3: BlockResult | null;
  block4: BlockResult | null;
  block5: BlockResult | null;
  orientationContext: OrientationContext | null;
  meta: PipelineMeta | null;
  streamingText: string;
  error: string | null;
  llmConfig: LLMConfig | null;
  inputText: string;
  mediaType: MediaType;
  /** Optional author framing — switches the audit to guided mode (v16 §2) */
  guided: GuidedContext;
  /** Additional artefacts beyond the main text — material-aware mode (v16 §2) */
  materials: AuditMaterial[];
  /** Qualitative verdict (v16 §26.S) — replaces the legacy checklist score */
  verdict: AuditVerdict | null;
  /** Timestamped pipeline events — answers "is it stuck?" without a debugger */
  log: PipelineLogEntry[];
  /** Epoch ms when the current run started (for the live elapsed timer) */
  pipelineStartedAt: number | null;
  /**
   * Last persistence failure (localStorage quota, blocked storage).
   * Non-null means the draft on screen is no longer being saved.
   */
  storageError: string | null;

  // Actions
  startAudit: () => void;
  /** Drop the run in progress but keep the author's draft (input, framing, artefacts). */
  abortAudit: () => void;
  setBlockResult: (blockNumber: 1 | 2 | 3 | 4 | 5, result: BlockResult) => void;
  setOrientationContext: (context: OrientationContext) => void;
  setMeta: (meta: PipelineMeta) => void;
  setChunkProgress: (totalChunks: number, chunkIndex: number) => void;
  appendStreamingText: (text: string) => void;
  clearStreamingText: () => void;
  setError: (message: string) => void;
  setLlmConfig: (config: LLMConfig) => void;
  setInputText: (text: string) => void;
  setMediaType: (type: MediaType) => void;
  /** Merge a partial guided framing; empty strings are kept as-is and omitted at submit time */
  setGuided: (partial: Partial<GuidedContext>) => void;
  setMaterials: (materials: AuditMaterial[]) => void;
  setVerdict: (verdict: AuditVerdict | null) => void;
  /** Append one progress event; the list is capped so a long run cannot grow unbounded */
  appendLog: (entry: PipelineLogEntry) => void;
  reset: () => void;
}

// ============================================================
// Initial state
// ============================================================

const initialState = {
  phase: 'idle' as PipelinePhase,
  currentBlock: 0 as 0 | 1 | 2 | 3 | 4 | 5,
  currentBlockTotalChunks: 0,
  currentChunkIndex: 0,
  block1: null as BlockResult | null,
  block2: null as BlockResult | null,
  block3: null as BlockResult | null,
  block4: null as BlockResult | null,
  block5: null as BlockResult | null,
  orientationContext: null as OrientationContext | null,
  meta: null as PipelineMeta | null,
  streamingText: '',
  error: null as string | null,
  llmConfig: null as LLMConfig | null,
  inputText: '',
  mediaType: 'narrative' as MediaType,
  guided: {} as GuidedContext,
  materials: [] as AuditMaterial[],
  verdict: null as AuditVerdict | null,
  log: [] as PipelineLogEntry[],
  pipelineStartedAt: null as number | null,
  storageError: null as string | null,
};

const AUDIT_STATE_V3_STORAGE_KEY = 'audit-state-v3';

// ============================================================
// Store
// ============================================================

let reportStorageFailure: (message: string | null) => void = () => {};

const safeStorage = createSafeStorage(
  () => (typeof window === 'undefined' ? null : window.localStorage),
  (message) => reportStorageFailure(message ? t.form.storageError : null),
);

// ============================================================
// Store
// ============================================================

export const useAuditStateV3 = create<AuditStateV3>()(
  persist(
    (set) => ({
      ...initialState,

      startAudit: () =>
        set({
          phase: 'running',
          currentBlock: 1,
          currentBlockTotalChunks: 0,
          currentChunkIndex: 0,
          block1: null,
          block2: null,
          block3: null,
          block4: null,
          block5: null,
          orientationContext: null,
          meta: null,
          streamingText: '',
          error: null,
          verdict: null,
          log: [],
          pipelineStartedAt: Date.now(),
        }),

      // Cancelling must not destroy the draft the author typed: only the run is
      // dropped. The journal is kept — it is the evidence of what happened
      // before the cancel and is cleared on the next start or reset.
      abortAudit: () =>
        set({
          phase: 'idle',
          currentBlock: 0,
          currentBlockTotalChunks: 0,
          currentChunkIndex: 0,
          block1: null,
          block2: null,
          block3: null,
          block4: null,
          block5: null,
          orientationContext: null,
          meta: null,
          streamingText: '',
          error: null,
          verdict: null,
        }),

      setBlockResult: (blockNumber, result) =>
        set((state) => {
          const key = `block${blockNumber}` as keyof Pick<AuditStateV3, 'block1' | 'block2' | 'block3' | 'block4' | 'block5'>;
          const nextBlock = (blockNumber + 1) as 0 | 1 | 2 | 3 | 4 | 5;
          const isLastBlock = blockNumber === 5;

          return {
            [key]: result,
            currentBlock: isLastBlock ? 5 : nextBlock,
            currentBlockTotalChunks: 0,
            currentChunkIndex: 0,
            streamingText: '',
            ...(isLastBlock ? { phase: 'done' as const } : {}),
          };
        }),

      setOrientationContext: (context) => set({ orientationContext: context }),

      setMeta: (meta) => set({ meta }),

      setChunkProgress: (totalChunks, chunkIndex) =>
        set({ currentBlockTotalChunks: totalChunks, currentChunkIndex: chunkIndex }),

      appendStreamingText: (text) =>
        set((state) => ({ streamingText: state.streamingText + text })),

      clearStreamingText: () => set({ streamingText: '' }),

      setError: (message) =>
        set({
          phase: 'error',
          error: message,
          streamingText: '',
        }),

      setLlmConfig: (config) => set({ llmConfig: config }),

      setInputText: (text) => set({ inputText: text }),

      setMediaType: (type) => set({ mediaType: type }),

      setGuided: (partial) =>
        set((state) => ({ guided: { ...state.guided, ...partial } })),

      setMaterials: (materials) => set({ materials }),

      setVerdict: (verdict) => set({ verdict }),

      appendLog: (entry) =>
        set((state) => ({
          // Cap keeps the persisted state (and the panel) bounded on long runs:
          // heartbeats alone add a line every 10 s per in-flight request.
          log: state.log.length >= 400 ? [...state.log.slice(-399), entry] : [...state.log, entry],
        })),

      reset: () => set({ ...initialState }),
    }),
    {
      name: AUDIT_STATE_V3_STORAGE_KEY,
      skipHydration: true,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        phase: state.phase,
        currentBlock: state.currentBlock,
        currentBlockTotalChunks: state.currentBlockTotalChunks,
        currentChunkIndex: state.currentChunkIndex,
        block1: state.block1,
        block2: state.block2,
        block3: state.block3,
        block4: state.block4,
        block5: state.block5,
        orientationContext: state.orientationContext,
        meta: state.meta,
        error: state.error,
        // Deliberately not persisted: LLMConfig carries the plaintext apiKey.
        // The live config lives in memory (and the key belongs in useSettings,
        // which keeps it in sessionStorage only).
        inputText: state.inputText,
        mediaType: state.mediaType,
        guided: state.guided,
        materials: state.materials,
        verdict: state.verdict,
        log: state.log,
        pipelineStartedAt: state.pipelineStartedAt,
      }),
      onRehydrateStorage: () => {
        return (state) => {
          if (state && state.phase === 'running') {
            // A reload cannot resume a run: drop the stale run, keep the draft.
            queueMicrotask(() => {
              useAuditStateV3.getState().abortAudit();
            });
          }
        };
      },
    }
  )
);

// Persistence failures are reported through the store itself: the failing write
// has already been applied, so only a flag has to reach the UI.
reportStorageFailure = (message) => {
  if (useAuditStateV3.getState().storageError !== message) {
    useAuditStateV3.setState({ storageError: message });
  }
};
