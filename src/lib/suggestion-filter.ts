/**
 * סינון ההצעות לפי מה שהוקלד.
 *
 * ⭐ **קובץ בלי שום ייבוא, בכוונה.** Node מריץ `.ts` ישירות בבדיקות, אבל
 * לא פותר ייבוא של מודול שמושך את לקוח ה-Supabase. הלוגיקה שכדאי לבדוק
 * יושבת לבד, וה-IO נשאר במקום אחר. (אותו לקח כמו `api/_lib/inbox.ts`.)
 */

/**
 * 🔴 **התאמה מתחילת המילה קודמת להתאמה באמצע.** מי שמקליד "רא" מחפש את
 * ראשון לציון, לא את "באר שבע" שיש בה את הרצף.
 */
export function filterSuggestions(all: string[], query: string, limit = 8): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return all.slice(0, limit);

  const starts: string[] = [];
  const contains: string[] = [];
  for (const v of all) {
    const lower = v.toLowerCase();
    if (lower.startsWith(q)) starts.push(v);
    else if (lower.includes(q)) contains.push(v);
    if (starts.length >= limit) break;
  }
  // הערך שהוקלד במדויק אינו מוצע לעצמו: הצעה כזאת היא רעש.
  return [...starts, ...contains].filter((v) => v.toLowerCase() !== q).slice(0, limit);
}
