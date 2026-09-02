import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_DAYS_FOR_RATE,
  OPEN_BACKLOG_ALERT,
  needsAttention,
  orderPeople,
  pct,
  toPersonRow,
} from '../src/lib/team-metrics.ts';

/**
 * 🔴🔴 **הבדיקות שמגנות על אנשים.** המדדים כאן מוצגים להנהלה על עובדים
 * בשמם, ולכן כל טעות כאן היא שיחת משמעת על סמך מספר שגוי.
 */

const p = (o = {}) => ({
  name: 'נהג', kind: 'driver', stops: 0, arrived: 0, completed: 0,
  notCompleted: 0, openFromPast: 0, activeDays: 10, closedSameDay: 0, ...o,
});

test('🔴🔴 עצירה שנשארה פתוחה אינה "לא בוצעה", והמכנה הוא מה שנסגר', () => {
  // רודי, מהמדידה האמיתית של 02/09: 271 משובצות, 75 בוצעו, 38 לא בוצעו, 156 פתוחות
  const r = toPersonRow(p({ stops: 271, completed: 75, notCompleted: 38, openFromPast: 156, activeDays: 26 }));
  // התמים היה 75/271 = 28%. הנכון הוא 75 מתוך 113 שנסגרו.
  assert.equal(Math.round(r.closeRate), 66);
  assert.equal(r.openFromPast, 156);
});

test('🔴 בלי סגירות בכלל אין אחוז, ולא אפס', () => {
  const r = toPersonRow(p({ stops: 33, completed: 0, notCompleted: 0, openFromPast: 27, activeDays: 1 }));
  assert.equal(r.closeRate, null);
  assert.equal(pct(r.closeRate), '·');
});

test('🔴 קצב מוצג רק ממספיק ימי פעילות', () => {
  assert.equal(toPersonRow(p({ activeDays: MIN_DAYS_FOR_RATE - 1, completed: 29 })).perDay, null);
  assert.equal(toPersonRow(p({ activeDays: MIN_DAYS_FOR_RATE - 1 })).tooFewDays, true);
  const ok = toPersonRow(p({ activeDays: 10, completed: 30, notCompleted: 0 }));
  assert.equal(ok.perDay, 3);
  assert.equal(ok.tooFewDays, false);
});

test('🔴 המיון לפי כמות שנסגרה, לא לפי אחוז', () => {
  const perfect = toPersonRow(p({ name: 'מושלם', completed: 1, notCompleted: 0, activeDays: 10 }));
  const workhorse = toPersonRow(p({ name: 'סוס עבודה', completed: 237, notCompleted: 37, activeDays: 44 }));
  assert.deepEqual(orderPeople([perfect, workhorse]).map((r) => r.name), ['סוס עבודה', 'מושלם']);
});

test('מי שכמעט לא נכח יורד לתחתית, גם עם 100 אחוז', () => {
  const ghost = toPersonRow(p({ name: 'רפאים', completed: 1, activeDays: 1 }));
  const real = toPersonRow(p({ name: 'אמיתי', completed: 50, notCompleted: 10, activeDays: 30 }));
  assert.deepEqual(orderPeople([ghost, real]).map((r) => r.name), ['אמיתי', 'רפאים']);
});

test('🔴 רשימת הפתוחות ממוינת מהגדול, ולא לפי סדר התפוקה', () => {
  const rows = [
    toPersonRow(p({ name: 'דוד', completed: 237, openFromPast: 37, activeDays: 44 })),
    toPersonRow(p({ name: 'רודי', completed: 75, openFromPast: 156, activeDays: 26 })),
  ];
  assert.deepEqual(needsAttention(rows).map((r) => r.name), ['רודי', 'דוד']);
});

test('סף הפתוחות הוא מספר מוחלט ולא אחוז', () => {
  const many = toPersonRow(p({ name: 'הרבה', openFromPast: OPEN_BACKLOG_ALERT, stops: 1000 }));
  const few = toPersonRow(p({ name: 'מעט', openFromPast: OPEN_BACKLOG_ALERT - 1, stops: 12 }));
  assert.deepEqual(needsAttention([many, few]).map((r) => r.name), ['הרבה']);
});

test('אחוז סגירה באותו יום נגזר מהבוצעות בלבד', () => {
  const r = toPersonRow(p({ completed: 197, closedSameDay: 178 }));
  assert.equal(Math.round(r.sameDayRate), 90);
  assert.equal(toPersonRow(p({ completed: 0, closedSameDay: 0 })).sameDayRate, null);
});
