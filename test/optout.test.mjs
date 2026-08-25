import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * 🔴🔴 **שלוש דלתות לפנייה יזומה ללקוח עבר, ואף אחת מהן לא שווה בלי
 * השתיים האחרות:** תבנית מאושרת · דרך יציאה שנשמעת · **ובדיקה מולה
 * לפני כל שליחה**.
 *
 * הבדיקה כאן היא על הדלת השלישית, והיא סטטית בכוונה: היא קוראת את
 * קוד השרת ומוודאת שהשער קיים, שהוא לפני אכיפת החלון, ושכשל בו **עוצר**
 * ולא מדלג. שער שנפתח כשהוא שבור אינו שער.
 */

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '..', 'api', 'wa-send.ts'), 'utf8');

test('🔴🔴 בדיקת המושתקים קיימת, ולפני אכיפת החלון', () => {
  const mute = src.indexOf("from('wa_suppressed')");
  assert.ok(mute > 0, '🔴 אין בדיקה מול רשימת המושתקים לפני שליחה');
  const window = src.indexOf('── אכיפת החלון');
  assert.ok(window > 0, 'לא נמצאה אכיפת החלון');
  // ⭐ בקשת הסרה גוברת גם על שיחה פתוחה.
  assert.ok(mute < window, '🔴 המושתקים נבדקים אחרי החלון, כלומר שיחה פתוחה עוקפת בקשת הסרה');
});

test('🔴 כשל בבדיקה עוצר את השליחה ולא מדלג עליה', () => {
  const seg = src.slice(src.indexOf("from('wa_suppressed')"), src.indexOf('── אכיפת החלון'));
  assert.match(seg, /suppression_check_failed/,
    '🔴 אין מסלול עצירה לכשל בבדיקה. שער שנפתח כשהוא שבור אינו שער.');
  assert.match(seg, /status\(503\)/, 'כשל בבדיקה חייב להחזיר שגיאת שרת ולא להמשיך');
  assert.match(seg, /status\(409\)/, 'לקוח מושתק חייב לקבל דחייה מפורשת');
});

test('⭐ הזיהוי האוטומטי מחובר לקליטת ההודעות הנכנסות', () => {
  const thread = readFileSync(join(here, '..', 'api', '_lib', 'wa-thread.ts'), 'utf8');
  assert.match(thread, /wa_note_optout/, '🔴 בקשת הסרה לא נקלטת, והרשימה תישאר ריקה לנצח');
  // 🔴 רק על נכנסת. הודעה יוצאת שמכילה את המילה "הסר" אינה בקשה של הלקוח.
  assert.match(thread, /direction === 'in'/, '🔴 הזיהוי אינו מוגבל להודעות נכנסות');
});
