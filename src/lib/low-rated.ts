/**
 * סדר רשימת "לקוחות בדירוג נמוך", ומי בה עדיין פתוח.
 *
 * ⭐ **הרשימה הזאת היא רשימת עבודה ולא דוח.** לכן מי שטופל **יורד למטה
 * ואינו נמחק**: המחיקה הייתה מוחקת גם את התשובה לשאלה "מי דיבר איתו
 * ומתי", וזו בדיוק השאלה שנשאלת שבוע אחרי.
 *
 * 🔴 **והמונה סופר את הפתוחים בלבד.** מונה שסופר את כולם לעולם לא יורד,
 * ורשימה שלא מתרוקנת מפסיקים להסתכל עליה.
 *
 * בלי ייבוא, ולכן נבדק ביחידה.
 */

export interface LowRatedRow {
  satisfaction: number | null;
  answeredAt: string | null;
  handledAt: string | null;
}

/** הסף זהה למנוע ההתראות: 2 ומטה. לקוח שנתן 3 אינו "דירוג נמוך". */
export const LOW_RATED_MAX = 2;

export function isLowRated<T extends LowRatedRow>(row: T): boolean {
  return row.satisfaction !== null && row.satisfaction <= LOW_RATED_MAX;
}

/** הפתוחים קודם, ובתוך כל קבוצה החדש קודם. */
export function orderLowRated<T extends LowRatedRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const openDiff = Number(a.handledAt !== null) - Number(b.handledAt !== null);
    if (openDiff !== 0) return openDiff;
    return (b.answeredAt ?? '').localeCompare(a.answeredAt ?? '');
  });
}

export function openLowRated<T extends LowRatedRow>(rows: T[]): T[] {
  return rows.filter((r) => r.handledAt === null);
}
