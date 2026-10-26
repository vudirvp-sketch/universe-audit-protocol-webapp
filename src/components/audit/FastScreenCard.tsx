'use client';

/**
 * FastScreenCard — the seven v16 §6 fast-screen answers plus audit mode.
 *
 * Renders `OrientationContext.fastScreen` (YES / PARTIAL / NO / UNKNOWN / N/A)
 * and warns when Block 1 marked the material as FOUNDATION-LIMITED.
 *
 * Direction A: rows on hairlines, answer status by shape via `SeverityMark` —
 * filled = YES, half = PARTIAL, outline = NO, hairline outline = UNKNOWN / N/A.
 */

import * as React from 'react';
import type { FastScreenAnswer, OrientationContext } from '@/lib/audit/types-v3';
import { CalloutBlock } from './CalloutBlock';
import { SeverityMark } from './status-marks';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n/ru';
import { severityTextClass, type Severity } from '@/lib/audit/verdict-display';

// ============================================================
// Answer status — severity tokens only, shape first
// ============================================================

const ANSWER_TONE: Record<FastScreenAnswer, Severity> = {
  YES: 'success',
  PARTIAL: 'warning',
  NO: 'critical',
  UNKNOWN: 'neutral',
  NA: 'neutral',
};

function AnswerStatus({ answer }: { answer: FastScreenAnswer | null }) {
  if (!answer) {
    return (
      <span className="flex shrink-0 items-baseline gap-2 text-sm text-muted-foreground">
        <SeverityMark severity="neutral" />
        {t.fastScreen.unparsed}
      </span>
    );
  }
  const tone = ANSWER_TONE[answer];
  return (
    <span className="flex shrink-0 items-baseline gap-2 text-sm">
      <SeverityMark severity={tone} />
      <span className={cn('font-medium', severityTextClass(tone))}>
        {t.fastScreen.answers[answer]}
      </span>
    </span>
  );
}

// ============================================================
// Props
// ============================================================

export interface FastScreenCardProps {
  orientationContext: OrientationContext | null;
}

// ============================================================
// Main component
// ============================================================

export function FastScreenCard({ orientationContext }: FastScreenCardProps) {
  if (!orientationContext) return null;

  const { auditMode, foundationLimited, fastScreen } = orientationContext;
  const answers = fastScreen ?? [];
  const modeLabel = auditMode ? t.modes[auditMode] : null;

  return (
    <section aria-labelledby="fast-screen-card-title" className="mb-10">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border pb-3">
        <h2 id="fast-screen-card-title" className="text-base font-semibold">
          {t.fastScreen.title}
        </h2>
        <p className="text-sm text-muted-foreground">{t.fastScreen.subtitle}</p>
      </div>

      {modeLabel && (
        <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border py-2 text-sm">
          <span className="text-muted-foreground">{t.fastScreen.mode}</span>
          <span className="font-medium text-foreground">{modeLabel}</span>
        </p>
      )}

      {foundationLimited && (
        <CalloutBlock type="WARNING">
          <p className="m-0">{t.fastScreen.foundationLimited}</p>
        </CalloutBlock>
      )}

      {answers.length === 0 ? (
        <p className="border-b border-border py-3 text-sm text-muted-foreground">
          {t.fastScreen.empty}
        </p>
      ) : (
        <ol className="border-b border-border">
          {answers.map((item, index) => (
            <li
              key={`${index}-${item.question}`}
              className="flex items-baseline justify-between gap-4 border-b border-border py-2 last:border-b-0"
            >
              <span className="flex items-baseline gap-3 text-sm text-foreground">
                <span className="w-4 shrink-0 tabular-nums text-xs text-muted-foreground/70">
                  {index + 1}
                </span>
                {item.question}
              </span>
              <AnswerStatus answer={item.answer} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
