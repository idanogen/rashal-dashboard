import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCalendarStops } from './useCalendarStops';
import { geocodeStopAddress } from '@/lib/calendar-stops';
import { selectForGeocode, localDateStr } from '@/lib/geocode-backfill';

/**
 * Backfill geocoding לעצירות פעילות שעדיין אין להן נקודה מדויקת.
 * - רץ על stops בסטטוס planned / in_progress עם כתובת, **מהיום והלאה בלבד**.
 * - מדלג על עצירות שכבר עברו geocoding לאותה כתובת (geocodedAddress === address).
 * - מדלג על כתובת שנכשלה לאחרונה. ההכרעה עצמה ב-`lib/geocode-backfill.ts`.
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

    const pending = selectForGeocode(
      stops,
      localDateStr(new Date()),
      Date.now(),
      attempted.current,
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
