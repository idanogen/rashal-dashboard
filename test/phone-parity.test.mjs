import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * נעילת כללי נרמול הטלפון.
 *
 * 🔴 למה הטסט הזה קיים: אותו מספר מנורמל בשני מקומות, ב-TypeScript
 * (`api/_lib/phone.ts` → `normalizePhone`) וב-SQL (`public.wa_normalize_phone`).
 * ה-SQL הוא זה שרושם את `wa_conversations.phone_local`, וה-TypeScript הוא
 * זה שמחפש לפיו ב-`api/conversation`. **אם השניים נפרדים, לקוח שיש לו
 * שיחה מלאה יוצג כלקוח שמעולם לא דיברנו איתו.** כשל שקט, בלי שגיאה.
 *
 * הטבלה למטה היא ההסכם. שינוי בה מחייב שינוי בשני המימושים.
 * אומת מול המסד החי ב-20/08/2026: כל 12 המקרים החזירו ערך זהה.
 */

// עותק מדויק של api/_lib/phone.ts. מועתק ולא מיובא כי הקובץ הוא TypeScript.
function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('972') && digits.length === 12) return '0' + digits.slice(3);
  if (digits.startsWith('0') && digits.length === 10) return digits;
  if (digits.length === 9) return digits.startsWith('0') ? digits : '0' + digits;
  return digits;
}

const CASES = [
  ['0523694547', '0523694547', 'נייד מקומי תקני'],
  ['054-5412903', '0545412903', 'עם מקפים, הפורמט שקיים במחסן'],
  ['+972523694547', '0523694547', 'בינלאומי, כפי ש-heyy מחזיר'],
  ['972523694547', '0523694547', 'בינלאומי בלי פלוס'],
  ['052-369-4547', '0523694547', 'מקפים מרובים'],
  ['052 369 4547', '0523694547', 'רווחים'],
  ['523694547', '0523694547', 'תשע ספרות, בלי אפס מוביל'],
  ['036221100', '036221100', 'קווי תשע ספרות, כבר עם אפס'],
  ['', null, 'ריק'],
  [null, null, 'חסר'],
  ['לא מספר', null, 'טקסט בלבד'],
  ['00972523694547', '00972523694547', 'צורה חריגה, מוחזרת כמות שהיא ולא מנוחשת'],
];

test('נרמול טלפון: ההסכם בין TypeScript ל-SQL', () => {
  for (const [input, expected, why] of CASES) {
    assert.equal(normalizePhone(input), expected, `${why} (${JSON.stringify(input)})`);
  }
});

test('נרמול הוא אידמפוטנטי', () => {
  for (const [input] of CASES) {
    const once = normalizePhone(input);
    assert.equal(normalizePhone(once), once, `נרמול כפול שינה את ${JSON.stringify(input)}`);
  }
});
