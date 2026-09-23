import { timingSafeEqual } from 'node:crypto';

/**
 * השוואת סוד בזמן קבוע, וסוד שלא הוגדר בסביבה = סגור (23/09/2026).
 * 🔴 `if (!SECRET) return true` פתח את הוובהוק של heyy לכל העולם בכל סביבה
 * שבה המשתנה חסר; השוואה רגילה מדליפה את הסוד תו-תו דרך זמן התגובה.
 */
export function secretEquals(given: unknown, expected: string | undefined): boolean {
  if (!expected || typeof given !== 'string' || !given) return false;
  const a = Buffer.from(given, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
