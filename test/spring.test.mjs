import test from 'node:test';
import assert from 'node:assert/strict';
import { SP, step, countText, clamp01 } from '../src/lib/spring.ts';

test('הקפיץ מתחיל ב-0, מתכנס ל-1, והרך לא עובר את 1', () => {
  assert.equal(step(0, SP.base), 0);
  assert.equal(step(-1, SP.base), 0);
  for (const p of Object.values(SP)) assert.ok(Math.abs(step(4, p) - 1) < 1e-3, `${p} converges`);
  // ריסון 1 (glide, stiff): מונוטוני ובלי חריגה
  let prev = 0;
  for (let t = 0; t <= 2; t += 0.02) { const v = step(t, SP.glide); assert.ok(v >= prev - 1e-9 && v <= 1 + 1e-9); prev = v; }
  // ריסון מתחת ל-1 (snap): עובר את 1 פעם אחת, זה הקפיץ
  let over = false;
  for (let t = 0; t <= 2; t += 0.02) if (step(t, SP.snap) > 1.005) over = true;
  assert.equal(over, true);
});

test('ספירה למקום שומרת סיומת ועשרוני, ולא נוגעת בטקסט', () => {
  assert.equal(countText('73%', 0), '0%');
  assert.equal(countText('73%', 0.5), '37%');
  assert.equal(countText('73%', 1), '73%');
  assert.equal(countText('1,234', 1), '1,234');
  assert.equal(countText('1,234', 0.5), '617');
  assert.equal(countText('4.5', 0.5), '2.3');
  assert.equal(countText('אין דיווח', 0.5), null);
  assert.equal(countText('…', 0.5), null);
  assert.equal(countText('19', 2), '19');
  assert.equal(clamp01(1.3), 1);
});
