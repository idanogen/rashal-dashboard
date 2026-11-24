/**
 * חיפוש ספציפי מוביל לביקור עצמו (24/11/2026).
 *
 * עידן חיפש SO2604018 במסך השיבוץ, מצא את הלקוחה בפס ההיסטוריה, ושאל
 * "אני לא יכול לראות מה היה בביקור הזה?". מכאן: כשהחיפוש הוא מספר מסמך,
 * כרטיס הלקוח נפתח עם השורות של אותו מסמך מודגשות, והביקור שלו עם הטפסים.
 *
 * בלי ייבוא, ולכן נבדק ביחידה.
 */

export interface FocusableEvent {
  ref: string | null;
  /** מספרי המסמכים של השורה מהמסד (הזמנה/קריאה/איסוף של ביקור, SH של תעודה). */
  refs?: string[] | null;
}

/**
 * מספר מסמך מתוך טקסט החיפוש, או null כשהחיפוש הוא שם, טלפון או עיר.
 * מסמך = קידומת של שתי אותיות ואחריה ספרות (SO, SH, SC, PK...), או ספרות
 * בלבד באורך 5 עד 7 (מספר פנימי של תעודה). טלפון (9-10 ספרות) אינו מסמך.
 */
export function focusDocRef(query: string | null | undefined): string | null {
  const q = (query ?? '').trim().toUpperCase().replace(/\s+/g, '');
  if (/^[A-Z]{2}\d{4,}$/.test(q)) return q;
  if (/^\d{5,7}$/.test(q)) return q;
  return null;
}

/** האם השורה היא של המסמך שחיפשו. `extra` = מספרים שהמסך יודע בעצמו (SH של ביקור). */
export function eventMatchesFocus(e: FocusableEvent, focus: string | null, extra: string[] = []): boolean {
  if (!focus) return false;
  const all = [e.ref, ...(e.refs ?? []), ...extra];
  return all.some((r) => (r ?? '').trim().toUpperCase() === focus);
}
