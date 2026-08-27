import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LOW_RATING_MAX,
  buildAlertMail,
  shouldAlert,
} from '../supabase/functions/rashal-surveys/low-rating.ts';

/**
 * 🔴 **הבדיקות שמגנות על ההכרעות, לא על הפורמט.**
 *
 * המנגנון הזה נוגע בלקוח לא מרוצה, וכל תקלה בו נראית כמו חוסר אכפתיות.
 * שלוש ההכרעות שנשמרות כאן: הסף הוא 2 ומטה, רשומת בדיקה אינה מתריעה,
 * וההערה שהלקוח כתב היא לב ההודעה ולא הערת שוליים.
 */

const row = (o = {}) => ({
  id: 's1',
  customerName: 'כהן דוד',
  driver: 'רודי',
  q1: 2,
  q2: 2,
  comment: 'הנהג איחר בשלוש שעות',
  answeredAt: '2026-08-27T09:00:00Z',
  isTest: false,
  alertedAt: null,
  ...o,
});

test('🔴 הסף הוא 2 ומטה, כפי שעידן קבע', () => {
  assert.equal(LOW_RATING_MAX, 2);
  assert.equal(shouldAlert(row({ q1: 1 })).alert, true);
  assert.equal(shouldAlert(row({ q1: 2 })).alert, true);
  assert.equal(shouldAlert(row({ q1: 3 })).alert, false);
  assert.equal(shouldAlert(row({ q1: 5 })).alert, false);
});

test('🔴🔴 רשומת בדיקה אינה מתריעה', () => {
  // נמדד: שתיים משלוש התוצאות הנמוכות שהיו עד היום הן בדיקות פנימיות,
  // כלומר בלי השער הזה ההתרעה הראשונה שהצוות היה מקבל היא על עצמו.
  const d = shouldAlert(row({ isTest: true }));
  assert.equal(d.alert, false);
  assert.equal(d.reason, 'test_row');
});

test('🔴 לא מתריעים פעמיים על אותה חוות דעת', () => {
  const d = shouldAlert(row({ alertedAt: '2026-08-27T09:05:00Z' }));
  assert.equal(d.alert, false);
  assert.equal(d.reason, 'already_alerted');
});

test('סקר שנשלח ולא נענה אינו מתריע', () => {
  const d = shouldAlert(row({ answeredAt: null, q1: null }));
  assert.equal(d.alert, false);
  assert.equal(d.reason, 'not_answered');
});

test('🔴 ציון חסר אינו נחשב ציון נמוך', () => {
  // ⭐ לקוח יכול לענות רק על השאלה השנייה או רק להשאיר הערה. `null`
  // אינו אפס, ובלי ההבחנה הזאת כל תשובה חלקית הייתה מייצרת התרעה.
  const d = shouldAlert(row({ q1: null }));
  assert.equal(d.alert, false);
  assert.equal(d.reason, 'not_low');
});

test('🔴 ההמלצה אינה מפעילה התרעה בעצמה', () => {
  // נמדד: לקוח נתן שביעות רצון 3 והמלצה 4, כלומר שתי השאלות אינן מודדות
  // את אותו דבר. הקובע הוא שביעות הרצון בלבד.
  assert.equal(shouldAlert(row({ q1: 5, q2: 1 })).alert, false);
});

test('⭐ ההערה של הלקוח היא לב ההודעה', () => {
  const m = buildAlertMail(row(), 'https://x.test/surveys');
  assert.match(m.subject, /כהן דוד/);
  assert.match(m.subject, /2 מתוך 5/);
  assert.match(m.html, /הנהג איחר בשלוש שעות/);
  assert.match(m.html, /מה שהוא כתב/);
  assert.match(m.html, /רודי/);
});

test('🔴 כשאין הערה זה נאמר, ולא נשאר שדה ריק', () => {
  const m = buildAlertMail(row({ comment: '  ' }), 'https://x.test/surveys');
  assert.match(m.html, /לא הוסיף הערה/);
  assert.doesNotMatch(m.html, /מה שהוא כתב/);
});

test('🔴 שם או הערה עם תווי HTML אינם שוברים את המייל', () => {
  const m = buildAlertMail(
    row({ customerName: 'כהן <b>דוד</b>', comment: 'איחר & לא התקשר' }),
    'https://x.test/surveys'
  );
  assert.match(m.html, /&lt;b&gt;/);
  assert.match(m.html, /&amp;/);
  assert.doesNotMatch(m.html, /<b>דוד<\/b>/);
});

test('לקוח בלי שם מוצג כ"לקוח" ולא כשדה ריק', () => {
  const m = buildAlertMail(row({ customerName: null }), 'https://x.test/surveys');
  assert.match(m.subject, /^דירוג נמוך בסקר: לקוח /);
});

test('⭐ ההודעה מפנה לאדם, לא לאוטומציה', () => {
  // זו ההכרעה שהמנגנון הזה קיים בשבילה, ולכן היא נבדקת ולא רק נכתבת.
  const m = buildAlertMail(row(), 'https://x.test/surveys');
  assert.match(m.html, /שיחת טלפון/);
});
