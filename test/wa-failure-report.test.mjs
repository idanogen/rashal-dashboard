// הדוח השבועי "לקוחות שלא הגיעה אליהם הודעת וואטסאפ" (13/11/2026): רינדור טהור, נבדק ישירות מה-TS של ה-Edge Function.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  renderFailureReport, previousWeek, localPhone, isBlocking, PRIORITY_CALL_CLOSED,
} from '../supabase/functions/rashal-wa-failure-report/render.ts';

const base = {
  from: '2026-11-01', to: '2026-11-08', unreachable_total: 5, survey_only: 1, technical: 2, technical_sample: 'x',
  customers: [
    { phone: '+972527130128', name: 'רוזנברג יחזקאל', kinds: ['media'], attempts: 2, last_at: '2026-11-04T11:00:00Z',
      ever_delivered: false, calls: [{ call: 'SC2603986', product: '183WM56', state: 'no_response', priority_status: 'לביצוע' }] },
    { phone: '+972527154969', name: 'ביטון אודט', kinds: ['on_way'], attempts: 1, last_at: '2026-11-01T09:48:00Z',
      ever_delivered: false, calls: [] },
    { phone: '+972533158675', name: 'פופר טובה', kinds: ['media'], attempts: 3, last_at: '2026-11-03T09:00:00Z',
      ever_delivered: true, calls: [{ call: 'SC2600001', product: 'X', state: 'no_response', priority_status: 'בוצעה' }] },
  ],
};

test('קריאה פתוחה שמחכה לתמונה עולה ראשונה; קריאה שכבר בוצעה לא חוסמת', () => {
  assert.equal(isBlocking(base.customers[0]), true);
  assert.equal(isBlocking(base.customers[2]), false);
  const r = renderFailureReport(base);
  assert.equal(r.blocking, 1);
  assert.match(r.subject, /3 לקוחות/);
  assert.match(r.subject, /1 מהם עם קריאה שמחכה לתמונה/);
  assert.match(r.subject, /01\/11 עד 07\/11/);
  assert.ok(r.html.indexOf('SC2603986') < r.html.indexOf('ביטון אודט'));
  assert.ok(!r.html.includes('SC2600001'), 'קריאה שבוצעה לא מוצגת כקריאה שמחכה');
  assert.ok(r.html.includes('dir="rtl"'));
  assert.ok(r.html.includes('052-7130128'));
  assert.ok(r.html.includes('סקר שביעות הרצון'));
  assert.ok(r.html.includes('סיבה טכנית'));
});

test('שבוע נקי: נושא חיובי, בלי טבלאות', () => {
  const r = renderFailureReport({ ...base, customers: [], survey_only: 0, technical: 0 });
  assert.match(r.subject, /כל הודעות הוואטסאפ הגיעו/);
  assert.ok(!r.html.includes('<table'));
});

test('בלי גרש ארוך ובלי "אוגן" בנוסח', () => {
  const r = renderFailureReport(base);
  assert.ok(!/[–—]/.test(r.html + r.subject + r.text));
  assert.ok(!r.html.includes('אוגן'));
});

test('השבוע הקודם: ראשון עד ראשון בשעון ישראל', () => {
  assert.deepEqual(previousWeek('2026-11-15'), { from: '2026-11-08', to: '2026-11-15' }); // ראשון
  assert.deepEqual(previousWeek('2026-11-13'), { from: '2026-11-01', to: '2026-11-08' }); // שישי
});

test('טלפון מקומי', () => {
  assert.equal(localPhone('+972527130128'), '052-7130128');
});

test('רשימת הסטטוסים הסגורים זהה לזו של הדשבורד (src/lib/constants.ts)', () => {
  const src = readFileSync(new URL('../src/lib/constants.ts', import.meta.url), 'utf8');
  const m = src.match(/export const PRIORITY_CALL_CLOSED = \[([^\]]*)\]/);
  assert.ok(m, 'PRIORITY_CALL_CLOSED נמצא בקובץ המקור');
  const fromSrc = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  const fn = readFileSync(new URL('../supabase/functions/rashal-wa-failure-report/render.ts', import.meta.url), 'utf8');
  const m2 = fn.match(/export const PRIORITY_CALL_CLOSED = \[([^\]]*)\]/);
  assert.deepEqual([...m2[1].matchAll(/'([^']+)'/g)].map((x) => x[1]), fromSrc);
  assert.deepEqual([...PRIORITY_CALL_CLOSED], fromSrc);
});
