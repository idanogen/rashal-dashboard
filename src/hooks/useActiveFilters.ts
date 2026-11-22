import { useEffect, useMemo, useRef } from 'react';

import { activeFilters, filterSignature, filterSummary, filterTelemetry } from '@/lib/active-filters';
import type { FilterCounts, FilterState } from '@/lib/active-filters';
import { track } from '@/lib/telemetry';

const LOG_DELAY_MS = 1500;

/**
 * הסינונים הפעילים במסך הסדרן, לפס "המסך מסונן", ורישום שלהם ללוגים
 * (`app_events`, kind=action, name=filters) בכניסה למסך ובכל שינוי שנרגע.
 * כך רואים מרחוק מה מסונן אצל משתמש שמדווח שחסר לו מידע. בלי תוכן החיפוש.
 */
export function useActiveFilters(state: FilterState, counts: FilterCounts) {
  const filters = useMemo(() => activeFilters(state), [state]);
  const summary = useMemo(() => filterSummary(filters, counts), [filters, counts]);

  const signature = filterSignature(state);
  const logged = useRef<string | null>(null);
  useEffect(() => {
    // כניסה למסך בלי סינון: אין מה לרשום. חזרה ל"בלי סינון" אחרי סינון כן נרשמת.
    if (logged.current === null && activeFilters(state).length === 0) {
      logged.current = signature;
      return;
    }
    if (logged.current === signature) return;
    const id = setTimeout(() => {
      logged.current = signature;
      track('action', 'filters', filterTelemetry(state));
    }, LOG_DELAY_MS);
    return () => clearTimeout(id);
  }, [signature, state]);

  return { filters, summary };
}
