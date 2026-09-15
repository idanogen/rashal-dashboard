/**
 * רמזור קריאות השירות (עידן אישר את המוקאפ, 15/09/2026).
 *
 * הצבע מחושב במסד (`service_call_lights`), כאן רק הצורה, הסדר, התוויות
 * ומה מותר לשבץ. קובץ טהור בלי ייבוא, כדי שייבדק (`test/service-call-light.test.mjs`).
 *
 *   צהוב  = פרונטלית, הלקוח מגיע לבד · כתום = להמשך טיפול
 *   ירוק  = יש תמונה או ירוק ידני     · אדום = כל השאר
 */

export type ServiceLight = 'orange' | 'green' | 'red' | 'yellow';

export const LIGHT_ORDER: ServiceLight[] = ['orange', 'green', 'red', 'yellow'];

export const LIGHT_LABEL: Record<ServiceLight, string> = {
  orange: 'להמשך טיפול',
  green: 'מוכנות לשיבוץ',
  red: 'ממתינות לתמונה',
  yellow: 'הלקוח מגיע לבד',
};

export const LIGHT_HINT: Record<ServiceLight, string> = {
  orange: 'חזרו מהקו, הטכנאי היה אצל הלקוח וצריך סבב נוסף',
  green: 'הלקוח שלח תמונה, או עובד סימן ירוק וחתם',
  red: 'אי אפשר לשבץ עד שיש תמונה, או סימון ירוק ידני',
  yellow: 'פרונטלית בפריוריטי, לא משבצים',
};

/** אדומה "ותיקה" מעל שבועיים מקופלת (החלטת עידן, 15/09/2026). */
export const OLD_RED_DAYS = 14;

export type ManualReason = 'phone_described' | 'photo_other_channel' | 'known_fix' | 'other';

export const MANUAL_REASONS: { value: ManualReason; label: string }[] = [
  { value: 'phone_described', label: 'הלקוח תיאר את התקלה בטלפון' },
  { value: 'photo_other_channel', label: 'התמונה הגיעה בדרך אחרת (מייל, מהקופה)' },
  { value: 'known_fix', label: 'ברור מה צריך (החלפת חלק ידוע, תחזוקה)' },
  { value: 'other', label: 'אחר' },
];

export interface ServiceCallLight {
  serviceCallId: string;
  light: ServiceLight;
  openedAt?: string;
  images: number;
  videos: number;
  manual?: { by: string; at: string; reason: ManualReason; note?: string };
  touch?: { driver: string; date: string; status: string; kind?: string; note?: string };
}

type Raw = Record<string, unknown>;
const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() !== '' ? v : undefined;

export function parseLights(rows: unknown): Map<string, ServiceCallLight> {
  const out = new Map<string, ServiceCallLight>();
  for (const r of Array.isArray(rows) ? (rows as Raw[]) : []) {
    const id = str(r.service_call_id);
    const light = str(r.light) as ServiceLight | undefined;
    if (!id || !light || !LIGHT_ORDER.includes(light)) continue;
    const manualBy = str(r.manual_by);
    const driver = str(r.touch_driver);
    out.set(id, {
      serviceCallId: id,
      light,
      openedAt: str(r.opened_at),
      images: Number(r.images) || 0,
      videos: Number(r.videos) || 0,
      manual: manualBy
        ? { by: manualBy, at: String(r.manual_at ?? ''), reason: (str(r.manual_reason) ?? 'other') as ManualReason, note: str(r.manual_note) }
        : undefined,
      touch: driver
        ? { driver, date: String(r.touch_date ?? ''), status: String(r.touch_status ?? ''), kind: str(r.touch_kind), note: str(r.touch_note) }
        : undefined,
    });
  }
  return out;
}

/**
 * מותר לשבץ? ירוק וכתום כן, אדום וצהוב לא.
 * 🔴 כשהרמזור לא נטען (undefined) לא חוסמים: תקלה בשאילתה לא אמורה
 * לעצור את כל השיבוץ של היום.
 */
export function isSchedulable(light: ServiceLight | undefined): boolean {
  return light === undefined || light === 'green' || light === 'orange';
}

export function blockReason(light: ServiceLight | undefined): string | null {
  if (light === 'red') return 'אי אפשר לשבץ קריאה אדומה. צריך תמונה מהלקוח, או לסמן אותה ירוקה ידנית עם סיבה.';
  if (light === 'yellow') return 'קריאה פרונטלית: הלקוח מגיע לבד, ולא משבצים לה טכנאי.';
  return null;
}

export function daysOpen(openedAt: string | undefined, now = new Date()): number | null {
  if (!openedAt) return null;
  const t = new Date(openedAt).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / 86_400_000));
}

export function isOldRed(l: ServiceCallLight, now = new Date()): boolean {
  const d = daysOpen(l.openedAt, now);
  return l.light === 'red' && d !== null && d > OLD_RED_DAYS;
}

/** "דד/חח" מתאריך YYYY-MM-DD. */
function ddmm(date: string): string {
  const [, m, d] = date.split('-');
  return d && m ? `${d}/${m}` : date;
}

/**
 * תג "נהג כבר נגע" (עידן, 15/09/2026): מי ומתי, בכל צבע.
 * "היה אצל הלקוח" כשהגיע (בוצע או להמשך טיפול), "ניסה" כשסומן לא בוצע.
 */
export function touchLabel(t: ServiceCallLight['touch']): string | null {
  if (!t) return null;
  const when = t.date ? ` · ${ddmm(t.date)}` : '';
  if (t.status === 'not_completed' && t.kind !== 'follow_up') return `${t.driver} ניסה${when}`;
  return `${t.driver} היה אצל הלקוח${when}`;
}

export function mediaLabel(l: ServiceCallLight): string | null {
  const parts: string[] = [];
  if (l.images > 0) parts.push(l.images === 1 ? '📷 תמונה' : `📷 ${l.images} תמונות`);
  if (l.videos > 0) parts.push(l.videos === 1 ? '▶ סרטון' : `▶ ${l.videos} סרטונים`);
  return parts.length ? parts.join(' · ') : null;
}

export function manualReasonLabel(reason: ManualReason): string {
  return MANUAL_REASONS.find((r) => r.value === reason)?.label ?? 'אחר';
}

export interface LightCounts {
  orange: number;
  green: number;
  red: number;
  yellow: number;
  redWeek: number;
  redLastWeek: number;
  redOld: number;
}

export function countLights(lights: Iterable<ServiceCallLight>, now = new Date()): LightCounts {
  const c: LightCounts = { orange: 0, green: 0, red: 0, yellow: 0, redWeek: 0, redLastWeek: 0, redOld: 0 };
  for (const l of lights) {
    c[l.light]++;
    if (l.light !== 'red') continue;
    const d = daysOpen(l.openedAt, now);
    if (d === null || d <= 7) c.redWeek++;
    else if (d <= OLD_RED_DAYS) c.redLastWeek++;
    else c.redOld++;
  }
  return c;
}

/** סדר ברשימה: כתום, ירוק, אדום, צהוב; בתוך צבע, החדש קודם. */
export function compareByLight(a: ServiceCallLight | undefined, b: ServiceCallLight | undefined): number {
  const ra = a ? LIGHT_ORDER.indexOf(a.light) : LIGHT_ORDER.length;
  const rb = b ? LIGHT_ORDER.indexOf(b.light) : LIGHT_ORDER.length;
  if (ra !== rb) return ra - rb;
  return String(b?.openedAt ?? '').localeCompare(String(a?.openedAt ?? ''));
}
