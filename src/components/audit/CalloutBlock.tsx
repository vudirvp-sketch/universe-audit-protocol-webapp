'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Info, AlertTriangle, Lightbulb, ShieldAlert, XCircle } from 'lucide-react';

const CALLOUT_STYLES: Record<string, string> = {
  NOTE: 'border-l-blue-500 bg-blue-500/5',
  WARNING: 'border-l-amber-500 bg-amber-500/5',
  TIP: 'border-l-emerald-500 bg-emerald-500/5',
  CAUTION: 'border-l-orange-500 bg-orange-500/5',
  CRITICAL: 'border-l-red-500 bg-red-500/5',
};

const CALLOUT_ICONS: Record<string, React.ReactNode> = {
  NOTE: <Info className="h-4 w-4 text-blue-500" />,
  WARNING: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  TIP: <Lightbulb className="h-4 w-4 text-emerald-500" />,
  CAUTION: <ShieldAlert className="h-4 w-4 text-orange-500" />,
  CRITICAL: <XCircle className="h-4 w-4 text-red-500" />,
};

export function CalloutBlock({ type, children }: { type: string; children: React.ReactNode }) {
  const style = CALLOUT_STYLES[type] || CALLOUT_STYLES.NOTE;
  const icon = CALLOUT_ICONS[type] || CALLOUT_ICONS.NOTE;

  return (
    <div className={cn('flex gap-3 rounded-r-lg border-l-4 p-4 my-4', style)}>
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div className="min-w-0 prose prose-sm dark:prose-invert max-w-none">{children}</div>
    </div>
  );
}
