import { ClipboardList, Package, Undo2, UserPlus, Wrench } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ALL_SOURCE_TYPES, SOURCE_TYPE_LABEL } from '@/hooks/useCalendarTypeFilter';
import type { CalendarStopSource } from '@/types/delivery';

/** צ'יפי "מציג ביומן": הצגה והסתרה של סוג פעילות ביומן. הוצא מ-DispatchPage ב-22/11/2026. */
const OFF = 'bg-muted text-muted-foreground/60 border-transparent';
const CHIP_META: Record<string, { Icon: typeof Package; on: string }> = {
  delivery: { Icon: Package, on: 'bg-blue-50 text-blue-700 border-blue-200' },
  service: { Icon: Wrench, on: 'bg-orange-50 text-orange-700 border-orange-200' },
  pickup: { Icon: Undo2, on: 'bg-teal-50 text-teal-700 border-teal-200' },
  task: { Icon: ClipboardList, on: 'bg-amber-50 text-amber-700 border-amber-200' },
  customer: { Icon: UserPlus, on: 'bg-violet-50 text-violet-700 border-violet-200' },
};

interface CalendarTypeChipsProps {
  visibleTypes: Set<CalendarStopSource>;
  counts: Record<string, number>;
  onToggle: (t: CalendarStopSource) => void;
  onShowAll: () => void;
}

export function CalendarTypeChips({ visibleTypes, counts, onToggle, onShowAll }: CalendarTypeChipsProps) {
  const partial = visibleTypes.size < ALL_SOURCE_TYPES.length;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">
        מציג ביומן
        {partial && (
          <span className="text-amber-700">
            {' '}
            ({visibleTypes.size} מתוך {ALL_SOURCE_TYPES.length} סוגים)
          </span>
        )}
        :
      </span>
      {ALL_SOURCE_TYPES.map((t) => {
        const meta = CHIP_META[t];
        const label = SOURCE_TYPE_LABEL[t];
        const on = visibleTypes.has(t);
        const count = counts[t] ?? 0;
        return (
          <button
            key={t}
            type="button"
            onClick={() => onToggle(t)}
            className={cn(
              'flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
              on ? meta.on : OFF
            )}
            title={on ? `הסתר ${label} מהיומן` : `הצג ${label} ביומן`}
          >
            <meta.Icon className="h-3.5 w-3.5" />
            {label}
            {count > 0 && <span className="opacity-70">({count})</span>}
          </button>
        );
      })}
      {partial && (
        <button
          type="button"
          onClick={onShowAll}
          className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100"
          title="החזר את היומן להצגת כל הסוגים"
        >
          הצג הכל
        </button>
      )}
    </div>
  );
}
