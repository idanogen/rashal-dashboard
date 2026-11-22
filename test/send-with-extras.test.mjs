// מספר שאינו בוואטסאפ (13/11/2026): הפסקה של 30 יום, ובני המשפחה עדיין מקבלים.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sendWithExtras, isPausedResponse, PAUSED_ERROR } from '../supabase/functions/_shared/send-with-extras.ts';

const fake = (results) => {
  const calls = [];
  return { calls, send: async (phone) => { calls.push(phone); return results[phone] ?? { ok: true }; } };
};
const paused = { ok: false, error: 'HTTP 409', retryable: false, paused: true };
const noop = () => {};

test('הלקוח קיבל: גם בני המשפחה מקבלים', async () => {
  const f = fake({});
  const r = await sendWithExtras('+1', ['+2', '+3'], f.send, noop);
  assert.equal(r.ok, true);
  assert.deepEqual(f.calls, ['+1', '+2', '+3']);
});

test('הלקוח מושהה ובן משפחה קיבל: נחשב כנשלח', async () => {
  const f = fake({ '+1': paused });
  const r = await sendWithExtras('+1', ['+2'], f.send, noop);
  assert.equal(r.ok, true);
  assert.equal(r.via_extra, true);
});

test('הלקוח מושהה ואין בני משפחה: הכשלון חוזר כמו שהוא', async () => {
  const r = await sendWithExtras('+1', [], fake({ '+1': paused }).send, noop);
  assert.equal(r.ok, false);
  assert.equal(r.paused, true);
});

test('כשלון אחר (429 שחוזר לתור): בני המשפחה לא מקבלים, כמו קודם', async () => {
  const f = fake({ '+1': { ok: false, error: 'rate', retryable: true } });
  const r = await sendWithExtras('+1', ['+2'], f.send, noop);
  assert.equal(r.ok, false);
  assert.equal(r.retryable, true);
  assert.deepEqual(f.calls, ['+1']);
});

test('כשלון אצל בן משפחה נרשם ולא משנה את התוצאה', async () => {
  const failed = [];
  const r = await sendWithExtras('+1', ['+2'], fake({ '+2': { ok: false, error: 'x', retryable: false } }).send, (p) => failed.push(p));
  assert.equal(r.ok, true);
  assert.deepEqual(failed, ['+2']);
});

test('מזהה רק 409 עם unreachable_paused', () => {
  assert.equal(isPausedResponse(409, { error: PAUSED_ERROR }), true);
  assert.equal(isPausedResponse(409, { error: 'suppressed' }), false);
  assert.equal(isPausedResponse(502, { error: PAUSED_ERROR }), false);
});

test('קוד השגיאה זהה בשרת ובמנועים, ושלושת המנועים עוברים דרך הקובץ המשותף', () => {
  const api = readFileSync(new URL('../api/_lib/unreachable.ts', import.meta.url), 'utf8');
  assert.match(api, new RegExp(`PAUSED_ERROR = '${PAUSED_ERROR}'`));
  for (const fn of ['rashal-media-request', 'rashal-on-way', 'rashal-surveys']) {
    const src = readFileSync(new URL(`../supabase/functions/${fn}/index.ts`, import.meta.url), 'utf8');
    assert.match(src, /sendWithExtras\(/, `${fn} שולח דרך sendWithExtras`);
    assert.match(src, /paused: isPausedResponse\(res\.status, body\)/, `${fn} מסמן הפסקה`);
    assert.ok(!/for \(const extra of/.test(src), `${fn} לא מחזיק לולאת בני משפחה משלו`);
  }
});

test('ההפסקה חלה רק על המנועים האוטומטיים, בהתאם ל-triggeredBy שהם שולחים', () => {
  const api = readFileSync(new URL('../api/_lib/unreachable.ts', import.meta.url), 'utf8');
  const prefixes = [...api.match(/AUTOMATIC_PREFIXES = \[([^\]]*)\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const triggers = {
    'rashal-media-request': '`media-request-${row.stage}`',
    'rashal-on-way': '"on-way-engine"',
    'rashal-surveys': '"survey-engine"',
  };
  for (const [fn, lit] of Object.entries(triggers)) {
    const src = readFileSync(new URL(`../supabase/functions/${fn}/index.ts`, import.meta.url), 'utf8');
    assert.ok(src.includes(lit), `${fn} עדיין שולח ${lit}`);
  }
  assert.deepEqual(prefixes, ['media-request-', 'on-way-engine', 'survey-engine']);
  const formCopy = readFileSync(new URL('../supabase/functions/rashal-form-copy/index.ts', import.meta.url), 'utf8');
  assert.ok(!prefixes.some((p) => formCopy.includes(`"${p}`)), 'העתק טופס שהמשרד ביקש לא מושהה');
});
