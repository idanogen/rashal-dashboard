import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCalendarStops } from './useCalendarStops';
import { geocodeStopAddress } from '@/lib/calendar-stops';

/**
 * Backfill geocoding לעצירות פעילות שעדיין אין להן נקודה מדויקת.
 * - רץ על stops בסטטוס planned / in_progress עם כתובת.
 * - מדלג על עצירות שכבר עברו geocoding לאותה כתובת (geocodedAddress === address).
 * - התור ב-geocodeAddress מווסת את הקצב (~1 בקשה/שנייה, מדיניות Nominatim).
 * - useRef<Set> מונע ירי כפול על אותה עצירה בין refetches.
 *
 * מותקן פעם אחת ברמת הדף (DeliveriesPage).
 */
export function useGeocodeBackfill() {
  const { data: stops } = useCalendarStops();
  const queryClient = useQueryClient();
  const attempted = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!stops || stops.length === 0) return;

    const pending = stops.filter(
      (s) =>
        (s.status === 'planned' || s.status === 'in_progress') &&
        s.address &&
        s.address.trim() &&
        // עדיין אין geocode מדויק לכתובת הנוכחית
        s.geocodedAddress !== s.address &&
        !attempted.current.has(s.id)
    );
    if (pending.length === 0) return;

    let cancelled = false;
    (async () => {
      let anySaved = false;
      for (const stop of pending) {
        if (cancelled) break;
        attempted.current.add(stop.id);
        const ok = await geocodeStopAddress({
          id: stop.id,
          address: stop.address,
          city: stop.city,
        });
        if (ok) anySaved = true;
      }
      if (!cancelled && anySaved) {
        queryClient.invalidateQueries({ queryKey: ['calendarStops'] });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [stops, queryClient]);
}
