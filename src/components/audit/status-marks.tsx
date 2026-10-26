import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Маркер состояния: смысл несёт форма, цвет только подкрепляет.
 *
 *   success  — сплошная заливка
 *   warning  — заливка наполовину
 *   critical — контур
 *   neutral  — волосяной контур (нет данных)
 *
 * Используется карточкой вердикта и быстрым скринингом. Не заменяет
 * StatusIndicator блоков (ожидает / идёт / готово) — у того другая шкала.
 */
export type MarkSeverity = 'success' | 'warning' | 'critical' | 'neutral';

const MARK_CLASS: Record<MarkSeverity, string> = {
  success: 'bg-severity-success',
  warning:
    'bg-[linear-gradient(to_top,var(--severity-warning)_0_50%,transparent_50%)] ring-1 ring-inset ring-severity-warning',
  critical: 'bg-transparent ring-[1.5px] ring-inset ring-severity-critical',
  neutral: 'bg-transparent ring-1 ring-inset ring-border',
};

export function SeverityMark({
  severity,
  size = 'md',
  className,
}: {
  severity: MarkSeverity;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block shrink-0 rounded-[1px] align-[-1px]',
        size === 'sm' ? 'size-2.5' : 'size-3',
        MARK_CLASS[severity],
        className,
      )}
    />
  );
}
