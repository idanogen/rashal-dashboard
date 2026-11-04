import { useMemo, useState } from 'react';
import type { CalendarStop } from '@/types/calendar-stop';
import { matchesSearch } from '@/lib/search-match';
import { matchDatesByDay, stopSearchText } from '@/lib/calendar-view';

/**
 * חיפוש ביומן (עידן, 04/11/2026): שורה משלו מעל היומן, נפרדת מחיפוש הממתינים.
 * מחזיר את העצירות שעברו את החיפוש (כולן כשאין חיפוש), ואת הימים שיש בהם תוצאות.
 */
export function useCalendarSearch(calendarStops: CalendarStop[]) {
  const [search, setSearch] = useState('');
  const searching = search.trim() !== '';
  const stops = useMemo(() => {
    const q = search.trim();
    if (!q) return calendarStops;
    return calendarStops.filter((s) => matchesSearch(stopSearchText(s), q));
  }, [calendarStops, search]);
  const totalCount = useMemo(() => calendarStops.filter((s) => s.status !== 'cancelled').length, [calendarStops]);
  const matchDates = useMemo(() => (searching ? matchDatesByDay(stops) : []), [searching, stops]);
  const matchCount = useMemo(() => matchDates.reduce((sum, d) => sum + d.count, 0), [matchDates]);
  return { search, setSearch, searching, stops, totalCount, matchDates, matchCount };
}
