import test from 'node:test';
import assert from 'node:assert/strict';
import {
  groupParked,
  parkedDigest,
} from '../supabase/functions/rashal-watchdog/parked-check.ts';
import {
  craneDigest,
  digestDue,
  checkCraneTraining,
} from '../supabase/functions/rashal-watchdog/crane-training-check.ts';

/**
 * 🔴 25/10/2026, עידן: "היום קיבלנו הודעות מערכת שלא אהבתי". המקרים כאן
 * הם המיילים האמיתיים של אותו יום: SC2603292 הופיעה ארבע פעמים בלי שם,
 * המייל אמר "לא ייכנס לפריוריטי" על הערות ותמונות שכן נכנסו לכרטיס הלקוח,
 * ומייל המנופים השני ("2 מנופים") הציג מחדש את כל ה-18.
 */

const parkedRows = [
  { key: 'event:e1', docno: 'SC2603292', fail_reason: 'call_locked', last_error: null, failed_at: '' },
  { key: 'event:e2', docno: 'SC2603292', fail_reason: 'call_locked', last_error: null, failed_at: '' },
  { key: 'event:e3', docno: 'SC2603292', fail_reason: 'call_locked', last_error: null, failed_at: '' },
  { key: 'note:stop1:abc', docno: 'SC2603292', fail_reason: 'call_locked', last_error: null, failed_at: '' },
];
const calls = new Map([['SC2603292', { customer_name: 'פיטוסי יצחק', priority_status: 'מבוטלת' }]]);
const events = new Map([
  ['e1', { type: 'file_upload', user_name: 'ישראל', content: null, on_card: true }],
  ['e2', { type: 'file_upload', user_name: 'ישראל', content: null, on_card: true }],
  ['e3', { type: 'comment', user_name: 'ישראל', content: 'ריפוד מ. יד שמאל קרוע. צריך להחליף', on_card: true }],
]);
const notes = new Map([['stop1', { driver: 'ישראל', note: 'מריפוד מ. יד מיוחד. צד שמאל' }]]);

test('🔴 ארבעה פריטים של אותה קריאה הם שורה אחת, עם הלקוח והטכנאי', () => {
  const groups = groupParked(parkedRows, calls, events, notes);
  assert.equal(groups.length, 1);
  const { inner } = parkedDigest(groups, []);
  assert.equal(inner.split('SC2603292').length - 1, 1, 'מספר הקריאה מופיע יותר מפעם אחת');
  assert.match(inner, /פיטוסי יצחק/);
  assert.match(inner, /ישראל/);
  assert.match(inner, /2 תמונות \(נכנסו לכרטיס הלקוח\)/);
  assert.match(inner, /צריך להחליף/);
  assert.match(inner, /נשארה רק אצלנו/);
});

test('🔴🔴 קריאה מבוטלת בפריוריטי עולה לכותרת', () => {
  const { subject, inner } = parkedDigest(groupParked(parkedRows, calls, events, notes), []);
  assert.match(subject, /קריאה מבוטלת: פיטוסי יצחק/);
  assert.match(inner, /מבוטלת בפריוריטי/);
});

test('קריאה סופית, לא מבוטלת: בלי אזהרת ביטול', () => {
  const c = new Map([['SC2603292', { customer_name: 'לב איתמר', priority_status: 'סופית' }]]);
  const { subject } = parkedDigest(groupParked(parkedRows, c, events, notes), []);
  assert.doesNotMatch(subject, /מבוטלת/);
  assert.match(subject, /לב איתמר/);
});

test('🔴 המייל לא אומר "לא ייכנס לפריוריטי" על מה שנכנס לכרטיס הלקוח', () => {
  const { inner } = parkedDigest(groupParked(parkedRows, calls, events, notes), []);
  assert.doesNotMatch(inner, /לא ייכנס לפריוריטי/);
});

test('תוכן מהטכנאי עובר escape', () => {
  const ev = new Map([['e1', { type: 'comment', user_name: 'x', content: '<script>', on_card: false }]]);
  const { inner } = parkedDigest(groupParked([parkedRows[0]], calls, ev, notes), []);
  assert.doesNotMatch(inner, /<script>/);
});

const crane = (i, driver) => ({
  stop_id: `s${i}`, customer_name: `לקוח ${i}`, customer_number: null, driver,
  delivery_date: '2026-10-25', completed_at: null, order_docno: null, crane_model: 'G175',
});

test('🔴 סיכום המנופים מציג רק את החדשים, והישנים בשורה אחת', () => {
  const fresh = [crane(17, 'מוהנד'), crane(18, 'מוהנד')];
  const { subject, inner } = craneDigest(fresh, 16);
  assert.match(subject, /^🟠 2 מנופים/);
  assert.equal((inner.match(/• /g) ?? []).length, 2);
  assert.match(inner, /ועוד 16/);
  assert.match(inner, /מוהנד 2/);
});

test('סיכום אחד ביום, אחרי 18:00 שעון ישראל', () => {
  // 14:05 UTC = 17:05 בישראל (שעון קיץ): עוד לא.
  assert.equal(digestDue(new Date('2026-10-20T14:05:00Z'), null), false);
  // 15:05 UTC = 18:05 בישראל.
  assert.equal(digestDue(new Date('2026-10-20T15:05:00Z'), null), true);
  // כבר נשלח היום ב-18:05: לא שוב ב-19:05.
  assert.equal(digestDue(new Date('2026-10-20T16:05:00Z'), '2026-10-20T15:05:00Z'), false);
  // נשלח אתמול: היום שוב. (20/10, עוד בשעון קיץ: השעון בישראל עבר לחורף ב-25/10.)
  assert.equal(digestDue(new Date('2026-10-21T15:05:00Z'), '2026-10-20T15:05:00Z'), true);
  // שעון חורף (מ-25/10): 18:05 בישראל הוא 16:05 UTC.
  assert.equal(digestDue(new Date('2026-10-25T15:05:00Z'), null), false);
  assert.equal(digestDue(new Date('2026-10-25T16:05:00Z'), null), true);
});

test('🔴 הדגל לא נכתב כשהמייל נכשל, והנמענים הנוספים עוברים', async () => {
  const upserts = [];
  let sentTo;
  const deps = (ok) => ({
    sb: {
      rpc: async () => ({ data: [crane(1, 'רודי')], error: null }),
      from: () => ({ upsert: async (r) => { upserts.push(r); } }),
    },
    sendEmail: async (_s, _h, extra) => { sentTo = extra; return ok; },
    wrap: (s) => s,
    extraTo: ['ami@example.com'],
  });
  const at = new Date('2026-10-20T15:05:00Z');
  assert.equal(await checkCraneTraining(at, undefined, deps(false)), 'email failed');
  assert.equal(upserts.length, 0);
  assert.match(await checkCraneTraining(at, undefined, deps(true)), /ALERT sent/);
  assert.deepEqual(sentTo, ['ami@example.com']);
  assert.equal(upserts.length, 1);
});
