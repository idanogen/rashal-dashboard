import test from 'node:test';
import assert from 'node:assert/strict';
import {
  selectForGeocode,
  localDateStr,
  RETRY_COOLDOWN_DAYS,
} from '../src/lib/geocode-backfill.ts';

/**
 * 🔴 מה שנבדק כאן הוא **כמה בקשות יוצאות**, וזה מה שעלה כסף.
 * במדידה של 23/08/2026 יצאו 83 בקשות בכל טעינת מסך סדרן, 77 מהן לעצירות
 * בתאריך שכבר עבר, וכל אחת מהן חויבה אצל גוגל וגם נספרה כעבודה ב-Vercel.
 */

const TODAY = '2026-08-24';
const NOW = Date.parse('2026-08-24T09:00:00Z');
const DAY = 86_400_000;

const stop = (o = {}) => ({
  id: o.id ?? 's1',
  status: o.status ?? 'planned',
  deliveryDate: o.deliveryDate ?? TODAY,
  address: 'address' in o ? o.address : 'הרצל 1',
  geocodedAddress: o.geocodedAddress,
  geocodedAt: o.geocodedAt,
});

const pick = (stops, tried) => selectForGeocode(stops, TODAY, NOW, tried);

test('עצירה של היום עם כתובת נבחרת', () => {
  assert.equal(pick([stop()]).length, 1);
});

test('🔴 עצירה בתאריך שעבר לא נבחרת, וזה החסם המרכזי', () => {
  // מימוש בלי חסם תאריך יחזיר 1 ויפיל בדיוק את הבדיקה הזאת.
  assert.equal(pick([stop({ deliveryDate: '2026-04-22' })]).length, 0);
});

test('עצירה עתידית כן נבחרת', () => {
  assert.equal(pick([stop({ deliveryDate: '2026-09-01' })]).length, 1);
});

test('עצירה של אתמול לא נבחרת, גם אם רק יום אחד עבר', () => {
  assert.equal(pick([stop({ deliveryDate: '2026-08-23' })]).length, 0);
});

test('סטטוס סגור לא נבחר', () => {
  for (const status of ['completed', 'not_completed', 'cancelled']) {
    assert.equal(pick([stop({ status })]).length, 0, status);
  }
  assert.equal(pick([stop({ status: 'in_progress' })]).length, 1);
});

test('בלי כתובת אין מה לחפש', () => {
  assert.equal(pick([stop({ address: undefined })]).length, 0);
  assert.equal(pick([stop({ address: '   ' })]).length, 0);
});

test('כתובת שכבר יש לה פין מדויק לא נבחרת', () => {
  assert.equal(pick([stop({ geocodedAddress: 'הרצל 1' })]).length, 0);
});

test('כתובת שהשתנתה מאז החיפוש כן נבחרת מחדש', () => {
  assert.equal(pick([stop({ geocodedAddress: 'כתובת ישנה' })]).length, 1);
});

test('🔴 כישלון טרי בצינון, אחרת אותה כתובת נוסתה לנצח', () => {
  const justFailed = new Date(NOW - 2 * DAY).toISOString();
  assert.equal(pick([stop({ geocodedAt: justFailed })]).length, 0);
});

test('אחרי הצינון מנסים שוב, כי כתובת יכולה להתווסף למאגר', () => {
  const old = new Date(NOW - (RETRY_COOLDOWN_DAYS + 1) * DAY).toISOString();
  assert.equal(pick([stop({ geocodedAt: old })]).length, 1);
});

test('חותמת לא תקינה לא חוסמת', () => {
  assert.equal(pick([stop({ geocodedAt: 'לא תאריך' })]).length, 1);
});

test('מה שכבר נוסה בטעינה הנוכחית מדולג', () => {
  assert.equal(pick([stop({ id: 'a' })], new Set(['a'])).length, 0);
});

test('⭐ התמונה המלאה: מהתערובת שנמדדה נשארות רק העצירות שקדימה', () => {
  const stops = [
    ...Array.from({ length: 77 }, (_, i) =>
      stop({ id: `past-${i}`, deliveryDate: '2026-05-01' })),
    ...Array.from({ length: 6 }, (_, i) =>
      stop({ id: `next-${i}`, deliveryDate: '2026-08-25' })),
  ];
  assert.equal(stops.length, 83);
  assert.equal(pick(stops).length, 6);
});

test('תאריך מקומי ולא UTC, אחרת יום שלם זז', () => {
  // 23:30 שעון מקומי, שב-UTC כבר היום שאחרי.
  const d = new Date(2026, 7, 24, 23, 30);
  assert.equal(localDateStr(d), '2026-08-24');
});
