import test from 'node:test';
import assert from 'node:assert/strict';
import { SLOW_LOAD_MS, analyzeLoad, shouldPersist } from '../src/lib/perf.ts';

/**
 * 🔴 **הבדיקות שמגנות על המסקנה, לא על החישוב.**
 *
 * הדבר היחיד שמדידת ביצועים צריכה לומר הוא **מה על הנתיב הקריטי**.
 * חמש השליפות רצות במקביל, ודוח שמצביע על "הכי כבדה" במקום על "נגמרה
 * אחרונה" ישלח אותנו לייעל משהו שלא יקצר שנייה אחת.
 */

const mark = (o) => ({
  name: o.name,
  startedAt: o.from ?? 0,
  endedAt: o.to,
  rows: o.rows ?? 100,
  pages: o.pages ?? 1,
  ...(o.failed ? { failed: o.failed } : {}),
});

test('🔴🔴 הנתיב הקריטי הוא מי שנגמרה אחרונה, לא מי שהכי כבדה', () => {
  // ⭐ `pickups` מושכת פי שלושה שורות, אבל התחילה מוקדם ונגמרה לפני.
  // ייעול שלה לא יקצר את הטעינה ולו במילישנייה אחת.
  const r = analyzeLoad([
    mark({ name: 'pickups', from: 0, to: 1200, rows: 5642, pages: 6 }),
    mark({ name: 'orders', from: 900, to: 3000, rows: 1598, pages: 2 }),
  ]);
  assert.equal(r.critical.name, 'orders');
  assert.equal(r.totalMs, 3000);
  assert.match(r.verdict, /orders/);
});

test('זמן הקיר אינו סכום הזמנים, כי השליפות מקבילות', () => {
  const r = analyzeLoad([
    mark({ name: 'a', from: 0, to: 1000 }),
    mark({ name: 'b', from: 0, to: 1000 }),
    mark({ name: 'c', from: 0, to: 1000 }),
  ]);
  assert.equal(r.totalMs, 1000, 'זמן הקיר');
  assert.equal(r.sumMs, 3000, 'סכום הזמנים');
  assert.equal(r.parallelism, 3, 'שלוש שליפות באמת במקביל');
});

test('⭐ מקביליות של 1 מסגירה שליפות שרצות בפועל בטור', () => {
  const r = analyzeLoad([
    mark({ name: 'a', from: 0, to: 1000 }),
    mark({ name: 'b', from: 1000, to: 2000 }),
  ]);
  assert.equal(r.parallelism, 1);
  assert.equal(r.totalMs, 2000);
});

test('🔴 כשל נאמר לפני איטיות, כי הוא ההסבר לרשימה ריקה', () => {
  const r = analyzeLoad([
    mark({ name: 'orders', from: 0, to: 300, rows: 0, failed: 'Failed to fetch' }),
    mark({ name: 'pickups', from: 0, to: 9000, rows: 5642, pages: 6 }),
  ]);
  assert.equal(r.failures.length, 1);
  assert.match(r.verdict, /נכשלה/);
  assert.doesNotMatch(r.verdict, /תקין/);
});

test('שתי שליפות שנכשלו נאמרות ברבים ובשמן', () => {
  const r = analyzeLoad([
    mark({ name: 'orders', to: 300, failed: 'x' }),
    mark({ name: 'pickups', to: 300, failed: 'y' }),
  ]);
  assert.match(r.verdict, /2 שליפות נכשלו/);
  assert.match(r.verdict, /orders/);
  assert.match(r.verdict, /pickups/);
});

test('טעינה מהירה מוצגת כתקינה ולא מאשימה אף אחד', () => {
  const r = analyzeLoad([mark({ name: 'orders', to: 800 })]);
  assert.match(r.verdict, /תקין/);
});

test('הסבבים הסדרתיים נספרים, כי הם החלק היחיד שמצטבר', () => {
  const r = analyzeLoad([
    mark({ name: 'orders', to: 500, pages: 2, rows: 1598 }),
    mark({ name: 'pickups', to: 900, pages: 6, rows: 5642 }),
  ]);
  assert.equal(r.totalPages, 8);
  assert.equal(r.totalRows, 7240);
});

test('הרשימה ממוינת מהאיטית לזריזה, כי זה סדר הקריאה', () => {
  const r = analyzeLoad([
    mark({ name: 'fast', from: 0, to: 100 }),
    mark({ name: 'slow', from: 0, to: 900 }),
    mark({ name: 'mid', from: 0, to: 400 }),
  ]);
  assert.deepEqual(r.marks.map((m) => m.name), ['slow', 'mid', 'fast']);
});

test('🔴 בלי מדידות מחזיר דוח ריק ולא קורס', () => {
  const r = analyzeLoad([]);
  assert.equal(r.totalMs, 0);
  assert.equal(r.critical, null);
  assert.equal(shouldPersist(r), false);
});

test('🔴 נשמר רק מה שמסביר תלונה: כשל, או איטי מהסף', () => {
  // ⭐ אחרת עשרה עובדים × עשר פתיחות ביום הם 100 שורות רעש, ורעש הוא
  // הדרך הבטוחה לכך שאיש לא יסתכל בטבלה.
  assert.equal(shouldPersist(analyzeLoad([mark({ name: 'a', to: 900 })])), false);
  assert.equal(shouldPersist(analyzeLoad([mark({ name: 'a', to: SLOW_LOAD_MS })])), true);
  assert.equal(
    shouldPersist(analyzeLoad([mark({ name: 'a', to: 50, failed: 'boom' })])),
    true,
    'כשל נשמר תמיד, גם כשהוא מהיר'
  );
});
