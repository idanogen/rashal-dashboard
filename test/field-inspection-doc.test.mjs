import test from 'node:test';
import assert from 'node:assert/strict';
import { fieldInspectionDocInput, sectionsForForm } from '../src/lib/field-inspection-doc.ts';
import { checklistLayout } from '../src/lib/forms/layouts/checklist.ts';
import { CRANE_CHECKLIST_V1_TEXT } from '../src/lib/crane-checklist.ts';

/** המסמך החתום של בדיקת טכנאי, נבנה בדשבורד מהנתונים השמורים (16/11/2026). */

const row = (over = {}) => ({
  form_type: 'inspection', checklist_version: 2, crane_serial: '17516057934', customer_name: 'שבו יהודה',
  customer_number: '8449321', answers: { a1: true }, verdict: 'ok', notes: 'הכל תקין', technician_name: 'ישראל',
  recipient_name: 'יהודה שבו', recipient_signature: 'data:image/png;base64,AAAA',
  submitted_at: '2026-11-16T09:41:04Z', created_at: '2026-11-16T09:41:05Z', ...over,
});

test('טופס מגרסה 1 מוצג בנוסח שבו נחתם', () => {
  const b4 = (v) => sectionsForForm('inspection', v).flatMap((s) => s.items).find((i) => i.id === 'b4').text;
  assert.equal(b4(1), CRANE_CHECKLIST_V1_TEXT.b4);
  assert.notEqual(b4(2), CRANE_CHECKLIST_V1_TEXT.b4);
});

test('כיסא ממונע מקבל את הכותרת והרשימה של הכיסא', () => {
  const input = fieldInspectionDocInput(row({ form_type: 'chair_inspection' }), {});
  assert.match(input.title, /כיסא/);
});

test('המסמך נושא את הלקוח, החותם, החתימה, הקריאה והתוצאה', () => {
  const html = checklistLayout(fieldInspectionDocInput(row(), { deviceModel: 'G175', docNumber: 'SC2612345' }));
  for (const s of ['שבו יהודה', 'יהודה שבו', 'data:image/png;base64,AAAA', 'SC2612345', '17516057934', 'הכל תקין', 'תקין להפעלה']) {
    assert.ok(html.includes(s), s);
  }
});

test('בלי submitted_at התאריך מ-created_at', () => {
  const input = fieldInspectionDocInput(row({ submitted_at: null }), {});
  assert.equal(input.meta.signedAt.toISOString(), '2026-11-16T09:41:05.000Z');
});
