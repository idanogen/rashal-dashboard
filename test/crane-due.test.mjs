import test from 'node:test';
import assert from 'node:assert/strict';
import { craneDue, craneStartDate } from '../src/lib/crane-due.ts';
import { lastMoves } from '../supabase/functions/rashal-crane-dates/moves.ts';

// המקרה מהפגישה 25/11: 1750200615685, ת. התקנה 07/11/2022 של הלקוח הקודם, נשלח לדנה רחל 21/08/2024.
test('משלוח ללקוח חדש מתחיל שעון חדש, לא תאריך ההתקנה הישן', () => {
  const r = craneDue({ installDate: '2022-11-07', shipDate: '2024-08-21' });
  assert.deepEqual(r, { nextDue: '2027-08-21', basis: 'ship' });
});

test('בלי משלוח בלוג: גיבוי לתאריך ההתקנה', () => {
  assert.deepEqual(craneDue({ installDate: '2022-11-07' }), { nextDue: '2025-11-07', basis: 'install' });
  assert.equal(craneStartDate({ installDate: '2022-11-07' }), '2022-11-07');
});

test('בדיקה אחרי המשלוח קובעת; משלוח אחרי הבדיקה מנצח', () => {
  assert.equal(craneDue({ shipDate: '2023-01-01', lastInspection: { inspectionDate: '2025-02-01' } }).nextDue, '2028-02-01');
  assert.equal(craneDue({ shipDate: '2025-06-01', lastInspection: { inspectionDate: '2024-02-01' } }).nextDue, '2028-06-01');
});

test('אין שום תאריך: לא ידוע', () => {
  assert.deepEqual(craneDue({}), {});
});

test('לוג התנועות: המשלוח האחרון וההחזרה האחרונה', () => {
  const rows = [{ SERNUM: '1750200615685', SERNTRANSENV_SUBFORM: [
    { CURDATE: '2020-09-30T00:00:00Z', DOCDES: 'קבלות סחורה מספק', LOGDOCNO: 'GR20000859' },
    { CURDATE: '2020-10-22T00:00:00Z', DOCDES: 'משלוחים ללקוח', LOGDOCNO: 'SH20004062' },
    { CURDATE: '2022-09-04T00:00:00Z', DOCDES: 'החזרה מלקוח', LOGDOCNO: 'RT22001590' },
    { CURDATE: '2022-11-07T00:00:00Z', DOCDES: 'משלוחים ללקוח', LOGDOCNO: 'SH22004111' },
    { CURDATE: '2024-07-21T00:00:00Z', DOCDES: 'החזרה מלקוח', LOGDOCNO: 'RT2401301' },
    { CURDATE: '2024-08-21T00:00:00Z', DOCDES: 'משלוחים ללקוח', LOGDOCNO: 'SH2402681' },
  ] }, { SERNUM: 'X1', SERNTRANSENV_SUBFORM: [] }];
  assert.deepEqual(lastMoves(rows), [
    { sn: '1750200615685', ship: '2024-08-21', doc: 'SH2402681', ret: '2024-07-21' },
    { sn: 'X1', ship: null, doc: null, ret: null },
  ]);
});
