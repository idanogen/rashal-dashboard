import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * 🔴 מה שנבדק כאן הוא **שם הקובץ בנתיב האחסון**, וזו לא קפדנות יתר:
 * שמות המסמכים אצלנו עבריים, ומפתח אחסון עם תווים שאינם ASCII נדחה או
 * נשבר בחתימה. כישלון כזה נראה בדיוק כמו "אין קובץ", והוא היה מתגלה רק
 * אחרי שהכתובת אצל heyy כבר פגה, כלומר כשאי אפשר לתקן.
 *
 * הפונקציה עצמה פנימית לקובץ, ולכן נבדקת דרך העתק מדויק שלה. השומר על
 * הצמד הוא הבדיקה האחרונה כאן.
 */
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../api/_lib/wa-media.ts', import.meta.url), 'utf8');
const body = src.match(/function safeKey\([\s\S]*?\n\}/);
assert.ok(body, 'safeKey לא נמצאה בקוד');
const safeKey = new Function(
  'return ' + body[0].replace(/name: string \| undefined, fallback: string/, 'name, fallback').replace(/: string/g, ''),
)();

test('שם עברי הופך למפתח בטוח, והסיומת נשמרת', () => {
  const k = safeKey('תעודת משלוח.pdf', 'file');
  assert.match(k, /^[a-zA-Z0-9._-]+$/, 'נשארו תווים שאינם ASCII במפתח');
  assert.ok(k.endsWith('.pdf'), 'הסיומת אבדה, והדפדפן לא יידע איך להציג');
});

test('שם לועזי תקין עובר כמו שהוא', () => {
  assert.equal(safeKey('SI26602993.pdf', 'file'), 'SI26602993.pdf');
});

test('שם שכולו עברי נופל לברירת המחדל ולא למחרוזת ריקה', () => {
  // 🔴 מפתח ריק היה יוצר נתיב שנגמר במקף, ושני קבצים כאלה באותה הודעה
  // היו דורסים זה את זה בשקט.
  const k = safeKey('קובץ', 'file');
  assert.ok(k.length > 0);
  assert.notEqual(k, '');
  assert.match(k, /^[a-zA-Z0-9._-]+$/);
});

test('חסר או ריק נופל לברירת המחדל', () => {
  for (const v of [undefined, null, '', '   ']) {
    assert.equal(safeKey(v, 'file'), 'file');
  }
});

test('🔴 ניסיון מעבר תיקייה לא שורד את הנרמול', () => {
  // מקור השם הוא המטען של heyy, כלומר צד שלישי.
  const k = safeKey('../../secrets/keys.pem', 'file');
  assert.ok(!k.includes('/'), 'לוכסן שרד במפתח האחסון');
  assert.ok(!k.includes('..'), 'מעבר תיקייה שרד במפתח האחסון');
});

test('שם ארוך מאוד נחתך ולא מפיל את המפתח', () => {
  const k = safeKey('a'.repeat(500) + '.pdf', 'file');
  assert.ok(k.length < 60, 'המפתח ארוך מדי: ' + k.length);
  assert.ok(k.endsWith('.pdf'));
});
