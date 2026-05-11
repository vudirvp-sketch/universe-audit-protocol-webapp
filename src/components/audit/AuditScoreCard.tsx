'use client';

/**
 * AuditScoreCard — visual score summary component.
 * Displays overall score percent, verdict, and per-level circular progress indicators.
 * Uses semantic severity color tokens (Section 11.3).
 */

import * as React from 'react';
import type { ChecklistScoreResult, MediaType } from '@/lib/audit/types-v3';
import { t } from '@/lib/i18n/ru';

interface AuditScoreCardProps {
  score: ChecklistScoreResult;
  mediaType: MediaType;
}

// ============================================================
// Verdict logic — uses severity color tokens
// ============================================================

function getVerdict(score: ChecklistScoreResult): { text: string; color: string } {
  if (score.scorePercent >= 75) return { text: t.score.verdictAlive, color: 'text-severity-success' };
  if (score.scorePercent >= 50) return { text: t.score.verdictNeedsWork, color: 'text-severity-warning' };
  return { text: t.score.verdictRedesign, color: 'text-severity-critical' };
}

// ============================================================
// Circular progress component — uses severity stroke tokens
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
    percent >= 75 ? 'stroke-severity-success' :
    percent >= 50 ? 'stroke-severity-warning' :
    'stroke-severity-critical';

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
      <span className="text-sm font-medium">{label}</span>
      <span className="text-sm text-muted-foreground">{fulfilled}/{applicable}</span>
    </div>
  );
}

// ============================================================
// Main component
// ============================================================

export function AuditScoreCard({ score, mediaType }: AuditScoreCardProps) {
  const verdict = getVerdict(score);
  const levels = ['L1', 'L2', 'L3', 'L4'] as const;

  const mediaLabel =
    mediaType === 'narrative' ? t.form.mediaNarrative :
    mediaType === 'game' ? t.form.mediaGame :
    mediaType === 'visual' ? t.form.mediaVisual : t.form.mediaTtrpg;

  return (
    <div className="border-2 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-base font-semibold">{t.score.title}</span>
        <span className="text-sm font-normal text-muted-foreground">
          {mediaLabel}
        </span>
      </div>
      <div className="flex flex-col items-center gap-4">
        {/* Overall score */}
        <div className="text-center">
          <div className={`text-4xl font-bold ${verdict.color}`}>{score.scorePercent}%</div>
          <div className={`text-lg font-semibold mt-1 ${verdict.color}`}>{verdict.text}</div>
          <div className="text-base text-muted-foreground mt-1">
            {t.score.criteriaPassed.replace('{fulfilled}', String(score.fulfilled)).replace('{total}', String(score.totalApplicable))}
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
    </div>
  );
}
