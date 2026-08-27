import type { CalendarStop, StopResolutionKind } from '@/types/calendar-stop';

/**
 * "חזר מהקו" — מי חזר, **ולמה**.
 *
 * 🔴 **הבאג שהוליד את הקובץ (עמי, 19/08/2026):** נהג שמסמן עצירה כ"לא בוצע"
 * חייב לרשום סיבה (`NotCompletedReasonDialog` חוסם בלי טקסט), הסיבה נשמרת
 * ב-`calendar_stops.notes`, **והיא הוצגה רק בדשבורד של הנהג עצמו**. המנהל
 * ראה תג אדום "חזר מהקו" וזהו, בלי מילה אחת ממה שהנהג כתב. כלומר המערכת
 * דרשה מהנהג לדווח ואז בלעה את הדיווח.
 *
 * ⭐ ולכן ההחזרה כאן היא **אובייקט ולא `Set`**: כל מסך שיודע מי חזר יודע
 * מעכשיו גם למה, ואי אפשר להוסיף את החיווי בלי הסיבה שנוסעת איתו.
 */

export interface ReturnedInfo {
  /** מזהה העצירה שסומנה "לא בוצע" */
  stopId: string;
  /** מה שהנהג כתב. `null` רק בעצירות ישנות שנסגרו לפני שהשדה נאכף. */
  note: string | null;
  /** מי סימן */
  driver: string;
  /** תאריך הקו, YYYY-MM-DD */
  deliveryDate: string;
  /**
   * ⭐ **"לא הגיע" מול "הגיע וצריך המשך" הן שתי בקשות שונות מהמשרד**,
   * ולכן הן נוסעות עד המסך ולא נבלעות תחת תג אחד.
   * ריק בעצירות שנסגרו לפני 27/08/2026.
   */
  kind?: StopResolutionKind;
}

export type ReturnedSource = 'delivery' | 'service' | 'pickup';

/** השדה שמחזיק את מפתח הישות המקורית, לפי סוג העצירה. */
const ENTITY_KEY = {
  delivery: 'orderId',
  service: 'serviceCallId',
  pickup: 'pickupId',
} as const;

/**
 * ממפה ישות ⟵ החזרה האחרונה שלה מהקו.
 *
 * 🔴 **האחרונה, לא הראשונה.** לקוח שנוסו אצלו שני ניסיונות מחזיק שתי
 * עצירות "לא בוצע", והסיבה הרלוונטית היא של הניסיון האחרון. מיון לפי
 * תאריך הקו, ובאותו יום לפי שעת הסימון.
 */
export function buildReturnedMap(
  stops: CalendarStop[],
  source: ReturnedSource,
): Map<string, ReturnedInfo> {
  const key = ENTITY_KEY[source];
  const out = new Map<string, ReturnedInfo>();

  for (const stop of stops) {
    if (stop.status !== 'not_completed' || stop.sourceType !== source) continue;
    const id = stop[key];
    if (!id) continue;

    const prev = out.get(id);
    if (prev && !isNewer(stop, prev, stops)) continue;

    out.set(id, {
      stopId: stop.id,
      kind: stop.resolutionKind,
      // 🔴 `resolutionNote` קודם, ו-`notes` הוא נפילה לאחור להיסטוריה:
      // עד 23/08/2026 הסיבה נכתבה לתוך `notes`, ולכן עצירות ישנות
      // מחזיקות אותה שם ואין להן `resolutionNote`.
      note: stop.resolutionNote?.trim() || stop.notes?.trim() || null,
      driver: stop.driver,
      deliveryDate: stop.deliveryDate,
    });
  }
  return out;
}

/** האם `stop` מאוחר מהעצירה שכבר נבחרה עבור אותה ישות. */
function isNewer(stop: CalendarStop, prev: ReturnedInfo, stops: CalendarStop[]): boolean {
  if (stop.deliveryDate !== prev.deliveryDate) return stop.deliveryDate > prev.deliveryDate;
  // אותו יום: מכריעים לפי שעת הסימון, וחסר נחשב מוקדם.
  const prevStop = stops.find((s) => s.id === prev.stopId);
  return (stop.completedAt ?? '') > (prevStop?.completedAt ?? '');
}

/** `Set` של המפתחות, למסכים שמסננים בלבד ולא מציגים את הסיבה. */
export function returnedIdSet(map: Map<string, ReturnedInfo>): Set<string> {
  return new Set(map.keys());
}

/** "דוד · 19/08" — מי סימן ומתי, לשורה שמעל הסיבה. */
export function returnedMeta(info: ReturnedInfo): string {
  const [, m, d] = info.deliveryDate.split('-');
  return d && m ? `${info.driver} · ${d}/${m}` : info.driver;
}
