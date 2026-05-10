'use client';

/**
 * AuditScoreCard — visual score summary component.
 * Displays overall score percent, verdict, and per-level circular progress indicators.
 */

import * as React from 'react';
import type { ChecklistScoreResult, MediaType } from '@/lib/audit/types-v3';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AuditScoreCardProps {
  score: ChecklistScoreResult;
  mediaType: MediaType;
}

// ============================================================
// Verdict logic
// ============================================================

function getVerdict(score: ChecklistScoreResult): { text: string; color: string } {
  const l1 = score.byLevel['L1'];
  if (l1) {
    if (l1.fulfilled >= 13) return { text: 'Мир жив', color: 'text-green-600 dark:text-green-400' };
    if (l1.fulfilled >= 10) return { text: 'Требует доработки', color: 'text-yellow-600 dark:text-yellow-400' };
    return { text: 'Фундаментальный редизайн', color: 'text-red-600 dark:text-red-400' };
  }
  // Fallback to overall score
  if (score.scorePercent >= 75) return { text: 'Мир жив', color: 'text-green-600 dark:text-green-400' };
  if (score.scorePercent >= 50) return { text: 'Требует доработки', color: 'text-yellow-600 dark:text-yellow-400' };
  return { text: 'Фундаментальный редизайн', color: 'text-red-600 dark:text-red-400' };
}

// ============================================================
// Circular progress component
// ============================================================

function CircularProgress({
  percent,
  label,
  fulfilled,
  applicable,
  size = 80,
}: {
  percent: number;
  label: string;
  fulfilled: number;
  applicable: number;
  size?: number;
}) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  const colorClass =
    percent >= 75 ? 'stroke-green-500' :
    percent >= 50 ? 'stroke-yellow-500' :
    'stroke-red-500';

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/20"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={colorClass}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div className="text-center -mt-[calc(50%+8px)] mb-[calc(50%-8px)] flex flex-col items-center justify-center" style={{ width: size, height: size, marginTop: -size, position: 'relative', zIndex: 1 }}>
        <span className="text-lg font-bold">{percent}%</span>
      </div>
      <span className="text-xs font-medium">{label}</span>
      <span className="text-xs text-muted-foreground">{fulfilled}/{applicable}</span>
    </div>
  );
}

// ============================================================
// Main component
// ============================================================

export function AuditScoreCard({ score, mediaType }: AuditScoreCardProps) {
  const verdict = getVerdict(score);
  const levels = ['L1', 'L2', 'L3', 'L4'] as const;

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Оценка аудита</span>
          <span className="text-sm font-normal text-muted-foreground">
            {mediaType === 'narrative' ? 'Нарратив' : mediaType === 'game' ? 'Игра' : mediaType === 'visual' ? 'Визуальное' : 'ТВРПГ'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-4">
          {/* Overall score */}
          <div className="text-center">
            <div className={`text-4xl font-bold ${verdict.color}`}>{score.scorePercent}%</div>
            <div className={`text-lg font-semibold mt-1 ${verdict.color}`}>{verdict.text}</div>
            <div className="text-sm text-muted-foreground mt-1">
              {score.fulfilled} из {score.totalApplicable} критериев пройдено
            </div>
          </div>

          {/* Per-level breakdown */}
          <div className="flex gap-4 flex-wrap justify-center">
            {levels.map(level => {
              const data = score.byLevel[level];
              if (!data) return null;
              return (
                <CircularProgress
                  key={level}
                  percent={data.percent}
                  label={level}
                  fulfilled={data.fulfilled}
                  applicable={data.applicable}
                />
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
