'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Info, AlertTriangle, Lightbulb, ShieldAlert, XCircle } from 'lucide-react';

// Цвета берутся из токенов состояния, а не из палитры Tailwind.
const CALLOUT_STYLES: Record<string, string> = {
  NOTE: 'border-l-severity-recommendation',
  WARNING: 'border-l-severity-warning',
  TIP: 'border-l-severity-success',
  CAUTION: 'border-l-severity-warning',
  CRITICAL: 'border-l-severity-critical',
};

const CALLOUT_ICONS: Record<string, React.ReactNode> = {
  NOTE: <Info className="h-4 w-4 text-severity-recommendation" aria-hidden="true" />,
  WARNING: <AlertTriangle className="h-4 w-4 text-severity-warning" aria-hidden="true" />,
  TIP: <Lightbulb className="h-4 w-4 text-severity-success" aria-hidden="true" />,
  CAUTION: <ShieldAlert className="h-4 w-4 text-severity-warning" aria-hidden="true" />,
  CRITICAL: <XCircle className="h-4 w-4 text-severity-critical" aria-hidden="true" />,
};

export function CalloutBlock({ type, children }: { type: string; children: React.ReactNode }) {
  const style = CALLOUT_STYLES[type] || CALLOUT_STYLES.NOTE;
  const icon = CALLOUT_ICONS[type] || CALLOUT_ICONS.NOTE;

  return (
    <div className={cn('my-5 flex gap-3 border-l-2 bg-card py-3 pl-4 pr-4', style)}>
      <div className="mt-1 shrink-0">{icon}</div>
      <div className="report prose prose-sm min-w-0 max-w-none">{children}</div>
    </div>
  );
}
