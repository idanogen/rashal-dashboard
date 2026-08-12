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
    address: s.address,
    city: s.city,
    phone: s.phone,
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
