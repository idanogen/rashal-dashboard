import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WA_INBOX_KEY,
  inboxKey,
  threadKey,
  readWaitingCount,
  WA_INBOX_POLL_MS,
  WA_THREAD_POLL_MS,
} from '../src/lib/wa-inbox-query.ts';

/**
 * 🔴 מה שנבדק כאן הוא **שלא יוצאות שתי בקשות על אותם נתונים**, וזה מה
 * שאכל את מכסת ה-CPU ב-Vercel ב-23/08/2026: הכפתור הצף והתיבה שאלו כל
 * אחד לחוד תחת שני מפתחות שונים, 348 קריאות בשעה מול תיבה של 23 שורות.
 * החוזה הוא שאותה לשונית ואותו חיפוש מייצרים מפתח זהה, ולכן react-query
 * מאחד אותם לבקשה אחת.
 */

/** מטמון מזויף בצורה שבה `readWaitingCount` באמת קורא אותו. */
const cache = (entries) => ({
  getQueryCache: () => ({
    getAll: () =>
      entries.map((e) => ({
        queryKey: e.key,
        state: { data: e.data, dataUpdatedAt: e.at },
      })),
  }),
});

const listResponse = (waiting, all = waiting) => ({
  ok: true,
  counts: { waiting, all },
  items: [],
});

test('אותה לשונית ואותו חיפוש מייצרים מפתח זהה, אחרת אין איחוד', () => {
  assert.deepEqual([...inboxKey('waiting', '')], [...inboxKey('waiting', '')]);
  assert.deepEqual([...inboxKey('waiting', '')], [WA_INBOX_KEY, 'waiting', '']);
});

test('לשונית או חיפוש שונים הם נתונים אחרים, ולכן מפתח אחר', () => {
  assert.notDeepEqual([...inboxKey('waiting', '')], [...inboxKey('all', '')]);
  assert.notDeepEqual([...inboxKey('waiting', '')], [...inboxKey('waiting', 'דנה')]);
});

test('כל מפתחות הרשימה חולקים תחילית אחת, כדי שרענון יתפוס את כולם', () => {
  for (const key of [inboxKey('waiting', ''), inboxKey('all', 'x')]) {
    assert.equal(key[0], WA_INBOX_KEY);
  }
  assert.notEqual(threadKey('0501234567')[0], WA_INBOX_KEY);
});

test('המונה נלקח מהתשובה הטרייה ביותר, ולא מהראשונה שנמצאה', () => {
  // 🔴 הבדיקה שמפילה מימוש של "הראשון מנצח": הישן מופיע ראשון ברשימה.
  const c = cache([
    { key: inboxKey('waiting', ''), data: listResponse(9), at: 1000 },
    { key: inboxKey('all', ''), data: listResponse(2), at: 5000 },
  ]);
  assert.equal(readWaitingCount(c), 2);
});

test('גם כשהטרי מופיע ראשון, התוצאה זהה', () => {
  const c = cache([
    { key: inboxKey('all', ''), data: listResponse(2), at: 5000 },
    { key: inboxKey('waiting', ''), data: listResponse(9), at: 1000 },
  ]);
  assert.equal(readWaitingCount(c), 2);
});

test('בלי שום תשובה במטמון מוחזר null, ולא אפס', () => {
  // ⭐ אפס היה אומר לתג "אין ממתינים" בזמן שהאמת היא "עוד לא יודעים".
  assert.equal(readWaitingCount(cache([])), null);
});

test('מפתחות של שאילתות אחרות לא נספרים', () => {
  const c = cache([
    { key: ['orders'], data: listResponse(77), at: 9000 },
    { key: threadKey('0501234567'), data: { ok: true, messages: [] }, at: 9000 },
    { key: inboxKey('waiting', ''), data: listResponse(3), at: 1000 },
  ]);
  assert.equal(readWaitingCount(c), 3);
});

test('תשובה בלי counts מדולגת ולא מאפסת את התג', () => {
  const c = cache([
    { key: inboxKey('all', ''), data: undefined, at: 9000 },
    { key: inboxKey('waiting', ''), data: listResponse(4), at: 1000 },
  ]);
  assert.equal(readWaitingCount(c), 4);
});

test('אפס ממתינים הוא תשובה אמיתית, לא "אין נתונים"', () => {
  const c = cache([{ key: inboxKey('waiting', ''), data: listResponse(0), at: 1000 }]);
  assert.equal(readWaitingCount(c), 0);
});

test('הרשימה נשאלת כל שלוש דקות, והשרשור נשאר מהיר ממנה', () => {
  assert.equal(WA_INBOX_POLL_MS, 180_000);
  assert.ok(
    WA_THREAD_POLL_MS < WA_INBOX_POLL_MS,
    'השרשור הפתוח חייב להתרענן מהר מהרשימה: שם יושב עובד ומחכה לתשובה',
  );
});
