import { EyeOff, Filter, X } from 'lucide-react';

import type { ActiveFilter, DefaultHiding, DefaultKey, FilterKey } from '@/lib/active-filters';

/**
 * פס "המסך מסונן" (22/11/2026), בתוך הרצועה הדביקה של מסך הסדרן, כך שהוא
 * נראה גם כשגוללים ליומן.
 *
 * 🔴 הרקע: עמי לא ראה את כל המידע ולא זיהה איזה סינון פעיל. סינון הקופה
 * וסינון הסוגים נזכרים בדפדפן, ולכן רענון לא עזר לו. עידן אחרי הפריסה:
 * "חייבים שכל הסינונים יופיעו שם". לכן שתי שורות:
 *   צהוב = מה שהמשתמש בחר (קופה, אזור, רמזור, סוגים ביומן, חיפושים), עם נקה הכל.
 *   אפור = מה שהמסך מסתיר כברירת מחדל ואף אחד לא בחר, עם "הצג" לכל אחד.
 */
const CHIP =
  'flex items-center gap-1 rounded-full border border-amber-300 bg-white px-2.5 py-0.5 text-xs font-medium transition-colors hover:bg-amber-100';
const DEFAULT_CHIP =
  'flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs text-slate-700 transition-colors hover:bg-slate-100';

interface ActiveFiltersBannerProps {
  filters: ActiveFilter[];
  /** שורת המספרים: כמה מוצג מתוך כמה. ריק = לא מוצגת. */
  summary: string;
  defaults: DefaultHiding[];
  onClear: (key: FilterKey) => void;
  onClearAll: () => void;
  onShowDefault: (key: DefaultKey) => void;
}

export function ActiveFiltersBanner({ filters, summary, defaults, onClear, onClearAll, onShowDefault }: ActiveFiltersBannerProps) {
  if (filters.length === 0 && defaults.length === 0) return null;
  const filtered = filters.length > 0;
  return (
    <div
      role="status"
      className={`mt-2 basis-full space-y-1.5 rounded-lg border px-3 py-1.5 ${
        filtered ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-slate-200 bg-slate-50 text-slate-700'
      }`}
    >
      {filtered && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <Filter className="h-4 w-4 text-amber-700" />
            המסך מסונן
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {filters.map((f) => (
              <button key={f.key} type="button" onClick={() => onClear(f.key)} title="בטל את הסינון הזה" className={CHIP}>
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
            נקה את כל הסינונים
          </button>
        </div>
      )}
      {defaults.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
          <span className="flex items-center gap-1.5 font-medium text-slate-600">
            <EyeOff className="h-3.5 w-3.5" />
            {filtered ? 'מוסתר גם כברירת מחדל:' : 'מוצג הכל, חוץ ממה שמוסתר כברירת מחדל:'}
          </span>
          {defaults.map((d) => (
            <button key={d.key} type="button" onClick={() => onShowDefault(d.key)} title="הצג גם אותן" className={DEFAULT_CHIP}>
              <bdi>{d.label}</bdi>
              <span className="rounded-full bg-slate-100 px-1.5 font-semibold tabular-nums">{d.count.toLocaleString('he-IL')}</span>
              <span className="font-semibold text-blue-700">הצג</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
