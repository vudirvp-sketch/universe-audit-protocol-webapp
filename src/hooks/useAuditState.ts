// Universe Audit Protocol v10.0 - State Management
import { create } from 'zustand';
import type { 
  AuditState, 
  AuditPhase,
  MediaType,
  AuditMode,
  AuthorProfileAnswers,
  AuthorProfile,
  Skeleton,
  ScreeningResult,
  GateResult,
  ChecklistItem,
  GriefArchitectureMatrix,
  AuditReport
} from '@/lib/audit/types';
import { MASTER_CHECKLIST } from '@/lib/audit/protocol-data';
import { filterByMediaType } from '@/lib/audit/scoring-algorithm';

// Initial state values
const initialState = {
  phase: 'idle' as AuditPhase,
  inputText: '',
  mediaType: 'game' as MediaType,
  auditMode: null as AuditMode | null,
  authorAnswers: null as AuthorProfileAnswers | null,
  authorProfile: null as AuthorProfile | null,
  skeleton: null as Skeleton | null,
  screeningResult: null as ScreeningResult | null,
  gateResults: {
    L1: null as GateResult | null,
    L2: null as GateResult | null,
    L3: null as GateResult | null,
    L4: null as GateResult | null,
  },
  checklist: [...MASTER_CHECKLIST] as ChecklistItem[],
  griefMatrix: null as GriefArchitectureMatrix | null,
  report: null as AuditReport | null,
  isLoading: false,
  error: null as string | null,
};

export const useAuditState = create<AuditState>((set, get) => ({
  ...initialState,

  // Setters
  setPhase: (phase: AuditPhase) => set({ phase }),
  
  setInputText: (inputText: string) => set({ inputText }),
  
  setMediaType: (mediaType: MediaType) => {
    // Re-filter checklist when media type changes
    const checklist = filterByMediaType([...MASTER_CHECKLIST], mediaType);
    set({ mediaType, checklist });
  },
  
  setAuditMode: (auditMode: AuditMode | null) => set({ auditMode }),
  
  setAuthorAnswers: (authorAnswers: AuthorProfileAnswers | null) => set({ authorAnswers }),
  
  setAuthorProfile: (authorProfile: AuthorProfile | null) => set({ authorProfile }),
  
  setSkeleton: (skeleton: Skeleton | null) => set({ skeleton }),
  
  setScreeningResult: (screeningResult: ScreeningResult | null) => set({ screeningResult }),
  
  setGateResult: (level: 'L1' | 'L2' | 'L3' | 'L4', result: GateResult) => {
    set(state => ({
      gateResults: {
        ...state.gateResults,
        [level]: result,
      },
    }));
  },
  
  setChecklist: (checklist: ChecklistItem[]) => set({ checklist }),
  
  updateChecklistItem: (id: string, updates: Partial<ChecklistItem>) => {
    set(state => ({
      checklist: state.checklist.map(item =>
        item.id === id ? { ...item, ...updates } : item
      ),
    }));
  },
  
  setGriefMatrix: (griefMatrix: GriefArchitectureMatrix | null) => set({ griefMatrix }),
  
  setReport: (report: AuditReport | null) => set({ report }),
  
  setLoading: (isLoading: boolean) => set({ isLoading }),
  
  setError: (error: string | null) => set({ error }),
  
  reset: () => {
    set({
      ...initialState,
      checklist: filterByMediaType([...MASTER_CHECKLIST], initialState.mediaType),
    });
  },
}));

// Selectors for derived state
export const selectCurrentPhase = (state: AuditState) => state.phase;

export const selectHasPassedGate = (level: 'L1' | 'L2' | 'L3' | 'L4') => (state: AuditState) => {
  const result = state.gateResults[level];
  return result?.passed ?? false;
};

export const selectOverallProgress = (state: AuditState) => {
  const phases: AuditPhase[] = [
    'idle',
    'mode_selection',
    'author_profile',
    'skeleton_extraction',
    'screening',
    'L1_evaluation',
    'L2_evaluation',
    'L3_evaluation',
    'L4_evaluation',
    'complete',
    'failed',
  ];
  
  const currentIndex = phases.indexOf(state.phase);
  const total = phases.length - 2; // Exclude idle and failed from progress
  
  return {
    current: currentIndex,
    total,
    percentage: Math.round((currentIndex / total) * 100),
  };
};

export const selectChecklistStats = (state: AuditState) => {
  const applicable = state.checklist.filter(i => i.applicable);
  const passed = applicable.filter(i => i.status === 'PASS').length;
  const failed = applicable.filter(i => i.status === 'FAIL').length;
  const insufficient = applicable.filter(i => i.status === 'INSUFFICIENT_DATA').length;
  const pending = applicable.filter(i => i.status === 'PENDING').length;
  
  return {
    total: applicable.length,
    passed,
    failed,
    insufficient,
    pending,
    score: applicable.length > 0 ? Math.round((passed / applicable.length) * 100) : 0,
  };
};

export const selectGateStatus = (state: AuditState) => {
  return {
    L1: state.gateResults.L1 ? {
      score: state.gateResults.L1.score,
      passed: state.gateResults.L1.passed,
      evaluated: true,
    } : { score: 0, passed: false, evaluated: false },
    L2: state.gateResults.L2 ? {
      score: state.gateResults.L2.score,
      passed: state.gateResults.L2.passed,
      evaluated: true,
    } : { score: 0, passed: false, evaluated: false },
    L3: state.gateResults.L3 ? {
      score: state.gateResults.L3.score,
      passed: state.gateResults.L3.passed,
      evaluated: true,
    } : { score: 0, passed: false, evaluated: false },
    L4: state.gateResults.L4 ? {
      score: state.gateResults.L4.score,
      passed: state.gateResults.L4.passed,
      evaluated: true,
    } : { score: 0, passed: false, evaluated: false },
  };
};

// Hook for getting applicable checklist for current media type
export const useApplicableChecklist = () => {
  const checklist = useAuditState(state => state.checklist);
  return checklist.filter(item => item.applicable);
};

// Hook for getting checklist grouped by block
export const useChecklistByBlock = () => {
  const checklist = useApplicableChecklist();
  
  const grouped = checklist.reduce((acc, item) => {
    if (!acc[item.block]) {
      acc[item.block] = [];
    }
    acc[item.block].push(item);
    return acc;
  }, {} as Record<string, ChecklistItem[]>);
  
  return grouped;
};

// Hook for gate failures
export const useGateFailures = () => {
  const gateResults = useAuditState(state => state.gateResults);
  
  const failures: Array<{ level: 'L1' | 'L2' | 'L3' | 'L4'; result: GateResult }> = [];
  
  (['L1', 'L2', 'L3', 'L4'] as const).forEach(level => {
    const result = gateResults[level];
    if (result && !result.passed) {
      failures.push({ level, result });
    }
  });
  
  return failures;
};
