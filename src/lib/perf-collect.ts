import { analyzeLoad, shouldPersist, type FetchMark, type LoadReport } from './perf';
import { supabase } from './supabase';

/**
 * האיסוף עצמו: מי מדד, מתי, וכמה.
 *
 * ⭐ **הופרד מ-`perf.ts` בכוונה.** הניתוח הוא היגיון טהור ונבדק ב-node;
 * כאן יושבים השעון, ה-`console` והכתיבה למסד, שאי אפשר לבדוק ככה.
 *
 * 🔴 **ואף אחת מהמדידות אינה עושה עבודה בזמן רינדור.** הכל נרשם בתוך
 * שליפות שרצות ממילא, והדיווח יוצא מ-`useEffect` אחרי שהכל נגמר.
 * [[render_must_not_start_work]]
 */

let screenStart = 0;
let marks: FetchMark[] = [];
let reported = false;

/** תחילת טעינה של מסך. מאפס את המדידות. */
export function beginScreenLoad(): void {
  screenStart = performance.now();
  marks = [];
  reported = false;
}

/** ⭐ מדידה בלי `beginScreenLoad` קודם היא מדידה יחסית לרגע האקראי הזה. */
function since(): number {
  if (!screenStart) screenStart = performance.now();
  return Math.round(performance.now() - screenStart);
}

/**
 * עוטף שליפה ומודד אותה.
 *
 * ⭐ `countPage` מועבר פנימה כדי שהשליפה תספור את הסבבים שלה עצמה. כל
 * עמוד של 1,000 שורות הוא סבב רשת שמחכה לקודמו, וזה החלק היחיד בטעינה
 * שבאמת מצטבר.
 *
 * 🔴 **שליפה שנכשלה נרשמת וזורקת הלאה.** מדידה שבולעת שגיאה הופכת תקלה
 * לרשימה ריקה, וזה בדיוק הבאג שהכלי הזה נולד בגללו.
 */
export async function timedFetch<T>(
  name: string,
  fn: (countPage: () => void) => Promise<T>,
  rowsOf: (result: T) => number
): Promise<T> {
  const startedAt = since();
  let pages = 0;
  try {
    const result = await fn(() => {
      pages += 1;
    });
    marks.push({ name, startedAt, endedAt: since(), rows: rowsOf(result), pages });
    return result;
  } catch (err) {
    marks.push({
      name,
      startedAt,
      endedAt: since(),
      rows: 0,
      pages,
      failed: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export function currentMarks(): FetchMark[] {
  return [...marks];
}

/**
 * מפיק את הדוח, מדפיס אותו, ושומר אותו כשיש מה לספר.
 *
 * 🔴 **פעם אחת לטעינה.** שאילתה שמתרעננת ברקע לא מתחילה "טעינת מסך"
 * חדשה, ובלי השומר הזה כל רענון היה מייצר עוד שורה בטבלה.
 */
export async function reportScreenLoad(screen: string): Promise<LoadReport | null> {
  if (reported || marks.length === 0) return null;
  reported = true;
  const report = analyzeLoad(marks);

  // ⭐ קבוצה מקופלת: מי שלא מחפש את זה לא רואה קיר של שורות.
  console.groupCollapsed(
    `⏱ ${screen}: ${(report.totalMs / 1000).toFixed(1)}s · ${report.verdict}`
  );
  console.table(
    report.marks.map((m) => ({
      שליפה: m.name,
      'זמן (ms)': m.endedAt - m.startedAt,
      'נגמרה ב-': m.endedAt,
      שורות: m.rows,
      סבבים: m.pages,
      כשל: m.failed ?? '',
    }))
  );
  console.groupEnd();

  if (!shouldPersist(report)) return report;

  try {
    await supabase.from('screen_load_log').insert({
      screen,
      total_ms: report.totalMs,
      critical_fetch: report.critical?.name ?? null,
      critical_ms: report.critical ? report.critical.endedAt - report.critical.startedAt : null,
      total_rows: report.totalRows,
      total_pages: report.totalPages,
      parallelism: report.parallelism,
      failures: report.failures.map((f) => `${f.name}: ${f.failed}`),
      verdict: report.verdict,
      marks: report.marks,
      user_agent: navigator.userAgent.slice(0, 300),
    });
  } catch {
    // 🔴 בשקט, ובכוונה. כלי מדידה שמפיל את המסך שהוא מודד גרוע מאין כלום.
  }
  return report;
}
