// Universe Audit Protocol v11.0 — State Management (Pipeline V2)
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Step1Result,
  Step2Result,
  Step3Result,
  PipelineMeta,
  LLMConfig,
  MediaType,
} from '../lib/audit/types-v2';

// ============================================================
// Store interface
// ============================================================

export interface AuditStateV2 {
  phase: 'idle' | 'running' | 'done' | 'error';
  currentStep: 0 | 1 | 2 | 3;
  step1: Step1Result | null;
  step2: Step2Result | null;
  step3: Step3Result | null;
  meta: PipelineMeta | null;
  streamingText: string;
  error: string | null;
  llmConfig: LLMConfig | null;
  inputText: string;
  mediaType: MediaType;

  // Actions
  startAudit: () => void;
  setStepResult: (step: 1 | 2 | 3, result: Step1Result | Step2Result | Step3Result) => void;
  setMeta: (meta: PipelineMeta) => void;
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
  phase: 'idle' as const,
  currentStep: 0 as 0 | 1 | 2 | 3,
  step1: null as Step1Result | null,
  step2: null as Step2Result | null,
  step3: null as Step3Result | null,
  meta: null as PipelineMeta | null,
  streamingText: '',
  error: null as string | null,
  llmConfig: null as LLMConfig | null,
  inputText: '',
  mediaType: 'narrative' as MediaType,
};

const AUDIT_STATE_V2_STORAGE_KEY = 'audit-state-v2';

// ============================================================
// Store
// ============================================================

export const useAuditStateV2 = create<AuditStateV2>()(
  persist(
    (set) => ({
      ...initialState,

      // Start the audit pipeline
      startAudit: () =>
        set({
          phase: 'running',
          currentStep: 1,
          step1: null,
          step2: null,
          step3: null,
          meta: null,
          streamingText: '',
          error: null,
        }),

      // Set the result for a completed step and advance the pipeline
      setStepResult: (step: 1 | 2 | 3, result: Step1Result | Step2Result | Step3Result) =>
        set((state) => {
          const nextStep = (step + 1) as 0 | 1 | 2 | 3;

          // If this was the last step, mark the pipeline as done
          if (step === 3) {
            return {
              step3: result as Step3Result,
              phase: 'done' as const,
              currentStep: 3 as const,
              streamingText: '',
            };
          }

          return {
            [`step${step}`]: result,
            currentStep: nextStep,
            streamingText: '',
          };
        }),

      // Set pipeline meta information (tokens, timings, etc.)
      setMeta: (meta: PipelineMeta) => set({ meta }),

      // Append a chunk of streaming text from the LLM
      appendStreamingText: (text: string) =>
        set((state) => ({ streamingText: state.streamingText + text })),

      // Clear the streaming text buffer
      clearStreamingText: () => set({ streamingText: '' }),

      // Set an error message and transition to error phase
      setError: (message: string) =>
        set({
          phase: 'error',
          error: message,
          streamingText: '',
        }),

      // Store the LLM configuration
      setLlmConfig: (config: LLMConfig) => set({ llmConfig: config }),

      // Set the input text for the audit
      setInputText: (text: string) => set({ inputText: text }),

      // Set the media type
      setMediaType: (type: MediaType) => set({ mediaType: type }),

      // Full reset to initial state
      reset: () =>
        set({
          ...initialState,
        }),
    }),
    {
      name: AUDIT_STATE_V2_STORAGE_KEY,
      // CRITICAL: skipHydration prevents React Error #185 (hydration mismatch).
      // In a static-export Next.js app (output: 'export'), the server renders
      // HTML with default state at build time. Without skipHydration, Zustand's
      // persist middleware rehydrates from localStorage DURING the initial render,
      // causing the client's first render to differ from the server HTML.
      // By skipping auto-hydration and calling rehydrate() in useEffect,
      // we ensure the server HTML and client's first render are identical.
      skipHydration: true,
      // Only persist these fields — exclude streamingText and action functions
      partialize: (state) => ({
        phase: state.phase,
        currentStep: state.currentStep,
        step1: state.step1,
        step2: state.step2,
        step3: state.step3,
        meta: state.meta,
        error: state.error,
        llmConfig: state.llmConfig,
        inputText: state.inputText,
        mediaType: state.mediaType,
      }),
      // On hydration, handle interrupted / stale sessions.
      // - 'running': the pipeline was interrupted (page closed / crashed) → reset to idle
      // - 'done': the audit completed successfully → keep the report
      // - 'error': the audit failed → keep the error so the user can see it
      // - 'idle': fresh state, nothing to do
      onRehydrateStorage: () => {
        return (state) => {
          if (state) {
            if (state.phase === 'running') {
              // Pipeline was interrupted — reset to idle so the user can start fresh
              queueMicrotask(() => {
                useAuditStateV2.setState({
                  phase: 'idle',
                  currentStep: 0,
                  step1: null,
                  step2: null,
                  step3: null,
                  meta: null,
                  streamingText: '',
                  error: null,
                });
              });
            }
            // 'done' → keep the report (no action needed)
            // 'error' → keep the error (no action needed)
            // 'idle' → fresh state (no action needed)
          }
        };
      },
    }
  )
);
