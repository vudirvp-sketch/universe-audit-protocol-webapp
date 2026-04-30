'use client';

import * as React from 'react';
import { useAuditState, selectGateStatus, selectOverallProgress } from '@/hooks/useAuditState';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2,
  XCircle,
  Circle,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import type { AuditPhase } from '@/lib/audit/types';
import { t } from '@/lib/i18n/ru';

interface PhaseInfo {
  id: AuditPhase;
  name: string;
  description: string;
}

const PHASES: PhaseInfo[] = [
  { id: 'idle', name: t.phases.idle, description: t.phaseDescriptions.idle },
  { id: 'input_validation', name: t.phases.input_validation, description: t.phaseDescriptions.input_validation },
  { id: 'mode_detection', name: t.phases.mode_detection, description: t.phaseDescriptions.mode_detection },
  { id: 'author_profile', name: t.phases.author_profile, description: t.phaseDescriptions.author_profile },
  { id: 'skeleton_extraction', name: t.phases.skeleton_extraction, description: t.phaseDescriptions.skeleton_extraction },
  { id: 'screening', name: t.phases.screening, description: t.phaseDescriptions.screening },
  { id: 'L1_evaluation', name: t.phases.L1_evaluation, description: t.phaseDescriptions.L1_evaluation },
  { id: 'L2_evaluation', name: t.phases.L2_evaluation, description: t.phaseDescriptions.L2_evaluation },
  { id: 'L3_evaluation', name: t.phases.L3_evaluation, description: t.phaseDescriptions.L3_evaluation },
  { id: 'L4_evaluation', name: t.phases.L4_evaluation, description: t.phaseDescriptions.L4_evaluation },
  { id: 'issue_generation', name: t.phases.issue_generation, description: t.phaseDescriptions.issue_generation },
  { id: 'generative_modules', name: t.phases.generative_modules, description: t.phaseDescriptions.generative_modules },
  { id: 'final_output', name: t.phases.final_output, description: t.phaseDescriptions.final_output },
  { id: 'complete', name: t.phases.complete, description: t.phaseDescriptions.complete },
  { id: 'failed', name: t.phases.failed, description: t.phaseDescriptions.failed },
  { id: 'blocked', name: t.phases.blocked, description: t.phaseDescriptions.blocked },
];

export function AuditProgress() {
  const phase = useAuditState((state) => state.phase);
  const isLoading = useAuditState((state) => state.isLoading);
  const error = useAuditState((state) => state.error);
  const elapsedMs = useAuditState((state) => state.elapsedMs);
  const stepTimings = useAuditState((state) => state.stepTimings);

  // FIX: Use individual field selectors instead of object-returning selectors
  // to prevent re-render storms. selectGateStatus and selectOverallProgress
  // return NEW objects on every call, causing Zustand to always detect "changes"
  // and trigger unnecessary re-renders.
  const L1 = useAuditState((s) => s.gateResults.L1);
  const L2 = useAuditState((s) => s.gateResults.L2);
  const L3 = useAuditState((s) => s.gateResults.L3);
  const L4 = useAuditState((s) => s.gateResults.L4);

  const gateStatus = React.useMemo(() => ({
    L1: L1 ? { score: L1.score, passed: L1.passed, evaluated: true } : { score: 0, passed: false, evaluated: false },
    L2: L2 ? { score: L2.score, passed: L2.passed, evaluated: true } : { score: 0, passed: false, evaluated: false },
    L3: L3 ? { score: L3.score, passed: L3.passed, evaluated: true } : { score: 0, passed: false, evaluated: false },
    L4: L4 ? { score: L4.score, passed: L4.passed, evaluated: true } : { score: 0, passed: false, evaluated: false },
  }), [L1, L2, L3, L4]);

  const overallProgress = React.useMemo(() => {
    const phases: AuditPhase[] = [
      'idle', 'input_validation', 'mode_detection', 'author_profile',
      'skeleton_extraction', 'screening', 'L1_evaluation', 'L2_evaluation',
      'L3_evaluation', 'L4_evaluation', 'issue_generation', 'generative_modules',
      'final_output', 'complete', 'failed',
    ];
    const terminalStates = ['idle', 'failed', 'blocked', 'cancelled'];
    const total = phases.filter(p => !terminalStates.includes(p)).length;
    const currentIndex = phases.indexOf(phase);
    const effectiveIndex = terminalStates.includes(phase)
      ? currentIndex > 0 ? currentIndex - 1 : 0
      : currentIndex;
    return { current: effectiveIndex, total, percentage: Math.round((effectiveIndex / total) * 100) };
  }, [phase]);

  // Live timer for current step
  const [liveElapsed, setLiveElapsed] = React.useState(0);
  React.useEffect(() => {
    if (!isLoading) {
      setLiveElapsed(0);
      return;
    }
    const interval = setInterval(() => {
      setLiveElapsed((prev) => prev + 1000);
    }, 1000);
    return () => clearInterval(interval);
  }, [isLoading]);

  const currentPhaseIndex = PHASES.findIndex((p) => p.id === phase);

  // Calculate total elapsed (from stepTimings + live)
  const totalElapsed = elapsedMs || Object.values(stepTimings).reduce((sum, ms) => sum + (ms || 0), 0) + liveElapsed;

  // Estimate remaining time based on average step time
  const completedTimings = Object.values(stepTimings).filter((ms): ms is number => ms != null && ms > 0);
  const avgStepMs = completedTimings.length > 0
    ? completedTimings.reduce((sum, ms) => sum + ms, 0) / completedTimings.length
    : 0;
  const completedStepCount = completedTimings.length;
  const totalSteps = PHASES.filter((p) => p.id !== 'idle' && p.id !== 'failed' && p.id !== 'complete' && p.id !== 'blocked' && p.id !== 'cancelled').length;
  const remainingSteps = Math.max(0, totalSteps - completedStepCount);
  const estimatedRemainingMs = avgStepMs > 0 ? avgStepMs * remainingSteps : 0;

  const getPhaseIcon = (phaseId: AuditPhase, index: number) => {
    if (phaseId === 'failed') {
      return <XCircle className="h-5 w-5 text-red-500" />;
    }
    if (phaseId === 'complete') {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
    if (index === currentPhaseIndex) {
      if (isLoading) {
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      }
      return <Clock className="h-5 w-5 text-blue-500" />;
    }
    if (index < currentPhaseIndex) {
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    }
    return <Circle className="h-5 w-5 text-muted-foreground" />;
  };

  const getGateIcon = (level: 'L1' | 'L2' | 'L3' | 'L4') => {
    const status = gateStatus[level];
    if (!status.evaluated) {
      return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
    if (status.passed) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{t.app.title} — {t.progress.progress}</CardTitle>
            <CardDescription>
              {isLoading
                ? PHASES.find(p => p.id === phase)?.description || t.progress.processing
                : t.progress.percentComplete.replace('{percent}', String(overallProgress.percentage))}
            </CardDescription>
          </div>
          {error && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {t.errors.error}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Timing Info */}
        {(totalElapsed > 0 || isLoading) && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t.progress.elapsed.replace('{time}', formatDuration(totalElapsed))}</span>
            {estimatedRemainingMs > 0 && isLoading && (
              <span>{t.progress.estimatedRemaining.replace('{time}', formatDuration(estimatedRemainingMs))}</span>
            )}
          </div>
        )}

        {/* Overall Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t.progress.progress}</span>
            <span>{overallProgress.current} / {overallProgress.total}</span>
          </div>
          <Progress value={overallProgress.percentage} className="h-2" />
        </div>

        {/* Phase Timeline — compact on mobile */}
        <div className="space-y-1 sm:space-y-2">
          {PHASES.filter((p) => p.id !== 'idle' && p.id !== 'failed').map((p, index) => {
            const isActive = p.id === phase;
            const isPast = index < currentPhaseIndex;
            
            return (
              <div
                key={p.id}
                className={`flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2 rounded-md transition-colors ${
                  isActive ? 'bg-accent' : isPast ? 'opacity-70' : 'opacity-50'
                }`}
              >
                {getPhaseIcon(p.id, index)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <span className="text-xs sm:text-sm font-medium truncate">{p.name}</span>
                    {isActive && isLoading && (
                      <Badge variant="secondary" className="text-xs animate-pulse hidden sm:inline-flex">
                        {t.progress.processing}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate hidden sm:block">{p.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Gate Status */}
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-3">{t.gates.status}</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(['L1', 'L2', 'L3', 'L4'] as const).map((level) => {
              const status = gateStatus[level];
              return (
                <div
                  key={level}
                  className={`flex flex-col items-center p-2 rounded-md border ${
                    status.evaluated
                      ? status.passed
                        ? 'border-green-500/50 bg-green-500/10'
                        : 'border-red-500/50 bg-red-500/10'
                      : 'border-muted'
                  }`}
                >
                  {getGateIcon(level)}
                  <span className="text-xs font-medium mt-1">{level}</span>
                  <span className="text-xs text-muted-foreground">
                    {status.evaluated ? `${status.score}%` : '—'}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            {t.gates.requirement}
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive">{t.progress.auditStopped}</p>
                <p className="text-xs text-muted-foreground">{error}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format milliseconds into a human-readable duration string.
 * Returns "Xм Yс" for minutes+seconds, or "Yс" for seconds only.
 */
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}м ${seconds}с`;
  }
  return `${seconds}с`;
}
