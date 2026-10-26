import * as React from 'react';
import type { ChecklistScoreResult } from '@/lib/audit/types-v3';
import { cn } from '@/lib/utils';
import { CELL_LABEL, StatusMark, type CellStatus } from './status-marks';

const LEVELS = [
  { key: 'L1', name: 'Механизм' },
  { key: 'L2', name: 'Тело' },
  { key: 'L3', name: 'Психика' },
  { key: 'L4', name: 'Мета' },
] as const;

const CELL_CLASS: Record<CellStatus, string> = {
  PASS: 'bg-severity-success',
  FAIL: 'ring-[1.5px] ring-inset ring-severity-critical',
  INSUFFICIENT_DATA:
    'bg-[repeating-linear-gradient(45deg,var(--border)_0_2px,transparent_2px_4px)] ring-1 ring-inset ring-border',
};

function countByStatus(items: ChecklistScoreResult['items']) {
  const c: Record<CellStatus, number> = { PASS: 0, FAIL: 0, INSUFFICIENT_DATA: 0 };
  for (const i of items) c[i.status] += 1;
  return c;
}

/** Одна клетка на критерий чек-листа, строка на уровень. */
export function CriteriaStrip({ score }: { score: ChecklistScoreResult }) {
  const applicable = score.items.filter((i) => i.applicable);
  const total = countByStatus(applicable);
  // Столбцов ровно столько, сколько критериев у самого длинного уровня:
  // строки уровней выравниваются по одной сетке, короткие просто кончаются раньше.
  // На узком экране — фиксированные 20 столбцов, иначе клетки вырождаются в волос.
  const maxCells = Math.max(1, ...LEVELS.map(({ key }) => applicable.filter((i) => i.level.startsWith(key)).length));

  return (
    <div>
      <div className="space-y-2.5">
        {LEVELS.map(({ key, name }) => {
          const items = applicable.filter((i) => i.level.startsWith(key));
          if (items.length === 0) return null;
          const c = countByStatus(items);
          return (
            <div key={key} className="grid grid-cols-[2.75rem_1fr_3.25rem] items-center gap-3 sm:grid-cols-[7rem_1fr_4rem]">
              <div className="text-sm">
                <span className="font-semibold">{key}</span>
                <span className="ml-1.5 hidden text-muted-foreground sm:inline">{name}</span>
              </div>
              <ul
                className="grid min-w-0 grid-cols-[repeat(20,minmax(0,1fr))] gap-[2px] xl:grid-cols-[repeat(var(--cells),minmax(0,1fr))]"
                style={{ '--cells': maxCells } as React.CSSProperties}
                aria-label={`${key} ${name}: выполнено ${c.PASS} из ${items.length}`}
              >
                {items.map((item) => (
                  <li
                    key={item.id}
                    title={`${item.id}. ${item.text} — ${CELL_LABEL[item.status]}`}
                    className={cn('h-[18px] rounded-[1px]', CELL_CLASS[item.status])}
                  />
                ))}
              </ul>
              <div className="text-right text-sm tabular-nums text-muted-foreground">
                {c.PASS} из {items.length}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
        {(['PASS', 'FAIL', 'INSUFFICIENT_DATA'] as const).map((s) => (
          <span key={s} className="inline-flex items-center gap-2">
            <StatusMark status={s} />
            {CELL_LABEL[s].toLowerCase()} <span className="tabular-nums text-foreground">{total[s]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
