import test from 'node:test';
import assert from 'node:assert/strict';
import {
  rowToFieldInspection, serialKey, countsAsPeriodic, periodicFromField, craneInspectionsBySerial, isUnmatchedCrane, countSince, matchesFieldSearch,
} from '../src/lib/field-inspections.ts';

/** בדיקות הטכנאים מהשטח במסך "בדיקות מנופים" (עמי, 16/11/2026). */

const row = (over = {}) => ({
  id: 'f1', form_type: 'inspection', crane_serial: '17516057934', customer_name: 'שבו יהודה',
  technician_name: 'ישראל', verdict: 'ok', notes: null, submitted_at: '2026-11-16T09:41:04Z',
  created_at: '2026-11-16T09:41:05Z', stop_id: 's1', service_call_id: 'c1', ...over,
});

test('שורה ממופה, ובלי submitted_at נופלים ל-created_at', () => {
  assert.equal(rowToFieldInspection(row()).technician, 'ישראל');
  assert.equal(rowToFieldInspection(row({ submitted_at: null })).submittedAt, '2026-11-16T09:41:05Z');
  assert.equal(rowToFieldInspection(row({ form_type: 'chair_inspection' })).formType, 'chair_inspection');
});

test('מספר סידורי מושווה בלי רווחים ומקפים', () => {
  assert.equal(serialKey(' 175-160 57934 '), '17516057934');
  assert.equal(serialKey(null), '');
});

test('לפי מספר סידורי: רק מנוף, החדשה ראשונה', () => {
  const list = [
    rowToFieldInspection(row({ id: 'a', submitted_at: '2026-11-01T08:00:00Z' })),
    rowToFieldInspection(row({ id: 'b', submitted_at: '2026-11-15T08:00:00Z', crane_serial: '175 16057934' })),
    rowToFieldInspection(row({ id: 'c', form_type: 'chair_inspection' })),
  ];
  const map = craneInspectionsBySerial(list);
  assert.deepEqual(map.get('17516057934').map((f) => f.id), ['b', 'a']);
  assert.equal(map.size, 1);
});

test('בדיקת מנוף שלא במאגר מסומנת, כיסא ממונע לא', () => {
  const known = new Set(['17516057934']);
  assert.equal(isUnmatchedCrane(rowToFieldInspection(row()), known), false);
  assert.equal(isUnmatchedCrane(rowToFieldInspection(row({ crane_serial: '999' })), known), true);
  assert.equal(isUnmatchedCrane(rowToFieldInspection(row({ crane_serial: null })), known), true);
  assert.equal(isUnmatchedCrane(rowToFieldInspection(row({ form_type: 'chair_inspection', crane_serial: null })), known), false);
});

test('ספירה מאז רגע נתון', () => {
  const list = [row({ submitted_at: '2026-11-10T00:00:00Z' }), row({ submitted_at: '2026-11-16T00:00:00Z' })].map(rowToFieldInspection);
  assert.equal(countSince(list, '2026-11-12T00:00:00Z'), 1);
});

test('תקופתית: רק בדיקת מנוף בקריאת שירות שנמצאה תקינה (עמי: "לתקלה או יזום, לא אספקה")', () => {
  const f = (over) => rowToFieldInspection(row(over));
  assert.equal(countsAsPeriodic(f({})), true);
  assert.equal(countsAsPeriodic(f({ service_call_id: null })), false, 'אספקה');
  assert.equal(countsAsPeriodic(f({ verdict: 'out_of_service' })), false, 'לא תקין');
  assert.equal(countsAsPeriodic(f({ form_type: 'chair_inspection' })), false, 'כיסא');
  assert.deepEqual(periodicFromField([f({ submitted_at: '2026-11-16T09:41:04Z' })]), [{ inspectionDate: '2026-11-16', status: 'completed' }]);
  assert.deepEqual(periodicFromField(undefined), []);
});

test('חיפוש בבדיקות הטכנאים: שם בכל סדר, טכנאי, מספר סידורי עם מקפים', () => {
  const f = rowToFieldInspection(row());
  assert.equal(matchesFieldSearch(f, ''), true);
  assert.equal(matchesFieldSearch(f, 'יהודה שבו'), true);
  assert.equal(matchesFieldSearch(f, 'ישראל'), true);
  assert.equal(matchesFieldSearch(f, '175-160'), true);
  assert.equal(matchesFieldSearch(f, 'כהן'), false);
});
