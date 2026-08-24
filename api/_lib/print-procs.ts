/**
 * מה שנלמד על מסכי ההדפסה של פריוריטי: אימות, וצורה אחת לשני הצדדים.
 *
 * 🔴🔴 **הערכים כאן מורצים בסופו של דבר מול פריוריטי, אצל כל העובדים.**
 * הם מגיעים מהתוסף שרץ בדפדפן, כלומר מצד שאי אפשר לסמוך עליו. לשונית
 * אחת שנפגעה או באג אחד בלמידה יכולים לשתול פרוצדורה שתופעל אצל כולם.
 * לכן כל שדה נבדק מול תבנית צרה, ולא "מנוקה".
 *
 * ⭐ ואין כאן שום ייבוא שרץ, בכוונה, כדי שהבדיקות יריצו את הקובץ ישירות.
 */

/** שם מסך או פרוצדורה בפריוריטי: אותיות גדולות, ספרות, קו תחתון. */
const IDENT = /^[A-Z][A-Z0-9_]{1,63}$/;

/**
 * 🔴 **רשימה סגורה, ולא "כל מה שהגיע".** הפרמטרים האלה הם התשובה
 * לדיאלוג ההדפסה, והם **שונים בין מסכים**: אומת ב-17/08/2026 שתעודת
 * משלוח שולחת `format=-3` וחשבונית מס שולחת `format=-1`, בזמן שבשני
 * המסכים הבחירה בתפריט נראית זהה.
 */
export const PRINT_ARG_KEYS = ['mode', 'format', 'sendattach', 'copies', 'pdf', 'sign', 'quick'] as const;

export type PrintArgs = Partial<Record<(typeof PRINT_ARG_KEYS)[number], string>>;

export interface LearnedProc {
  form: string;
  ename: string;
  table: string;
  avoidmessages: string | null;
  printArgs: PrintArgs;
}

export interface NormalizeResult {
  ok: boolean;
  value: LearnedProc | null;
  reason: string | null;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * בודק מה שהתוסף מדווח שלמד. מחזיר ערך רק כשהכל תקין.
 *
 * 🔴 **דחייה שקטה ולא תיקון.** ערך שלא עבר לא נשמר, והתוסף ממשיך לעבוד
 * עם מה שלמד מקומית. חצי-פרוצדורה ששמורה לכל החברה גרועה מכלום.
 */
export function normalizeLearnedProc(input: unknown): NormalizeResult {
  const bad = (reason: string): NormalizeResult => ({ ok: false, value: null, reason });
  if (!input || typeof input !== 'object') return bad('not_an_object');

  const i = input as Record<string, unknown>;
  const form = str(i.form).toUpperCase();
  const ename = str(i.ename).toUpperCase();
  const table = str(i.table).toUpperCase();

  if (!IDENT.test(form)) return bad('bad_form');
  if (!IDENT.test(ename)) return bad('bad_ename');
  if (!IDENT.test(table)) return bad('bad_table');

  // פריוריטי מוסרת "true"/"false" כמחרוזת. כל דבר אחר אינו מוכר.
  const avoidRaw = str(i.avoidmessages).toLowerCase();
  const avoidmessages = avoidRaw === 'true' || avoidRaw === 'false' ? avoidRaw : null;

  const printArgs: PrintArgs = {};
  const src = (i.printArgs ?? {}) as Record<string, unknown>;
  if (typeof src !== 'object' || src === null) return bad('bad_args');
  for (const k of PRINT_ARG_KEYS) {
    const v = src[k];
    if (v === undefined || v === null) continue;
    if (typeof v !== 'string' && typeof v !== 'number') return bad(`bad_arg_${k}`);
    const s = String(v).trim();
    // ערכי הדיאלוג קצרים תמיד. מחרוזת ארוכה כאן היא סימן לזליגה.
    if (s.length > 16) return bad(`long_arg_${k}`);
    if (!/^-?[\w.]*$/.test(s)) return bad(`bad_arg_${k}`);
    printArgs[k] = s;
  }

  return { ok: true, value: { form, ename, table, avoidmessages, printArgs }, reason: null };
}

interface Row {
  form: string;
  ename: string;
  table_name: string;
  avoidmessages: string | null;
  print_args: unknown;
}

/**
 * שורות המסד ⟵ הצורה שהתוסף מכיר.
 *
 * 🔴 **המפתחות זהים למה ש-`printer.js` שומר מקומית**, כי הוא ממזג את
 * שניהם לאותו אובייקט. שם אחר בצד אחד פירושו פרוצדורה שנראית קיימת
 * ולא מופעלת.
 */
export function procsToMap(rows: Row[] | null | undefined): Record<string, Omit<LearnedProc, 'form'>> {
  const out: Record<string, Omit<LearnedProc, 'form'>> = {};
  for (const r of rows ?? []) {
    if (!r || !r.form) continue;
    out[r.form] = {
      ename: r.ename,
      table: r.table_name,
      avoidmessages: r.avoidmessages,
      printArgs: (r.print_args && typeof r.print_args === 'object' ? r.print_args : {}) as PrintArgs,
    };
  }
  return out;
}
