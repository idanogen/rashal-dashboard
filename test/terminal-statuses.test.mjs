import test from 'node:test';
import assert from 'node:assert/strict';
import { ORDER_CLOSED, CALL_CLOSED, PICKUP_CLOSED } from '../src/lib/constants.ts';

/**
 * 🔴🔴 הבדיקה נכתבה אחרי שנמצא ש-`PICKUP_CLOSED` הכיל `'בוצע'`, ערך
 * שאינו סטטוס איסוף בכלל, **ופספס את `'נאסף'`** שהוא מצב הסיום הרגיל.
 * התוצאה: 12,210 מתוך 13,266 האיסופים נחשבו "לא סופיים" למסנן החלון.
 *
 * ⭐ הכשל הזה שקט לחלוטין: אין שגיאה, אין אזהרה, והמסנן פשוט מפסיק
 * לסנן. בדיקה סטטית היא הדרך היחידה לתפוס אותו, כי שום מסך לא מציג
 * "הרשימה מכילה ערך שלא קיים".
 */

/** הסטטוסים האמיתיים, מועתקים מהאיחודים ב-`src/types`. */
const REAL = {
  order: ['ממתין לליקוט', 'ממתין לתאום', 'תואמה אספקה', 'אין במלאי', 'סופק', 'בוטל'],
  call: ['קריאה חדשה', 'תואם ביקור', 'בוצע', 'בוטל'],
  pickup: ['ממתין לתאום', 'תואם איסוף', 'נאסף', 'בוטל'],
};

test('🔴 כל ערך ברשימת הסופיים הוא סטטוס שקיים באמת', () => {
  for (const v of PICKUP_CLOSED) assert.ok(REAL.pickup.includes(v), `איסופים: "${v}" אינו סטטוס קיים`);
  for (const v of ORDER_CLOSED) assert.ok(REAL.order.includes(v), `הזמנות: "${v}" אינו סטטוס קיים`);
  for (const v of CALL_CLOSED) assert.ok(REAL.call.includes(v), `קריאות: "${v}" אינו סטטוס קיים`);
});

/**
 * 🔴 ובכיוון ההפוך: `בוטל` הוא סופי בכל שלושת הסוגים, ואם הוא נעלם
 * מרשימה כלשהי המסך יתחיל למשוך מבוטלות בלי ששום דבר יצעק.
 */
test('🔴 "בוטל" סופי בשלושת הסוגים', () => {
  assert.ok(PICKUP_CLOSED.includes('בוטל'));
  assert.ok(ORDER_CLOSED.includes('בוטל'));
  assert.ok(CALL_CLOSED.includes('בוטל'));
});

test('🔴 מצב הסיום הרגיל של כל סוג נמצא ברשימה', () => {
  // זה בדיוק מה שהיה חסר באיסופים.
  assert.ok(PICKUP_CLOSED.includes('נאסף'), 'איסוף שנאסף הוא איסוף שהסתיים');
  assert.ok(ORDER_CLOSED.includes('סופק'));
  assert.ok(CALL_CLOSED.includes('בוצע'));
});

test('ומצב פתוח לעולם אינו ברשימה', () => {
  assert.ok(!PICKUP_CLOSED.includes('ממתין לתאום'));
  assert.ok(!PICKUP_CLOSED.includes('תואם איסוף'));
  assert.ok(!ORDER_CLOSED.includes('ממתין לתאום'));
  assert.ok(!CALL_CLOSED.includes('קריאה חדשה'));
});
