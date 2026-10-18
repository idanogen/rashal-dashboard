import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { waUiSource } from '../api/_lib/ui-source.ts';

/**
 * ⭐ מדידת השימוש בממשקי הוואטסאפ (18/10/2026). השאלה של עידן הייתה
 * "האם הצוות משתמש בכלים", והתשובה שווה משהו רק אם התוסף והתיבה לא
 * מתערבבים, ואם מה שלא מזוהה לא מנוחש.
 */

const EXT = 'chrome-extension://abcdefghijklmnop';

test('התוסף מזוהה לפי Origin, בלי שום שדה מהקוד שלו', () => {
  assert.equal(waUiSource(undefined, EXT), 'extension');
  assert.equal(waUiSource(undefined, 'Chrome-Extension://X'), 'extension');
});

test('🔴 Origin של התוסף גובר על הצהרה', () => {
  assert.equal(waUiSource('inbox', EXT), 'extension');
});

test('הדשבורד מצהיר על עצמו: דף התיבה והחלונית הצפה בנפרד', () => {
  assert.equal(waUiSource('inbox', 'https://rashal-dashboard.vercel.app'), 'inbox');
  assert.equal(waUiSource('dock', undefined), 'dock');
  assert.equal(waUiSource(' DOCK ', null), 'dock');
});

test('🔴 מה שלא מזוהה נשאר unknown ולא מנוחש', () => {
  assert.equal(waUiSource(undefined, undefined), 'unknown');
  assert.equal(waUiSource('extension', undefined), 'unknown');
  assert.equal(waUiSource('hacker', 'https://evil.example'), 'unknown');
  assert.equal(waUiSource(['inbox'], ''), 'unknown');
});

test('🔴 הערכים שהשרת כותב הם בדיוק הערכים שה-check במסד מקבל', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const sql = readFileSync(
    join(here, '..', 'supabase', 'migrations', '20261018_wa_ui_usage.sql'),
    'utf8',
  );
  for (const v of ['inbox', 'dock', 'extension', 'unknown']) {
    assert.match(sql, new RegExp(`ui in \\([^)]*'${v}'`), `${v} חסר ב-check של wa_ui_usage_log`);
  }
});

test('כל נקודת שליחה בדשבורד מעבירה את הממשק', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const lib = readFileSync(join(here, '..', 'src', 'lib', 'wa-inbox.ts'), 'utf8');
  const sends = lib.match(/authFetch\('\/api\/wa-send'[\s\S]*?\}\);/g) ?? [];
  assert.ok(sends.length >= 2, 'בקרה חיובית: נמצאו קריאות ל-wa-send');
  for (const call of sends) assert.match(call, /source: surface/);
  assert.match(lib, /markRead=1&source=\$\{surface\}/);
});
