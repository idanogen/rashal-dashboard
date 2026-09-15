import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseLights,
  isSchedulable,
  blockReason,
  touchLabel,
  mediaLabel,
  countLights,
  isOldRed,
  compareByLight,
} from '../src/lib/service-call-light.ts';

/**
 * רמזור קריאות השירות (עידן, 15/09/2026). הצורות הן מה ש-service_call_lights מחזירה.
 */

const NOW = new Date('2026-09-15T12:00:00Z');
const row = (o) => ({ service_call_id: o.id, light: o.light, opened_at: o.opened ?? '2026-09-15T08:00:00Z', images: o.images ?? 0, videos: o.videos ?? 0, ...o.extra });

test('🔴 אדום וצהוב לא משבצים, ירוק וכתום כן, ולא נטען לא חוסם', () => {
  assert.equal(isSchedulable('green'), true);
  assert.equal(isSchedulable('orange'), true);
  assert.equal(isSchedulable('red'), false);
  assert.equal(isSchedulable('yellow'), false);
  assert.equal(isSchedulable(undefined), true, 'תקלה בטעינת הרמזור לא עוצרת את השיבוץ');
  assert.match(blockReason('red'), /ירוקה ידנית/);
  assert.match(blockReason('yellow'), /מגיע לבד/);
  assert.equal(blockReason('green'), null);
});

test('תג "נהג כבר נגע": היה אצל הלקוח מול ניסה', () => {
  const m = parseLights([
    row({ id: 'a', light: 'orange', extra: { touch_driver: 'אולג', touch_date: '2026-09-14', touch_status: 'not_completed', touch_kind: 'follow_up', touch_note: 'חסר חלק, צריך להזמין' } }),
    row({ id: 'b', light: 'red', extra: { touch_driver: 'אולג', touch_date: '2026-09-14', touch_status: 'not_completed', touch_kind: 'not_done' } }),
    row({ id: 'c', light: 'red', extra: { touch_driver: 'דוד חסידים', touch_date: '2026-07-14', touch_status: 'not_completed', touch_kind: null } }),
    row({ id: 'd', light: 'green' }),
  ]);
  assert.equal(touchLabel(m.get('a').touch), 'אולג היה אצל הלקוח · 14/09');
  assert.equal(touchLabel(m.get('b').touch), 'אולג ניסה · 14/09');
  assert.equal(touchLabel(m.get('c').touch), 'דוד חסידים ניסה · 14/07', 'עצירה ישנה בלי סוג = לא הגיע');
  assert.equal(touchLabel(m.get('d').touch), null);
});

test('ירוק ידני נושא חתימה, ושורות פסולות נזרקות', () => {
  const m = parseLights([
    row({ id: 'g', light: 'green', extra: { manual_by: 'עמי גז', manual_at: '2026-09-15T11:20:00Z', manual_reason: 'phone_described' } }),
    { service_call_id: 'x', light: 'purple' },
    { light: 'red' },
  ]);
  assert.equal(m.size, 1);
  assert.equal(m.get('g').manual.by, 'עמי גז');
  assert.equal(m.get('g').manual.reason, 'phone_described');
});

test('ספירה לרמזור, כולל פילוח האדום לפי ותק', () => {
  const m = parseLights([
    row({ id: '1', light: 'red', opened: '2026-09-14T08:00:00Z' }),
    row({ id: '2', light: 'red', opened: '2026-09-05T08:00:00Z' }),
    row({ id: '3', light: 'red', opened: '2026-06-01T08:00:00Z' }),
    row({ id: '4', light: 'green', images: 1, videos: 1 }),
    row({ id: '5', light: 'yellow' }),
    row({ id: '6', light: 'orange' }),
  ]);
  const c = countLights(m.values(), NOW);
  assert.deepEqual(c, { orange: 1, green: 1, red: 3, yellow: 1, redWeek: 1, redLastWeek: 1, redOld: 1 });
  assert.equal(isOldRed(m.get('3'), NOW), true);
  assert.equal(isOldRed(m.get('2'), NOW), false, '10 ימים עדיין לא ותיקה');
  assert.equal(mediaLabel(m.get('4')), '📷 תמונה · ▶ סרטון');
});

test('סדר: כתום, ירוק, אדום, צהוב, ובתוך צבע החדש קודם', () => {
  const m = parseLights([
    row({ id: 'y', light: 'yellow' }),
    row({ id: 'r-old', light: 'red', opened: '2026-08-01T08:00:00Z' }),
    row({ id: 'r-new', light: 'red', opened: '2026-09-15T08:00:00Z' }),
    row({ id: 'g', light: 'green' }),
    row({ id: 'o', light: 'orange' }),
  ]);
  const ids = [...m.keys()].sort((a, b) => compareByLight(m.get(a), m.get(b)));
  assert.deepEqual(ids, ['o', 'g', 'r-new', 'r-old', 'y']);
});
