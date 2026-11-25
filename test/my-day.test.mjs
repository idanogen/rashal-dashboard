import test from 'node:test';
import assert from 'node:assert/strict';
import { waitingSummary, driversForDay, neededPerDay } from '../src/lib/my-day.ts';

test('waitingSummary: ספירה, הוותיק ביותר, וכמה חזרו מהקו', () => {
  const now = new Date('2026-11-25T10:00:00Z').getTime();
  const r = waitingSummary([
    { id: 'a', created: '2026-11-15T09:00:00Z' },
    { id: 'b', created: '2026-11-24T09:00:00Z' },
    { id: 'c', created: null },
  ], new Set(['b']), now);
  assert.deepEqual(r, { count: 3, oldestDays: 10, returned: 1 });
  assert.deepEqual(waitingSummary([], new Set(), now), { count: 0, oldestDays: null, returned: 0 });
});

test('driversForDay: רק אספקות ואיסופים של אותו יום, לפי נהג, העמוס ראשון', () => {
  const rows = driversForDay([
    { driver: 'אולג', deliveryDate: '2026-11-25', status: 'completed', sourceType: 'delivery' },
    { driver: 'אולג', deliveryDate: '2026-11-25', status: 'planned', sourceType: 'pickup' },
    { driver: 'מיכאל', deliveryDate: '2026-11-25', status: 'not_completed', sourceType: 'delivery' },
    { driver: 'מיכאל', deliveryDate: '2026-11-25', status: 'planned', sourceType: 'service' },
    { driver: 'אולג', deliveryDate: '2026-11-26', status: 'planned', sourceType: 'delivery' },
    { driver: null, deliveryDate: '2026-11-25', status: 'planned', sourceType: 'delivery' },
  ], '2026-11-25');
  assert.equal(rows.length, 3);
  assert.equal(rows[0].driver, 'אולג');
  assert.deepEqual(rows[0].deliveries, { planned: 0, done: 1, notDone: 0 });
  assert.deepEqual(rows[0].pickups, { planned: 1, done: 0, notDone: 0 });
  assert.ok(rows.some((r) => r.driver === 'לא משובץ לנהג'));
});

test('neededPerDay', () => {
  assert.equal(neededPerDay(147, 81, 2), 33);
  assert.equal(neededPerDay(147, 150, 2), null);
  assert.equal(neededPerDay(147, 81, 0), null);
});
