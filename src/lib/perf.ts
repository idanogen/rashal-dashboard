/**
 * מדידת זמן הטעינה של מסך הסדרן, ומה שורף אותו.
 *
 * ⭐ **נבנה אחרי התלונה של עמי** (<bdi>27/08/2026</bdi>): "אתמול עד שעות
 * הערב לא היה אספקות במערכת". הנתונים היו במסד כל הזמן, הרשימה פשוט לא
 * נטענה, **ולא הייתה שום דרך לדעת מה קרה אצלו בדפדפן.** מדידה שחיה רק
 * בקונסולה שלו אינה מדידה, ולכן מה שאיטי או שנכשל נרשם גם במסד.
 *
 * 🔴🔴 **והמסקנה החשובה ביותר כאן היא לא "כמה", אלא "מה על הנתיב".**
 * חמש השליפות רצות **במקביל**, ולכן סכום הזמנים שלהן אינו זמן הטעינה
 * ואין שום טעם לייעל את השנייה בגודלה. מה שקובע הוא **השליפה שנגמרה
 * אחרונה**, וכמה **סבבי רשת סדרתיים** יש בתוכה: כל עמוד של 1,000 שורות
 * הוא סבב נוסף שמחכה לקודמו, וזה החלק היחיד שבאמת מצטבר.
 *
 * 🔴 **המודול טהור ובלי שום ייבוא**, ולכן הוא נבדק ב-node. ⭐ ואין בו
 * שום קריאה ל-`Date.now()` בזמן ניתוח: החותמות מוזרקות מבחוץ, אחרת אי
 * אפשר לבדוק אותו בכלל.
 */

export interface FetchMark {
  /** `orders` · `service_calls` · `pickups` · `customers` · `calendar_stops` */
  name: string;
  /** מילישניות מתחילת הטעינה של המסך ועד שהשליפה התחילה. */
  startedAt: number;
  /** מילישניות מתחילת הטעינה של המסך ועד שהשליפה נגמרה. */
  endedAt: number;
  rows: number;
  /** כמה סבבי רשת סדרתיים. עמוד של 1,000 שורות = סבב. */
  pages: number;
  /** הודעת השגיאה, כשהשליפה נכשלה. */
  failed?: string;
}

export interface LoadReport {
  /** זמן הקיר: מתחילת הטעינה ועד שהאחרונה נגמרה. זה מה שהמשתמש מרגיש. */
  totalMs: number;
  /** ⭐ השליפה שנגמרה אחרונה. היא הנתיב הקריטי, והיא היחידה ששווה לייעל. */
  critical: FetchMark | null;
  /** כמה אחוז מזמן הקיר מוסבר על ידי הנתיב הקריטי. */
  criticalShare: number;
  /** סך הסבבים הסדרתיים על פני כל השליפות. */
  totalPages: number;
  totalRows: number;
  /** שליפות שנכשלו. 🔴 כשל הוא הסבר טוב יותר מאיטיות, ולכן הוא ראשון. */
  failures: FetchMark[];
  /** סכום הזמנים, למי שרוצה לראות כמה מקבילות באמת יש. */
  sumMs: number;
  /** ⭐ `sumMs / totalMs`. קרוב ל-1 פירושו שהשליפות בפועל סדרתיות. */
  parallelism: number;
  marks: FetchMark[];
  /** משפט אחד בעברית, מוכן להצגה ולשמירה. */
  verdict: string;
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/**
 * ניתוח, מהחותמות בלבד.
 *
 * 🔴 **כשל גובר על איטיות בניסוח.** מסך שנטען לאט הוא מטרד; רשימה שלא
 * נטענה היא המסך שעמי צילם, ואם שניהם קרו זה מה שצריך לומר קודם.
 */
export function analyzeLoad(marks: FetchMark[]): LoadReport {
  const empty: LoadReport = {
    totalMs: 0, critical: null, criticalShare: 0, totalPages: 0, totalRows: 0,
    failures: [], sumMs: 0, parallelism: 0, marks: [], verdict: 'לא נמדדה שום שליפה',
  };
  if (!marks.length) return empty;

  const totalMs = Math.max(...marks.map((m) => m.endedAt));
  const spans = marks.map((m) => Math.max(0, m.endedAt - m.startedAt));
  const sumMs = spans.reduce((a, b) => a + b, 0);
  // ⭐ האחרונה שנגמרה, ובתיקו הארוכה מביניהן.
  const critical = marks.reduce((best, m) =>
    m.endedAt > best.endedAt ||
    (m.endedAt === best.endedAt && m.endedAt - m.startedAt > best.endedAt - best.startedAt)
      ? m
      : best
  );
  const failures = marks.filter((m) => m.failed);
  const totalPages = marks.reduce((a, m) => a + m.pages, 0);
  const totalRows = marks.reduce((a, m) => a + m.rows, 0);
  const criticalSpan = critical.endedAt - critical.startedAt;

  let verdict: string;
  if (failures.length) {
    const names = failures.map((f) => f.name).join(', ');
    verdict = `${failures.length === 1 ? 'שליפה אחת נכשלה' : `${failures.length} שליפות נכשלו`} (${names}), וזה מסביר רשימה ריקה יותר מכל זמן טעינה.`;
  } else if (totalMs < 1500) {
    verdict = `המסך עלה ב-${(totalMs / 1000).toFixed(1)} שניות, וזה תקין.`;
  } else {
    verdict =
      `המסך עלה ב-${(totalMs / 1000).toFixed(1)} שניות, ומה שקבע את זה הוא ${critical.name} ` +
      `(${(criticalSpan / 1000).toFixed(1)} שניות, ${critical.rows.toLocaleString('he-IL')} שורות ב-${critical.pages} סבבים). ` +
      `ייעול של כל השאר לא יקצר את הטעינה.`;
  }

  return {
    totalMs,
    critical,
    criticalShare: pct(criticalSpan, totalMs),
    totalPages,
    totalRows,
    failures,
    sumMs,
    parallelism: totalMs > 0 ? Math.round((sumMs / totalMs) * 100) / 100 : 0,
    marks: [...marks].sort((a, b) => b.endedAt - b.startedAt - (a.endedAt - a.startedAt)),
    verdict,
  };
}

/**
 * האם שווה לשמור את המדידה במסד.
 *
 * 🔴 **לא כל טעינה.** עשרה עובדים שפותחים את המסך עשר פעמים ביום הם
 * 100 שורות ביום של רעש, ורעש הוא הדרך הבטוחה לכך שאיש לא יסתכל בטבלה.
 * נשמר רק מה שמסביר תלונה: כשל, או טעינה שנמשכה מעל הסף.
 */
export const SLOW_LOAD_MS = 4000;

export function shouldPersist(r: LoadReport): boolean {
  return r.failures.length > 0 || r.totalMs >= SLOW_LOAD_MS;
}
