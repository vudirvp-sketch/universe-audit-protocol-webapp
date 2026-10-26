'use client';

/**
 * ChecklistScoreCard — detailed 52-item checklist with PASS/FAIL/INSUFFICIENT_DATA badges.
 * Supports filtering by level and status.
 * Uses semantic severity color tokens (Section 11.4).
 * Typography updated per Section 1.3.
 */

import * as React from 'react';
import type { ChecklistScoreResult } from '@/lib/audit/types-v3';
import { CELL_LABEL, StatusLabel, StatusMark } from './status-marks';
import { t } from '@/lib/i18n/ru';

interface ChecklistScoreCardProps {
  score: ChecklistScoreResult;
}

// ============================================================
// Collapsible evidence row
// ============================================================

function ChecklistRow({ item }: { item: { id: string; text: string; level: string; status: 'PASS' | 'FAIL' | 'INSUFFICIENT_DATA'; evidence: string } }) {
  const [expanded, setExpanded] = React.useState(false);
  const hasEvidence = item.evidence.trim().length > 0;

  return (
    <>
      <tr className="border-b hover:bg-accent/40">
        <td className="hidden py-2 px-1 text-sm font-semibold tabular-nums text-muted-foreground lg:table-cell">{item.id}</td>
        <td className="py-2 px-1 text-sm">{item.text}</td>
        <td className="hidden py-2 px-1 text-sm text-muted-foreground lg:table-cell">{item.level}</td>
        <td className="py-2 px-1 whitespace-nowrap"><StatusLabel status={item.status} compact /></td>
        <td className="py-2 px-1 text-sm">
          {hasEvidence ? (
            <button
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
              className="inline-flex min-h-8 items-center text-[#8fc4dd] hover:text-foreground underline underline-offset-4 rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
            >
              {expanded ? t.score.evidenceHide : t.score.evidenceShow}
            </button>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
      </tr>
      {expanded && hasEvidence && (
        <tr className="border-b bg-card">
          <td colSpan={5} className="py-2 px-3 text-sm text-muted-foreground">
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
    <section className="mb-12" aria-labelledby="checklist-title">
      <h2 id="checklist-title" className="mb-4 text-xl font-semibold">{t.score.checklist}</h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {/* Level tabs */}
        <div className="flex gap-1">
          {['all', 'L1', 'L2', 'L3', 'L4'].map(level => (
            <button
              key={level}
              onClick={() => setLevelFilter(level)}
              aria-pressed={levelFilter === level}
              className={`px-3 py-1.5 text-sm rounded-sm border transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
                levelFilter === level
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-transparent border-input hover:bg-accent'
              }`}
            >
              {level === 'all' ? t.score.filterAll : level}
            </button>
          ))}
        </div>

        {/* Status toggles */}
        <div className="flex flex-wrap gap-1 sm:ml-3">
          {(['PASS', 'FAIL', 'INSUFFICIENT_DATA'] as const).map(status => (
            <button
              key={status}
              onClick={() => toggleStatus(status)}
              aria-pressed={statusFilter.has(status)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-sm border transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
                statusFilter.has(status) ? 'bg-accent border-ring' : 'bg-transparent border-input hover:bg-accent/60'
              }`}
            >
              <StatusMark status={status} />
              {CELL_LABEL[status]}
            </button>
          ))}
        </div>
      </div>

      {/* Items table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="hidden text-left py-2 px-1 w-12 text-sm font-medium lg:table-cell">ID</th>
              <th className="text-left py-2 px-1 text-sm font-medium">{t.score.criteriaCol}</th>
              <th className="hidden text-left py-2 px-1 w-14 text-sm font-medium lg:table-cell">{t.score.levelCol}</th>
              <th className="text-left py-2 px-1 w-20 text-sm font-medium">{t.score.statusCol}</th>
              <th className="text-left py-2 px-1 w-20 text-sm font-medium">{t.score.evidenceCol}</th>
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
          {t.score.noItems}
        </p>
      )}
    </section>
  );
}
