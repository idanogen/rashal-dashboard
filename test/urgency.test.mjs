import test from 'node:test';
import assert from 'node:assert/strict';
import { urgencyOf, urgentWord, manualActive, isWorkHoursIL, israelDate, urgencyLabel } from '../api/_lib/urgency.ts';

/**
 * דחיפות בתיבה (08/10/2026). מה שנבדק הוא שהתג אדום רק עם סיבה אמיתית,
 * ושהסימון הידני יורד לבד במענה ולא נשאר דלוק לנצח.
 */

// יום רביעי 08/10/2026 10:00 שעון ישראל = 07:00 UTC
const WORK = Date.parse('2026-10-08T07:00:00Z');
// אותו יום 22:00 שעון ישראל
const NIGHT = Date.parse('2026-10-08T19:00:00Z');
// שבת
const SAT = Date.parse('2026-10-10T08:00:00Z');

test('שעות עבודה בשעון ישראל, לא UTC', () => {
  assert.equal(isWorkHoursIL(WORK), true);
  assert.equal(isWorkHoursIL(NIGHT), false);
  assert.equal(isWorkHoursIL(SAT), false);
  assert.equal(isWorkHoursIL(Date.parse('2026-10-09T09:00:00Z')), true);  // שישי 12:00
  assert.equal(isWorkHoursIL(Date.parse('2026-10-09T11:00:00Z')), false); // שישי 14:00
  assert.equal(israelDate(Date.parse('2026-10-08T21:30:00Z')), '2026-10-09'); // 00:30 למחרת בישראל
});

test('ממתין מעל שעה: דחוף ביום, לא בלילה, לא מתחת לסף', () => {
  assert.deepEqual(urgencyOf({ waitingMinutes: 75 }, undefined, WORK).reasons, ['ממתין מעל שעה']);
  assert.equal(urgencyOf({ waitingMinutes: 75 }, undefined, NIGHT).active, false);
  assert.equal(urgencyOf({ waitingMinutes: 59 }, undefined, WORK).active, false);
  assert.equal(urgencyOf({ waitingMinutes: null }, undefined, WORK).active, false);
});

test('ביקור היום או מחר, רק כשהלקוח מחכה', () => {
  assert.deepEqual(urgencyOf({ waitingMinutes: 3 }, { nextStopDate: '2026-10-08' }, WORK).reasons, ['ביקור היום']);
  assert.deepEqual(urgencyOf({ waitingMinutes: 3 }, { nextStopDate: '2026-10-09' }, WORK).reasons, ['ביקור מחר']);
  assert.equal(urgencyOf({ waitingMinutes: 3 }, { nextStopDate: '2026-10-12' }, WORK).active, false);
  assert.equal(urgencyOf({ waitingMinutes: null }, { nextStopDate: '2026-10-08' }, WORK).active, false);
});

test('מילות דחיפות עם גבולות מילה', () => {
  assert.equal(urgentWord('המנוף נפל על הרצפה'), 'נפל');
  assert.equal(urgentWord('היה נפלא תודה'), null);
  assert.equal(urgentWord('הכיסא  לא   עובד'), 'לא עובד');
  assert.equal(urgentWord('זה דחוף!!'), 'דחוף');
  assert.equal(urgentWord('הגעתי בסדר'), null);
  assert.equal(urgentWord(null), null);
  assert.deepEqual(urgencyOf({ waitingMinutes: 2 }, { lastInboundBody: 'המכשיר נתקע' }, NIGHT).reasons, ['כתב "נתקע"']);
});

test('סקר נמוך עם הערה', () => {
  assert.deepEqual(urgencyOf({ waitingMinutes: 1, survey: { score: 2, comment: 'הטכנאי לא הגיע' } }, undefined, NIGHT).reasons, ['סקר 2 עם הערה']);
  assert.equal(urgencyOf({ waitingMinutes: 1, survey: { score: 2, comment: '' } }, undefined, NIGHT).active, false);
  assert.equal(urgencyOf({ waitingMinutes: 1, survey: { score: 4, comment: 'בסדר' } }, undefined, NIGHT).active, false);
});

test('סימון ידני: פעיל עד שעונים, גם כשהשיחה לא "מחכה"', () => {
  const marked = { waitingMinutes: null, urgentMarkedAt: '2026-10-08T06:00:00Z', urgentMarkedBy: 'אילונה' };
  assert.equal(manualActive(marked), true);
  const u = urgencyOf(marked, undefined, NIGHT);
  assert.equal(u.active, true);
  assert.equal(u.manual, true);
  assert.deepEqual(u.reasons, ['סומן על ידי אילונה']);
  // ענינו אחרי הסימון: יורד
  assert.equal(manualActive({ ...marked, lastHumanAt: '2026-10-08T06:30:00Z', lastHumanDirection: 'out' }), false);
  // הלקוח כתב אחרי הסימון: נשאר
  assert.equal(manualActive({ ...marked, lastHumanAt: '2026-10-08T06:30:00Z', lastHumanDirection: 'in' }), true);
  // ענינו לפני הסימון: נשאר
  assert.equal(manualActive({ ...marked, lastHumanAt: '2026-10-08T05:00:00Z', lastHumanDirection: 'out' }), true);
});

test('כמה סיבות יחד, והתווית', () => {
  const u = urgencyOf({ waitingMinutes: 90, survey: null, urgentMarkedAt: '2026-10-08T06:00:00Z' }, { nextStopDate: '2026-10-08', lastInboundBody: 'דחוף' }, WORK);
  assert.deepEqual(u.reasons, ['סומן ידנית', 'ממתין מעל שעה', 'ביקור היום', 'כתב "דחוף"']);
  assert.equal(urgencyLabel(u), 'דחוף · סומן ידנית · ממתין מעל שעה · ביקור היום · כתב "דחוף"');
  assert.equal(urgencyLabel(urgencyOf({ waitingMinutes: null }, undefined, WORK)), '');
});
