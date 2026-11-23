import test from 'node:test';
import assert from 'node:assert/strict';
import { nearestZone, distanceKm, MAX_ZONE_DISTANCE_KM } from '../src/lib/zone-nearest.ts';

/** סינון "צפון" הסתיר את דיר חנא (שלומי 22/11/2026): יישוב מחוץ לרשימה מקבל את אזור העיר הקרובה. */
const anchors = [
  { point: { lat: 32.81912, lng: 34.99839 }, zoneId: 'haifa' },
  { point: { lat: 32.91, lng: 35.30 }, zoneId: 'galil-valleys' }, // כרמיאל
  { point: { lat: 31.77, lng: 35.21 }, zoneId: 'jerusalem' },
];

test('דיר חנא נופלת על כרמיאל, גליל-עמקים', () => {
  assert.equal(nearestZone({ lat: 32.8625, lng: 35.36666 }, anchors), 'galil-valleys');
});

test('כינוי באותה נקודה בדיוק מקבל את אותו אזור', () => {
  assert.equal(nearestZone({ lat: 31.77, lng: 35.21 }, anchors), 'jerusalem');
});

test('בלי נקודה או רחוק מכל עיר: אין אזור, לא מנחשים', () => {
  assert.equal(nearestZone(undefined, anchors), undefined);
  assert.equal(nearestZone({ lat: 29.55, lng: 34.95 }, anchors), undefined); // אילת מול רשימה בלי דרום
  assert.equal(nearestZone({ lat: 32.8, lng: 35.0 }, []), undefined);
});

test('מרחק בק"מ סביר', () => {
  const km = distanceKm({ lat: 32.81912, lng: 34.99839 }, { lat: 31.77, lng: 35.21 });
  assert.ok(km > 110 && km < 125, String(km));
  assert.ok(MAX_ZONE_DISTANCE_KM >= 30);
});
