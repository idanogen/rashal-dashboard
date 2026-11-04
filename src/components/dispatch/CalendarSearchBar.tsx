import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { railJumpToDay } from '@/lib/dispatch-rail-store';
import { orderMatchDates } from '@/lib/calendar-view';
import { toLocalDateStr } from '@/lib/calendar-meta';

/**
 * שורת חיפוש מעל היומן (עידן, 04/11/2026). החיפוש העליון מסנן את הממתינים
 * לשיבוץ; זו מסננת את מה שכבר משובץ ביומן. היומן מציג שבוע אחד, ולכן השורה
 * מציגה גם את הימים שיש בהם תוצאות, ולחיצה על יום מקפיצה את היומן אליו.
 */
export interface CalendarSearchBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  matchCount: number;
  totalCount: number;
  matchDates: { date: string; count: number }[];
}

const DAY_NAMES = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

function dayLabel(date: string): string {
  const d = new Date(date + 'T12:00:00');
  return `${DAY_NAMES[d.getDay()]}' ${d.getDate()}/${d.getMonth() + 1}`;
}

export function CalendarSearchBar({ search, onSearchChange, matchCount, totalCount, matchDates }: CalendarSearchBarProps) {
  const active = search.trim() !== '';
  const shownDates = orderMatchDates(matchDates, toLocalDateStr(new Date())).slice(0, 8);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2 shadow-sm">
      <div className="relative min-w-[240px] flex-1">
        <Search className="pointer-events-none absolute end-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="חיפוש ביומן: שם, מספר לקוח, טלפון, כתובת, עיר, עובד, הערה"
          className="h-9 pe-9"
          aria-label="חיפוש ביומן"
        />
        {active && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute start-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            title="נקה חיפוש ביומן"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {active && (
        <>
          <Badge variant={matchCount === 0 ? 'destructive' : 'secondary'} className="h-7 px-2 text-xs">
            {matchCount === 0 ? 'אין עצירות ביומן' : `${matchCount} מתוך ${totalCount} עצירות`}
          </Badge>
          {shownDates.map((d) => (
            <button
              key={d.date}
              type="button"
              onClick={() => railJumpToDay(d.date)}
              className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800
                transition-colors hover:bg-emerald-100"
              title={`קפוץ ליום ${dayLabel(d.date)} ביומן`}
            >
              {dayLabel(d.date)} <span className="opacity-70">({d.count})</span>
            </button>
          ))}
          {matchDates.length > shownDates.length && (
            <span className="text-xs text-muted-foreground">ועוד {matchDates.length - shownDates.length} ימים</span>
          )}
        </>
      )}
    </div>
  );
}
