import { useEffect, useMemo, useState } from 'react';
import { useCurrentProfile } from '@/hooks/useProfile';
import { useZonedOrders } from '@/hooks/useZonedOrders';
import { usePickups } from '@/hooks/usePickups';
import { useNewCustomers } from '@/hooks/useNewCustomers';
import { useCalendarStops } from '@/hooks/useCalendarStops';
import { useDeliveryNotes } from '@/hooks/useDocuments';
import { weeklyTargetFromNotes, workDaysLeft } from '@/lib/delivery-target';
import { isPendingPickup } from '@/lib/pending-pickup';
import { buildReturnedMap, returnedIdSet } from '@/lib/returned-from-route';
import { waitingSummary, driversForDay, neededPerDay } from '@/lib/my-day';
import { toLocalDateStr } from '@/lib/calendar-meta';
import { MyDayView } from '@/components/my-day/MyDayView';

/**
 * ☀️ "הבוקר שלי" (עידן 25/11/2026): המסך הראשון של אילונה כל בוקר, וגם בתפריט של עידן.
 * שלושה דברים מלמעלה למטה: היעד השבועי של החברה (147 תעודות משלוח, אותו חישוב כמו
 * בדשבורד ההנהלה), מה מחכה לשיבוץ, והאספקות של היום ומחר לפי נהג.
 * 🔴 שום כלל כאן לא מוגדר מחדש: "ממתין" ו"חזר מהקו" באים מהמקורות של מסך הסדרן.
 * הרעננות: useRealtimeSync הגלובלי (חזרה ללשונית, בדיקה תקופתית, realtime).
 */
function nextWorkDay(d: Date): Date {
  const n = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  while (n.getDay() === 5 || n.getDay() === 6) n.setDate(n.getDate() + 1);
  return n;
}

export function MyDayPage() {
  const { data: profile } = useCurrentProfile();
  const { unscheduledOrders, isLoading: ordersLoading } = useZonedOrders();
  const { data: pickups = [], isLoading: pickupsLoading } = usePickups();
  const { data: newCustomers = [], isLoading: customersLoading } = useNewCustomers();
  const { data: stops = [], isLoading: stopsLoading } = useCalendarStops();
  const { data: notes = [], isLoading: notesLoading } = useDeliveryNotes();

  // השעון ב-state ומתקדם כל דקה: קריאה לשעון בתוך הרינדור אינה טהורה, והמסך פתוח כל היום.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const now = useMemo(() => new Date(nowMs), [nowMs]);
  const today = toLocalDateStr(now);
  const tomorrowDate = useMemo(() => nextWorkDay(now), [now]);
  const tomorrow = toLocalDateStr(tomorrowDate);
  const firstName = (profile?.fullName ?? '').split(' ')[0];

  const target = useMemo(() => weeklyTargetFromNotes(notes, now), [notes, now]);
  const daysLeft = workDaysLeft(now);
  const perDay = neededPerDay(target.weekly.target, target.weekly.actual, daysLeft);

  const waiting = useMemo(() => {
    const retOrders = returnedIdSet(buildReturnedMap(stops, 'delivery'));
    const retPickups = returnedIdSet(buildReturnedMap(stops, 'pickup'));
    return {
      deliveries: waitingSummary(unscheduledOrders, retOrders, nowMs),
      pickups: waitingSummary(pickups.filter(isPendingPickup), retPickups, nowMs),
      customers: waitingSummary(
        newCustomers.filter((c) => !c.isScheduled).map((c) => ({ id: c.customerNumber, created: c.openedAt })),
        new Set(), nowMs),
    };
  }, [unscheduledOrders, pickups, newCustomers, stops, nowMs]);

  const todayRows = useMemo(() => driversForDay(stops, today), [stops, today]);
  const tomorrowRows = useMemo(() => driversForDay(stops, tomorrow), [stops, tomorrow]);

  return (
    <MyDayView
      now={now}
      firstName={firstName}
      target={target}
      daysLeft={daysLeft}
      perDay={perDay}
      notesLoading={notesLoading}
      waiting={waiting}
      waitingLoading={ordersLoading || pickupsLoading || customersLoading || stopsLoading}
      todayRows={todayRows}
      tomorrowRows={tomorrowRows}
      tomorrowDate={tomorrowDate}
      stopsLoading={stopsLoading}
    />
  );
}
