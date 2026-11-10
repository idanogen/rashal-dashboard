import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHAIR_CHECKLIST, CHAIR_FORM_TYPE, canSubmitChair } from '../src/lib/chair-checklist.ts';
import { checkAll, progressOf, CRANE_CHECKLIST } from '../src/lib/crane-checklist.ts';

/** רשימת הבדיקה לכיסא ממונע (שלומי, 03/11/2026). הטופס לא מאבד פריט, ואין "תקין" בלי בדיקה וחתימה. */

const ids = CHAIR_CHECKLIST.flatMap((s) => s.items.map((i) => i.id));
const all = () => checkAll({}, CHAIR_CHECKLIST);

test('הטופס שלם: חמישה פרקים ו-11 פריטים, מזהים ייחודיים', () => {
  assert.equal(CHAIR_CHECKLIST.length, 5);
  assert.equal(ids.length, 11);
  assert.equal(new Set(ids).size, 11);
});

test('הפריט האדום בטופס המקורי נשאר קריטי', () => {
  const critical = CHAIR_CHECKLIST.flatMap((s) => s.items).filter((i) => i.critical);
  assert.deepEqual(critical.map((i) => i.id), ['b1']);
  assert.match(critical[0].text, /תפעול בחרום/);
});

test('סימון הכל מסמן את רשימת הכיסא ולא את רשימת המנוף', () => {
  const a = all();
  assert.equal(progressOf(a, CHAIR_CHECKLIST).missing.length, 0);
  assert.ok(progressOf(a, CRANE_CHECKLIST).missing.length > 0);
});

test('"תקין להפעלה" מחייב שהכל סומן', () => {
  const a = all();
  a.e2 = false;
  const r = canSubmitChair(a, 'ok', 'ישראל ישראלי', 'data:sig');
  assert.equal(r.ok, false);
  assert.match(r.reason, /נותרו 1 פריטים/);
});

test('"הוצא משימוש" מותר גם עם פריטים פתוחים', () => {
  assert.equal(canSubmitChair({}, 'out_of_service', 'ישראל ישראלי', 'data:sig').ok, true);
});

test('🔴 בלי חתימה, בלי שם או בלי סיכום אין טופס', () => {
  assert.match(canSubmitChair(all(), 'ok', 'ישראל ישראלי', null).reason, /חתימה/);
  assert.match(canSubmitChair(all(), 'ok', '  ', 'data:sig').reason, /שם/);
  assert.match(canSubmitChair(all(), null, 'ישראל ישראלי', 'data:sig').reason, /תקין להפעלה/);
  assert.equal(canSubmitChair(all(), 'ok', 'ישראל ישראלי', 'data:sig').ok, true);
});

test('סוג הטופס מוכר למסד: המיגרציה מתירה אותו ב-crane_forms ומחזירה אותו לעצירה', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261110_chair_checklist.sql', import.meta.url), 'utf8');
  assert.match(sql, new RegExp(`form_type in \\('inspection', 'training', '${CHAIR_FORM_TYPE}'\\)`));
  assert.match(sql, new RegExp(`then '${CHAIR_FORM_TYPE}'`));
});
