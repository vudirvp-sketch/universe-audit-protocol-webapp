'use client';

/**
 * AuditScoreCard — итог аудита одной строкой и полоса критериев по уровням.
 * Без карточки и колец: число, вердикт, затем 52 клетки (по одной на критерий).
 */

import * as React from 'react';
import type { ChecklistScoreResult, MediaType } from '@/lib/audit/types-v3';
import { t } from '@/lib/i18n/ru';
import { CriteriaStrip } from './CriteriaStrip';

interface AuditScoreCardProps {
  score: ChecklistScoreResult;
  mediaType: MediaType;
}

function getVerdict(score: ChecklistScoreResult): { text: string; color: string } {
  if (score.scorePercent >= 75) return { text: t.score.verdictAlive, color: 'text-severity-success' };
  if (score.scorePercent >= 50) return { text: t.score.verdictNeedsWork, color: 'text-severity-warning' };
  return { text: t.score.verdictRedesign, color: 'text-severity-critical' };
}

export function AuditScoreCard({ score, mediaType }: AuditScoreCardProps) {
  const verdict = getVerdict(score);
  const mediaLabel =
    mediaType === 'narrative' ? t.form.mediaNarrative :
    mediaType === 'game' ? t.form.mediaGame :
    mediaType === 'visual' ? t.form.mediaVisual : t.form.mediaTtrpg;

  return (
    <section aria-labelledby="score-title" className="mb-10 border-b pb-8">
      <h2 id="score-title" className="sr-only">{t.score.title}</h2>
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 pb-5">
        <p className="text-6xl font-semibold leading-none tracking-tight tabular-nums">
          {score.fulfilled} из {score.totalApplicable}
        </p>
        <p className={`text-lg font-semibold ${verdict.color}`}>{verdict.text}</p>
        <p className="text-sm text-muted-foreground sm:ml-auto">{mediaLabel}, {score.scorePercent}%</p>
      </div>
      <CriteriaStrip score={score} />
    </section>
  );
}
