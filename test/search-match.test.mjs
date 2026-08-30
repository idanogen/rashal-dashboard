import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesSearch } from '../src/lib/search-match.ts';

/**
 * 🔴🔴 **המימוש השלישי של תקלת סדר-המילים.** עמי, 30/08/2026: "לא מצליח
 * לחפש את הלקוח ברשימות". רשימות הסדרן דרשו רצף מדויק, ובפריוריטי אין
 * סדר קבוע בין שם פרטי למשפחה. אותה תקלה תוקנה ב-25/08 פעמיים
 * (customer_search במסד, matchesQuery בתיבה) ונשארה כאן.
 * [[priority_customer_name_has_no_order]]
 */

const HAY = 'קורן שלומי-שלמה 12345 052-1234567 רמת גן מכבי';

test('🔴 שם מלא בסדר הפוך נמצא', () => {
  assert.equal(matchesSearch(HAY, 'שלומי קורן'), true);
});

test('התאמה רצופה רגילה עדיין עובדת', () => {
  assert.equal(matchesSearch(HAY, 'קורן שלומי'), true);
  assert.equal(matchesSearch(HAY, 'רמת גן'), true);
});

test('🔴 כל המילים ולא אחת מהן: "שלומי כהן" לא מחזיר את כל השלומים', () => {
  assert.equal(matchesSearch(HAY, 'שלומי כהן'), false);
});

test('שאילתה ריקה מתאימה להכל', () => {
  assert.equal(matchesSearch(HAY, ''), true);
  assert.equal(matchesSearch(HAY, '   '), true);
});

test('טלפון מוקלד בלי מקפים מוצא טלפון שנשמר עם מקפים', () => {
  assert.equal(matchesSearch(HAY, '0521234567'), true);
  assert.equal(matchesSearch(HAY, '052 123 4567'), true);
});

test('🔴 פחות משלוש ספרות אינו מסלול מספרי (אבל רצף טקסטואלי כן נתפס)', () => {
  // "12" נמצא כרצף בתוך "12345", וזה בסדר; המסלול המספרי לבדו לא נפתח.
  assert.equal(matchesSearch('טלפון 054-9', '49'), false);
});

test('אותיות גדולות/קטנות לא משנות', () => {
  assert.equal(matchesSearch('ACME Ltd 300123', 'acme'), true);
});

test('מילה בת אות אחת לא הופכת שאילתה לרב-מילים', () => {
  // "קורן ו" — האות הבודדת מסוננת, נשארת מילה אחת שנמצאת כרצף.
  assert.equal(matchesSearch(HAY, 'קורן ו'), false);
});
