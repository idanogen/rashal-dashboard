import test from 'node:test';
import assert from 'node:assert/strict';
import { FORM_DEFINITIONS, findForm } from '../src/lib/forms/registry.ts';
import { buildContext, buildInitialValues, missingRequired } from '../src/lib/forms/prefill.ts';
import { DEMO_DRIVER, demoEntries, demoSource } from '../src/lib/forms-demo.ts';

/** מסך הדגמת הטפסים (25/10/2026), לפני המסירה לעמי. */

test('⭐ כל טופס במערכת מופיע בהדגמה, וטופס חדש יופיע מעצמו', () => {
  const keys = demoEntries(FORM_DEFINITIONS).map((e) => e.key).sort();
  assert.deepEqual(keys, FORM_DEFINITIONS.map((d) => d.key).sort());
  assert.ok(keys.length >= 8);
});

test('לקוח הדמה נבחר לאותו טופס שהמערכת הייתה בוחרת לו', () => {
  for (const def of FORM_DEFINITIONS) {
    const src = demoSource(def);
    // משרד הבריאות תופס גם "משרד הבריאות"; תיקון אחיד לכל הקופות.
    assert.equal(findForm(src.healthFund, def.kind)?.key, def.key, def.key);
  }
});

test('הטפסים נפתחים כבר ממולאים בפרטי הלקוח והמכשיר', () => {
  // כללית היא צילום של טופס הנייר, אין בה שדות למלא.
  for (const def of FORM_DEFINITIONS.filter((d) => !d.photoOnly)) {
    const src = demoSource(def);
    const values = buildInitialValues(def, buildContext(src, DEMO_DRIVER), src.lines);
    const filled = Object.values(values).filter((v) => typeof v === 'string' && v.trim()).length;
    assert.ok(filled >= 3, `${def.key}: רק ${filled} שדות מולאו`);
    // שדות החובה שנשארים הם מה שהטכנאי באמת ממלא מול הלקוח (ת"ז, בחירות).
    assert.ok(Array.isArray(missingRequired(def, values)), def.key);
  }
});
