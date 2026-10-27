/**
 * Pipeline log UI.
 *
 * Two surfaces over the same event list:
 *  - `PipelineStatusLine` — one live line above the report: elapsed time, the
 *    current request, and how long ago the last event happened. This is the
 *    answer to "did it freeze?" without opening anything.
 *  - `PipelineLogSection` — the full timestamped journal inside the Inspector,
 *    with a copy button so a slow run can be reported with real numbers.
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Check, Copy, ScrollText } from 'lucide-react';
import type { PipelineLogEntry, PipelineLogLevel } from '@/lib/audit/types-v3';

/** Clipboard write with a textarea fallback for browsers that block the API. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/** 0:09.8, 1:03.4, 12:07.1 */
export function formatLogTime(ms: number): string {
  const totalSeconds = Math.max(0, ms) / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`;
}

const LEVEL_CLASS: Record<PipelineLogLevel, string> = {
  info: 'text-muted-foreground',
  warn: 'text-severity-warning',
  error: 'text-severity-critical',
};

function useSecondTick(active: boolean): void {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((value) => value + 1), 1_000);
    return () => clearInterval(id);
  }, [active]);
}

export interface PipelineStatusLineProps {
  entries: PipelineLogEntry[];
  startedAt: number | null;
  phase: 'idle' | 'running' | 'done' | 'error';
}

export function PipelineStatusLine({ entries, startedAt, phase }: PipelineStatusLineProps) {
  const isRunning = phase === 'running';
  useSecondTick(isRunning);

  const last = entries.length > 0 ? entries[entries.length - 1] : null;
  if (phase === 'idle') return null;

  const elapsedMs = startedAt ? (isRunning ? Date.now() - startedAt : (last?.at ?? 0)) : 0;
  // entries[].at is relative to the run start, so silence = elapsed - last.at.
  const quietMs = last && isRunning ? Math.max(0, elapsedMs - last.at) : 0;
  const quietSeconds = Math.floor(quietMs / 1000);

  return (
    <div
      className="mb-4 border-y border-border py-2 text-sm"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-baseline gap-3 min-w-0">
        <span
          className={cn(
            'inline-block size-2 shrink-0 rounded-[1px] translate-y-[-1px]',
            isRunning ? 'bg-severity-streaming animate-pulse' : phase === 'error' ? 'bg-severity-critical' : 'bg-severity-success',
          )}
          aria-hidden="true"
        />
        <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
          {formatLogTime(elapsedMs)}
        </span>
        {/* Одна строка вместо двух: время уже показывает «когда», поэтому
            отдельная подпись «событие записано на…» только занимала высоту. */}
        <span className="line-clamp-2 min-w-0 flex-1 break-words leading-snug">
          {last ? last.message : 'ожидание первого события…'}
        </span>
        {isRunning && quietSeconds >= 10 && (
          <span className="ml-auto shrink-0 font-mono tabular-nums text-severity-warning">
            тишина {quietSeconds} с
          </span>
        )}
      </div>
    </div>
  );
}

export function PipelineLogSection({ entries }: { entries: PipelineLogEntry[] }) {
  const [copied, setCopied] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const isLive = entries.length > 0;

  React.useEffect(() => {
    if (isLive) bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [entries.length, isLive]);

  const copy = async () => {
    const text = entries
      .map((entry) => `${formatLogTime(entry.at).padStart(6, ' ')}  ${entry.level.toUpperCase().padEnd(5, ' ')}  ${entry.message}`)
      .join('\n');
    const ok = await copyText(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <ScrollText className="h-3.5 w-3.5" aria-hidden="true" />
          Журнал пайплайна
        </h3>
        {entries.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 rounded-sm px-2 text-xs text-muted-foreground"
            onClick={() => void copy()}
          >
            {copied
              ? <Check className="h-3 w-3 mr-1" aria-hidden="true" />
              : <Copy className="h-3 w-3 mr-1" aria-hidden="true" />}
            {copied ? 'Скопировано' : 'Копировать'}
          </Button>
        )}
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Событий пока нет — журнал заполняется с началом аудита.</p>
      ) : (
        <div className="max-h-64 overflow-y-auto font-mono text-[11px] leading-relaxed">
          {entries.map((entry, index) => (
            <div
              key={`${entry.at}-${index}`}
              className="flex gap-2 border-t border-border py-1 first:border-t-0"
            >
              <span className="shrink-0 tabular-nums text-muted-foreground/70">{formatLogTime(entry.at)}</span>
              <span className={cn('break-words', LEVEL_CLASS[entry.level])}>{entry.message}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
