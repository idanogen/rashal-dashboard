import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
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
const api = (...p) => readFileSync(join(here, '..', 'api', ...p), 'utf8');
const src = api('wa-send.ts');

/**
 * ⭐ **הבדיקה עצמה עברה ל-`_lib/suppression.ts` ב-27/08/2026**, כשנוסף
 * שולח שני (עבודת התזכורות של הערב). עד אז היא הייתה כתובה בתוך
 * `wa-send` בלבד, ובדיוק כך נולד הפער הקודם: `api/heyy-send` שלח בלי
 * לבדוק. הבדיקה כאן עוברת מהשואל הבודד לכלל: **כל מי ששולח, עובר בשער.**
 */
test('🔴🔴 השער קיים במודול משותף, ולא מועתק', () => {
  const mod = api('_lib', 'suppression.ts');
  assert.match(mod, /from\('wa_suppressed'\)/, '🔴 אין בדיקה מול רשימת המושתקים');
  assert.match(mod, /check_failed/, '🔴 אין מסלול עצירה לכשל בבדיקה');
});

test('🔴🔴 כל שולח עובר בשער, בלי יוצא מן הכלל', () => {
  // ⭐ מי ששולח נמצא לפי הקריאה עצמה ולא לפי רשימה ידנית של קבצים,
  // כי רשימה ידנית מתיישנת בדיוק כשמוסיפים את השולח שישכח לבדוק.
  const senders = readdirSync(join(here, '..', 'api'))
    .filter((f) => f.endsWith('.ts'))
    .filter((f) => {
      const body = api(f);
      return /heyySendTemplate\(|heyySendText\(|sendWithRateLimit\(/.test(body);
    });
  assert.ok(senders.length >= 2, `נמצאו רק ${senders.length} שולחים, הסריקה כנראה שבורה`);
  for (const f of senders) {
    assert.match(api(f), /checkSuppressed\(/, `🔴 ${f} שולח בלי לבדוק את רשימת המושתקים`);
  }
});

test('🔴🔴 בקשת הסרה גוברת על שיחה פתוחה', () => {
  const mute = src.indexOf('checkSuppressed(');
  assert.ok(mute > 0, '🔴 אין בדיקה מול רשימת המושתקים לפני שליחה');
  const window = src.indexOf('── אכיפת החלון');
  assert.ok(window > 0, 'לא נמצאה אכיפת החלון');
  assert.ok(mute < window, '🔴 המושתקים נבדקים אחרי החלון, כלומר שיחה פתוחה עוקפת בקשת הסרה');
});

test('🔴 כשל בבדיקה עוצר את השליחה ולא מדלג עליה', () => {
  const seg = src.slice(src.indexOf('checkSuppressed('), src.indexOf('── אכיפת החלון'));
  assert.match(seg, /suppression_check_failed/,
    '🔴 אין מסלול עצירה לכשל בבדיקה. שער שנפתח כשהוא שבור אינו שער.');
  assert.match(seg, /503/, 'כשל בבדיקה חייב להחזיר שגיאת שרת ולא להמשיך');
  assert.match(seg, /409/, 'לקוח מושתק חייב לקבל דחייה מפורשת');
});

test('⭐ הזיהוי האוטומטי מחובר לקליטת ההודעות הנכנסות', () => {
  const thread = readFileSync(join(here, '..', 'api', '_lib', 'wa-thread.ts'), 'utf8');
  assert.match(thread, /wa_note_optout/, '🔴 בקשת הסרה לא נקלטת, והרשימה תישאר ריקה לנצח');
  // 🔴 רק על נכנסת. הודעה יוצאת שמכילה את המילה "הסר" אינה בקשה של הלקוח.
  assert.match(thread, /direction === 'in'/, '🔴 הזיהוי אינו מוגבל להודעות נכנסות');
});
