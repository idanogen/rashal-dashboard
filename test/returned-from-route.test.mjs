import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReturnedMap, returnedIdSet, returnedMeta } from '../src/lib/returned-from-route.ts';

/**
 * 🔴 מה שנבדק כאן הוא ש**הסיבה נוסעת עם החיווי**. עד 19/08/2026 המנהל
 * ראה "חזר מהקו" ולא ראה מילה ממה שהנהג כתב, בזמן שהמערכת חסמה את הנהג
 * מלסמן בלי לכתוב. בדיקה שמוודאת רק "מי חזר" הייתה עוברת גם אז.
 */

const stop = (o) => ({
  id: o.id,
  deliveryDate: o.date,
  driver: o.driver ?? 'דוד',
  sequence: 0,
  sourceType: o.source ?? 'service',
  serviceCallId: o.callId,
  orderId: o.orderId,
  pickupId: o.pickupId,
  customerName: o.name ?? 'לקוח',
  status: o.status ?? 'not_completed',
  completedAt: o.at,
  notes: o.notes,
});

test('הסיבה שהנהג רשם מגיעה עם הישות', () => {
  const map = buildReturnedMap(
    [stop({ id: 's1', date: '2026-08-19', callId: 'c1', notes: 'טופל אתמול על ידי ישראל' })],
    'service',
  );
  assert.equal(map.get('c1').note, 'טופל אתמול על ידי ישראל');
  assert.equal(map.get('c1').driver, 'דוד');
  assert.equal(returnedMeta(map.get('c1')), 'דוד · 19/08');
});

test('רק עצירות "לא בוצע", ורק מהסוג המבוקש', () => {
  const stops = [
    stop({ id: 's1', date: '2026-08-19', callId: 'c1', status: 'completed', notes: 'בוצע' }),
    stop({ id: 's2', date: '2026-08-19', orderId: 'o1', source: 'delivery', notes: 'לא היה בבית' }),
    stop({ id: 's3', date: '2026-08-19', callId: 'c2', notes: 'בוטל' }),
  ];
  assert.deepEqual([...buildReturnedMap(stops, 'service').keys()], ['c2']);
  assert.deepEqual([...buildReturnedMap(stops, 'delivery').keys()], ['o1']);
  assert.equal(buildReturnedMap(stops, 'pickup').size, 0);
});

test('🔴 שני ניסיונות: מנצחת הסיבה של הניסיון האחרון', () => {
  const older = stop({ id: 's1', date: '2026-08-12', callId: 'c1', notes: 'לא ענה' });
  const newer = stop({ id: 's2', date: '2026-08-19', callId: 'c1', notes: 'טופל על ידי ישראל' });
  // בשני סדרי הגעה, כדי שהתוצאה לא תהיה תלויה בסדר השורות מהמסד
  assert.equal(buildReturnedMap([older, newer], 'service').get('c1').note, 'טופל על ידי ישראל');
  assert.equal(buildReturnedMap([newer, older], 'service').get('c1').note, 'טופל על ידי ישראל');
});

test('🔴 אותו יום: מכריעה שעת הסימון', () => {
  const morning = stop({ id: 's1', date: '2026-08-19', callId: 'c1', at: '2026-08-19T07:00:00Z', notes: 'בוקר' });
  const evening = stop({ id: 's2', date: '2026-08-19', callId: 'c1', at: '2026-08-19T13:20:00Z', notes: 'ערב' });
  assert.equal(buildReturnedMap([morning, evening], 'service').get('c1').note, 'ערב');
  assert.equal(buildReturnedMap([evening, morning], 'service').get('c1').note, 'ערב');
});

test('עצירה ישנה בלי סיבה מחזירה null, לא מחרוזת ריקה', () => {
  const map = buildReturnedMap([stop({ id: 's1', date: '2026-08-19', callId: 'c1', notes: '   ' })], 'service');
  assert.equal(map.get('c1').note, null);
});

test('עצירה בלי מפתח ישות מדולגת ולא מפילה', () => {
  const map = buildReturnedMap([stop({ id: 's1', date: '2026-08-19', callId: undefined, notes: 'x' })], 'service');
  assert.equal(map.size, 0);
});

test('returnedIdSet נותן בדיוק את אותם מפתחות', () => {
  const map = buildReturnedMap(
    [stop({ id: 's1', date: '2026-08-19', callId: 'c1' }), stop({ id: 's2', date: '2026-08-19', callId: 'c2' })],
    'service',
  );
  assert.deepEqual([...returnedIdSet(map)].sort(), ['c1', 'c2']);
});
