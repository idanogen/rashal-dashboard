import { SP, clamp01, countText, step, type SpringParams } from './spring';

/**
 * שכבת התנועה של הדשבורד (09/10/2026): קפיצים על requestAnimationFrame.
 *
 * ⭐ הלקח מ-ORDio (29/09): במערכת אמיתית הקצב איטי מהפרוטוטייפ, אין קופסה
 * ריקה (התוכן כבר במקום, רק נכנס), ו-prefers-reduced-motion מקבל את המצב
 * הסופי מיד. כל עזר מנקה אחריו את ה-style, כדי שלא יישאר אלמנט חבוי.
 */
export { SP };

export function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface Job { fn: (k: number) => void; p: SpringParams; delay: number; len: number; t0: number; done: boolean; res: () => void }
let jobs: Job[] = [];
let raf = 0;

function tick(now: number) {
  let live = false;
  for (const j of jobs) {
    if (j.done) continue;
    const tau = (now - j.t0) / 1000 - j.delay;
    if (tau < 0) { live = true; continue; }
    if (tau >= j.len) { j.fn(1); j.done = true; j.res(); continue; }
    j.fn(step(tau, j.p));
    live = true;
  }
  jobs = jobs.filter((j) => !j.done);
  raf = live ? requestAnimationFrame(tick) : 0;
}

/** מריץ fn(k) עם קפיץ 0→1 (k עשוי לעבור את 1); מסתיים אחרי len שניות ב-fn(1). */
export function run(fn: (k: number) => void, p: SpringParams = SP.base, delay = 0, len = 1.4): Promise<void> {
  return new Promise((res) => {
    if (reducedMotion() || typeof requestAnimationFrame !== 'function') { fn(1); res(); return; }
    jobs.push({ fn, p, delay, len, t0: performance.now(), done: false, res });
    if (!raf) raf = requestAnimationFrame(tick);
  });
}

/** עולה למקום מ-dy פיקסלים מתחת, ומנקה את ה-style בסוף. */
export function rise(el: HTMLElement, delay = 0, dy = 14, p: SpringParams = SP.base): Promise<void> {
  if (reducedMotion()) return Promise.resolve();
  el.style.opacity = '0';
  return run((k) => {
    if (k >= 1) { el.style.opacity = ''; el.style.transform = ''; return; }
    el.style.opacity = clamp01(k).toFixed(3);
    el.style.transform = `translateY(${((1 - k) * dy).toFixed(2)}px)`;
  }, p, delay);
}

/** פס שנמתח מהקצה ההתחלתי (ב-RTL: מימין). */
export function stretch(el: HTMLElement, delay = 0, p: SpringParams = SP.base): Promise<void> {
  if (reducedMotion()) return Promise.resolve();
  el.style.transformOrigin = '100% 50%';
  el.style.transform = 'scaleX(0)';
  return run((k) => { el.style.transform = k >= 1 ? '' : `scaleX(${Math.max(0, k).toFixed(4)})`; }, p, delay, 1.3);
}

/**
 * סופר מספר למקום. הטקסט הסופי כבר ב-DOM; מחליפים אותו תוך כדי ומחזירים
 * אותו בדיוק בסוף. טקסט שאינו מספר ("אין דיווח") לא נוגעים בו.
 */
export function countUp(el: HTMLElement, delay = 0, p: SpringParams = SP.glide, len = 1.4): Promise<void> {
  const finalText = el.textContent ?? '';
  if (reducedMotion() || countText(finalText, 1) == null) return Promise.resolve();
  return run((k) => { el.textContent = k >= 1 ? finalText : (countText(finalText, k) ?? finalText); }, p, delay, len);
}

export function stagger<T extends Element>(list: Iterable<T>, fn: (el: T, delay: number, i: number) => Promise<void>, gap = 0.08, cap = 0.9): Promise<void[]> {
  return Promise.all([...list].map((el, i) => fn(el, Math.min(i * gap, cap), i)));
}
