/**
 * התאמת חיפוש חופשי לרשימות הסדרן.
 *
 * 🔴🔴 **שם מלא מוקלד בכל סדר.** עמי, 30/08/2026: "לא מצליח לחפש את
 * הלקוח ברשימות". הרשימות התאימו את השאילתה כמחרוזת **רצופה** אחת,
 * ובפריוריטי אין סדר קבוע בין שם פרטי למשפחה, ולכן "דוד כהן" לא מצא
 * את "כהן דוד". זה המימוש **השלישי** של אותה תקלה: תוקנה ב-25/08
 * ב-`customer_search` שבמסד וב-`matchesQuery` של התיבה, ונשארה כאן.
 * [[priority_customer_name_has_no_order]]
 *
 * הכללים זהים ל-`api/_lib/inbox.ts`:
 * - התאמה רצופה קודמת (הזולה והנפוצה).
 * - אחרת: **כל** מילות השאילתה (בכל סדר), לא אחת מהן — אחרת
 *   "שלומי כהן" מחזיר את כל הכהנים. מילה בת אות אחת לא נספרת.
 * - שאילתה עם ספרות מושווית גם מול הספרות בלבד של המחסן, כדי
 *   ש-"052-123" ימצא "0521234567".
 *
 * - אותיות סופיות מנורמלות (ף=פ, ם=מ...): בפריוריטי "חלף" כתוב "חלפ",
 *   וחיפוש עם האות הסופית החזיר אפס (עמי, 30/08/2026).
 *
 * בלי ייבוא, ולכן נבדק ביחידה.
 */
const FINALS: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };

function fold(text: string): string {
  return text.toLowerCase().replace(/[ךםןףץ]/g, (c) => FINALS[c]);
}

/**
 * דירוג התאמה, לסידור התוצאות: 0 = השאילתה בתחילת מילה ("סעדה" ב"סעדה מחמוד"),
 * 1 = בתוך מילה ("סעדה" ב"מסעדה"), 2 = התאמה של כל המילים או של ספרות, -1 = אין.
 * עידן, 06/09/2026: חיפוש "סעדה" הציג קריאה של לקוח אחר רק כי הכתובת שלו
 * "מסעדה", באותה בולטות כמו שני הלקוחות שבאמת נקראים סעדה.
 */
export function searchRank(haystack: string, rawQuery: string): number {
  const q = fold(rawQuery.trim());
  if (!q) return 0;
  const hay = fold(haystack);
  if (new RegExp('(^|[\\s,.:;/()\\-])' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(hay)) return 0;
  if (hay.includes(q)) return 1;
  return matchesSearch(haystack, rawQuery) ? 2 : -1;
}

export function matchesSearch(haystack: string, rawQuery: string): boolean {
  const q = fold(rawQuery.trim());
  if (!q) return true;
  const hay = fold(haystack);

  if (hay.includes(q)) return true;

  const words = q.split(/\s+/).filter((w) => w.length >= 2);
  if (words.length > 1 && words.every((w) => hay.includes(w))) return true;

  const digits = q.replace(/\D/g, '');
  // שלוש ספרות לפחות: "54" בתוך טלפון מחזיר חצי מהרשימה ונראה כמו חיפוש שבור.
  if (digits.length >= 3 && hay.replace(/\D/g, '').includes(digits)) {
    return true;
  }
  return false;
}
