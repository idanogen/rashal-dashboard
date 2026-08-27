import test from 'node:test';
import assert from 'node:assert/strict';
import { countOpenOverDays, countRepeatCalls } from '../src/lib/repeat-calls.ts';

/**
 * 🔴🔴 **הבדיקה שמגנה על ההכרעה, לא רק על החישוב.**
 *
 * שלומי ביקש (20/08) לדעת מי חוזר. עידן הכריע (26/08) **פרונטליות בלבד**,
 * ולא במקרה: נמדד ב-90 יום ש-402 מתוך 459 הקריאות החוזרות הן טלפוניות,
 * כלומר סימון של כולן היה צובע שליש מהקריאות והופך את הסימן לרעש.
 * [[color_on_everything_is_not_color]]
 *
 * בלי הבדיקה הזאת, מישהו יסיר את התנאי כדי "לתפוס יותר" והמדד ימות בשקט.
 */

const DAY = 86_400_000;
const ago = (d) => new Date(Date.now() - d * DAY).toISOString();

const call = (o) => ({
  id: String(o.id),
  customerName: o.name ?? 'לקוח',
  serviceCallStatus: o.status ?? 'קריאה חדשה',
  deviceSerial: o.serial,
  callType: o.type ?? 'פרונטלית',
  created: o.created,
});

const metrics = (calls) => ({
  exceptions: {
    repeatCalls: countRepeatCalls(calls),
    callsOver7d: countOpenOverDays(calls),
  },
});

test('🔴 קריאה פרונטלית חוזרת על אותו מכשיר תוך 3 חודשים נספרת', () => {
  const m = metrics([
    call({ id: 1, serial: 'S1', created: ago(80) }),
    call({ id: 2, serial: 'S1', created: ago(10) }),
  ]);
  assert.equal(m.exceptions.repeatCalls, 1);
});

/**
 * 🔴 זו ההכרעה עצמה. טלפונית אינה "כבר היינו אצלו".
 */
test('🔴 קריאה טלפונית חוזרת אינה נספרת', () => {
  const m = metrics([
    call({ id: 1, serial: 'S1', created: ago(80), type: 'טלפונית' }),
    call({ id: 2, serial: 'S1', created: ago(10), type: 'טלפונית' }),
  ]);
  assert.equal(m.exceptions.repeatCalls, 0);
});

test('🔴 הפרש גדול משלושה חודשים אינו חזרה', () => {
  const m = metrics([
    call({ id: 1, serial: 'S1', created: ago(200) }),
    call({ id: 2, serial: 'S1', created: ago(10) }),
  ]);
  assert.equal(m.exceptions.repeatCalls, 0);
});

test('🔴 שני מכשירים שונים אצל אותו לקוח אינם חזרה', () => {
  const m = metrics([
    call({ id: 1, serial: 'S1', created: ago(30) }),
    call({ id: 2, serial: 'S2', created: ago(10) }),
  ]);
  assert.equal(m.exceptions.repeatCalls, 0);
});

test('קריאה בלי מספר סידורי אינה מפילה ואינה נספרת', () => {
  const m = metrics([
    call({ id: 1, serial: undefined, created: ago(30) }),
    call({ id: 2, serial: '', created: ago(10) }),
  ]);
  assert.equal(m.exceptions.repeatCalls, 0);
});

/** ⭐ נספרת הקריאה **השנייה** ולא הראשונה, אחרת ישן שחזר פעם אחת נספר לנצח. */
test('⭐ שלוש קריאות ברצף נספרות כשתי חזרות', () => {
  const m = metrics([
    call({ id: 1, serial: 'S1', created: ago(70) }),
    call({ id: 2, serial: 'S1', created: ago(40) }),
    call({ id: 3, serial: 'S1', created: ago(10) }),
  ]);
  assert.equal(m.exceptions.repeatCalls, 2);
});

/** 🔴 חלון התצוגה הוא 90 יום. חזרה ישנה אינה "בוער עכשיו". */
test('🔴 חזרה שקרתה לפני יותר מ-90 יום אינה נספרת היום', () => {
  const m = metrics([
    call({ id: 1, serial: 'S1', created: ago(200) }),
    call({ id: 2, serial: 'S1', created: ago(150) }),
  ]);
  assert.equal(m.exceptions.repeatCalls, 0);
});

test('🔴 קריאות פתוחות מעל שבעה ימים נספרות, וסגורות לא', () => {
  const m = metrics([
    call({ id: 1, serial: 'S1', created: ago(10) }),
    call({ id: 2, serial: 'S2', created: ago(10), status: 'בוצע' }),
    call({ id: 3, serial: 'S3', created: ago(10), status: 'בוטל' }),
    call({ id: 4, serial: 'S4', created: ago(3) }),
  ]);
  assert.equal(m.exceptions.callsOver7d, 1);
});
