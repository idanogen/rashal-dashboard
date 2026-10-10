/**
 * קפיצים בצורה סגורה, הועתקו מ-ogen-motion (`engine/engine.js`: step, SP).
 * 🔴 קובץ טהור בלי ייבוא, נבדק ב-`test/spring.test.mjs`. התזמון עצמו ב-`motion.ts`.
 */
export type SpringParams = [hz: number, zeta: number];

export const SP = {
  base: [1.6, 0.86] as SpringParams,
  soft: [1.0, 0.9] as SpringParams,
  snap: [2.4, 0.78] as SpringParams,
  fast: [3.6, 0.92] as SpringParams,
  glide: [1.1, 1] as SpringParams,
  stiff: [4.2, 1] as SpringParams,
};

/** מיקום הקפיץ בזמן tau (שניות), 0 בהתחלה, מתכנס ל-1; עשוי לעבור את 1 כשהריסון מתחת ל-1. */
export function step(tau: number, p: SpringParams): number {
  if (tau <= 0) return 0;
  const w = 2 * Math.PI * p[0];
  const z = p[1];
  if (z >= 1) return 1 - Math.exp(-w * tau) * (1 + w * tau);
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * tau) * (Math.cos(wd * tau) + (z * w / wd) * Math.sin(wd * tau));
}

export const clamp01 = (k: number): number => Math.min(1, Math.max(0, k));

/**
 * הטקסט של מספר שסופר למקום: שומר על הסיומת (%, אחוז) ועל ספרה אחרי הנקודה.
 * מחזיר null כשהטקסט אינו מספר ("אין דיווח", "…"), ואז לא סופרים.
 */
export function countText(finalText: string, k: number): string | null {
  const m = finalText.trim().match(/^(-?[\d,]+(?:\.\d+)?)(\s*%?)$/);
  if (!m) return null;
  const target = parseFloat(m[1].replace(/,/g, ''));
  if (!Number.isFinite(target)) return null;
  const dec = (m[1].split('.')[1] ?? '').length;
  const v = target * clamp01(k);
  const num = dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-US');
  return `${num}${m[2]}`;
}
