/**
 * גיול חובות: הדליים, והמתמטיקה המשותפת למסך.
 *
 * 🔴 **המודול הזה טהור ובלי שום ייבוא**, כדי שאפשר יהיה להריץ עליו בדיקות
 * ב-node בלי בנייה. הכרעת הדלי היא ההיגיון היחיד שיש כאן, וזה בדיוק הדבר
 * שלא רוצים לגלות שהיה שגוי אחרי שמישהו התקשר לגבות.
 *
 * ⭐ **הצבירה לפי לקוח אינה כאן אלא ב-`debt_aging()` שבמסד**, משתי סיבות:
 * הרשאה (כסף נחתך בשרת) וגודל (1,238 חשבוניות פתוחות מול תקרת 1,000 של
 * PostgREST). מה שנשאר כאן הוא מה שהמסך באמת עושה בדפדפן: צובע חשבונית
 * בודדת, ומסכם דליים על פני קבוצה מסוננת.
 * 🔴 ויש בדיקה שקוראת את קובץ המיגרציה ומוודאת שהגבולות בשני הצדדים זהים.
 *
 * ⭐ **הדליים נמדדים מתאריך החשבונית ולא מתאריך פירעון**, כי ל-CINVOICES
 * אין תאריך פירעון והדוח של פריוריטי נמדד באותה צורה. הצלבה מול הדוח
 * ב-27/08/2026: 7,272,096 אצלנו מול 7,172,946 בדוח, פער של 1.4%.
 */

/** מזהי הדליים, מהחדש לישן. הסדר הזה הוא סדר התצוגה. */
export const AGING_BUCKETS = ['b0_30', 'b31_60', 'b61_90', 'b91_120', 'b120_plus'] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

export const BUCKET_LABELS: Record<AgingBucket, string> = {
  b0_30: 'עד 30 יום',
  b31_60: '31-60',
  b61_90: '61-90',
  b91_120: '91-120',
  b120_plus: 'מעל 120',
};

/** ⭐ הדלי שממנו מתחילים לדאוג. מתחתיו זה מחזור עסקים רגיל. */
export const OVERDUE_FROM: AgingBucket = 'b61_90';

/**
 * ותק בימים ← דלי.
 *
 * 🔴 **ותק שלילי (חשבונית בתאריך עתידי) נופל לדלי הראשון ולא נעלם.**
 * שורה שאינה נכנסת לשום דלי פשוט לא מופיעה בסכום, והסכום הכולל מפסיק
 * להסתדר בלי שאף אחד רואה שגיאה.
 */
export function bucketOf(ageDays: number): AgingBucket {
  if (!Number.isFinite(ageDays)) return 'b0_30';
  if (ageDays <= 30) return 'b0_30';
  if (ageDays <= 60) return 'b31_60';
  if (ageDays <= 90) return 'b61_90';
  if (ageDays <= 120) return 'b91_120';
  return 'b120_plus';
}

/**
 * שורה מצוברת, כפי ש-`debt_aging()` מחזיר אותה.
 * ⭐ הצורה המינימלית בכוונה: שתי הפונקציות שלמטה מסכמות דליים ואינן צריכות
 * לדעת דבר על הלקוח, ולכן הן עובדות גם על תת-קבוצה מסוננת.
 */
export interface Bucketed {
  buckets: Record<AgingBucket, number>;
}

function emptyBuckets(): Record<AgingBucket, number> {
  return { b0_30: 0, b31_60: 0, b61_90: 0, b91_120: 0, b120_plus: 0 };
}

/** סכום החוב שכבר עבר את סף הדאגה. זה המספר שמופיע בראש המסך. */
export function overdueTotal(rows: Bucketed[]): number {
  const from = AGING_BUCKETS.indexOf(OVERDUE_FROM);
  let sum = 0;
  for (const r of rows) {
    AGING_BUCKETS.forEach((b, i) => {
      if (i >= from) sum += r.buckets[b];
    });
  }
  return sum;
}

/** סכומי הדליים על פני כל הלקוחות, לשורת הסיכום. */
export function bucketTotals(rows: Bucketed[]): Record<AgingBucket, number> {
  const out = emptyBuckets();
  for (const r of rows) for (const b of AGING_BUCKETS) out[b] += r.buckets[b];
  return out;
}

/**
 * ₪ בפורמט ישראלי, בלי אגורות.
 *
 * 🔴 `-0` נראה כמו תקלה, ולכן אפס הוא תמיד אפס.
 * 🔴 **והמינוס לפני סימן המטבע ולא אחריו.** `₪-8,215` נראה כמו תקלת
 * רינדור; `-₪8,215` נקרא כזיכוי. נתפס בצילום, בשורה של כללית.
 */
export function shekel(n: number): string {
  const v = Math.round(n);
  const safe = Object.is(v, -0) ? 0 : v;
  const sign = safe < 0 ? '-' : '';
  return `${sign}₪${Math.abs(safe).toLocaleString('he-IL')}`;
}
