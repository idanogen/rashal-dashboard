import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderPreview, missingVariables } from '../src/lib/template-render.ts';

const BODY =
  'שלום {{var.customer_name}}, כאן ר.שעל בע"מ.\nעדכון בנוגע ל{{var.subject}} שלכם: {{var.details}}';

test('🔴 התחביר עם var. מוחלף, לא נשאר כטקסט', () => {
  const out = renderPreview(BODY, { customer_name: 'רבקה', subject: 'הכיסא', details: 'הגיע' });
  assert.ok(out.includes('שלום רבקה,'));
  assert.ok(!out.includes('{{'), out);
});

test('התחביר הישן בלי var. עדיין נתמך', () => {
  assert.equal(renderPreview('שלום {{name}}', { name: 'דוד' }), 'שלום דוד');
});

test('משתנה ריק מוצג כמציין מקום ולא נעלם', () => {
  const out = renderPreview(BODY, { customer_name: 'רבקה' });
  assert.ok(out.includes('{subject}'), out);
});

test('רווחים בתוך הסוגריים לא שוברים', () => {
  assert.equal(renderPreview('היי {{ var.name }}', { name: 'עמי' }), 'היי עמי');
});

test('missingVariables מחזיר בדיוק את הריקים', () => {
  assert.deepEqual(
    missingVariables(['customer_name', 'subject', 'details'], { customer_name: 'x', subject: '  ' }),
    ['subject', 'details'],
  );
});

/**
 * 🔴 שני מימושים של אותו כלל נפרדים בשקט. הבדיקה הזאת אוסרת את זה.
 */
test('🔴 הביטוי בשרת ובדפדפן זהה תו בתו', () => {
  const grab = (p) => {
    const m = readFileSync(p, 'utf8').match(/const VAR_RE = (.+);/);
    assert.ok(m, `לא נמצא VAR_RE ב-${p}`);
    return m[1];
  };
  assert.equal(grab('src/lib/template-render.ts'), grab('api/_lib/templates-store.ts'));
});
