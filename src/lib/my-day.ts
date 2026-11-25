/**
 * החישובים של מסך "הבוקר שלי" (אילונה, 25/11/2026). קובץ טהור בלי ייבוא, נבדק ב-test/my-day.test.mjs.
 * מה ממתין נקבע במקורות של מסך הסדרן (isPendingPickup, unscheduledOrders, buildReturnedMap);
 * כאן רק סופרים ומקבצים, כדי ששני המסכים לא יחלקו על מספר.
 */
const DAY_MS = 86_400_000;

export interface WaitingSummary {
  count: number;
  /** כמה ימים מחכה הוותיק ביותר. null כשאין תאריך לאף אחד. */
  oldestDays: number | null;
  /** מתוכם, כמה חזרו מהקו (נהג סימן "לא בוצע") */
  returned: number;
}

export function waitingSummary(
  items: { id: string; created?: string | null }[],
  returnedIds: Set<string>,
  nowMs: number,
): WaitingSummary {
  let oldest: number | null = null;
  let returned = 0;
  for (const it of items) {
    if (returnedIds.has(it.id)) returned++;
    const t = it.created ? new Date(it.created).getTime() : NaN;
    if (!Number.isNaN(t) && (oldest === null || t < oldest)) oldest = t;
  }
  return {
    count: items.length,
    oldestDays: oldest === null ? null : Math.max(0, Math.floor((nowMs - oldest) / DAY_MS)),
    returned,
  };
}

export interface DayCount { planned: number; done: number; notDone: number }
export interface DriverDay { driver: string; deliveries: DayCount; pickups: DayCount }

type StopLike = { driver?: string | null; deliveryDate?: string | null; status: string; sourceType: string };

const empty = (): DayCount => ({ planned: 0, done: 0, notDone: 0 });

/** אספקות ואיסופים של יום אחד לפי נהג, הכי עמוס ראשון. עצירה בלי נהג נספרת תחת "לא משובץ לנהג". */
export function driversForDay(stops: StopLike[], date: string): DriverDay[] {
  const by = new Map<string, DriverDay>();
  for (const s of stops) {
    if (s.deliveryDate !== date) continue;
    if (s.sourceType !== 'delivery' && s.sourceType !== 'pickup') continue;
    const name = (s.driver ?? '').trim() || 'לא משובץ לנהג';
    const row = by.get(name) ?? { driver: name, deliveries: empty(), pickups: empty() };
    const c = s.sourceType === 'delivery' ? row.deliveries : row.pickups;
    if (s.status === 'completed') c.done++;
    else if (s.status === 'not_completed') c.notDone++;
    else c.planned++;
    by.set(name, row);
  }
  const total = (r: DriverDay) => sum(r.deliveries) + sum(r.pickups);
  return [...by.values()].sort((a, b) => total(b) - total(a) || a.driver.localeCompare(b.driver, 'he'));
}

export function sum(c: DayCount): number {
  return c.planned + c.done + c.notDone;
}

/** כמה תעודות ביום צריך עד סוף השבוע כדי להגיע ליעד. null כשאין ימים או שהיעד הושג. */
export function neededPerDay(target: number, actual: number, daysLeft: number): number | null {
  if (daysLeft <= 0 || actual >= target) return null;
  return Math.ceil((target - actual) / daysLeft);
}
