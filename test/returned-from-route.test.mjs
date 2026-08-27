import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReturnedMap, returnedIdSet, returnedMeta } from '../src/lib/returned-from-route.ts';

/**
 * 🔴 מה שנבדק כאן הוא ש**הסיבה נוסעת עם החיווי**. עד 19/08/2026 המנהל
 * ראה "חזר מהקו" ולא ראה מילה ממה שהנהג כתב, בזמן שהמערכת חסמה את הנהג
 * מלסמן בלי לכתוב. בדיקה שמוודאת רק "מי חזר" הייתה עוברת גם אז.
 */

const stop = (o) => ({
  id: o.id,
  deliveryDate: o.date,
  driver: o.driver ?? 'דוד',
  sequence: 0,
  sourceType: o.source ?? 'service',
  serviceCallId: o.callId,
  orderId: o.orderId,
  pickupId: o.pickupId,
  customerName: o.name ?? 'לקוח',
  status: o.status ?? 'not_completed',
  completedAt: o.at,
  notes: o.notes,
  resolutionNote: o.resolutionNote,
  resolutionKind: o.kind,
});

test('הסיבה שהנהג רשם מגיעה עם הישות', () => {
  const map = buildReturnedMap(
    [stop({ id: 's1', date: '2026-08-19', callId: 'c1', notes: 'טופל אתמול על ידי ישראל' })],
    'service',
  );
  assert.equal(map.get('c1').note, 'טופל אתמול על ידי ישראל');
  assert.equal(map.get('c1').driver, 'דוד');
  assert.equal(returnedMeta(map.get('c1')), 'דוד · 19/08');
});

test('רק עצירות "לא בוצע", ורק מהסוג המבוקש', () => {
  const stops = [
    stop({ id: 's1', date: '2026-08-19', callId: 'c1', status: 'completed', notes: 'בוצע' }),
    stop({ id: 's2', date: '2026-08-19', orderId: 'o1', source: 'delivery', notes: 'לא היה בבית' }),
    stop({ id: 's3', date: '2026-08-19', callId: 'c2', notes: 'בוטל' }),
  ];
  assert.deepEqual([...buildReturnedMap(stops, 'service').keys()], ['c2']);
  assert.deepEqual([...buildReturnedMap(stops, 'delivery').keys()], ['o1']);
  assert.equal(buildReturnedMap(stops, 'pickup').size, 0);
});

test('🔴 שני ניסיונות: מנצחת הסיבה של הניסיון האחרון', () => {
  const older = stop({ id: 's1', date: '2026-08-12', callId: 'c1', notes: 'לא ענה' });
  const newer = stop({ id: 's2', date: '2026-08-19', callId: 'c1', notes: 'טופל על ידי ישראל' });
  // בשני סדרי הגעה, כדי שהתוצאה לא תהיה תלויה בסדר השורות מהמסד
  assert.equal(buildReturnedMap([older, newer], 'service').get('c1').note, 'טופל על ידי ישראל');
  assert.equal(buildReturnedMap([newer, older], 'service').get('c1').note, 'טופל על ידי ישראל');
});

test('🔴 אותו יום: מכריעה שעת הסימון', () => {
  const morning = stop({ id: 's1', date: '2026-08-19', callId: 'c1', at: '2026-08-19T07:00:00Z', notes: 'בוקר' });
  const evening = stop({ id: 's2', date: '2026-08-19', callId: 'c1', at: '2026-08-19T13:20:00Z', notes: 'ערב' });
  assert.equal(buildReturnedMap([morning, evening], 'service').get('c1').note, 'ערב');
  assert.equal(buildReturnedMap([evening, morning], 'service').get('c1').note, 'ערב');
});

test('🔴 הסיבה מגיעה מ-resolutionNote, ותיאור המשימה לא מתחזה לה', () => {
  const map = buildReturnedMap(
    [stop({ id: 's1', date: '2026-08-19', callId: 'c1',
            notes: 'אספקת כיסא גלגלים', resolutionNote: 'הלקוח ביטל' })],
    'service',
  );
  assert.equal(map.get('c1').note, 'הלקוח ביטל');
});

test('עצירה היסטורית בלי resolutionNote נופלת אחורה ל-notes', () => {
  const map = buildReturnedMap(
    [stop({ id: 's1', date: '2026-08-12', callId: 'c1', notes: 'טופל על ידי ישראל' })],
    'service',
  );
  assert.equal(map.get('c1').note, 'טופל על ידי ישראל');
});

test('עצירה ישנה בלי סיבה מחזירה null, לא מחרוזת ריקה', () => {
  const map = buildReturnedMap([stop({ id: 's1', date: '2026-08-19', callId: 'c1', notes: '   ' })], 'service');
  assert.equal(map.get('c1').note, null);
});

test('עצירה בלי מפתח ישות מדולגת ולא מפילה', () => {
  const map = buildReturnedMap([stop({ id: 's1', date: '2026-08-19', callId: undefined, notes: 'x' })], 'service');
  assert.equal(map.size, 0);
});

test('returnedIdSet נותן בדיוק את אותם מפתחות', () => {
  const map = buildReturnedMap(
    [stop({ id: 's1', date: '2026-08-19', callId: 'c1' }), stop({ id: 's2', date: '2026-08-19', callId: 'c2' })],
    'service',
  );
  assert.deepEqual([...returnedIdSet(map)].sort(), ['c1', 'c2']);
});


// ═══════════════════════════════════════════════════════════════
// 27/08/2026 — "המשך טיפול"
// ═══════════════════════════════════════════════════════════════

/**
 * 🔴🔴 הבדיקה שמצדיקה את התוספת. עמי, 26/08: "אספקה שלא יצאה כמו שצריך,
 * אנחנו צריכים להוסיף לו כפתור של המשך טיפול." אם הסוג לא נוסע עד המסך,
 * המשרד רואה "לא בוצע" אדום על נהג שדווקא הגיע ועשה חלק מהעבודה, ואז
 * ההבחנה שנבנתה נמחקת בדיוק במקום שבו היא נדרשת.
 */
test('🔴 "המשך טיפול" נוסע עם הישות ואינו נבלע ב"לא בוצע"', () => {
  const map = buildReturnedMap(
    [stop({ id: 's1', date: '2026-08-27', callId: 'c1', resolutionNote: 'החגורה לא התאימה', kind: 'follow_up' })],
    'service',
  );
  assert.equal(map.get('c1').kind, 'follow_up');
  assert.equal(map.get('c1').note, 'החגורה לא התאימה');
});

test('סימון רגיל נשאר not_done', () => {
  const map = buildReturnedMap(
    [stop({ id: 's1', date: '2026-08-27', callId: 'c1', resolutionNote: 'לא היה בבית', kind: 'not_done' })],
    'service',
  );
  assert.equal(map.get('c1').kind, 'not_done');
});

/**
 * 🔴 עצירות שנסגרו לפני שהעמודה קיימת מחזירות undefined, **ולא ברירת
 * מחדל שקרית**. הצגתן כ"לא בוצע" הייתה נכונה במקרה, אבל הצגתן כ"המשך
 * טיפול" הייתה המצאה, ולכן הקוד שמצייר בוחר לפי `=== 'follow_up'`.
 */
test('עצירה היסטורית בלי הסוג אינה מקבלת ניחוש', () => {
  const map = buildReturnedMap(
    [stop({ id: 's1', date: '2026-06-01', callId: 'c1', notes: 'ישן' })],
    'service',
  );
  assert.equal(map.get('c1').kind, undefined);
});

/**
 * 🔴 "האחרון מנצח" חייב להמשיך לעבוד **גם כששני הניסיונות מסוגים שונים**.
 * לקוח שבשבוע שעבר לא נמצא בבית והשבוע קיבל ציוד שלא התאים צריך להציג
 * את החדש, אחרת המשרד מטפל בבעיה שכבר נפתרה.
 */
test('🔴 בין שני ניסיונות מסוגים שונים, האחרון מנצח', () => {
  const map = buildReturnedMap(
    [
      stop({ id: 's1', date: '2026-08-20', callId: 'c1', resolutionNote: 'לא היה בבית', kind: 'not_done' }),
      stop({ id: 's2', date: '2026-08-27', callId: 'c1', resolutionNote: 'הציוד לא התאים', kind: 'follow_up' }),
    ],
    'service',
  );
  assert.equal(map.get('c1').kind, 'follow_up');
  assert.equal(map.get('c1').note, 'הציוד לא התאים');
});
