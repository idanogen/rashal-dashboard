import type { CalendarStop as DbStop } from '@/types/calendar-stop';
import type { CalendarDelivery } from '@/types/delivery';
import type { AssigneeName } from '@/types/route';

/**
 * בונה את תצוגת היומן המאוחדת מכל עצירות ה-calendar_stops.
 * מקבץ לפי יום × משובץ, ומדלג על עצירות מבוטלות.
 *
 * ברירת המחדל: **כל הסוגים יחד** (משלוחים + שירות + איסופים + משימות) —
 * כדי שהיומן התחתון בכל מסך יראה את כל הקווים. אפשר לצמצם עם `filter`.
 */
/**
 * המרה של עצירה בודדת מטיפוס ה-DB לטיפוס התצוגה.
 * הופרדה כדי שאפשר יהיה לפתוח דיאלוג על עצירה שזה עתה נוצרה, בלי להמתין
 * למשיכה מחדש של כל היומן.
 */
export function toViewStop(s: DbStop) {
  return {
    stopId: s.id,
    sourceId: s.orderId ?? s.serviceCallId ?? s.pickupId ?? s.id,
    sourceType: s.sourceType,
    status: s.status,
    deliveryDate: s.deliveryDate,
    driver: s.driver as AssigneeName,
    customerName: s.customerName,
    customerNumber: s.customerNumber,
    address: s.address,
    city: s.city,
    phone: s.phone,
    phoneExtra: s.phoneExtra,
    originalAddress: s.originalAddress,
    originalCity: s.originalCity,
    coordinates: s.coordinates,
    coordinatesSource: s.coordinatesSource,
    coordinationStatus: s.coordinationStatus,
    coordinationMethod: s.coordinationMethod,
    coordinatedAt: s.coordinatedAt,
    timeWindowStart: s.timeWindowStart,
    timeWindowEnd: s.timeWindowEnd,
    coordinationNeedsCancel: s.coordinationNeedsCancel,
    scheduledBy: s.scheduledBy,
    rescheduledBy: s.rescheduledBy,
    rescheduledAt: s.rescheduledAt,
    // ההערה של המשרד (תיאום, שיבוץ), כדי שדיאלוג התיאום ייפתח איתה ולא ידרוס אותה.
    notes: s.notes,
    // עצירות שנסגרו לפני 23/08/2026 מחזיקות את הסיבה ב-notes,
    // אותו fallback כמו buildReturnedMap.
    resolutionNote: s.resolutionNote ?? s.notes,
    resolutionKind: s.resolutionKind,
  };
}

export function buildCalendarDeliveries(
  stops: DbStop[],
  filter?: (s: DbStop) => boolean
): CalendarDelivery[] {
  const groups = new Map<string, CalendarDelivery>();
  for (const s of stops) {
    if (s.status === 'cancelled') continue;
    if (filter && !filter(s)) continue;
    const key = `${s.deliveryDate}__${s.driver}`;
    let group = groups.get(key);
    if (!group) {
      group = { id: key, date: s.deliveryDate, driver: s.driver as AssigneeName, stops: [] };
      groups.set(key, group);
    }
    group.stops.push(toViewStop(s));
  }
  return Array.from(groups.values());
}

/**
 * מחרוזת חיפוש אחת לעצירה ביומן, לשורת החיפוש שמעל היומן (עידן, 04/11/2026).
 * כל השדות שהסדרן עשוי לזכור: שם, מספר לקוח, טלפונים, כתובת (גם המקורית),
 * עיר, מי משובץ, תיאור המשימה ומה שנרשם בסגירה. ההתאמה עצמה ב-`matchesSearch`.
 */
export function stopSearchText(s: DbStop): string {
  return [
    s.customerName,
    s.customerNumber,
    s.phone,
    s.phoneExtra,
    s.address,
    s.city,
    s.originalAddress,
    s.originalCity,
    s.driver,
    s.notes,
    s.resolutionNote,
  ]
    .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
    .join(' ');
}

/** הימים שיש בהם תוצאות חיפוש (בלי מבוטלות), ממוינים, לקפיצה מהשורה אל העמודה. */
export function matchDatesByDay(stops: DbStop[]): { date: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const s of stops) {
    if (s.status === 'cancelled') continue;
    counts.set(s.deliveryDate, (counts.get(s.deliveryDate) ?? 0) + 1);
  }
  return Array.from(counts, ([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * סדר הצ'יפים של ימי התוצאות: היום והבאים קודם (עולה), ואחריהם העבר (מהקרוב לרחוק).
 * בלי זה שמונה הצ'יפים הראשונים היו מאפריל, ו"ועוד 44 ימים" החביא את השבוע הזה.
 */
export function orderMatchDates<T extends { date: string }>(dates: T[], today: string): T[] {
  const upcoming = dates.filter((d) => d.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = dates.filter((d) => d.date < today).sort((a, b) => b.date.localeCompare(a.date));
  return [...upcoming, ...past];
}
