/**
 * שעות מפריוריטי הן שעון ישראל שמסומן כ-`Z`.
 *
 * 🔴🔴 **נמדד 07/09/2026:** `STARTDATE` של קריאה שנפתחה ב-16:39 שעון ישראל
 * מגיע כ-`2026-09-07T16:39:00Z`. מי ששומר את המחרוזת כמו שהיא מקבל 19:39
 * במסך (קיץ), וקריאה שנפתחה אחרי 21:00 נראית כאילו נפתחה מחר. התפלגות
 * שעות הפתיחה אצלנו הייתה 10:00 עד 21:00 בזמן שהמשרד פותח 07:00 עד 18:00.
 *
 * ⭐ **תאריך בלי שעה נשאר כמו שהוא.** `CURDATE` ו-`IVDATE` הם ימים
 * (`T00:00:00Z`), ומי שמזיז אותם שלוש שעות אחורה מקבל את **אתמול** בכל
 * `::date` בשעון עולמי. ההזזה חלה רק על ערך שנושא שעה אמיתית.
 *
 * 🔴 ההזזה היא רק לאחסון ולתצוגה. סימני המים (`sync_state`) נשארים
 * במסגרת של פריוריטי, כי הם חוזרים אליה ב-`$filter` וצריכים להשוות
 * תפוחים לתפוחים.
 */
const IL = 'Asia/Jerusalem';

const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: IL, hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
});

/** ההיסט של שעון ישראל, בדקות, ברגע נתון (180 בקיץ, 120 בחורף). */
function ilOffsetMinutes(atUtcMs: number): number {
  const parts = Object.fromEntries(fmt.formatToParts(new Date(atUtcMs)).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - atUtcMs) / 60_000);
}

/** האם המחרוזת נושאת שעה אמיתית (ולא חצות שמסמנת "תאריך בלבד"). */
export function hasClockTime(iso: string): boolean {
  const m = iso.match(/T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return false;
  return !(m[1] === '00' && m[2] === '00' && (m[3] ?? '00') === '00');
}

/**
 * מחרוזת של פריוריטי (שעון ישראל מסומן Z) ל-ISO אמיתי ב-UTC.
 * מחזירה את הקלט כמו שהוא כשאין שעה, כשהפורמט לא מוכר, או כשיש כבר
 * היסט מפורש שאינו Z (אז פריוריטי כבר אמרה באיזה שעון היא מדברת).
 */
export function priorityLocalToUtc(iso: string | null | undefined): string | null {
  if (!iso) return null;
  if (!hasClockTime(iso)) return iso;
  if (/[+-]\d{2}:\d{2}$/.test(iso)) return iso;
  const wall = Date.parse(iso.endsWith('Z') ? iso : iso + 'Z');
  if (!Number.isFinite(wall)) return iso;
  // ההיסט תלוי בתאריך (קיץ/חורף). מחשבים אותו סביב שעת הקיר עצמה, ואז
  // פעם נוספת סביב התוצאה, כדי שגם רגע החלפת השעון ייצא נכון.
  let utc = wall - ilOffsetMinutes(wall) * 60_000;
  utc = wall - ilOffsetMinutes(utc) * 60_000;
  return new Date(utc).toISOString().replace(/\.\d{3}Z$/, 'Z');
}
