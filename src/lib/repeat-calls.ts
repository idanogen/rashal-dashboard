/**
 * קריאות חוזרות, וקריאות שנשארו פתוחות יותר מדי זמן.
 *
 * ⭐ **קובץ נפרד ובלי שום ייבוא, ולכן נבדק ביחידה.** `management-metrics`
 * מייבא טיפוסים דרך הכינוי `@/`, ש-Node אינו יודע לפתור, ולכן כל מה
 * שרוצים לבדוק חייב לשבת בקובץ עצמאי. זה בדיוק הדפוס של
 * `coordination-message` ו-`survey-badge`.
 *
 * 🔴🔴 **וההכרעה שמוגנת כאן היא לא החישוב אלא ההגדרה.**
 * שלומי, 20/08: "אם יש לי מישהו שכבר חוזר אני רוצה לדעת מזה."
 * עידן, 26/08: פרונטליות בלבד. ⭐ ולא במקרה: נמדד ב-90 יום ש-**402 מתוך
 * 459** הקריאות החוזרות הן טלפוניות, ואלה אינן "כבר היינו אצלו". סימון
 * של כולן היה צובע שליש מכלל הקריאות והופך את הסימן לרעש.
 * [[color_on_everything_is_not_color]]
 */

const DAY = 86_400_000;

/** מה שהחישוב צריך מקריאת שירות, ותו לא. */
export interface RepeatCallInput {
  /** מזהה המכשיר. בלעדיו אי אפשר לדעת שזו אותה יחידה. */
  deviceSerial?: string | null;
  /** `פרונטלית` · `טלפונית` · אחר. */
  callType?: string | null;
  /** ISO. */
  created?: string | null;
  /** הסטטוס שלנו. */
  serviceCallStatus?: string | null;
}

export interface RepeatCallOptions {
  /** כמה אחורה מחפשים קריאה קודמת. ברירת מחדל: שלושה חודשים. */
  windowDays?: number;
  /** איזה חלון מוצג. ברירת מחדל: 90 יום. */
  lookbackDays?: number;
  nowMs?: number;
}

/**
 * כמה קריאות פרונטליות נפתחו לאותו מספר סידורי בתוך החלון.
 *
 * 🔴 **נספרת הקריאה השנייה ולא הראשונה.** ספירה של "מכשירים עם יותר
 * מקריאה אחת" הייתה נותנת מספר אחר לגמרי (1,013 מול 57 בנתונים שלנו),
 * והיא גם לא עונה על השאלה: שלומי שואל כמה פעמים חזרנו, לא לכמה
 * מכשירים יש היסטוריה.
 */
export function countRepeatCalls(calls: RepeatCallInput[], opts: RepeatCallOptions = {}): number {
  const windowMs = (opts.windowDays ?? 92) * DAY;
  const lookbackMs = (opts.lookbackDays ?? 90) * DAY;
  const now = opts.nowMs ?? Date.now();

  // כל הזמנים פר מספר סידורי, כולל טלפוניות: קריאה טלפונית קודמת עדיין
  // מעידה שהמכשיר הזה כבר הטריד. מה שנספר הוא רק הביקור הפרונטלי.
  const bySerial = new Map<string, number[]>();
  for (const c of calls) {
    const serial = c.deviceSerial?.trim();
    if (!serial || !c.created) continue;
    const t = new Date(c.created).getTime();
    if (Number.isNaN(t)) continue;
    const arr = bySerial.get(serial);
    if (arr) arr.push(t);
    else bySerial.set(serial, [t]);
  }

  let count = 0;
  for (const c of calls) {
    if (c.callType !== 'פרונטלית') continue;
    const serial = c.deviceSerial?.trim();
    if (!serial || !c.created) continue;
    const t = new Date(c.created).getTime();
    if (Number.isNaN(t) || now - t > lookbackMs) continue;
    const times = bySerial.get(serial);
    if (times?.some((prev) => prev < t && t - prev <= windowMs)) count++;
  }
  return count;
}

/** סטטוסים שבהם קריאה כבר אינה ממתינה לאיש. */
const CALL_DONE = ['בוצע', 'בוטל'];

/**
 * קריאות פתוחות שעברו את הסף.
 *
 * 🔴 **מוצג בצבע ניטרלי ולא כאזעקה.** עידן, 26/08: "המערכת בפיילוט, ועמי
 * בגדול משבץ רק מהיום למחר, עדיין לא התחלנו שימוש מלא." סף התראה שנקבע
 * על נתוני פיילוט מלמד את כולם להתעלם מהמסך.
 */
export function countOpenOverDays(
  calls: RepeatCallInput[],
  days = 7,
  nowMs = Date.now(),
): number {
  const cutoff = days * DAY;
  return calls.filter(
    (c) =>
      !CALL_DONE.includes(c.serviceCallStatus ?? '') &&
      !!c.created &&
      nowMs - new Date(c.created).getTime() > cutoff,
  ).length;
}
