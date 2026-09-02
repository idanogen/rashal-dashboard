/**
 * מתי נענתה חוות הדעת, בעברית קצרה.
 *
 * 🔴 **עם שנה.** הרשימות ממוינות מהחדש לישן, ובלי שנה קל להניח שהכל
 * מהשבוע. "היום" מוצג עם שעה, כי ביום עצמו השעה היא מה שמבדיל.
 *
 * ⭐ יושב במקום אחד כי שלוש רשימות מציגות את אותו תאריך: ההערות,
 * הדירוגים הנמוכים ותוצאות החיפוש. בלי ייבוא, ולכן נבדק ביחידה.
 */
export function surveyWhen(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `היום ${time}`;
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()} ${time}`;
}
