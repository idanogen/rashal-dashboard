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
