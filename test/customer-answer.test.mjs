import test from 'node:test';
import assert from 'node:assert/strict';
import {
  answerLine, mismatchNote, matchLabel, certaintyNote,
  daysSince, agoLabel, dayLabel, windowLabel,
} from '../src/lib/customer-answer.ts';

/**
 * 🔴 המשפט הזה הוא מה שנאמר ללקוח בטלפון. בדיקה שלו היא בדיקה של מה
 * שיוצא מהפה של הנציג, לא של פורמט.
 */

const NOW = new Date('2026-08-24T12:00:00Z').getTime();

const order = (o = {}) => ({
  id: 'o1', ref: 'SO2603120', status: 'ממתין לתאום',
  created: '2026-08-12T08:00:00Z', match: 'number',
  scheduled: false, date: null, driver: null, ...o,
});

test('משלוח משובץ: המשפט נותן יום, נהג וחלון שעות', () => {
  const a = answerLine([order({ scheduled: true, date: '2026-08-26', driver: 'רודי', winStart: '09:00:00', winEnd: '12:00:00', status: 'תואמה אספקה' })], [], NOW);
  assert.equal(a.tone, 'ok');
  assert.match(a.text, /יום רביעי 26\/08/);
  assert.match(a.text, /רודי/);
  assert.match(a.text, /09:00 עד 12:00/);
});

test('🔴 משלוח פתוח שלא שובץ: המשפט אומר כמה זמן הוא מחכה', () => {
  // גיל ההמתנה הוא מה שמאפשר לנציג להבחין בין עבודה חיה לשארית.
  const a = answerLine([order()], [], NOW);
  assert.equal(a.tone, 'warn');
  assert.match(a.text, /לא שובץ לאספקה/, 'יחיד ורבים');
  assert.match(a.text, /12 ימים/);
});

test('כמה משלוחים פתוחים: הגיל נלקח מהוותיק ביותר', () => {
  const a = answerLine([order({ created: '2026-08-22T08:00:00Z' }), order({ id: 'o2', created: '2026-06-01T08:00:00Z' })], [], NOW);
  assert.match(a.text, /יש 2 משלוחים פתוחים, עדיין לא שובצו/);
  assert.match(a.text, /84 ימים/);
});

test('משובץ גובר על לא משובץ, גם כשהלא-משובץ ראשון ברשימה', () => {
  const a = answerLine([order(), order({ id: 'o2', scheduled: true, date: '2026-08-26', driver: 'דוד' })], [], NOW);
  assert.equal(a.tone, 'ok');
  assert.match(a.text, /2 משלוחים פתוחים, אחד מהם/);
});

test('אין משלוח אבל יש קריאת שירות פתוחה', () => {
  const a = answerLine([], [order({ id: 'c1', ref: 'SC1', created: '2026-08-15T08:00:00Z' })], NOW);
  assert.equal(a.tone, 'warn');
  assert.match(a.text, /אין משלוח פתוח/);
  assert.match(a.text, /קריאת שירות/);
});

test('לקוח נקי לגמרי', () => {
  const a = answerLine([], [], NOW);
  assert.equal(a.tone, 'none');
  assert.match(a.text, /שום פריט פתוח/);
});

test('🔴 פער בין הסטטוס ליומן נאמר במפורש, בשני הכיוונים', () => {
  const noStop = mismatchNote(order({ status: 'תואמה אספקה', mismatch: true, scheduled: false }));
  assert.match(noStop, /אין שום עצירה ביומן/);
  const hasStop = mismatchNote(order({ status: 'בוטל', mismatch: true, scheduled: true }));
  assert.match(hasStop, /יש עצירה ביומן/);
  assert.equal(mismatchNote(order()), null, 'בלי פער אין הודעה');
});

test('🔴 התאמה לפי מספר לקוח אינה מסומנת, ורכה כן', () => {
  // תגית על כל רשומה הייתה הופכת לרעש; מה שצריך סימון הוא מה שאינו ודאי.
  assert.equal(matchLabel('number'), null);
  assert.equal(matchLabel('phone'), 'זוהה לפי טלפון');
  assert.equal(matchLabel('name'), 'זוהה לפי שם');
});

test('משפט הוודאות מופיע רק כשיש התאמות רכות', () => {
  assert.equal(certaintyNote({ byNumber: 9, byPhone: 0, byName: 0 }), null);
  const n = certaintyNote({ byNumber: 3, byPhone: 2, byName: 1 });
  assert.match(n, /3 רשומות כאן חוברו/);
  assert.match(n, /2 לפי טלפון/);
  assert.match(n, /1 לפי שם/);
});

test('עזרי תאריך', () => {
  assert.equal(daysSince(null), null);
  assert.equal(daysSince('2026-08-24T00:00:00Z', NOW), 0);
  assert.equal(agoLabel('2026-08-24T00:00:00Z', NOW), 'היום');
  assert.equal(agoLabel('2026-08-23T00:00:00Z', NOW), 'אתמול');
  assert.equal(agoLabel('2026-06-24T00:00:00Z', NOW), 'לפני חודשיים'.replace('חודשיים', '2 חודשים'));
  assert.equal(dayLabel(null), '');
  assert.equal(windowLabel(null, null), '');
  assert.equal(windowLabel('09:00:00', null), 'מ-09:00');
});
