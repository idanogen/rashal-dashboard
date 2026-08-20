import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * נעילת מרשם התבניות.
 *
 * 🔴 למה הטסט הזה קיים: אותו מרשם קיים בשני קבצים, כי הבנייה של `api/`
 * ושל `src/` מופרדות (`tsconfig.api.json` כולל רק `api`, ו-`tsconfig.app.json`
 * כולל רק `src`). הצד הקדמי מצייר את התבנית, והשרת הוא זה ששולח אותה.
 *
 * **אם השניים מתפצלים, החלונית מציגה נוסח אחד והלקוח מקבל אחר, בלי שום
 * שגיאה בדרך.** שם משתנה שגוי גרוע במיוחד: heyy לא דוחה אותו, הוא פשוט
 * מגיע ללקוח כחור בטקסט.
 *
 * אותו עיקרון של `phone-parity.test.mjs`: שני מימושים של אותו דבר חייבים
 * טסט שנועל את ההסכמה ביניהם.
 */

const SERVER = 'api/_lib/ogen-templates.ts';
const CLIENT = 'src/lib/heyy/ogen-templates.ts';

/** שולף את המרשם מקובץ TypeScript בלי להריץ אותו. */
function parseRegistry(path) {
  const src = fs.readFileSync(path, 'utf8');
  const out = {};

  // כל בלוק של תבנית: המפתח, ואחריו השדות עד הסוגר.
  for (const m of src.matchAll(/^ {2}(\w+):\s*\{([\s\S]*?)^ {2}\},$/gm)) {
    const [, key, block] = m;
    const field = (name) => (block.match(new RegExp(`${name}:\\s*'([^']*)'`)) || [])[1];
    const vars = (block.match(/variables:\s*\[([^\]]*)\]/) || [])[1];
    out[key] = {
      id: field('id'),
      name: field('name'),
      category: field('category'),
      hasDocumentHeader: /hasDocumentHeader:\s*true/.test(block),
      variables: (vars || '')
        .split(',')
        .map((s) => s.trim().replace(/^'|'$/g, ''))
        .filter(Boolean),
    };
  }
  return out;
}

test('מרשם התבניות זהה בשרת ובצד הקדמי', () => {
  const server = parseRegistry(SERVER);
  const client = parseRegistry(CLIENT);

  assert.ok(Object.keys(server).length >= 2, 'לא נמצאו תבניות בקובץ השרת');
  assert.deepEqual(
    Object.keys(server).sort(),
    Object.keys(client).sort(),
    'רשימת התבניות שונה בין השרת לצד הקדמי',
  );

  for (const key of Object.keys(server)) {
    assert.deepEqual(server[key], client[key], `התבנית ${key} שונה בין שני הקבצים`);
  }
});

test('כל תבנית שהחלונית שולחת היא בקטגוריית שירות', () => {
  // 🔴 הודעת שיווק יקרה יותר, כפופה להסכמת הנמען ולמכסות פר-לקוח, ולכן
  // אסור שתשמש לפתיחת שיחת שירות. `ogen_open_conversation` סווגה שיווק
  // בגלל גוף גנרי, והוחלפה ב-`ogen_service_update`.
  for (const [key, t] of Object.entries(parseRegistry(SERVER))) {
    assert.equal(t.category, 'utility', `${key} אינה בקטגוריית שירות`);
  }
});

test('שמות המשתנים תקפים לעורך של heyy', () => {
  // 🔴 העורך מקבל אותיות אנגליות קטנות, מספרים וקו תחתון, וחייב להתחיל באות.
  for (const [key, t] of Object.entries(parseRegistry(SERVER))) {
    assert.ok(t.variables.length, `${key} בלי משתנים`);
    for (const v of t.variables) {
      assert.match(v, /^[a-z][a-z0-9_]*$/, `שם משתנה פסול ב-${key}: ${v}`);
    }
  }
});
