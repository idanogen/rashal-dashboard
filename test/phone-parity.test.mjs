import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * נעילת כללי נרמול הטלפון.
 *
 * 🔴 למה הטסט הזה קיים: אותו מספר מנורמל בשלושה מקומות. ב-SQL
 * (`public.wa_normalize_phone`) שרושם את `wa_conversations.phone_local`,
 * וב-TypeScript פעמיים: `api/_lib/phone.ts` (השרת מחפש לפיו
 * ב-`api/conversation`) ו-`src/lib/heyy/phone.ts` (הדפדפן). **אם הם
 * נפרדים, לקוח שיש לו שיחה מלאה יוצג כלקוח שמעולם לא דיברנו איתו.**
 * כשל שקט, בלי שגיאה.
 *
 * 🔴🔴 הטסט קורא את **שני קבצי המקור האמיתיים** ומריץ את הטבלה על שניהם.
 * הגרסה הקודמת החזיקה עותק מודבק של הקוד, ולכן כשבאג הקווי תוקן רק
 * ב-`api/_lib/phone.ts` (24/10/2026) העותק בטסט המשיך לעבור בזמן
 * שהדפדפן עוד הפך `036221100` ל-`0036221100`. עותק מודבק בודק את עצמו.
 *
 * הטבלה למטה היא ההסכם. שינוי בה מחייב שינוי בשלושת המימושים.
 * אומת מול המסד החי ב-20/08/2026: כל המקרים דאז החזירו ערך זהה.
 * המקרה הקווי-בינלאומי אומת מול ה-SQL בקובץ המיגרציה (like '972%').
 */

const SOURCES = ['../api/_lib/phone.ts', '../src/lib/heyy/phone.ts'];

// מחלץ את normalizePhone מקובץ TypeScript אמיתי ומקמפל אותה להרצה.
// חתימה שתשתנה תפיל את ההמרה בקול (SyntaxError), לא תחזיר בשקט undefined.
function loadNormalizePhone(rel) {
  const src = readFileSync(new URL(rel, import.meta.url), 'utf8');
  const m = src.match(/export function normalizePhone\([^)]*\)[^{]*\{[\s\S]*?\n\}/);
  assert.ok(m, `normalizePhone לא נמצאה ב-${rel}`);
  const js = m[0].replace(/export function normalizePhone\([^)]*\)[^{]*\{/, 'function normalizePhone(raw) {');
  return new Function(`${js}; return normalizePhone;`)();
}

const IMPLS = SOURCES.map((rel) => [rel, loadNormalizePhone(rel)]);

const CASES = [
  ['0523694547', '0523694547', 'נייד מקומי תקני'],
  ['054-5412903', '0545412903', 'עם מקפים, הפורמט שקיים במחסן'],
  ['+972523694547', '0523694547', 'בינלאומי, כפי ש-heyy מחזיר'],
  ['972523694547', '0523694547', 'בינלאומי בלי פלוס'],
  ['052-369-4547', '0523694547', 'מקפים מרובים'],
  ['052 369 4547', '0523694547', 'רווחים'],
  ['523694547', '0523694547', 'תשע ספרות, בלי אפס מוביל'],
  ['036221100', '036221100', 'קווי תשע ספרות, כבר עם אפס'],
  // 🔴 11 ספרות, לא 12: קווי בינלאומי. נכשל ב-24/10/2026 בשני העותקים,
  // שבדקו רק length === 12 והחזירו את המספר בלי אפס מוביל.
  ['+97236221100', '036221100', 'E164 קווי, כפי ש-heyy מחזיר'],
  ['97236221100', '036221100', 'קווי בינלאומי בלי פלוס'],
  ['', null, 'ריק'],
  [null, null, 'חסר'],
  ['לא מספר', null, 'טקסט בלבד'],
  ['00972523694547', '00972523694547', 'צורה חריגה, מוחזרת כמות שהיא ולא מנוחשת'],
];

for (const [rel, normalizePhone] of IMPLS) {
  test(`נרמול טלפון: ההסכם, על הקובץ האמיתי ${rel}`, () => {
    for (const [input, expected, why] of CASES) {
      assert.equal(normalizePhone(input), expected, `${why} (${JSON.stringify(input)})`);
    }
  });

  test(`נרמול הוא אידמפוטנטי (${rel})`, () => {
    for (const [input] of CASES) {
      const once = normalizePhone(input);
      assert.equal(normalizePhone(once), once, `נרמול כפול שינה את ${JSON.stringify(input)}`);
    }
  });
}

test('⭐ הסריקה באמת טוענת שני מימושים נפרדים', () => {
  // בקרה חיובית: אם החילוץ יישבר ויחזיר פונקציה אחת פעמיים, או כלום,
  // הטסטים למעלה יהפכו לבדיקה של עותק אחד בלי שאיש ישים לב.
  assert.equal(IMPLS.length, 2);
  for (const [rel, fn] of IMPLS) assert.equal(typeof fn, 'function', rel);
});
