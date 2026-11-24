import test from 'node:test';
import assert from 'node:assert/strict';
import { focusDocRef, eventMatchesFocus } from '../src/lib/card-focus.ts';

/** חיפוש ספציפי מוביל לביקור (עידן 24/11/2026, SO2604018 של קולודני נאוה). */
test('מספר מסמך מזוהה, שם וטלפון לא', () => {
  assert.equal(focusDocRef('SO2604018'), 'SO2604018');
  assert.equal(focusDocRef(' so2604018 '), 'SO2604018');
  assert.equal(focusDocRef('SH2604717'), 'SH2604717');
  assert.equal(focusDocRef('SC2604044'), 'SC2604044');
  assert.equal(focusDocRef('308832'), '308832');
  assert.equal(focusDocRef('052912391'), null);
  assert.equal(focusDocRef('0501234567'), null);
  assert.equal(focusDocRef('קולודני'), null);
  assert.equal(focusDocRef(''), null);
  assert.equal(focusDocRef(null), null);
});

test('ביקור נמצא לפי מספר ההזמנה שלו, תעודה לפי ה-SH', () => {
  const visit = { ref: 'רודי', refs: ['SO2604018'] };
  const note = { ref: '308832', refs: ['SH2604717'] };
  assert.equal(eventMatchesFocus(visit, 'SO2604018'), true);
  assert.equal(eventMatchesFocus(note, 'SH2604717'), true);
  assert.equal(eventMatchesFocus(note, '308832'), true);
  assert.equal(eventMatchesFocus(visit, 'SH2604717'), false);
  // ה-SH של ביקור מגיע מהמסך (useStopDocs), לא מהמסד
  assert.equal(eventMatchesFocus(visit, 'SH2604717', ['SH2604717']), true);
});

test('בלי מוקד אין הדגשה, וגם לא על שורה בלי מספרים', () => {
  assert.equal(eventMatchesFocus({ ref: 'SO1' }, null), false);
  assert.equal(eventMatchesFocus({ ref: null }, 'SO2604018'), false);
  assert.equal(eventMatchesFocus({ ref: null, refs: null }, 'SO2604018'), false);
});
