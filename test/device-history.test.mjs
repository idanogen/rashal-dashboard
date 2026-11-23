import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDeviceHistory, groupByOwner, visitLabel, deviceSummary } from '../src/lib/device-history.ts';

/** היסטוריית מכשיר (עידן 23/11/2026): מכשיר עובר בין לקוחות, ההיסטוריה הולכת איתו. */
const raw = {
  serial: 'JB611519443C60',
  device_desc: 'כסא ממונע Q6',
  total: 4,
  customers: 2,
  calls: [
    { id: 'a', created: '2026-11-03T09:55:00Z', current: true, customer_name: 'דולי', customer_number: '100',
      fault: 'רעש', visits: [{ date: '2026-11-05', driver: 'אולג', status: 'completed', kind: null, note: 'הוחלף קפיץ' }],
      notes: [{ at: '2026-11-05T10:00:00Z', by: 'אולג', text: 'בוצע' }, { at: 'x', text: '' }],
      media: [{ bucket: 'timeline-files', path: 'a/1.jpg', type: 'image', at: '2026-11-05T10:00:00Z' }, { path: '' }] },
    { id: 'b', created: '2026-10-04T07:47:00Z', customer_name: 'דולי', customer_number: '100' },
    { id: 'c', created: '2023-11-22T08:46:00Z', customer_name: 'פוטשניק', customer_number: '200' },
    { id: 'd', created: '2023-01-01T08:46:00Z', customer_name: 'דולי', customer_number: '100' },
    { created: 'broken' },
  ],
};

test('פענוח: שדות חסרים וזבל לא שוברים', () => {
  const h = parseDeviceHistory(raw);
  assert.equal(h.calls.length, 4);
  assert.equal(h.calls[0].current, true);
  assert.equal(h.calls[0].notes.length, 1);
  assert.equal(h.calls[0].media.length, 1);
  assert.equal(h.calls[1].visits.length, 0);
  assert.deepEqual(parseDeviceHistory(null), { serial: null, deviceDesc: null, calls: [], total: 0, customers: 0 });
});

test('קבוצה לכל תקופה אצל לקוח, ולקוח שחזר מקבל תקופה חדשה', () => {
  const g = groupByOwner(parseDeviceHistory(raw).calls);
  assert.deepEqual(g.map((x) => [x.customerName, x.calls.length]), [['דולי', 2], ['פוטשניק', 1], ['דולי', 1]]);
});

test('תווית ביקור וסיכום', () => {
  assert.equal(visitLabel({ status: 'completed', kind: 'follow_up' }), 'המשך טיפול');
  assert.equal(visitLabel({ status: 'completed', kind: null }), 'בוצע');
  assert.equal(visitLabel({ status: 'not_completed', kind: null }), 'לא בוצע');
  assert.equal(visitLabel({ status: 'pending', kind: null }), '');
  assert.equal(deviceSummary({ total: 21, customers: 3 }), '21 קריאות · 3 לקוחות');
  assert.equal(deviceSummary({ total: 1, customers: 1 }), 'קריאה אחת');
});
