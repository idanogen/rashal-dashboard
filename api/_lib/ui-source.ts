/**
 * מאיזה ממשק הגיעה פעולת וואטסאפ של עובד: תיבת השיחות בדשבורד, החלונית
 * הצפה בדשבורד, או התוסף בתוך פריוריטי.
 *
 * 🔴 **הרקע (18/10/2026):** עידן שאל אם הצוות בכלל משתמש בכלים האלה, ולא
 * הייתה דרך לענות. שני הממשקים כתבו את אותו `triggered_by`
 * (`priority-panel:<email>`), פתיחת התיבה לא נרשמה בשום מקום, ו-`read_by`
 * שומר רק את הקורא האחרון.
 *
 * ⭐ **התוסף לא צריך גרסה חדשה כדי להיספר.** הוא קורא לשרת מה-service
 * worker שלו, והדפדפן חותם על הבקשה `Origin: chrome-extension://…` (בקשה
 * חוצת מקור, גם ב-GET). הדשבורד מצהיר על עצמו בשדה `source`, כי בקשה
 * מאותו מקור ב-GET לא נושאת `Origin` בכלל.
 *
 * 🔴 המקור של התוסף גובר על הצהרה: הדפדפן קובע אותו ולא הקוד שלנו.
 * מה שלא מזוהה נשאר `unknown` ולא מנוחש, כדי שהמדידה לא תשקר.
 *
 * טהור ובלי ייבוא, כדי שייבדק ב-node.
 */
export type WaUi = 'inbox' | 'dock' | 'extension' | 'unknown';

export const DASHBOARD_SURFACES: readonly WaUi[] = ['inbox', 'dock'];

export function waUiSource(declared: unknown, origin: unknown): WaUi {
  const o = typeof origin === 'string' ? origin.trim().toLowerCase() : '';
  if (o.startsWith('chrome-extension://')) return 'extension';
  const d = typeof declared === 'string' ? declared.trim().toLowerCase() : '';
  if ((DASHBOARD_SURFACES as readonly string[]).includes(d)) return d as WaUi;
  return 'unknown';
}
