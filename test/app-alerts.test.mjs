import test from 'node:test';
import assert from 'node:assert/strict';
import { israelParts, morningDue, morningEmail, problemsEmail, summaryDay } from '../supabase/functions/rashal-app-alerts/compose.ts';

/** פעמון הלוגים (02/11/2026, שלב 3 בתוכנית הלוגים). */

test('שעון ישראל: 04:30 UTC בחורף הוא 06:30, וב-05:10 כבר 07:10', () => {
  assert.deepEqual(israelParts(new Date('2026-11-02T04:30:00Z')), { day: '2026-11-02', hour: 6, dow: 1 });
  assert.equal(israelParts(new Date('2026-11-02T05:10:00Z')).hour, 7);
  // אחרי חצות בישראל אבל עוד אתמול ב-UTC
  assert.equal(israelParts(new Date('2026-11-01T22:30:00Z')).day, '2026-11-02');
});

test('סיכום הבוקר: מ-7:00, פעם אחת ליום, לא בשבת', () => {
  assert.equal(morningDue(new Date('2026-11-02T04:50:00Z'), null), false);
  assert.equal(morningDue(new Date('2026-11-02T05:05:00Z'), null), true);
  assert.equal(morningDue(new Date('2026-11-02T05:05:00Z'), '2026-11-02'), false);
  assert.equal(morningDue(new Date('2026-11-07T07:00:00Z'), null), false);
});

test('היום שהסיכום מתאר: אתמול, וביום ראשון יום שישי', () => {
  assert.equal(summaryDay('2026-11-02', 1), '2026-11-01');
  assert.equal(summaryDay('2026-11-01', 0), '2026-10-30');
});

test('מייל הדיווח: נושא עם השם והנושא, הלקוח בגוף, וקלט נמלט', () => {
  const row = {
    received_at: '2026-11-02T08:20:00Z', occurred_at: '2026-11-02T08:00:00Z', user_name: 'דוד גוזלן',
    screen: '/', app_version: 'f52e', customer_name: 'ברקמן מאיר', topic: 'תמונות', text: '<b>לבן</b>',
  };
  const one = problemsEmail([row]);
  assert.match(one.subject, /דוד גוזלן/);
  assert.match(one.subject, /תמונות/);
  assert.match(one.html, /ברקמן מאיר/);
  assert.match(one.html, /&lt;b&gt;לבן/);
  assert.match(one.html, /לא הייתה קליטה/);
  assert.match(problemsEmail([row, { ...row, user_name: 'מוהנד' }]).subject, /2 דיווחי/);
});

test('מייל הבוקר: רק מי שקרה אצלו משהו, ובלי גרש ארוך', () => {
  const u = (name, over = {}) => ({
    name, app: 'driver', version: 'f52e', problems: 0, crashes: 0, rejected: 0, forms_failed: 0, forms_blocked: 0,
    forms_cancelled: 0, forms_opened: 0, forms_saved: 0, forms_sent: 0, image_errors: 0, errors: 0, ...over,
  });
  const s = {
    day: '2026-11-01', events: 100, users: [u('אבי', { forms_saved: 2, forms_sent: 2 }), u('מוהנד', { forms_blocked: 3 })],
    top_errors: [], form_blocks: [], problems: [], silent: [{ name: 'רודי', stops: 9 }],
  };
  const m = morningEmail(s, 'יום ראשון 1/11');
  assert.match(m.subject, /1 נתקעו/);
  assert.match(m.html, /מוהנד<\/b> · 3 חסימות/);
  assert.doesNotMatch(m.html, /אבי<\/b> ·/);
  assert.match(m.html, /רודי \(9\)/);
  assert.doesNotMatch(m.subject + m.html, /[—–]/);
});
