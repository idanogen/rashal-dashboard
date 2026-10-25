/**
 * משתני תבנית: מהמבנה של v2.0 (`[{name, value}]`) למבנה של v3 (`{שם: ערך}`).
 *
 * 🔴 זה השינוי המסוכן בהגירה (`docs/heyy-limits.md` §4): משתנה שלא הומר
 * מגיע ללקוח ריק, בלי שום שגיאה. לכן פונקציה אחת, טהורה ובדוקה, וכל
 * הקוראים הישנים עוברים דרכה.
 */
export function variablesToV3(variables: Array<{ name: string; value: string }> = []): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of variables) {
    const name = String(v?.name ?? '').trim();
    if (!name) continue;
    out[name] = String(v?.value ?? '');
  }
  return out;
}
