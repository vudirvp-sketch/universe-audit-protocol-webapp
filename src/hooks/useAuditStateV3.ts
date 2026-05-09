/**
 * Universe Audit Protocol v3 — State Management
 * Zustand store with localStorage persistence.
 * 5-block pipeline, markdown-based results.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  BlockResult,
  PipelineMeta,
  OrientationContext,
  LLMConfig,
  MediaType,
  PipelinePhase,
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

  // Actions
  startAudit: () => void;
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
};

const AUDIT_STATE_V3_STORAGE_KEY = 'audit-state-v3';

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

      reset: () => set({ ...initialState }),
    }),
    {
      name: AUDIT_STATE_V3_STORAGE_KEY,
      skipHydration: true,
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
        llmConfig: state.llmConfig,
        inputText: state.inputText,
        mediaType: state.mediaType,
      }),
      onRehydrateStorage: () => {
        return (state) => {
          if (state && state.phase === 'running') {
            queueMicrotask(() => {
              useAuditStateV3.setState({
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
              });
            });
          }
        };
      },
    }
  )
);
