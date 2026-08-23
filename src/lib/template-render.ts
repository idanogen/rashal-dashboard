/**
 * הצגת נוסח התבנית עם הערכים שהוקלדו.
 *
 * 🔴 **עותק מכוון של `api/_lib/templates-store.ts`.** הצד השרתי חייב
 * להישאר בלי תלות בקוד הדפדפן, והצד הלקוחי בלי תלות בסודות השרת, ולכן
 * שני הקבצים מחזיקים את אותו ביטוי. יש על זה **בדיקה שמשווה את שני
 * הקבצים תו בתו**, כי שני מימושים שנפרדים בשקט הם בדיוק איך שהלקוח
 * מקבל טקסט אחר ממה שראינו על המסך.
 *
 * 🔴 **התחביר של heyy הוא `{{var.name}}` ולא `{{name}}`.** ביטוי שתופס
 * `\w+` בלבד אינו מתאים לנקודה, ולכן שום ערך לא היה מוחלף והלקוח היה
 * מקבל את שם המשתנה כטקסט.
 */
const VAR_RE = /\{\{\s*(?:var\.)?(\w+)\s*\}\}/g;

export function renderPreview(bodyPreview: string, values: Record<string, unknown>): string {
  return bodyPreview.replace(VAR_RE, (_m, name: string) =>
    String(values?.[name] ?? '').trim() || `{${name}}`,
  );
}

/** אילו משתנים עדיין ריקים. */
export function missingVariables(names: string[], values: Record<string, unknown>): string[] {
  return names.filter((n) => !String(values?.[n] ?? '').trim());
}
