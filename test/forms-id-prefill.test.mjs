import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContext, idFromCustomerNumber } from '../src/lib/forms/prefill.ts';

/**
 * ת"ז מתוך מספר הלקוח (02/11/2026, עמי: "שיכנס אוטומטי"). נבדק על 28 טפסים
 * שהטכנאים הקלידו ידנית: ב-26 הת"ז זהה למספר הלקוח, והשניים הם טפסי בדיקה.
 */

test('מספר לקוח שהוא ת"ז תקינה נכנס לשדה, עם אפסים מובילים', () => {
  assert.equal(idFromCustomerNumber('041456310'), '041456310');
  assert.equal(idFromCustomerNumber('41456310'), '041456310');
  assert.equal(idFromCustomerNumber('5355896'), '005355896');
  assert.equal(idFromCustomerNumber(' 316800226 '), '316800226');
});

test('מספר לקוח שאינו ת"ז נשאר ריק לטכנאי', () => {
  assert.equal(idFromCustomerNumber('316800227'), ''); // ספרת ביקורת שגויה
  assert.equal(idFromCustomerNumber('C10023'), '');
  assert.equal(idFromCustomerNumber('1234'), '');
  assert.equal(idFromCustomerNumber('5000123456'), '');
  assert.equal(idFromCustomerNumber(null), '');
});

test('ההקשר של הטופס מקבל את הת"ז מהמספר', () => {
  const ctx = buildContext({ customerName: 'מוזס מיכל', customerNumber: '213217904' }, 'אבי', new Date('2026-11-02T10:00:00Z'));
  assert.equal(ctx.idNumber, '213217904');
});
