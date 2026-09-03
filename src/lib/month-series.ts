/**
 * "אספקות לפי חודש": הזמנות שנפתחו מול תעודות משלוח, לפי חודש.
 *
 * 🔴🔴 **הגרף הזה שיקר בשני הצירים, ושלומי תפס (03/09/2026).**
 * "הוזמנו" נספר מרשימת ההזמנות שהמסך טוען, וזו מסננת ארכיון: אפריל הראה
 * 83 הזמנות כשבפריוריטי נפתחו 255, מאי 135 מול 403, יוני 236 מול 457.
 * "סופקו" נספר מעצירות שנסגרו באפליקציה, כלומר מדד כמה השתמשו במערכת
 * (1, 0, 12, 41, 81), בזמן שתעודות המשלוח באותם חודשים היו 267, 428,
 * 506, 372, 486.
 *
 * 🔴 ומלכודת בדרך לתיקון: ספירה של כל השורות בטבלה הייתה מראה 653
 * באפריל, כי בתקופת הוובהוק נכתבו לשם כרטיסי לקוח ולא הזמנות. נספרות
 * רק שורות עם מסמך הזמנה בפריוריטי (`orders_opened_by_month`).
 *
 * ⭐ עכשיו: "הוזמנו" = הזמנות שנפתחו בפריוריטי באותו חודש (ספירה במסד,
 * כולל ארכיון, בלי מבוטלות), ו"סופקו" = תעודות משלוח לפי תאריך התעודה,
 * באותו כלל שסופר לרצועת היעד השבועי שבכרטיס שמעל. שני מדדים באותו
 * כרטיס חייבים לספור את אותו דבר, אחרת אחד מהם מפריך את השני.
 *
 * קובץ בלי שום ייבוא, ולכן נבדק ביחידה. הכלל "מי נספרת" מועתק מ-
 * `delivery-target.ts` (תעודה עם תאריך שאינה מבוטלת), כי Node אינו פותר
 * ייבוא בלי סיומת בבדיקות.
 */

/** תעודה נספרת: לא מבוטלת, ויש לה תאריך. זהה ל-`countsTowardTarget`. */
function countsTowardTarget(status?: string | null, docDate?: string | null): boolean {
  return Boolean(docDate) && status !== 'מבוטלת';
}

export interface MonthSeries { label: string; a: number; b: number }

/** שורה מ-`orders_opened_by_month`. `month` = היום הראשון בחודש, YYYY-MM-DD. */
export interface OpenedByMonthRow { month: string; opened: number; cancelled: number }

/** מה שהחישוב צריך מתעודת משלוח. */
export interface NoteForMonth { status?: string | null; docDate?: string | null }

const MON = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];

/** מפתח חודש מקומי, בלי הסטת אזור זמן של `toISOString`. */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** היום הראשון של החודש ה-n לפני הנוכחי. `months=6` ⟵ החודש הנוכחי וחמישה לפניו. */
export function seriesFrom(months: number, now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
}

/**
 * הזמנות שנפתחו מול תעודות משלוח, `months` חודשים אחורה כולל הנוכחי.
 * חודש בלי נתונים הוא אפס ולא חור.
 */
export function ordersVsNotesByMonth(
  opened: OpenedByMonthRow[],
  notes: NoteForMonth[],
  months = 6,
  now: Date = new Date(),
): MonthSeries[] {
  const series: MonthSeries[] = [];
  const index = new Map<string, number>();
  const first = seriesFrom(months, now);
  for (let i = 0; i < months; i++) {
    const d = new Date(first.getFullYear(), first.getMonth() + i, 1);
    index.set(monthKey(d), series.length);
    series.push({ label: MON[d.getMonth()], a: 0, b: 0 });
  }
  for (const r of opened) {
    // `month` מגיע כתאריך YYYY-MM-DD; שבעת התווים הראשונים הם המפתח,
    // בלי לעבור דרך Date, כי חצות UTC של ה-1 בחודש הוא ה-31 בערב בזמן מקומי מערבי.
    const i = index.get(String(r.month).slice(0, 7));
    if (i != null) series[i].a += Math.max(0, Number(r.opened) - Number(r.cancelled));
  }
  for (const n of notes) {
    if (!countsTowardTarget(n.status, n.docDate)) continue;
    const i = index.get(String(n.docDate).slice(0, 7));
    if (i != null) series[i].b++;
  }
  return series;
}
