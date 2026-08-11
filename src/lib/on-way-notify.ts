import type { CalendarStop } from '@/types/calendar-stop';
import { getRoadRoute } from '@/lib/directions';
import { updateStop } from '@/lib/calendar-stops';

/**
 * "הנהג בדרך אליך" — הודעה ללקוח הבא בתור ברגע שהנהג סוגר את הלקוח שלפניו.
 *
 * שלוש הבחנות שקבעו את המימוש:
 *
 * 1. זו הודעה **ללקוח**, לא לעמי. לכן היא חייבת תבנית מאושרת של מטא, ואי
 *    אפשר לשלוח אותה כטקסט חופשי מחוץ לחלון 24 השעות.
 * 2. היא נשלחת פעם אחת בלבד לכל עצירה. "העצירה הבאה" מחושבת מחדש בכל
 *    סגירה, ובלי סימון הלקוח היה מקבל הודעה חוזרת בכל פעם שנהג סוגר משהו.
 * 3. היא לא נשלחת כשהיא לא נכונה. נהג שמסיים ב-10:00 בזמן שהעצירה הבאה
 *    מתואמת ל-15:00 אינו "בדרך", והודעה כזו שורפת את אמון הלקוח בכל
 *    ההודעות שלנו.
 */

/**
 * 🔴 מציין מקום. heyy מקבל UUID ולא שם, ולכן הערך הזה נדחה בכוונה ואנחנו
 * נופלים לטקסט חופשי עד לאישור. אחרי אישור מטא — להחליף ב-UUID מ-heyy.
 * שם התבנית להגשה: driver_on_the_way
 */
export const ON_WAY_TEMPLATE = 'DEMO-driver-on-the-way';

/** כמה זמן לפני תחילת חלון התיאום סביר להגיד "אני בדרך". */
const WINDOW_LEAD_MINUTES = 90;

export type SkipReason =
  | 'no-phone'
  | 'already-notified'
  | 'too-early'
  | 'send-failed';

export interface NotifyResult {
  sent: boolean;
  stopId?: string;
  customerName?: string;
  etaMinutes?: number | null;
  skipped?: SkipReason;
  error?: string;
}

function minutesUntil(timeHHMM: string): number | null {
  const m = timeHHMM.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const now = new Date();
  const target = new Date(now);
  target.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 60000);
}

/**
 * האם מוקדם מדי לשלוח.
 *
 * עצירה בלי חלון תיאום — תמיד מותר, כי אין ציפייה סותרת אצל הלקוח.
 * עצירה עם חלון — רק כשאנחנו בתוכו או קרוב לתחילתו.
 */
export function isTooEarly(stop: CalendarStop): boolean {
  if (!stop.timeWindowStart) return false;
  const untilStart = minutesUntil(stop.timeWindowStart);
  if (untilStart === null) return false;
  return untilStart > WINDOW_LEAD_MINUTES;
}

/** הלקוח הבא בתור אצל אותו נהג באותו יום. */
export function findNextStop(
  todayStops: CalendarStop[],
  justResolvedId: string,
): CalendarStop | null {
  const idx = todayStops.findIndex((s) => s.id === justResolvedId);
  if (idx === -1) return null;
  return (
    todayStops
      .slice(idx + 1)
      .find(
        (s) =>
          s.status !== 'completed' &&
          s.status !== 'not_completed' &&
          s.status !== 'cancelled',
      ) ?? null
  );
}

/**
 * זמן נסיעה משוער מהעצירה שנסגרה אל הבאה.
 * מחזיר null כשאין קואורדינטות מדויקות לשתיהן או שהשירות לא זמין —
 * ואז ההודעה תיאמר "בקרוב" במקום מספר, כי הערכה שגויה גרועה מהיעדר הערכה.
 */
async function estimateEta(from: CalendarStop, to: CalendarStop): Promise<number | null> {
  if (from.coordinatesSource !== 'geocoded' || to.coordinatesSource !== 'geocoded') return null;
  if (!from.coordinates || !to.coordinates) return null;
  try {
    const route = await getRoadRoute([
      [from.coordinates.lat, from.coordinates.lng],
      [to.coordinates.lat, to.coordinates.lng],
    ]);
    if (!route?.durationMin) return null;
    // עיגול כלפי מעלה לחמש דקות — "כ-20 דקות" מבטיח פחות מ"17 דקות".
    return Math.max(5, Math.ceil(route.durationMin / 5) * 5);
  } catch {
    return null;
  }
}

export function buildOnWayParams(stop: CalendarStop, etaMinutes: number | null): string[] {
  const address = [stop.address, stop.city].filter(Boolean).join(', ');
  return [
    stop.customerName || 'לקוח יקר',
    etaMinutes ? `${etaMinutes} דקות` : 'זמן קצר',
    address || 'הכתובת שמסרת',
  ];
}

export function buildOnWayText(stop: CalendarStop, etaMinutes: number | null): string {
  const p = buildOnWayParams(stop, etaMinutes);
  return [
    `שלום ${p[0]}, כאן ר.שעל ציוד רפואי.`,
    `הנהג שלנו בדרך אליך ויגיע בעוד כ-${p[1]}.`,
    `כתובת: ${p[2]}`,
    'ניתן להשיב להודעה זו.',
  ].join('\n');
}

/**
 * שולח ללקוח הבא בתור. בטוח לקריאה אחרי כל סגירת עצירה: כל תנאי שלא
 * מתקיים מחזיר `skipped` ולא זורק, כדי שלעולם לא ייחסם נהג באמצע יום עבודה.
 */
export async function notifyNextCustomer(
  todayStops: CalendarStop[],
  justResolved: CalendarStop,
): Promise<NotifyResult> {
  const next = findNextStop(todayStops, justResolved.id);
  if (!next) return { sent: false };

  const base = { stopId: next.id, customerName: next.customerName };

  if (next.onWayNotifiedAt) return { ...base, sent: false, skipped: 'already-notified' };
  if (!next.phone) return { ...base, sent: false, skipped: 'no-phone' };
  if (isTooEarly(next)) return { ...base, sent: false, skipped: 'too-early' };

  const etaMinutes = await estimateEta(justResolved, next);

  try {
    const payload = {
      phoneE164: next.phone,
      reminderKind: 'custom',
      triggeredBy: `driver:${justResolved.driver}`,
    };

    let res = await fetch('/api/heyy-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        kind: 'template',
        templateId: ON_WAY_TEMPLATE,
        parameters: buildOnWayParams(next, etaMinutes),
      }),
    });
    let json = (await res.json()) as { ok?: boolean; isDemo?: boolean; error?: string };

    if (!json.ok) {
      // התבנית טרם אושרה — ניסיון בטקסט חופשי, שיעבור רק אם הלקוח כתב
      // לנו ב-24 השעות האחרונות. ברוב המקרים לא יעבור, וזה בסדר.
      res = await fetch('/api/heyy-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, kind: 'text', bodyText: buildOnWayText(next, etaMinutes) }),
      });
      json = (await res.json()) as { ok?: boolean; isDemo?: boolean; error?: string };
    }

    if (!json.ok) return { ...base, sent: false, skipped: 'send-failed', error: json.error };

    // מסמנים רק אחרי שליחה מוצלחת, אחרת נאבד את ההודעה לגמרי.
    await updateStop(next.id, {
      onWayNotifiedAt: new Date().toISOString(),
      onWayEtaMinutes: etaMinutes ?? undefined,
    });

    return { ...base, sent: true, etaMinutes };
  } catch (e) {
    return { ...base, sent: false, skipped: 'send-failed', error: e instanceof Error ? e.message : String(e) };
  }
}
