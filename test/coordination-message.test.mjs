import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COORDINATION_TEMPLATE_KEY, COORDINATION_BUTTONS, PURPOSES,
  hebrewDay, hoursLabel, coordinationValues, coordinationPreview,
} from '../src/lib/coordination-message.ts';
import { parseCustomerReply as parseServer } from '../api/_lib/extract.ts';
import { parseCustomerReply as parseClient } from '../src/lib/heyy/extract.ts';

const base = {
  customerName: 'משה לוי',
  purpose: 'לאספקת הציוד',
  date: '2026-08-26',
  timeStart: '09:00',
  timeEnd: '13:00',
};

/**
 * 🔴🔴 **הבדיקה שמצדיקה את הקובץ הזה.** הכיתוב על הכפתור הוא מה שחוזר
 * אלינו כהודעה נכנסת. כיתוב שהמפרש לא מזהה פירושו עצירה שנשארת
 * "WA נשלח" לנצח, בלי שגיאה ובלי שאיש ידע.
 */
test('🔴 שני הכפתורים מתפרשים נכון, בשני המפרשים', () => {
  const [yes, no] = COORDINATION_BUTTONS;
  for (const [name, parse] of [['server', parseServer], ['client', parseClient]]) {
    assert.equal(parse(yes).status, 'מתאים', `${name}: "${yes}"`);
    assert.equal(parse(no).status, 'לא מתאים', `${name}: "${no}"`);
  }
});

test('🔴 "לא מתאים" לא נבלע ככן', () => {
  // הבדיקה החיובית רצה לפני השלילית, ו-/^מתאים/ מסוכן במיוחד כאן.
  assert.notEqual(parseServer('לא מתאים').status, 'מתאים');
});

test('הצעת מועד אחר בטקסט חופשי נקראת כבקשת שינוי', () => {
  const r = parseServer('אפשר ביום חמישי בבוקר?');
  assert.equal(r.status, 'בקשת שינוי');
  assert.equal(r.requestedTime, 'אפשר ביום חמישי בבוקר?');
});

test('התאריך נושא שם יום ושנה, בלי המילה יום', () => {
  assert.equal(hebrewDay('2026-08-26'), 'רביעי, 26.8.2026');
  assert.equal(hebrewDay('2026-08-22'), 'שבת, 22.8.2026');
});

test('תאריך לא תקין חוזר כמו שהוא ולא כ-Invalid Date', () => {
  assert.equal(hebrewDay(''), '');
  assert.equal(hebrewDay('26/08/2026'), '26/08/2026');
});

test('חלון השעות הוא משתנה אחד', () => {
  assert.equal(hoursLabel('09:00', '13:00'), '09:00 עד 13:00');
  assert.equal(hoursLabel('09:00', ''), '09:00');
});

test('הערכים נשלחים בשם, ובדיוק ארבעה', () => {
  const v = coordinationValues(base);
  assert.deepEqual(Object.keys(v).sort(), ['customer_name', 'day', 'hours', 'purpose']);
  assert.equal(v.day, 'רביעי, 26.8.2026');
  assert.equal(v.hours, '09:00 עד 13:00');
});

test('לקוח בלי שם לא מייצר "שלום ," בהודעה', () => {
  assert.equal(coordinationValues({ ...base, customerName: '  ' }).customer_name, 'לקוח יקר');
});

/**
 * 🔴 הנוסח מוקפא אצל מטא. שינוי כאן בלי הגשה מחדש פירושו שהמסך מראה
 * דבר אחד וללקוח יוצא דבר אחר.
 */
test('🔴 הנוסח נעול מול התבנית שאושרה', () => {
  assert.equal(
    coordinationPreview(base),
    'שלום משה לוי, כאן ר.שעל בע"מ.\n'
    + 'אנחנו מעוניינים להגיע אליכם לאספקת הציוד ביום רביעי, 26.8.2026, בין השעות 09:00 עד 13:00.\n'
    + 'נשמח לדעת אם המועד מתאים לכם. אם לא, אפשר להשיב כאן מתי נוח לכם ונתאם מועד אחר.',
  );
});

test('אין בנוסח גרש ארוך', () => {
  assert.ok(!/[—–]/.test(coordinationPreview(base)));
});

test('המפתח והמטרות סגורים', () => {
  assert.equal(COORDINATION_TEMPLATE_KEY, 'rashal_visit_coordination');
  assert.equal(PURPOSES.length, 4);
  for (const p of PURPOSES) assert.match(p.value, /^ל/);
});

/**
 * 🔴🔴 **עותק שני של אותו ניסוח, בשני צדדים שאינם יכולים לייבא זה מזה.**
 *
 * `api/` אינו יכול לייבא מ-`src/` (בנייה נפרדת ב-Vercel), ולכן עבודת
 * התזכורות מחזיקה עותק משלה של `hebrewDay` ושל רשימת המטרות. שני
 * עותקים נפרדים בשקט: מישהו יתקן ניסוח בצד אחד, והתזכורת שיוצאת בערב
 * תגיד משהו אחר מהתיאום שיצא בבוקר.
 * [[dual_implementation_needs_byte_identical_guard]]
 */
import { readFileSync } from 'node:fs';

const CRON = readFileSync(new URL('../api/cron-daily-reminders.ts', import.meta.url), 'utf8');

test('🔴 שמות הימים בעבודת התזכורות זהים לאלה שבמודול', () => {
  const m = /const DAY_NAMES = \[(.*?)\]/s.exec(CRON);
  assert.ok(m, 'DAY_NAMES לא נמצא בעבודת התזכורות');
  const cronDays = m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
  // הצד של המודול, דרך הפונקציה האמיתית ולא דרך קריאת הקובץ.
  const libDays = [
    '2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02',
    '2026-09-03', '2026-09-04', '2026-09-05',
  ].map((d) => hebrewDay(d).split(',')[0]);
  assert.deepEqual(cronDays, libDays);
});

test('🔴 כל מטרה שהתזכורת שולחת היא אחת מהרשימה הסגורה שאושרה', () => {
  // ⭐ מטא הקפיאה את הגוף, והמשתנה `purpose` נבדק מולו. ערך שאינו
  // ברשימה הוא ניסוח שלא אושר, והוא ייצא ללקוח בלי שאף אחד יראה.
  const m = /const PURPOSE_BY_SOURCE[^=]*= \{(.*?)\n\};/s.exec(CRON);
  assert.ok(m, 'PURPOSE_BY_SOURCE לא נמצא');
  const used = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  assert.ok(used.length >= 5, `נמצאו רק ${used.length} מטרות`);
  const allowed = new Set(PURPOSES.map((p) => p.value));
  for (const v of used) assert.ok(allowed.has(v), `"${v}" אינו ברשימה שאושרה`);
});

test('🔴🔴 עבודת התזכורות כבויה כברירת מחדל', () => {
  // טרם יצאה ולו הודעה אמיתית אחת ללקוח של ר.שעל. עבודה שנפרסת
  // ומתחילה לשלוח מעצמה באותו ערב היא בדיוק מה שאסור.
  assert.match(CRON, /WA_REMINDERS_ENABLED === '1'/);
  assert.doesNotMatch(CRON, /const ARMED = true/);
});

test('🔴 אין בעבודה שום מזהה תבנית מסוג DEMO', () => {
  // המנגנון הקודם הצביע על `DEMO-delivery-reminder`, בדיוק כמו
  // `DEMO-schedule-coordination` שנתפס ב-25/08. שניהם נראו כמו קוד עובד.
  assert.doesNotMatch(CRON, /DEMO-[a-z-]+'/);
});

test('🔴 העבודה שואלת את היומן ולא את `orders.delivery_date`', () => {
  // ⭐ נמדד: `delivery_date` ריק בכל 47,263 ההזמנות. השאילתה הישנה
  // החזירה אפס שורות תמיד, בלי שגיאה ובלי שאף אחד ידע.
  assert.match(CRON, /\.from\('calendar_stops'\)/);
  assert.doesNotMatch(CRON, /from\('orders'\)[\s\S]{0,200}delivery_date/);
});

test('🔴 רשימת המושתקים נבדקת לפני כל שליחה', () => {
  const checks = [...CRON.matchAll(/await checkSuppressed\(/g)].length;
  const sends = [...CRON.matchAll(/await heyySendTemplate\(/g)].length;
  assert.ok(checks >= sends, `${sends} שליחות מול ${checks} בדיקות השתקה`);
});
