'use client';

/**
 * ChecklistScoreCard — detailed 52-item checklist with PASS/FAIL/INSUFFICIENT_DATA badges.
 * Supports filtering by level and status.
 * Uses semantic severity color tokens (Section 11.4).
 * Typography updated per Section 1.3.
 */

import * as React from 'react';
import type { ChecklistScoreResult } from '@/lib/audit/types-v3';
import { Badge } from '@/components/ui/badge';

interface ChecklistScoreCardProps {
  score: ChecklistScoreResult;
}

// ============================================================
// Status badge colors — uses severity tokens
// ============================================================

function StatusBadge({ status }: { status: 'PASS' | 'FAIL' | 'INSUFFICIENT_DATA' }) {
  const variants: Record<string, string> = {
    PASS: 'bg-severity-success/10 text-severity-success',
    FAIL: 'bg-severity-critical/10 text-severity-critical',
    INSUFFICIENT_DATA: 'bg-muted text-muted-foreground',
  };

  const labels: Record<string, string> = {
    PASS: 'PASS',
    FAIL: 'FAIL',
    INSUFFICIENT_DATA: 'Н/Д',
  };

  return (
    <Badge variant="outline" className={`text-xs font-mono ${variants[status]}`}>
      {labels[status]}
    </Badge>
  );
}

// ============================================================
// Collapsible evidence row
// ============================================================

function ChecklistRow({ item }: { item: { id: string; text: string; level: string; status: 'PASS' | 'FAIL' | 'INSUFFICIENT_DATA'; evidence: string } }) {
  const [expanded, setExpanded] = React.useState(false);
  const hasEvidence = item.evidence.trim().length > 0;

  return (
    <>
      <tr className="border-b hover:bg-muted/30">
        <td className="py-1.5 px-1 font-mono text-xs">{item.id}</td>
        <td className="py-1.5 px-1 text-sm">{item.text}</td>
        <td className="py-1.5 px-1 text-sm text-muted-foreground">{item.level}</td>
        <td className="py-1.5 px-1"><StatusBadge status={item.status} /></td>
        <td className="py-1.5 px-1 text-sm">
          {hasEvidence ? (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline decoration-dotted underline-offset-2"
            >
              {expanded ? 'скрыть' : 'показать'}
            </button>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
      </tr>
      {expanded && hasEvidence && (
        <tr className="border-b bg-muted/10">
          <td colSpan={5} className="py-2 px-3 text-sm text-muted-foreground italic">
            {item.evidence}
          </td>
        </tr>
      )}
    </>
  );
}

// ============================================================
// Main component
// ============================================================

export function ChecklistScoreCard({ score }: ChecklistScoreCardProps) {
  const [levelFilter, setLevelFilter] = React.useState<string>('all');
  const [statusFilter, setStatusFilter] = React.useState<Set<string>>(new Set());

  const items = score.items.filter(item => {
    if (!item.applicable) return false;
    if (levelFilter !== 'all') {
      if (!item.level.startsWith(levelFilter)) return false;
    }
    if (statusFilter.size > 0 && !statusFilter.has(item.status)) return false;
    return true;
  });

  const toggleStatus = (status: string) => {
    setStatusFilter(prev => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  return (
    <div className="border rounded-lg p-6">
      <div className="text-base font-semibold mb-3">Чеклист ({score.fulfilled}/{score.totalApplicable})</div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {/* Level tabs */}
        <div className="flex gap-1">
          {['all', 'L1', 'L2', 'L3', 'L4'].map(level => (
            <button
              key={level}
              onClick={() => setLevelFilter(level)}
              className={`px-2 py-1 text-sm rounded transition-colors ${
                levelFilter === level
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {level === 'all' ? 'Все' : level}
            </button>
          ))}
        </div>

        {/* Status toggles */}
        <div className="flex gap-1 ml-2">
          {(['PASS', 'FAIL', 'INSUFFICIENT_DATA'] as const).map(status => (
            <button
              key={status}
              onClick={() => toggleStatus(status)}
              className={`px-2 py-1 text-sm rounded transition-colors border ${
                statusFilter.has(status)
                  ? status === 'PASS'
                    ? 'bg-severity-success/10 border-severity-success/40'
                    : status === 'FAIL'
                    ? 'bg-severity-critical/10 border-severity-critical/40'
                    : 'bg-muted border-muted'
                  : 'bg-transparent border-muted hover:bg-muted/50'
              }`}
            >
              {status === 'INSUFFICIENT_DATA' ? 'Н/Д' : status}
            </button>
          ))}
        </div>
      </div>

      {/* Items table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-1 w-12 text-sm font-medium">ID</th>
              <th className="text-left py-2 px-1 text-sm font-medium">Критерий</th>
              <th className="text-left py-2 px-1 w-14 text-sm font-medium">Уровень</th>
              <th className="text-left py-2 px-1 w-20 text-sm font-medium">Статус</th>
              <th className="text-left py-2 px-1 w-20 text-sm font-medium">Доказательство</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <ChecklistRow key={item.id} item={item} />
            ))}
          </tbody>
        </table>
      </div>

      {items.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Нет элементов для выбранных фильтров
        </p>
      )}
    </div>
  );
}
