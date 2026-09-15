/**
 * טקסט חופשי מפריוריטי ("תאור התקלה" בקריאת שירות) לשורות טקסט נקיות.
 *
 * ⭐ תת-טופס טקסט מגיע כ-HTML של העורך של פריוריטי:
 *   `<style> p,div,li {margin:0cm;...}</style><p dir=rtl> <p dir="rtl">שורה</p><p dir="rtl"><br></p>`
 * כולל `&nbsp;` ושורות ריקות. הנהג צריך את השורות, לא את העטיפה.
 *
 * 🔴 קובץ טהור בלי ייבוא, כדי שייבדק (`test/priority-text.test.mjs`).
 */

const ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

export function priorityHtmlToText(html: unknown): string | null {
  if (typeof html !== 'string') return null;
  let s = html.replace(/<style[\s\S]*?<\/style>/gi, '');
  s = s.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|tr|h[1-6])\s*>/gi, '\n');
  s = s.replace(/<[^>]*>/g, '');
  s = decodeEntities(s);

  const lines = s.split(/\r?\n/).map((l) => l.replace(/[\s ]+/g, ' ').trim());
  const out: string[] = [];
  for (const line of lines) {
    // שורה ריקה אחת בין פסקאות נשמרת, רצף של ריקות מתכווץ לאחת.
    if (!line && (!out.length || !out[out.length - 1])) continue;
    out.push(line);
  }
  while (out.length && !out[out.length - 1]) out.pop();
  return out.length ? out.join('\n') : null;
}

/**
 * הערך של תת-הטופס כפי שחזר ב-`$expand`.
 *
 * 🔴 `undefined` פירושו "השדה לא התבקש בשאילתה הזאת" (למשל משיכת היסטוריה
 * בלי expand), ואז לא נוגעים בעמודה. `null` פירושו "התבקש וריק", ואז
 * מנקים: תאור שנמחק בפריוריטי לא נשאר אצלנו.
 */
export function faultTextFromExpand(sub: unknown): string | null | undefined {
  if (sub === undefined) return undefined;
  const rows = Array.isArray(sub) ? sub : sub ? [sub] : [];
  const parts = rows
    .map((r) => (r && typeof r === 'object' ? priorityHtmlToText((r as { TEXT?: unknown }).TEXT) : null))
    .filter((t): t is string => !!t);
  return parts.length ? parts.join('\n') : null;
}
