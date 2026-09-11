import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * 🔴 **אותו נרמול כתוב בשני מקומות, ולכן הוא נעול כאן.**
 * המסך מראה למנהל "ייווצר כ-+9725..." (`previewE164` ב-`AdminUsersPage.tsx`),
 * והשרת הוא זה ששומר בפועל (`set_phone` ב-`api/admin-users.ts`). אם השניים
 * ייפרדו, המנהל יראה מספר אחד והקישור ייצא לאחר, **בלי שום שגיאה**. זהו
 * בדיוק סוג הכשל השקט שהמנגנון הזה לא יכול להרשות לעצמו: קישור שמחליף
 * סיסמה שהלך למכשיר לא נכון.
 *
 * הטבלה למטה היא ההסכם. שינוי בה מחייב שינוי בשני המימושים.
 */

// עותק מדויק של שני המימושים (שניהם TypeScript, ולכן מועתקים ולא מיובאים).
function normalize(raw) {
  const digits = String(raw ?? '').trim().replace(/[^0-9+]/g, '');
  if (/^0[2-9][0-9]{7,8}$/.test(digits)) return `+972${digits.slice(1)}`;
  if (/^\+[1-9][0-9]{7,14}$/.test(digits)) return digits;
  return null;
}

const CASES = [
  ['0501234567', '+972501234567', 'נייד ישראלי, הצורה שמקלידים במשרד'],
  ['050-123-4567', '+972501234567', 'עם מקפים'],
  ['050 123 4567', '+972501234567', 'עם רווחים'],
  ['  0501234567  ', '+972501234567', 'עם רווחים בקצוות'],
  ['+972501234567', '+972501234567', 'כבר בפורמט בינלאומי'],
  ['039611691', '+97239611691', 'קו נייח של המשרד'],
  ['972501234567', null, '🔴 בינלאומי בלי פלוס נדחה, כדי שלא יתפרש כמקומי'],
  ['0501234', null, 'קצר מדי'],
  ['05012345678901', null, 'ארוך מדי'],
  ['0101234567', null, '🔴 קידומת שאינה קיימת בישראל'],
  ['', null, 'ריק פירושו הסרת המספר, ולא מספר שגוי'],
  ['abc', null, 'טקסט'],
  ['+0501234567', null, '🔴 פלוס ואז אפס, לא מספר בינלאומי תקין'],
];

test('🔴 טבלת הנרמול של טלפון האיפוס', () => {
  for (const [input, expected, why] of CASES) {
    assert.equal(normalize(input), expected, `${why} — קלט: ${JSON.stringify(input)}`);
  }
});

test('🔴🔴 המסך והשרת מחזיקים את אותו ביטוי רגולרי', () => {
  const ui = readFileSync(new URL('../src/pages/AdminUsersPage.tsx', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../api/admin-users.ts', import.meta.url), 'utf8');

  // שתי התבניות שמכריעות, כפי שהן מופיעות בקוד.
  const local = String.raw`^0[2-9][0-9]{7,8}$`;
  const intl = String.raw`^\+[1-9][0-9]{7,14}$`;

  for (const [name, src] of [['המסך', ui], ['השרת', api]]) {
    assert.ok(src.includes(local), `${name} איבד את תבנית המספר המקומי`);
    assert.ok(src.includes(intl), `${name} איבד את תבנית המספר הבינלאומי`);
  }
});

/**
 * ⭐ המסד הוא השכבה השלישית, והוא חייב לקבל בדיוק את מה שהשרת מייצר.
 * `profiles_phone_e164_format` דוחה כל דבר אחר, כך ששגיאה במימוש תתגלה
 * ככישלון שמירה ולא כמספר שגוי ששכב בשקט עד ששלחו אליו.
 */
test('כל מה שהנרמול מייצר עומד באילוץ של המסד', () => {
  const dbConstraint = /^\+[1-9][0-9]{7,14}$/;
  for (const [input, expected] of CASES) {
    if (expected === null) continue;
    assert.match(normalize(input), dbConstraint, `קלט: ${input}`);
  }
});
