import test from 'node:test';
import assert from 'node:assert/strict';
import { geocodeQuery } from '../src/lib/geocode-query.ts';

/**
 * 🔴 25/10/2026: הרחוב נשלח בלי העיר, וכ-45% מהכתובות נפלו למרכז העיר.
 * הכתובות כאן הן אלה שנכשלו בפועל ונמצאו מדויקות כשהעיר צורפה.
 */

test('העיר מצטרפת לרחוב', () => {
  assert.equal(geocodeQuery('קרן היסוד 16', 'בת ים'), 'קרן היסוד 16, בת ים');
  assert.equal(geocodeQuery('זית 7', 'מבשרת ציון'), 'זית 7, מבשרת ציון');
});

test('עיר שכבר בתוך הכתובת לא מוכפלת', () => {
  assert.equal(geocodeQuery('סמילנסקי 21 נתניה', 'נתניה'), 'סמילנסקי 21 נתניה');
  assert.equal(geocodeQuery('הרצל 5, תל-אביב', 'תל אביב'), 'הרצל 5, תל-אביב');
});

test('בלי עיר: הכתובת כמו שהיא, בלי פסיק מיותר', () => {
  assert.equal(geocodeQuery('  הרצל 10 ', undefined), 'הרצל 10');
  assert.equal(geocodeQuery('הרצל 10', '  '), 'הרצל 10');
  assert.equal(geocodeQuery('הרצל 10', null), 'הרצל 10');
});
