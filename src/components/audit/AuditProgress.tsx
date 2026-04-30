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
  const gateStatus = useAuditState(selectGateStatus);
  const overallProgress = useAuditState(selectOverallProgress);
  const isLoading = useAuditState((state) => state.isLoading);
  const error = useAuditState((state) => state.error);

  const currentPhaseIndex = PHASES.findIndex((p) => p.id === phase);

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
              {isLoading ? t.progress.processing : t.progress.percentComplete.replace('{percent}', String(overallProgress.percentage))}
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
        {/* Overall Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t.progress.progress}</span>
            <span>{overallProgress.current} / {overallProgress.total}</span>
          </div>
          <Progress value={overallProgress.percentage} className="h-2" />
        </div>

        {/* Phase Timeline */}
        <div className="space-y-2">
          {PHASES.filter((p) => p.id !== 'idle' && p.id !== 'failed').map((p, index) => {
            const isActive = p.id === phase;
            const isPast = index < currentPhaseIndex;
            
            return (
              <div
                key={p.id}
                className={`flex items-center gap-3 p-2 rounded-md transition-colors ${
                  isActive ? 'bg-accent' : isPast ? 'opacity-70' : 'opacity-50'
                }`}
              >
                {getPhaseIcon(p.id, index)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{p.name}</span>
                    {isActive && isLoading && (
                      <Badge variant="secondary" className="text-xs animate-pulse">
                        {t.progress.processing}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{p.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Gate Status */}
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-3">{t.gates.status}</h4>
          <div className="grid grid-cols-4 gap-2">
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
