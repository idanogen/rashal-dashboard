// סידור עצירות דרך מרכז המיקום (19/11/2026, אחרי התלונה של אבירם על "סדר מחדש מהמחסן").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRouteRequest, mergeRouteOrder } from '../src/lib/route-order.ts';

const WH = { lat: 31.973, lng: 34.7925 };

test('עצירה בלי נקודה לא נשלחת ונכנסת בסוף', () => {
  const { body, withoutCoords } = buildRouteRequest(
    [
      { id: 'a', coordinates: { lat: 32.08, lng: 34.88 } },
      { id: 'b' },
      { id: 'c', coordinates: { lat: 32.17, lng: 34.9 } },
    ],
    WH,
  );
  assert.deepEqual(body.stops.map((s) => s.id), ['a', 'c']);
  assert.deepEqual(body.start, [31.973, 34.7925]);
  assert.deepEqual(body.end, [31.973, 34.7925]);
  assert.deepEqual(withoutCoords, ['b']);
  assert.deepEqual(mergeRouteOrder(['a', 'c'], ['c', 'a'], withoutCoords), ['c', 'a', 'b']);
});

test('תשובה חלקית או זרה לא משנה את הסדר', () => {
  assert.equal(mergeRouteOrder(['a', 'c'], ['c'], []), null);
  assert.equal(mergeRouteOrder(['a', 'c'], ['c', 'x'], []), null);
  assert.equal(mergeRouteOrder(['a', 'c'], ['a', 'a'], []), null);
  assert.equal(mergeRouteOrder(['a', 'c'], undefined, []), null);
});
