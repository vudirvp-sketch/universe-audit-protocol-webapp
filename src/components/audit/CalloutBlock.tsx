'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * CalloutBlock — врезка внутри отчёта.
 *
 * Без иконок, заливок и «цветных квадратиков»: тип врезки несёт цвет
 * волосяной линии слева и её толщина, текст остаётся обычным текстом отчёта.
 */
const CALLOUT_RULES: Record<string, string> = {
  NOTE: 'border-severity-recommendation',
  WARNING: 'border-severity-warning',
  TIP: 'border-severity-success',
  CAUTION: 'border-severity-warning',
  CRITICAL: 'border-severity-critical',
};

export function CalloutBlock({ type, children }: { type: string; children: React.ReactNode }) {
  const rule = CALLOUT_RULES[type] || CALLOUT_RULES.NOTE;

  return (
    <div className={cn('my-5 border-l-2 pl-4', rule)}>
      <div className="report prose prose-sm max-w-none">{children}</div>
    </div>
  );
}
