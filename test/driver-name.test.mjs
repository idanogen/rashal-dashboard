import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DRIVER_FIELD, DRIVER_FIELD_WIDTH, driverFieldValue, classifyDriverWrite,
} from '../supabase/functions/rashal-call-status/driver-name.ts';

/** "שם נהג / טכנאי" בפריוריטי ברגע השיבוץ (עידן, 13/11/2026). */

test('השם נכתב כמו שהוא אצלנו, גם למי שאין לו משתמש בפריוריטי', () => {
  assert.equal(driverFieldValue('מוהנד'), 'מוהנד');
  assert.equal(driverFieldValue('  דוד חסידים '), 'דוד חסידים');
});

test('ריק או חסר = אין מה לכתוב', () => {
  assert.equal(driverFieldValue(null), '');
  assert.equal(driverFieldValue(undefined), '');
  assert.equal(driverFieldValue('   '), '');
});

test('🔴 שם ארוך נחתך לרוחב השדה, בלי רווח בקצה', () => {
  const v = driverFieldValue('אברהם יצחק בן שושן הלוי');
  assert.equal(v.length <= DRIVER_FIELD_WIDTH, true);
  assert.equal(v, v.trim());
  assert.equal(driverFieldValue('אברהם יצחק בן שושן'), 'אברהם יצחק בן ש');
  assert.equal(driverFieldValue('אברהם יצחק בנו שושן'), 'אברהם יצחק בנו');
});

test('כתיבה שעברה ונקראה חזרה = done', () => {
  assert.equal(classifyDriverWrite(200, 'מוהנד', 'מוהנד'), 'done');
  assert.equal(classifyDriverWrite(204, 'אבי', 'אבי '), 'done');
});

test('🔴 200 בלי שהשם חזר בקריאה החוזרת = failed, לא done', () => {
  assert.equal(classifyDriverWrite(200, 'מוהנד', null), 'failed');
  assert.equal(classifyDriverWrite(200, 'מוהנד', 'אבי'), 'failed');
});

test('דחייה של פריוריטי (4xx) נעצרת, תקלה זמנית חוזרת', () => {
  assert.equal(classifyDriverWrite(400, 'אבי', null), 'failed');
  assert.equal(classifyDriverWrite(404, 'אבי', null), 'failed');
  for (const http of [408, 429, 500, 502, 503]) assert.equal(classifyDriverWrite(http, 'אבי', null), 'retry');
});

test('🔴 רוחב השדה בקוד ובטריגר במיגרציה זהה לשם השדה שאומת', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261113_call_driver_name.sql', import.meta.url), 'utf8');
  assert.equal(DRIVER_FIELD, 'TOPP_DRIVERNAME');
  assert.match(sql, /create table if not exists public\.priority_call_driver_writes/);
  assert.match(sql, /after insert or update of driver, service_call_id on public\.calendar_stops/);
  assert.match(sql, /"mode":"driver-live"/);
});

test('🔴 הכותב כבר לא שולח את "לטיפול" (TECHNICIANLOGIN) בזרם השוטף', () => {
  const src = readFileSync(new URL('../supabase/functions/rashal-call-status/index.ts', import.meta.url), 'utf8');
  const live = src.slice(src.indexOf('async function live('), src.indexOf('async function driverLive('));
  assert.equal(live.length > 0, true);
  assert.doesNotMatch(live, /JSON\.stringify\(\{[^}]*TECHNICIANLOGIN/);
  assert.match(live, /JSON\.stringify\(\{ CALLSTATUSCODE: r\.target_status \}\)/);
});

test('מייל הוואצ\'דוג: שם הלקוח, מספר הקריאה, הטכנאי והנוסח של פריוריטי', async () => {
  const { driverDigest } = await import('../supabase/functions/rashal-watchdog/driver-name-check.ts');
  const row = {
    priority_call_id: 'SC2604044', driver_name: 'אבי', state: 'failed',
    error: 'פריוריטי דחה (HTTP 400): נעול', requested_at: '', attempted_at: '',
  };
  const { subject, inner } = driverDigest([row], [], new Map([['SC2604044', 'כהן <לאה>']]));
  assert.match(subject, /קריאה אחת/);
  assert.match(inner, /כהן &lt;לאה&gt;/);
  assert.match(inner, /SC2604044.*אבי/s);
  assert.match(inner, /נעול/);
  const two = driverDigest([row], [{ ...row, priority_call_id: 'SC2604045', state: 'pending' }], new Map());
  assert.match(two.subject, /2 קריאות/);
  assert.match(two.inner, /יותר מחצי שעה/);
});
