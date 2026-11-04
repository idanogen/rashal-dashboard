import test from 'node:test';
import assert from 'node:assert/strict';
import { isReminderHour, reminderHours, reminderPreview, reminderValues, repliesSummary } from '../api/_lib/reminder-text.ts';

/** תזכורת הערב ללקוחות של מחר, גרסה א (עידן, 04/11/2026): עדכון בלי בקשת אישור. */

test('הערכים לתבנית: שם, יום בלי "יום", סוג ביקור כמשפט, ושעות', () => {
  const stop = {
    customer_name: ' כהן דוד ', source_type: 'service', delivery_date: '2026-11-05', time_window_start: '10:00:00', time_window_end: '12:00:00',
  };
  assert.deepEqual(reminderValues(stop), {
    customer_name: 'כהן דוד', day: 'חמישי, 5.11.2026',
    purpose: 'טכנאי שלנו יגיע אליכם לביקור שירות', hours: 'בין 10:00 ל-12:00',
  });
  const bare = {
    customer_name: '', source_type: 'delivery', delivery_date: '2026-11-05', time_window_start: null, time_window_end: null,
  };
  assert.equal(reminderValues(bare).purpose, 'נגיע אליכם עם האספקה');
});

test('🔴 בלי חלון שעות: "במהלך היום", לא ריק', () => {
  assert.equal(reminderHours(null, null), 'במהלך היום');
  assert.equal(reminderHours('09:00', null), 'החל מ-09:00');
});

test('התצוגה המקדימה היא הנוסח שאושר, בלי בקשת אישור ובלי "נשמח לאישור"', () => {
  const stop = { customer_name: 'לוי שרה', source_type: 'pickup', delivery_date: '2026-11-05', time_window_start: null, time_window_end: null };
  const p = reminderPreview(reminderValues(stop));
  assert.equal(p, 'שלום לוי שרה, כאן ר.שעל שירותי עזר לנכים. תזכורת: מחר, ביום חמישי, 5.11.2026, '
    + 'נגיע אליכם לאיסוף הציוד במהלך היום. '
    + 'אם המועד לא מתאים לכם, אפשר להשיב כאן ונתאם מחדש. תודה, צוות ר.שעל');
  assert.ok(!p.includes('אישור'));
  assert.ok(!/—|–/.test(p));
});

test('🔴 שעת השליחה 19:00 ישראל, גם בחורף וגם בקיץ', () => {
  assert.equal(isReminderHour(new Date('2026-11-05T17:00:00Z')), true, 'חורף: 17 UTC');
  assert.equal(isReminderHour(new Date('2026-11-05T16:00:00Z')), false);
  assert.equal(isReminderHour(new Date('2026-07-05T16:00:00Z')), true, 'קיץ: 16 UTC');
  assert.equal(isReminderHour(new Date('2026-07-05T17:00:00Z')), false);
});

test('🔴 מוצאי שבת: 20:30 ישראל (אחרי צאת השבת גם בקיץ), ושישי אף פעם', () => {
  // 07/11/2026 שבת. חורף: 18:30 UTC = 20:30 ישראל.
  assert.equal(isReminderHour(new Date('2026-11-07T18:30:00Z')), true);
  assert.equal(isReminderHour(new Date('2026-11-07T17:30:00Z')), false, '19:30 עוד לא');
  assert.equal(isReminderHour(new Date('2026-11-07T17:00:00Z')), false, '19:00 בשבת לא שולחים');
  // 11/07/2026 שבת. קיץ: 17:30 UTC = 20:30 ישראל.
  assert.equal(isReminderHour(new Date('2026-07-11T17:30:00Z')), true);
  assert.equal(isReminderHour(new Date('2026-07-11T18:30:00Z')), false);
  // 06/11/2026 שישי: 19:00 ישראל לא שולח.
  assert.equal(isReminderHour(new Date('2026-11-06T17:00:00Z')), false);
});

test('סיכום התשובות לדוח: שם ותשובה, קצוץ, ו"אין תשובות" כשאין', () => {
  assert.equal(repliesSummary([]), 'אין תשובות');
  const two = [{ customer_name: 'כהן דוד', reply_text: 'תגיעו  אחרי\n12' }, { customer_name: 'לוי', reply_text: 'בסדר' }];
  assert.equal(repliesSummary(two), 'כהן דוד: "תגיעו אחרי 12", לוי: "בסדר"');
  const long = Array.from({ length: 30 }, (_, i) => ({ customer_name: `לקוח ${i}`, reply_text: 'תשובה ארוכה מאוד '.repeat(5) }));
  assert.ok(repliesSummary(long).length <= 640);
  assert.match(repliesSummary(long), /ועוד \d+$/);
});

test('🔴 repliesSummary זהה בשני הצדדים: api (Vercel) ופונקציית הענן של דוח הבוקר', async () => {
  const { readFileSync } = await import('node:fs');
  const grab = (src) => src.slice(src.indexOf('function repliesSummary'), src.indexOf('\n}\n', src.indexOf('function repliesSummary')) + 3)
    .replace(/^export /, '').replace(/rows: ReplyRow\[\]/, 'rows: { customer_name: string | null; reply_text: string | null }[]');
  const api = grab(readFileSync(new URL('../api/_lib/reminder-text.ts', import.meta.url), 'utf8'));
  const edge = grab(readFileSync(new URL('../supabase/functions/rashal-morning-report/index.ts', import.meta.url), 'utf8'));
  assert.equal(edge, api);
});
