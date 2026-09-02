import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildVisitHistory,
  visitRecency,
  visitOutcomeLabel,
} from '../src/lib/visit-history.ts';

/**
 * היסטוריית ביקורים עם חיפוש (עמי, 30/08/2026).
 * שני הכללים שהבדיקות מגנות עליהם:
 * 1. בלי חיפוש — 7 ימים; עם חיפוש — כל ההיסטוריה. מי שישבור את זה
 *    יחזיר את המגבלה הישנה בשקט והחיפוש "לא ימצא" לקוחות ותיקים.
 * 2. "לא בוצע" נשאר בפנים, כי הסיבה שנרשמה היא הערך לביקור הבא.
 */

const TODAY = '2026-08-30';
const FLOOR = '2026-08-23'; // שבוע אחורה

const stop = (o) => ({
  deliveryDate: o.date,
  status: o.status ?? 'completed',
  customerName: o.name ?? 'לקוח',
  address: o.address,
  city: o.city,
  phone: o.phone,
  notes: o.notes,
  resolutionNote: o.resolutionNote,
});

const ENTRIES = [
  ['2026-08-30', [stop({ date: '2026-08-30', name: 'לקוח של היום' })]],
  ['2026-08-28', [stop({ date: '2026-08-28', name: 'כהן דוד' })]],
  [
    '2026-06-01',
    [
      stop({
        date: '2026-06-01',
        name: 'קורן שלומי-שלמה',
        status: 'not_completed',
        resolutionNote: 'הלקוח לא היה בבית',
      }),
      stop({ date: '2026-06-01', name: 'ישראלי רות' }),
    ],
  ],
];

test('בלי חיפוש: רק מהרצפה ועד אתמול, היום לא נכלל', () => {
  const days = buildVisitHistory(ENTRIES, { today: TODAY, floorDate: FLOOR, query: '' });
  assert.deepEqual(days.map((d) => d.date), ['2026-08-28']);
});

test('🔴 עם חיפוש: הרצפה נופלת וכל ההיסטוריה נסרקת', () => {
  const days = buildVisitHistory(ENTRIES, { today: TODAY, floorDate: FLOOR, query: 'שלומי קורן' });
  assert.deepEqual(days.map((d) => d.date), ['2026-06-01']);
  assert.equal(days[0].stops.length, 1);
  assert.equal(days[0].stops[0].status, 'not_completed');
});

test('🔴 גם עם חיפוש, היום והעתיד אינם היסטוריה', () => {
  const days = buildVisitHistory(ENTRIES, { today: TODAY, floorDate: FLOOR, query: 'של היום' });
  assert.equal(days.length, 0);
});

test('החיפוש רץ גם על סיבת אי-הביצוע', () => {
  const days = buildVisitHistory(ENTRIES, { today: TODAY, floorDate: FLOOR, query: 'לא היה בבית' });
  assert.equal(days.length, 1);
  assert.equal(days[0].stops[0].customerName, 'קורן שלומי-שלמה');
});

test('יום שהחיפוש ריקן לגמרי לא מוצג, והסדר חדש-לישן', () => {
  const days = buildVisitHistory(ENTRIES, { today: TODAY, floorDate: '2026-01-01', query: '' });
  assert.deepEqual(days.map((d) => d.date), ['2026-08-28', '2026-06-01']);
});

test('visitRecency: היום · אתמול · לפני X · תאריך רחוק', () => {
  assert.deepEqual(visitRecency('2026-08-30', TODAY), { days: 0, label: 'היום', recent: true });
  assert.deepEqual(visitRecency('2026-08-29', TODAY), { days: 1, label: 'אתמול', recent: true });
  assert.deepEqual(visitRecency('2026-08-24', TODAY), { days: 6, label: 'לפני 6 ימים', recent: true });
});

test('🔴 גבול הטריות: 30 יום בפנים, 31 בחוץ ועובר לתאריך', () => {
  const at30 = visitRecency('2026-07-31', TODAY);
  assert.equal(at30.days, 30);
  assert.equal(at30.recent, true);
  const at31 = visitRecency('2026-07-30', TODAY);
  assert.equal(at31.recent, false);
  assert.equal(at31.label, 'ב-30/07/26');
});

test('תוויות תוצאה', () => {
  assert.equal(visitOutcomeLabel('completed'), 'בוצע');
  assert.equal(visitOutcomeLabel('not_completed'), 'לא בוצע');
  assert.equal(visitOutcomeLabel(null), '');
});

/**
 * 🔴 מ-02/09/2026 הנהג רואה גם ביקורים של עובדים אחרים אצל לקוח שהוא
 * נוסע אליו. הבדיקות האלה שומרות על שני הגבולות: הם לא נכנסים לתצוגת
 * ברירת המחדל ולמונים שלה, והם כן נמצאים כשמחפשים.
 */
const mineOpts = { today: '2026-09-02', floorDate: '2026-08-26', mine: 'אבי' };
const mixedDays = [
  ['2026-09-01', [
    { deliveryDate: '2026-09-01', status: 'completed', driver: 'אבי', customerName: 'כהן משה' },
    { deliveryDate: '2026-09-01', status: 'completed', driver: 'רודי', customerName: 'לוי שרה' },
  ]],
  ['2026-05-04', [
    { deliveryDate: '2026-05-04', status: 'not_completed', driver: 'ישראל', customerName: 'לוי שרה',
      resolutionNote: 'הלקוח לא היה בבית' },
  ]],
];

test('ברירת המחדל מציגה רק את הביקורים של הנהג עצמו', () => {
  const days = buildVisitHistory(mixedDays, { ...mineOpts, query: '' });
  const all = days.flatMap((d) => d.stops);
  assert.equal(all.length, 1);
  assert.equal(all[0].customerName, 'כהן משה');
  assert.ok(!all.some((s) => s.driver !== 'אבי'), 'עבודה של עמית לא נספרת כשלו');
});

test('⭐ בחיפוש דווקא כן, כי זו השאלה "מה היה כאן קודם"', () => {
  const days = buildVisitHistory(mixedDays, { ...mineOpts, query: 'לוי שרה' });
  const all = days.flatMap((d) => d.stops);
  assert.equal(all.length, 2, 'שני הביקורים אצל אותה לקוחה, גם של רודי וגם של ישראל');
  assert.ok(all.some((s) => s.driver === 'ישראל'));
});

test('🔴 חיפוש חוצה גם את רצפת שבעת הימים, אחרת הביקור הקודם לא יימצא', () => {
  const days = buildVisitHistory(mixedDays, { ...mineOpts, query: 'לא היה בבית' });
  assert.equal(days.length, 1);
  assert.equal(days[0].date, '2026-05-04');
});

test('בלי mine ההתנהגות הישנה נשמרת, ואף עצירה לא נעלמת', () => {
  const days = buildVisitHistory(mixedDays, { today: '2026-09-02', floorDate: '2026-08-26', query: '' });
  assert.equal(days.flatMap((d) => d.stops).length, 2);
});
