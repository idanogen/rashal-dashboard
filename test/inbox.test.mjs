import test from 'node:test';
import assert from 'node:assert/strict';
import { toItem, sortItems, matchesQuery, waitLabel, isWaiting } from '../api/_lib/inbox.ts';

/**
 * 🔴 מה שנבדק כאן הוא **הסדר**, וזה לב המסך. מסך שנקרא "מי מחכה לתשובה"
 * ומציג את הטרי למעלה הוא מסך שקובר בדיוק את המקרים שהוא נועד לתפוס.
 */

const MIN = 60_000;
const now = Date.parse('2026-08-22T18:00:00Z');
const ago = (m) => new Date(now - m * MIN).toISOString();

// מצב החלון מוזרק, כי כלל 24 השעות נבדק במקום שבו הוא חי.
const win = (open) => ({ open, expiresAt: null, minutesLeft: open ? 120 : 0, reason: null });
const item = (o, isOpen = false) => toItem(row(o), win(isOpen), now);

const row = (o) => ({
  id: o.id,
  // 🔴 `??` בולע גם null, ולכן `phone: null` בבדיקה קיבל את ברירת המחדל
  // והמקרה שרצינו לבדוק מעולם לא נבדק.
  phone_local: 'phone' in o ? o.phone : '0501234567',
  phone_e164: null,
  contact_name: o.contact ?? null,
  customer_number: o.num ?? null,
  customer_name: o.name ?? null,
  last_inbound_at: o.inbound ?? null,
  last_message_at: o.last ?? ago(5),
  last_message_preview: o.preview ?? '',
  last_message_direction: 'in',
  unanswered_since: o.waiting ?? null,
  message_count: o.count ?? 1,
});

test('שם הלקוח מפריוריטי גובר על שם פרופיל הוואטסאפ', () => {
  const i = item({ id: 'a', num: '101143', name: 'כללית הנדסה רפואית', contact: 'Idan' });
  assert.equal(i.title, 'כללית הנדסה רפואית');
  assert.equal(i.unidentified, false);
});

test('בלי לקוח מזוהה נופלים לשם הפרופיל ואז לטלפון, ולא לשורה ריקה', () => {
  assert.equal(item({ id: 'a', contact: 'Idan' }).title, 'Idan');
  assert.equal(item({ id: 'b', contact: null, phone: '0521111111' }).title, '0521111111');
  assert.equal(item({ id: 'c', contact: null, phone: null }).title, 'לא מזוהה');
});

test('🔴 בלשונית הממתינים, מי שמחכה הכי הרבה נמצא למעלה', () => {
  const items = [
    item({ id: 'טרי', waiting: ago(5) }),
    item({ id: 'ותיק', waiting: ago(600) }),
    item({ id: 'בינוני', waiting: ago(90) }),
  ];
  const sorted = sortItems(items, 'waiting');
  assert.deepEqual(sorted.map((i) => i.id), ['ותיק', 'בינוני', 'טרי'],
    '🔴 המיון טרי-קודם קובר בדיוק את מי שהמסך נועד לתפוס');
});

test('⭐ באותו זמן המתנה, חלון פתוח קודם', () => {
  // שם עוד אפשר לענות בטקסט חופשי. אחרי שהחלון נסגר התשובה כפופה
  // לתבנית מאושרת ולעלות, ולכן היא פחות דחופה.
  const w = ago(60);
  const items = [
    item({ id: 'סגור', waiting: w }, false),
    item({ id: 'פתוח', waiting: w }, true),
  ];
  assert.deepEqual(sortItems(items, 'waiting').map((i) => i.id), ['פתוח', 'סגור']);
});

test('בלשונית כל השיחות, המיון הוא לפי ההודעה האחרונה', () => {
  const items = [
    item({ id: 'ישן', last: ago(500) }),
    item({ id: 'חדש', last: ago(2) }),
  ];
  assert.deepEqual(sortItems(items, 'all').map((i) => i.id), ['חדש', 'ישן']);
});

test('🔴 חיפוש טלפון עובד גם עם מקפים וגם בלעדיהם', () => {
  const i = item({ id: 'a', name: 'בכר דינה', phone: '0545412903' });
  for (const q of ['0545412903', '054-541', '5412903', '054 541 2903']) {
    assert.ok(matchesQuery(i, q), 'לא נמצא עבור: ' + q);
  }
});

test('חיפוש רץ גם על מספר הלקוח וגם על תצוגת ההודעה', () => {
  const i = item({ id: 'a', name: 'לקוח', num: '101143', preview: 'מתי מגיעה ההזמנה' });
  assert.ok(matchesQuery(i, '101143'), 'מספר לקוח');
  assert.ok(matchesQuery(i, 'ההזמנה'), 'תוכן ההודעה');
  assert.ok(!matchesQuery(i, 'משהו אחר לגמרי'));
});

test('חיפוש ריק מחזיר הכל', () => {
  const i = item({ id: 'a' });
  for (const q of ['', '   ', undefined, null]) assert.ok(matchesQuery(i, q));
});

test('🔴 שתי ספרות לא מפעילות חיפוש מספרי רחב', () => {
  // אחרת כל הקלדה קצרה הייתה מחזירה חצי מהתיבה, ונראית כמו חיפוש שבור.
  const i = item({ id: 'a', name: 'לקוח', phone: '0545412903', num: '101143' });
  assert.ok(!matchesQuery(i, '54'), 'שתי ספרות החזירו התאמה');
  assert.ok(matchesQuery(i, '541'), 'שלוש ספרות לא החזירו התאמה');
});

test('זמן ההמתנה נאמר בעברית תקינה, ובלי "0 דקות"', () => {
  assert.equal(waitLabel(0), 'עכשיו');
  assert.equal(waitLabel(20), '20 דקות');
  assert.equal(waitLabel(60), 'שעה');
  assert.equal(waitLabel(125), 'שעתיים');
  assert.equal(waitLabel(60 * 24), 'יום');
  assert.equal(waitLabel(60 * 49), 'יומיים');
  assert.equal(waitLabel(null), '');
});

test('חוב מענה מתורגם לדקות המתנה, ובלי חוב אין מספר', () => {
  assert.equal(item({ id: 'a', waiting: ago(45) }).waitingMinutes, 45);
  assert.equal(item({ id: 'b' }).waitingMinutes, null);
});

/**
 * 🔴🔴 "שיחה שקראתי עדיין ב'ממתינים'" (עידן, 24/08/2026).
 * עד אז הדרך היחידה להוריד שיחה מהרשימה הייתה **לשלוח תשובה**, ולכן
 * "תודה" של לקוח נשאר תלוי ברשימה לנצח.
 */
test('שיחה בלי חוב מענה אינה ממתינה, גם בלי שנקראה', () => {
  assert.equal(isWaiting({ unanswered_since: null, last_inbound_at: '2026-08-24T12:00:00Z', read_at: null }), false);
});

test('חוב מענה שלא נקרא הוא ממתין', () => {
  assert.equal(isWaiting({ unanswered_since: '2026-08-24T12:00:00Z', last_inbound_at: '2026-08-24T12:00:00Z', read_at: null }), true);
});

test('🔴 קריאה אחרי ההודעה מורידה מהרשימה, גם בלי לענות', () => {
  assert.equal(isWaiting({
    unanswered_since: '2026-08-24T12:00:00Z',
    last_inbound_at: '2026-08-24T12:00:00Z',
    read_at: '2026-08-24T12:05:00Z',
  }), false);
});

test('🔴 הודעה חדשה אחרי הקריאה מחזירה את השיחה לרשימה', () => {
  // זה מה שדגל בוליאני "נקרא" היה מפספס: הלקוח כתב שוב, ואיש לא ידע.
  assert.equal(isWaiting({
    unanswered_since: '2026-08-24T14:00:00Z',
    last_inbound_at: '2026-08-24T14:00:00Z',
    read_at: '2026-08-24T12:05:00Z',
  }), true);
});

test('קריאה באותו רגע בדיוק אינה מספיקה', () => {
  // גבול: `<` ולא `<=`. שווה נחשב נקרא, כי הסימון נרשם אחרי הצפייה.
  assert.equal(isWaiting({
    unanswered_since: '2026-08-24T12:00:00Z',
    last_inbound_at: '2026-08-24T12:00:00Z',
    read_at: '2026-08-24T12:00:00Z',
  }), false);
});

test('בלי last_inbound_at נופלים לרגע פתיחת החוב', () => {
  assert.equal(isWaiting({ unanswered_since: '2026-08-24T12:00:00Z', last_inbound_at: null, read_at: '2026-08-24T12:30:00Z' }), false);
  assert.equal(isWaiting({ unanswered_since: '2026-08-24T12:00:00Z', last_inbound_at: null, read_at: '2026-08-24T11:30:00Z' }), true);
});

test('🔴 שעון ההמתנה נעלם משורה שנקראה, ולא רק הסינון', () => {
  // התג הכתום "מחכה 27 דקות" הוא מה שעידן ראה. הוא נגזר מ-waitingMinutes.
  const base = {
    id: 'c1', phone_local: '0523694547', phone_e164: null, contact_name: 'עוגן עידן',
    customer_number: null, customer_name: null, last_message_at: '2026-08-24T12:00:00Z',
    last_message_preview: 'תודה', last_message_direction: 'in', message_count: 4,
    unanswered_since: '2026-08-24T12:00:00Z', last_inbound_at: '2026-08-24T12:00:00Z',
  };
  const win = { open: true, expiresAt: null, minutesLeft: 1000, reason: null };
  const now = new Date('2026-08-24T12:27:00Z').getTime();

  const unread = toItem({ ...base, read_at: null }, win, now);
  assert.equal(unread.waitingMinutes, 27);
  assert.equal(unread.read, false);

  const read = toItem({ ...base, read_at: '2026-08-24T12:05:00Z' }, win, now);
  assert.equal(read.waitingMinutes, null, 'שעון ההמתנה נשאר על שיחה שנקראה');
  assert.equal(read.read, true);
  assert.equal(read.unansweredSince, base.unanswered_since, 'חוב המענה נמחק, והוא עובדה שצריכה לשרוד');
});
