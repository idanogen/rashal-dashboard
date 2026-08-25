import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stockLine, warrantyState, itemTitle, itemSubtitle, sourceLabels,
} from '../src/lib/customer-answer.ts';

/**
 * 🔴 **מה שנבדק כאן הוא מה שהנציגה תגיד ללקוח על הציוד שלו.**
 * "אתה באחריות" שנאמר בטעות עולה כסף, ו"אין לך ציוד" שנאמר על לקוח
 * שהציוד שלו פשוט ישן מהחלון שאנחנו מכסים הוא שקר מנומס.
 */

const NOW = new Date('2026-08-25T12:00:00Z').getTime();

const device = (o = {}) => ({
  part: 'G175', desc: 'מנוף חשמלי SUNRISE MEDICAL', qty: 1,
  serials: ['17517098728'], installedAt: null, warrantyEnd: '2028-01-12',
  lastSeen: '2026-07-07', sources: ['delivery', 'service'], match: 'number', ...o,
});
const stock = (o = {}) => ({ devices: [], accessories: [], returned: [], since: '2026-01-01', ...o });

test('⭐ המשפט שעידן ביקש: איזה מוצר יש ללקוח, מיד', () => {
  const a = stockLine(stock({ devices: [device()] }), NOW);
  assert.equal(a.tone, 'ok');
  assert.match(a.text, /יש לו G175/);
  assert.match(a.text, /מספר סידורי 17517098728/);
  assert.match(a.text, /באחריות עד 12\.01\.2028|באחריות עד 12\/01\/2028/);
});

test('🔴 יחיד ורבים: "ועוד מכשיר אחד", לא "ועוד 1"', () => {
  const one = stockLine(stock({ devices: [device(), device({ part: 'G150' })] }), NOW);
  assert.match(one.text, /ועוד מכשיר אחד\./);
  assert.doesNotMatch(one.text, /ועוד 1/);
  const many = stockLine(stock({ devices: [device(), device(), device()] }), NOW);
  assert.match(many.text, /ועוד 2 מכשירים\./);
});

test('🔴 מספר סידורי נאמר רק כשהוא חד-משמעי', () => {
  const two = stockLine(stock({ devices: [device({ serials: ['A1', 'B2'] })] }), NOW);
  assert.doesNotMatch(two.text, /מספר סידורי/, 'שני סידוריים על אותו קוד אינם מזהים מכשיר אחד');
  const none = stockLine(stock({ devices: [device({ serials: [] })] }), NOW);
  assert.doesNotMatch(none.text, /מספר סידורי/);
});

test('🔴🔴 אחריות שפגה לא נאמרת כאילו היא בתוקף', () => {
  const a = stockLine(stock({ devices: [device({ warrantyEnd: '2025-03-01' })] }), NOW);
  assert.match(a.text, /האחריות כבר פגה/);
  assert.doesNotMatch(a.text, /באחריות עד/);
});

test('🔴 סף האחריות: 60 יום, ולא צבע על כל פריט', () => {
  assert.equal(warrantyState(null, NOW).tone, 'unknown');
  assert.equal(warrantyState('2026-08-01', NOW).tone, 'expired');
  assert.equal(warrantyState('2026-09-20', NOW).tone, 'ending', '26 יום קדימה');
  assert.equal(warrantyState('2026-10-24', NOW).tone, 'ending', '60 יום בדיוק, עדיין מסומן');
  assert.equal(warrantyState('2026-11-01', NOW).tone, 'active', '68 יום, כבר לא מסומן');
  assert.equal(warrantyState('not-a-date', NOW).tone, 'unknown');
});

test('🔴 מצב ריק מסביר את עצמו ומצטט את גבול החלון מהמסד', () => {
  const a = stockLine(stock(), NOW);
  assert.match(a.text, /לא רשום אצלנו ציוד/);
  assert.match(a.text, /01\.01\.2026|01\/01\/2026/, 'התאריך מגיע מ-since ולא קבוע בקוד');
  assert.match(a.text, /קריאת שירות/, 'הנציגה צריכה לדעת איך ציוד ישן כן מתגלה');
});

test('🔴 "הכל נאסף בחזרה" אינו אותו דבר כמו "לא ידוע לנו כלום"', () => {
  const a = stockLine(stock({ returned: [{ part: 'G175', desc: 'מנוף', at: '2026-05-26' }] }), NOW);
  assert.match(a.text, /נאסף בחזרה/);
  assert.match(a.text, /G175/);
  assert.doesNotMatch(a.text, /לא רשום אצלנו ציוד/);
});

test('אביזרים בלי מכשיר נאמרים ככאלה', () => {
  const a = stockLine(stock({
    accessories: [
      { ...device({ part: null, desc: 'חגורת פרפר', serials: [] }) },
      { ...device({ part: null, desc: 'שולחן עץ', serials: [] }) },
      { ...device({ part: null, desc: 'רצועות שוקיים', serials: [] }) },
    ],
  }), NOW);
  assert.match(a.text, /אין מכשיר רשום/);
  assert.match(a.text, /חגורת פרפר ו-שולחן עץ/);
  assert.match(a.text, /ועוד 1 פריטים/);
});

test('🔴 פריט בלי קוד קטלוגי נופל לתיאור ולא לשורה ריקה', () => {
  // 167 שורות בפריוריטי נושאות part = '*', כלומר טקסט חופשי.
  assert.equal(itemTitle({ part: null, desc: 'חגורת פרפר' }), 'חגורת פרפר');
  assert.equal(itemTitle({ part: null, desc: '' }), 'פריט');
  assert.equal(itemTitle({ part: 'G175', desc: 'מנוף' }), 'G175');
  assert.equal(itemSubtitle({ part: null, desc: 'חגורת פרפר' }), '', 'בלי כפילות של אותו טקסט');
  assert.equal(itemSubtitle({ part: 'G175', desc: '"מנוף חשמלי"' }), 'מנוף חשמלי', 'המרכאות של פריוריטי מנוקות');
});

test('🔴 קריאת שירות נאמרת ראשונה, כי היא העדות החזקה ביותר', () => {
  assert.deepEqual(sourceLabels(['register', 'delivery', 'service']),
    ['קריאת שירות', 'אספקה', 'מרשם המנופים']);
  assert.deepEqual(sourceLabels([]), []);
  assert.deepEqual(sourceLabels(null), []);
});

test('הגנה מפני קלט חסר: המשפט לא קורס', () => {
  assert.equal(typeof stockLine(null, NOW).text, 'string');
  assert.equal(typeof stockLine(undefined, NOW).text, 'string');
  assert.equal(stockLine({}, NOW).tone, 'none');
});

test('🔴🔴 זיהוי דרך הסקר נאמר בקול ולא נבלע', async () => {
  const { identityNote } = await import('../src/lib/customer-answer.ts');
  // זיהוי ודאי אינו דורש הסבר, ותגית על כל לקוח הייתה הופכת לרעש.
  assert.equal(identityNote({ identifiedBy: 'number' }), null);
  assert.equal(identityNote({ identifiedBy: 'phone' }), null);
  assert.equal(identityNote(null), null);
  // 🔴 והמסלול החזק אך לא-ודאי: הטלפון על ההזמנה, לא על כרטיס הלקוח.
  assert.match(identityNote({ identifiedBy: 'document' }), /אינו רשום על כרטיס הלקוח/);
  // וזיהוי דרך שם שנשמר על סקר כן דורש.
  const n = identityNote({ identifiedBy: 'survey', identifiedHint: 'אלחרר פרלה' });
  assert.match(n, /אינו רשום בפריוריטי/);
  assert.match(n, /אלחרר פרלה/);
  assert.match(n, /סקר/);
});

test('🔴🔴 "אין שום פריט פתוח" לא נאמר על לקוח שיש לו מוצר', async () => {
  // עידן, 25/08/2026: "רשום פה 'אין ללקוח הזה שום פריט פתוח', וזה מבלבל
  // בגלל שיש אצלו מוצר." שתי קופסאות זו מעל זו אמרו דברים שנשמעו סותרים.
  const { answerLine } = await import('../src/lib/customer-answer.ts');
  const withDevice = answerLine([], [], NOW, stock({ devices: [device()] }));
  assert.match(withDevice.text, /אין משלוח, קריאה או איסוף פתוחים/);
  assert.match(withDevice.text, /יש לו G175/, 'התשובה חייבת לומר גם מה יש לו');
  assert.equal(withDevice.tone, 'ok');

  // ובלי ציוד, המשפט הישן נשאר בדיוק כמו שהיה.
  const empty = answerLine([], [], NOW, stock());
  assert.equal(empty.text, 'אין ללקוח הזה שום פריט פתוח.');
  assert.equal(empty.tone, 'none');

  // 🔴 ומשלוח פתוח עדיין מנצח: הוא מה שהלקוח מתקשר עליו.
  const open = answerLine(
    [{ id: 'o1', ref: 'S1', status: 'תואמה', created: '2026-08-20T09:00:00Z', match: 'number',
       scheduled: true, date: '2026-08-26', driver: 'רודי' }],
    [], NOW, stock({ devices: [device()] }));
  assert.match(open.text, /יש משלוח פתוח/);
  assert.doesNotMatch(open.text, /יש לו G175/, 'התשובה על משלוח לא נבלעת בציוד');
});

test('🔴 הפרדת המשפט לא שינתה את הניסוח שכבר אושר', async () => {
  const { devicePhrase } = await import('../src/lib/customer-answer.ts');
  assert.equal(devicePhrase([]), null);
  assert.equal(devicePhrase(null), null);
  assert.match(devicePhrase([device()], NOW), /^יש לו G175, מספר סידורי 17517098728, באחריות עד/);
});

test('🔴🔴 כל תאריך נושא שנה, אחרי שנכנסו 12 שנות היסטוריה', async () => {
  // עידן, 25/08/2026: "חסר לי חיווי של שנה בתאריך."
  // 🔴 עד הייבוא ההיסטורי של אותו יום כל מה שהמערכת הכירה היה 2026,
  // והשנה הייתה מובנת מאליה. עכשיו יש בציר אירועים מ-2014, ו-"02/01"
  // נקרא כאילו הוא מהחודש שעבר.
  const { dayLabel, shortDate, answerLine } = await import('../src/lib/customer-answer.ts');
  assert.equal(dayLabel('2026-08-26T00:00:00Z'), 'יום רביעי 26/08/2026');
  assert.equal(shortDate('2014-01-02T00:00:00Z'), '02/01/14');
  assert.equal(shortDate('2026-05-26T00:00:00Z'), '26/05/26');
  // 🔴 ומשפט שנאמר ללקוח בטלפון נושא שנה מלאה: הוא לא רואה את המסך.
  const sched = answerLine(
    [{ id: 'o1', ref: 'S1', status: 'תואמה', created: '2026-08-20T09:00:00Z', match: 'number',
       scheduled: true, date: '2026-08-26', driver: 'רודי' }], [], NOW);
  assert.match(sched.text, /26\/08\/2026/);
  assert.equal(shortDate(null), '');
  assert.equal(dayLabel('בלגן'), '');
});
