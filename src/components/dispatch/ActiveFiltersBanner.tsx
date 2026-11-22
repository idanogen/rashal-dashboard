import { Filter, X } from 'lucide-react';

import type { ActiveFilter, FilterKey } from '@/lib/active-filters';

/**
 * פס "המסך מסונן" (22/11/2026). מופיע רק כשסינון פעיל, בתוך הרצועה הדביקה
 * של מסך הסדרן, כך שהוא נראה גם כשגוללים ליומן. כשאין פס, רואים הכל.
 *
 * 🔴 הרקע: עמי לא ראה את כל המידע ולא זיהה איזה סינון פעיל. סינון הקופה
 * וסינון הסוגים נזכרים בדפדפן, ולכן רענון לא עזר לו.
 */
const CHIP =
  'flex items-center gap-1 rounded-full border border-amber-300 bg-white px-2.5 py-0.5 text-xs font-medium transition-colors hover:bg-amber-100';

interface ActiveFiltersBannerProps {
  filters: ActiveFilter[];
  /** שורת המספרים: כמה מוצג מתוך כמה. ריק = לא מוצגת. */
  summary: string;
  onClear: (key: FilterKey) => void;
  onClearAll: () => void;
}

export function ActiveFiltersBanner({ filters, summary, onClear, onClearAll }: ActiveFiltersBannerProps) {
  if (filters.length === 0) return null;
  return (
    <div
      role="status"
      className="mt-2 flex basis-full flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-amber-950"
    >
      <span className="flex items-center gap-1.5 text-sm font-semibold">
        <Filter className="h-4 w-4 text-amber-700" />
        המסך מסונן
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => onClear(f.key)}
            title="בטל את הסינון הזה"
            className={CHIP}
          >
            <bdi>{f.label}</bdi>
            <X className="h-3.5 w-3.5 text-amber-700" />
          </button>
        ))}
      </div>
      {summary && <span className="text-xs tabular-nums text-amber-900/80">{summary}</span>}
      <button
        type="button"
        onClick={onClearAll}
        className="ms-auto rounded-md bg-amber-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-amber-700"
      >
        נקה הכל והצג את כל המידע
      </button>
    </div>
  );
}
