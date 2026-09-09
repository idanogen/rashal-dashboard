import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import {
  WA_INBOX_KEY,
  inboxKey,
  threadKey,
  readWaitingCount,
  WA_INBOX_POLL_MS,
  WA_THREAD_POLL_MS,
  WA_IDLE_AFTER_MS,
  WA_IDLE_POLL_MS,
  WA_IDLE_THREAD_POLL_MS,
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

test('השרשור נשאר מהיר מהרשימה, בשני ההילוכים', () => {
  // 08/09/2026: הקצבים האטו כי הערוץ החי ובדיקת הטריות הפכו למסלול
  // הראשי. מה שנשמר הוא הסדר היחסי, לא המספר עצמו.
  assert.ok(
    WA_THREAD_POLL_MS < WA_INBOX_POLL_MS,
    'השרשור הפתוח חייב להתרענן מהר מהרשימה: שם יושב עובד ומחכה לתשובה',
  );
  assert.ok(
    WA_IDLE_THREAD_POLL_MS < WA_IDLE_POLL_MS,
    'גם בהילוך הנמוך השרשור נשאר מהיר מהרשימה',
  );
});

test('🔴 חוסר פעילות מוריד הילוך ולעולם לא מכבה', () => {
  // 🔴 הלקח של 07/09/2026: מסך שנשאר פתוח קפא עד F5, כי היה לו מסלול
  // רענון אחד בלבד. מסך על הקיר בר.שעל הוא שימוש אמיתי, ולכן טיימר
  // שמתאפס ל-0 או ל-false הוא רגרסיה ולא חיסכון.
  for (const v of [WA_IDLE_POLL_MS, WA_IDLE_THREAD_POLL_MS]) {
    assert.equal(typeof v, 'number');
    assert.ok(Number.isFinite(v) && v > 0, 'ההילוך הנמוך חייב להישאר טיימר חי');
  }
  assert.ok(WA_IDLE_POLL_MS > WA_INBOX_POLL_MS, 'ההילוך הנמוך חייב להיות איטי יותר');
  assert.ok(WA_IDLE_THREAD_POLL_MS > WA_THREAD_POLL_MS, 'ההילוך הנמוך חייב להיות איטי יותר');
  assert.ok(
    WA_IDLE_AFTER_MS >= 3 * 60_000,
    'סף נטישה קצר מדי מוריד הילוך למי שרק קורא שרשור ארוך',
  );
});

test('⭐ שני ההילוכים מחוברים למסך, ולא רק מוגדרים בקובץ', () => {
  const board = readFileSync(new URL('../src/components/wa/InboxBoard.tsx', import.meta.url), 'utf8');
  assert.match(board, /useIdle\(WA_IDLE_AFTER_MS\)/, 'התיבה לא מזהה נטישה');
  assert.match(board, /idle \? WA_IDLE_POLL_MS : WA_INBOX_POLL_MS/, 'הרשימה לא מחליפה הילוך');
  assert.match(board, /idle \? WA_IDLE_THREAD_POLL_MS : WA_THREAD_POLL_MS/, 'השרשור לא מחליף הילוך');

  const dock = readFileSync(new URL('../src/components/wa/WaDock.tsx', import.meta.url), 'utf8');
  assert.match(dock, /idle \? WA_IDLE_POLL_MS : WA_INBOX_POLL_MS/, 'הכפתור הצף לא מחליף הילוך');
});

test('🔴🔴 הוואטסאפ מחובר לערוץ החי, אחרת ההאטה מאחרת מידע', () => {
  // זו הבדיקה שמחזיקה את כל ההיגיון של 08/09: מותר להאט את הטיימר רק כי
  // הדחיפה תפסה את מקומו. אם ההאזנה תוסר, ההאטה תהפוך לפיגור אמיתי.
  const sync = readFileSync(new URL('../src/hooks/useRealtimeSync.ts', import.meta.url), 'utf8');
  const block = sync.slice(sync.indexOf('const TABLE_KEYS'), sync.indexOf('export function useRealtimeSync'));
  for (const table of ['whatsapp_inbound', 'whatsapp_outbound', 'wa_conversations']) {
    assert.ok(block.includes(table), `${table} לא מאזינה בערוץ החי`);
  }
  assert.ok(block.includes("'wa-thread'"), 'השרשור לא נפסל על הודעה חדשה');
  assert.ok(block.includes("'wa-inbox'"), 'הרשימה לא נפסלת על הודעה חדשה');

  // 🔴 שמות החותמות בשרת חייבים להיות זהים למפתחות ה-query, כי
  // probeFreshness עושה invalidateQueries על שם החותמת.
  const mig = readFileSync(
    new URL('../supabase/migrations/20260908_wa_realtime_freshness.sql', import.meta.url),
    'utf8',
  );
  assert.match(mig, /'wa-inbox'/, 'חסרה חותמת טריות לרשימה');
  assert.match(mig, /'wa-thread'/, 'חסרה חותמת טריות לשרשור');
});

test('🔴 חזרה לחלון מרעננת, וזה דורש גם איפוס הטריות', () => {
  // נתפס אצל עידן 24/08/2026: הוא שלח הודעה מהטלפון, חזר לדשבורד, ולא
  // קרה כלום עד רענון ידני. השורש היה `refetchOnWindowFocus: false`
  // גלובלי, ו-`staleTime` של דקה שהיה בולע את התיקון גם אחרי שהופעל.
  const board = readFileSync(new URL('../src/components/wa/InboxBoard.tsx', import.meta.url), 'utf8');

  const threadBlock = board.slice(board.indexOf('const thread = useQuery'), board.indexOf('const items ='));
  assert.match(threadBlock, /refetchOnWindowFocus: true/, 'השרשור אינו מתרענן בחזרה לחלון');
  assert.match(threadBlock, /staleTime: 0/, '🔴 בלי איפוס הטריות הרענון נבלע בדקה הגלובלית');

  const listBlock = board.slice(board.indexOf('const inbox = useQuery'), board.indexOf('const thread = useQuery'));
  assert.match(listBlock, /refetchOnWindowFocus: true/, 'הרשימה אינה מתרעננת בחזרה לחלון');

  // ⭐ ורענון בחזרה לחלון הוא בדיוק מה שמאפשר להאט את הטיימר: הוא חסום
  // על ידי התנהגות אנושית ולא על ידי שעון, ולכן הוא לא עולה כלום כשאין
  // אף אחד מול המסך.
});
