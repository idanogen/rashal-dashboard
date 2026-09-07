import test from 'node:test';
import assert from 'node:assert/strict';
import { priorityLocalToUtc, hasClockTime } from '../api/_lib/priority-time.ts';

/**
 * 🔴 המקרה שנמדד: SC2603167 נפתחה 16:39 שעון ישראל ב-07/09/2026 (קיץ, UTC+3).
 * לפני התיקון נשמרה כ-16:39Z והוצגה 19:39.
 */
test('summer wall time shifts back three hours', () => {
  assert.equal(priorityLocalToUtc('2026-09-07T16:39:00Z'), '2026-09-07T13:39:00Z');
});

test('winter wall time shifts back two hours', () => {
  assert.equal(priorityLocalToUtc('2026-12-15T09:05:00Z'), '2026-12-15T07:05:00Z');
});

test('a late evening call stays on its own day in Israel', () => {
  // 21:30 בישראל = 18:30Z. לפני התיקון זה היה 21:30Z = 00:30 למחרת בישראל.
  assert.equal(priorityLocalToUtc('2026-09-07T21:30:00Z'), '2026-09-07T18:30:00Z');
});

/** ⭐ תאריך בלבד (CURDATE, IVDATE) לא זז, אחרת `::date` נופל לאתמול. */
test('date-only values are left untouched', () => {
  assert.equal(priorityLocalToUtc('2026-09-07T00:00:00Z'), '2026-09-07T00:00:00Z');
  assert.equal(hasClockTime('2026-09-07T00:00:00Z'), false);
  assert.equal(hasClockTime('2026-09-07T00:01:00Z'), true);
});

test('explicit offsets are trusted as they are', () => {
  assert.equal(priorityLocalToUtc('2026-09-07T16:39:00+03:00'), '2026-09-07T16:39:00+03:00');
});

test('null and garbage pass through', () => {
  assert.equal(priorityLocalToUtc(null), null);
  assert.equal(priorityLocalToUtc(''), null);
  assert.equal(priorityLocalToUtc('not a date'), 'not a date');
});

/** אימות בהיפוך: אם ההזזה הייתה מתעלמת מהחורף, הבדיקה הזו נופלת. */
test('summer and winter differ by exactly one hour of offset', () => {
  const s = Date.parse('2026-07-01T12:00:00Z') - Date.parse(priorityLocalToUtc('2026-07-01T12:00:00Z'));
  const w = Date.parse('2026-01-01T12:00:00Z') - Date.parse(priorityLocalToUtc('2026-01-01T12:00:00Z'));
  assert.equal(s, 3 * 3600_000);
  assert.equal(w, 2 * 3600_000);
});
