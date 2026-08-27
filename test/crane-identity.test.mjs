import test from 'node:test';
import assert from 'node:assert/strict';
import { craneInOrder, isCraneModel } from '../src/lib/crane-identity.ts';

/**
 * 🔴🔴 **הבדיקה שמונעת את החזרה לרשימה הקשיחה.**
 *
 * הרשימה שהייתה (`['G150','G150E','G175']`) פספסה G130, G175E, G130E
 * ו-G165, כולם קיימים בנתונים. רשימה שחסר בה ערך אינה מחזירה שגיאה,
 * היא פשוט מפסיקה להתאים. [[terminal_status_list_missing_a_state]]
 */

test('⭐ כל הדגמים שנמדדו בנתונים מזוהים כמנוף', () => {
  // הרשימה הזאת אינה המימוש, היא מה שנמדד במסד ב-27/08/2026.
  for (const m of ['G175', 'G150', 'G175E', 'G150E', 'G130', 'G130E', 'G165']) {
    assert.ok(isCraneModel(m), `${m} אמור להיות מנוף`);
  }
});

test('🔴 דגם עתידי באותה משפחה נתפס מעצמו', () => {
  // זו כל הנקודה: G185 עוד לא נמכר, וכשהוא יימכר אף אחד לא יזכור
  // לעדכן רשימה בקוד.
  assert.ok(isCraneModel('G185'));
  assert.ok(isCraneModel('G200E'));
});

test('רווחים מיותרים ואותיות קטנות אינם מפילים את הזיהוי', () => {
  assert.ok(isCraneModel('  G175 '));
  assert.ok(isCraneModel('g175e'));
});

test('🔴 מה שאינו מנוף אינו נתפס', () => {
  for (const m of ['SL 1003', 'MOH4071', 'ש\'ע', 'G17', 'G1750', 'GX175', '', null, undefined]) {
    assert.equal(isCraneModel(m), false, `${m} אינו אמור להיות מנוף`);
  }
});

test('🔴🔴 ערסל למנוף אינו מנוף', () => {
  // ⭐ נמדד: 4,500 שורות ערסל ו-3,000 שורות השתתפות עצמית מכילות את
  // המילה "מנוף" בתיאור. התאמה על התיאור הייתה פותחת טופס הדרכה על
  // אספקת ערסל בודד.
  const items = [
    { part: 'SL 1003', desc: 'ערסל למנוף מידה M', serial: null },
    { part: 'השתתפות עצמית', desc: 'השתתפות עצמית עבור רכישת מנוף חשמלי עד 175 ק"ג', serial: null },
    { part: 'ש\'ע', desc: 'זמן עבודה בתיקון מנוף', serial: null },
  ];
  assert.equal(craneInOrder(items), null);
});

test('הזמנה עם מנוף מחזירה אותו יחד עם המספר הסידורי', () => {
  const items = [
    { part: 'SL 1006', desc: 'ערסל למנוף מידה L', serial: null },
    { part: 'G175', desc: 'מנוף חשמלי SUNRISE MEDICAL', serial: '17517098728' },
  ];
  const found = craneInOrder(items);
  assert.equal(found?.part, 'G175');
  assert.equal(found?.serial, '17517098728');
});

test('הזמנה בלי פריטים אינה מפילה כלום', () => {
  assert.equal(craneInOrder(null), null);
  assert.equal(craneInOrder(undefined), null);
  assert.equal(craneInOrder([]), null);
});
