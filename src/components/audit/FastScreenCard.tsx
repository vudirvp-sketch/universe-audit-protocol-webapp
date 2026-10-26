'use client';

/**
 * FastScreenCard — the seven v16 §6 fast-screen answers plus audit mode.
 *
 * Renders `OrientationContext.fastScreen` (YES / PARTIAL / NO / UNKNOWN / N/A)
 * and warns when Block 1 marked the material as FOUNDATION-LIMITED.
 */

import * as React from 'react';
import type { FastScreenAnswer, OrientationContext } from '@/lib/audit/types-v3';
import { Badge } from '@/components/ui/badge';
import { CalloutBlock } from './CalloutBlock';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n/ru';

// ============================================================
// Answer badge styling — severity tokens only
// ============================================================

const ANSWER_CLASSES: Record<FastScreenAnswer, string> = {
  YES: 'bg-severity-success/10 text-severity-success',
  PARTIAL: 'bg-severity-warning/10 text-severity-warning',
  NO: 'bg-severity-critical/10 text-severity-critical',
  UNKNOWN: 'bg-muted text-muted-foreground',
  NA: 'bg-muted text-muted-foreground',
};

function AnswerBadge({ answer }: { answer: FastScreenAnswer | null }) {
  if (!answer) {
    return (
      <Badge variant="outline" className="text-xs font-mono text-muted-foreground">
        {t.fastScreen.unparsed}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn('text-xs font-mono', ANSWER_CLASSES[answer])}>
      {t.fastScreen.answers[answer]}
    </Badge>
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
    <section
      aria-labelledby="fast-screen-card-title"
      className="border rounded-lg p-6 mb-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h2 id="fast-screen-card-title" className="text-base font-semibold">
          {t.fastScreen.title}
        </h2>
        <span className="text-sm text-muted-foreground">{t.fastScreen.subtitle}</span>
      </div>

      {modeLabel && (
        <p className="text-sm mb-3">
          <span className="text-muted-foreground">{t.fastScreen.mode}: </span>
          <span className="font-medium">{modeLabel}</span>
        </p>
      )}

      {foundationLimited && (
        <CalloutBlock type="WARNING">
          <p className="m-0">{t.fastScreen.foundationLimited}</p>
        </CalloutBlock>
      )}

      {answers.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.fastScreen.empty}</p>
      ) : (
        <ol className="space-y-1 mt-2">
          {answers.map((item, index) => (
            <li
              key={`${index}-${item.question}`}
              className="flex items-start justify-between gap-3 border-b py-1.5 last:border-b-0"
            >
              <span className="text-sm text-muted-foreground">
                <span className="font-mono text-xs mr-2 text-muted-foreground/70">
                  {index + 1}
                </span>
                {item.question}
              </span>
              <AnswerBadge answer={item.answer} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
