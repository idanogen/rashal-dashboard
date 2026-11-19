// כשל זמני של שירות המפות אינו "כתובת לא נמצאה" (19/11/2026).
// עד היום geocodeAddress החזיר null גם על 503, ו-geocodeStopAddress רשם
// geocoded_at ככישלון: העצירה לא נוסתה שוב 30 יום. 18 מ-28 "נכשלות" נמצאו בניסיון חוזר.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const geo = readFileSync(new URL('../src/lib/geocoding.ts', import.meta.url), 'utf8');
const stops = readFileSync(new URL('../src/lib/calendar-stops.ts', import.meta.url), 'utf8');

test('geocodeAddress מחזיר transient ולא null על כשל זמני', () => {
  assert.match(geo, /if \(result === 'transient'\) return 'transient';/);
  assert.match(geo, /Promise<GeocodeResult \| null \| 'transient'>/);
});

test('geocodeStopAddress לא כותב חותמת כישלון על כשל זמני', () => {
  const body = stops.slice(stops.indexOf('export async function geocodeStopAddress'));
  const guard = body.indexOf("if (result === 'transient') return false;");
  const failWrite = body.indexOf('geocoded_at: new Date().toISOString() })');
  assert.ok(guard > 0, 'חסר טיפול בכשל זמני');
  assert.ok(guard < failWrite, 'הטיפול בכשל זמני חייב לבוא לפני רישום הכישלון');
});
