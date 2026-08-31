/**
 * קישור שפותח שיחת וואטסאפ עם הלקוח (בקשת עידן, 31/08/2026: "קישור
 * שיפתח שיחה עם הלקוח מהר" מרשימת ההערות בסקרים).
 *
 * `wa.me` דורש ספרות בלבד בפורמט בינלאומי, בלי `+` ובלי מקפים. מספר
 * שאינו נראה כמו נייד ישראלי תקין מחזיר null, והמסך מציג "אין נייד"
 * במקום כפתור שפותח שיחה עם מספר שבור.
 *
 * בלי ייבוא, ולכן נבדק ביחידה.
 */
export function waChatUrl(phoneE164: string | null | undefined): string | null {
  if (!phoneE164) return null;
  const digits = phoneE164.replace(/\D/g, '');
  // נייד ישראלי בינלאומי: 9725XXXXXXXX (12 ספרות). גם צורה מקומית
  // 05XXXXXXXX מתקבלת ומתורגמת, ליתר ביטחון.
  if (/^9725\d{8}$/.test(digits)) return `https://wa.me/${digits}`;
  if (/^05\d{8}$/.test(digits)) return `https://wa.me/972${digits.slice(1)}`;
  return null;
}
