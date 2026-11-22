import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CalendarStopSource } from '@/types/delivery';

/** סינון היומן לפי סוג פעילות. נזכר בדפדפן לכל משתמש (המפתח הוא חוזה, לא לשנות). */
const CALENDAR_FILTER_KEY = 'rashal:calendarTypeFilter';

export const ALL_SOURCE_TYPES: CalendarStopSource[] = ['delivery', 'service', 'pickup', 'task', 'customer'];

export const SOURCE_TYPE_LABEL: Record<string, string> = {
  delivery: 'משלוחים',
  service: 'שירות',
  pickup: 'איסופים',
  task: 'משימות',
  customer: 'לקוחות חדשים',
};

function loadCalendarFilter(): Set<CalendarStopSource> {
  try {
    const raw = localStorage.getItem(CALENDAR_FILTER_KEY);
    if (!raw) return new Set(ALL_SOURCE_TYPES);
    const parsed = JSON.parse(raw) as string[];
    const valid = parsed.filter((t): t is CalendarStopSource => (ALL_SOURCE_TYPES as string[]).includes(t));
    return valid.length > 0 ? new Set(valid) : new Set(ALL_SOURCE_TYPES);
  } catch {
    return new Set(ALL_SOURCE_TYPES);
  }
}

export function useCalendarTypeFilter() {
  const [visibleTypes, setVisibleTypes] = useState<Set<CalendarStopSource>>(loadCalendarFilter);
  useEffect(() => {
    try {
      localStorage.setItem(CALENDAR_FILTER_KEY, JSON.stringify([...visibleTypes]));
    } catch {
      // אחסון חסום: הסינון חי בזיכרון בלבד.
    }
  }, [visibleTypes]);

  const toggleType = useCallback((t: CalendarStopSource) => {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      // לא מאפשרים להסתיר את הכל: תמיד נשאר לפחות סוג אחד
      return next.size === 0 ? new Set(ALL_SOURCE_TYPES) : next;
    });
  }, []);
  const showAllTypes = useCallback(() => setVisibleTypes(new Set(ALL_SOURCE_TYPES)), []);
  const hiddenTypeLabels = useMemo(
    () => ALL_SOURCE_TYPES.filter((t) => !visibleTypes.has(t)).map((t) => SOURCE_TYPE_LABEL[t]),
    [visibleTypes]
  );
  return { visibleTypes, toggleType, showAllTypes, hiddenTypeLabels, allTypesVisible: hiddenTypeLabels.length === 0 };
}
