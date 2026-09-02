import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WEEKLY_TARGET, WEEK_CURVE, weekStart, expectedShare,
  deliveryTargetStatus, countsTowardTarget,
} from '../src/lib/delivery-target.ts';

/**
 * 🔴 מה שנבדק כאן הוא ש**אותו מספר תעודות נשפט אחרת בימים שונים**. זה כל
 * ההבדל בין המדד הזה לבין סרגל אחוזים, ובדיקה שרק סופרת אחוזים הייתה
 * עוברת גם על המימוש שלא רצינו.
 */

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h, 0, 0);
// ספטמבר 2026: 30/08 ראשון · 31/08 שני · 01/09 שלישי · 02/09 רביעי · 03/09 חמישי

test('השבוע מתחיל ביום ראשון, גם כשמסתכלים מאמצע השבוע', () => {
  assert.equal(weekStart(at(2026, 9, 2)).getDate(), 30);   // רביעי → ראשון 30/08
  assert.equal(weekStart(at(2026, 9, 2)).getMonth(), 7);   // אוגוסט
  assert.equal(weekStart(at(2026, 8, 30)).getDate(), 30);  // ראשון עצמו
  assert.equal(weekStart(at(2026, 9, 3)).getDate(), 30);   // חמישי
});

test('🔴 יום שני אינו תחילת שבוע (המלכודת של פוסטגרס)', () => {
  const w = weekStart(at(2026, 8, 31)); // שני
  assert.equal(w.getDay(), 0, 'תחילת השבוע חייבת להיות ראשון');
  assert.equal(w.getDate(), 30);
});

test('הצפוי מטפס במהלך היום ולא קופץ בחצות', () => {
  const morning = expectedShare(at(2026, 9, 2, 8));
  const noon = expectedShare(at(2026, 9, 2, 13));
  const evening = expectedShare(at(2026, 9, 2, 18));
  assert.equal(morning, WEEK_CURVE[2], 'בתחילת יום רביעי הצפוי הוא סוף שלישי');
  assert.ok(noon > morning && noon < evening);
  assert.equal(evening, WEEK_CURVE[3], 'בסוף יום רביעי הצפוי הוא סוף רביעי');
});

test('אחרי שעות העבודה הצפוי לא ממשיך לזוז', () => {
  assert.equal(expectedShare(at(2026, 9, 2, 22)), expectedShare(at(2026, 9, 2, 18)));
  assert.equal(expectedShare(at(2026, 9, 2, 6)), expectedShare(at(2026, 9, 2, 8)));
});

test('⭐ אותו מספר תעודות: קצב טוב ברביעי, פיגור בחמישי בערב', () => {
  const wed = deliveryTargetStatus(85, at(2026, 9, 2, 8));
  const thu = deliveryTargetStatus(85, at(2026, 9, 3, 18));
  assert.ok(wed.gap > -10, `רביעי בבוקר: ${wed.gap}`);
  assert.notEqual(wed.verdict, 'behind');
  assert.ok(thu.gap < -50, `חמישי בערב: ${thu.gap}`);
  assert.equal(thu.verdict, 'behind');
});

test('המצב האמיתי של השבוע הנוכחי, כפי שנמדד', () => {
  // 85 תעודות בבוקר יום רביעי, כלומר בסוף יום שלישי לפי העקומה
  const s = deliveryTargetStatus(85, at(2026, 9, 2, 8));
  assert.equal(s.target, 147);
  assert.equal(s.expected, Math.round(147 * WEEK_CURVE[2])); // 88
  assert.equal(s.gap, 85 - s.expected);
  assert.equal(s.projected, Math.round(85 / WEEK_CURVE[2])); // 143
});

test('🔴 בבוקר יום ראשון אין תחזית, כי תעודה אחת אינה קצב', () => {
  const s = deliveryTargetStatus(1, at(2026, 8, 30, 9));
  assert.equal(s.projected, null, 'תחזית מוקדמת מדי היא מספר שנראה כמו מידע ואינו');
});

test('🔴 מוקדם בשבוע והקדמנו: זו הקדמה, לא פיגור', () => {
  // הבאג שנתפס בצילום (02/09): 4 מול 3 צפויות הוצג "מתחת לקצב",
  // כי הפסיקה נשענה על התחזית שאינה קיימת בשלב הזה ונפלה למספר הגולמי.
  const s = deliveryTargetStatus(4, at(2026, 8, 30, 9));
  assert.ok(s.gap >= 0, `הפער חייב להיות חיובי, התקבל ${s.gap}`);
  assert.equal(s.verdict, 'ahead');
  assert.equal(s.projected, null);
});

test('הפסיקה נגזרת מהקצב ולא מהמספר הגולמי, בכל יום בשבוע', () => {
  for (const [d, h] of [[30, 12], [31, 12], [1, 12], [2, 12], [3, 17]]) {
    const day = d > 20 ? at(2026, 8, d, h) : at(2026, 9, d, h);
    const s = deliveryTargetStatus(Math.round(147 * expectedShare(day)), day);
    assert.equal(s.verdict, 'ahead', `בדיוק בקצב ביום ${d} חייב להיות עמידה`);
  }
});

test('שבוע שסוגר את היעד בדיוק נחשב עמידה', () => {
  const s = deliveryTargetStatus(147, at(2026, 9, 3, 18));
  assert.equal(s.verdict, 'ahead');
  assert.equal(s.pct, 100);
});

test('הסרגל לא חורג מ-100% גם בשבוע חריג', () => {
  const s = deliveryTargetStatus(200, at(2026, 9, 3, 18));
  assert.equal(s.pct, 100);
  assert.equal(s.verdict, 'ahead');
});

test('תעודה מבוטלת אינה נספרת, ותעודה בלי תאריך אינה נספרת', () => {
  assert.equal(countsTowardTarget('סופית', '2026-09-01'), true);
  assert.equal(countsTowardTarget('טיוטא', '2026-09-01'), true);
  assert.equal(countsTowardTarget('מבוטלת', '2026-09-01'), false);
  assert.equal(countsTowardTarget('סופית', null), false);
});

test('היעד והעקומה נעולים: שינוי בהם הוא החלטה ולא תקלה', () => {
  assert.equal(WEEKLY_TARGET, 147);
  assert.equal(WEEK_CURVE.length, 7);
  assert.equal(WEEK_CURVE[6], 1, 'סוף השבוע חייב להיות 100%');
  for (let i = 1; i < WEEK_CURVE.length; i++) {
    assert.ok(WEEK_CURVE[i] >= WEEK_CURVE[i - 1], 'העקומה חייבת לעלות בלבד');
  }
});
