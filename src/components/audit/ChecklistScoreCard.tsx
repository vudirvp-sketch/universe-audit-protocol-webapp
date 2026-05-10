'use client';

/**
 * ChecklistScoreCard — detailed 52-item checklist with PASS/FAIL/INSUFFICIENT_DATA badges.
 * Supports filtering by level and status.
 */

import * as React from 'react';
import type { ChecklistScoreResult } from '@/lib/audit/types-v3';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ChecklistScoreCardProps {
  score: ChecklistScoreResult;
}

// ============================================================
// Status badge colors
// ============================================================

function StatusBadge({ status }: { status: 'PASS' | 'FAIL' | 'INSUFFICIENT_DATA' }) {
  const variants: Record<string, string> = {
    PASS: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    FAIL: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    INSUFFICIENT_DATA: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
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
// Main component
// ============================================================

export function ChecklistScoreCard({ score }: ChecklistScoreCardProps) {
  const [levelFilter, setLevelFilter] = React.useState<string>('all');
  const [statusFilter, setStatusFilter] = React.useState<Set<string>>(new Set());

  const items = score.items.filter(item => {
    if (!item.applicable) return false;
    if (levelFilter !== 'all') {
      // Handle "L1/L2" by matching the start
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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Чеклист ({score.fulfilled}/{score.totalApplicable})</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          {/* Level tabs */}
          <div className="flex gap-1">
            {['all', 'L1', 'L2', 'L3', 'L4'].map(level => (
              <button
                key={level}
                onClick={() => setLevelFilter(level)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
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
                className={`px-2 py-1 text-xs rounded transition-colors border ${
                  statusFilter.has(status)
                    ? status === 'PASS'
                      ? 'bg-green-100 border-green-400 dark:bg-green-900 dark:border-green-600'
                      : status === 'FAIL'
                      ? 'bg-red-100 border-red-400 dark:bg-red-900 dark:border-red-600'
                      : 'bg-gray-100 border-gray-400 dark:bg-gray-800 dark:border-gray-600'
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
                <th className="text-left py-2 px-1 w-12">ID</th>
                <th className="text-left py-2 px-1">Критерий</th>
                <th className="text-left py-2 px-1 w-14">Уровень</th>
                <th className="text-left py-2 px-1 w-20">Статус</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="border-b hover:bg-muted/30">
                  <td className="py-1.5 px-1 font-mono text-xs">{item.id}</td>
                  <td className="py-1.5 px-1 text-xs">{item.text}</td>
                  <td className="py-1.5 px-1 text-xs text-muted-foreground">{item.level}</td>
                  <td className="py-1.5 px-1"><StatusBadge status={item.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {items.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Нет элементов для выбранных фильтров
          </p>
        )}
      </CardContent>
    </Card>
  );
}
