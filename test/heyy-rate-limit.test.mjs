import test from 'node:test';
import assert from 'node:assert/strict';
import {
  rateLimitInfo, retryAfterMs, isRetryableFailure, RATE_LIMITED, DEFAULT_RETRY,
} from '../api/_lib/heyy-rate-limit.ts';

/** כותרות אמיתיות מהתשובה של heyy (25/08/2026), לא מומצאות. */
const NOW = 1787683440000;              // 2026-08-25T18:44:00Z
const RESET_EPOCH = 1787683497;         // 57 שניות אחרי
const headers = (o = {}) => ({
  get: (n) => {
    const bag = {
      'x-ratelimit-limit': '100',
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': String(RESET_EPOCH),
      ...o,
    };
    const v = bag[n.toLowerCase()];
    return v === undefined ? null : v;
  },
});

const opts = (o = {}) => ({
  retryServerErrors: true, maxWaitMs: DEFAULT_RETRY.maxWaitMs, waitedMs: 0,
  attempt: 0, maxAttempts: DEFAULT_RETRY.maxAttempts, nowMs: NOW, ...o,
});

test('הכותרות נקראות, והאיפוס מומר משניות למילישניות', () => {
  const i = rateLimitInfo(headers());
  assert.equal(i.limit, 100);
  assert.equal(i.remaining, 0);
  // 🔴 heyy נותנת שניות. פי אלף טעות כאן הופכת המתנה של דקה לאחת עשרה שעות.
  assert.equal(i.resetAtMs, RESET_EPOCH * 1000);
  assert.ok(i.resetAtMs - NOW < 60_000);
});

test('כותרת חסרה נשארת null ולא מקבלת ניחוש', () => {
  const i = rateLimitInfo({ get: () => null });
  assert.equal(i.limit, null);
  assert.equal(i.resetAtMs, null);
});

test('429 עם איפוס קרוב ממתין עד האיפוס ועוד שנייה', () => {
  // האיפוס בעוד 4 שניות: מחכים 5 ושולחים, בתוך התקציב.
  const wait = retryAfterMs(429, headers(), opts({ nowMs: RESET_EPOCH * 1000 - 4000 }));
  assert.equal(wait, 5000);
});

/**
 * 🔴🔴 **המקרה שקובע את כל הארכיטקטורה.** חלון המכסה של heyy הוא דקה
 * ופונקציית Vercel חיה 60 שניות, ולכן 429 שנופל בתחילת החלון פשוט
 * **אי אפשר להמתין לו בתוך הבקשה**. אז לא ממתינים, ומחזירים את הפריט
 * לתור. ההמתנה היא קיצור דרך למקרה הקל בלבד, והתור הוא התיקון האמיתי.
 */
test('🔴 429 עם איפוס רחוק מוותר, ולא תוקע את הפונקציה עד שתיהרג', () => {
  const wait = retryAfterMs(429, headers(), opts());   // איפוס בעוד 57 שניות
  assert.equal(wait, null);
});

/**
 * 🔴🔴 הכלל שבגללו הקובץ קיים. 429 אומר מפורשות שהבקשה לא בוצעה, ולכן
 * ניסיון חוזר בטוח. 500 על **שליחה** הוא דו משמעי: ייתכן שהוואטסאפ כבר
 * יצא ללקוח ורק התשובה אלינו אבדה, וכפילות גרועה מהודעה חסרה.
 */
test('🔴 במסלול שליחה לא מנסים שוב על שגיאת שרת, רק על מכסה', () => {
  assert.equal(retryAfterMs(500, headers(), opts({ retryServerErrors: false })), null);
  assert.equal(retryAfterMs(502, headers(), opts({ retryServerErrors: false })), null);
  assert.ok(retryAfterMs(429, headers(), opts({ retryServerErrors: false, nowMs: RESET_EPOCH * 1000 - 4000 })) > 0);
});

test('במסלול קריאה מותר לנסות שוב על שגיאת שרת', () => {
  assert.equal(retryAfterMs(500, headers(), opts({ retryServerErrors: true })), 1000);
  assert.equal(retryAfterMs(500, headers(), opts({ retryServerErrors: true, attempt: 1 })), 2000);
});

/**
 * 🔴 גם בקשה שנכשלת נספרת במכסה (נמדד: חמישה 400 הורידו את המונה מ-99
 * ל-94). לולאת ניסיונות על שגיאת ולידציה שורפת את המכסה של כל המערכת.
 */
test('🔴 4xx לעולם לא נשלח שוב, חוץ מ-429', () => {
  for (const st of [400, 401, 403, 404, 422]) {
    assert.equal(retryAfterMs(st, headers(), opts()), null, `status ${st}`);
  }
});

test('נעצרים אחרי מספר הניסיונות המוגדר', () => {
  assert.equal(retryAfterMs(429, headers(), opts({ attempt: DEFAULT_RETRY.maxAttempts })), null);
});

/**
 * 🔴 פונקציית Vercel חיה 60 שניות. המתנה ארוכה מהתקציב אינה "להמתין בכל
 * זאת", אלא לוותר ולהחזיר את הפריט לתור.
 */
test('🔴 המתנה שחורגת מהתקציב מוותרת ולא מנסה', () => {
  const close = { nowMs: RESET_EPOCH * 1000 - 4000 };  // דרושות 5 שניות
  assert.equal(retryAfterMs(429, headers(), opts({ ...close, maxWaitMs: 3000 })), null);
  assert.equal(retryAfterMs(429, headers(), opts({ ...close, waitedMs: 12_000 })), null);
  assert.equal(retryAfterMs(429, headers(), opts(close)), 5000);
});

test('בלי כותרת איפוס נופלים על השהיה קצרה, לא על דקה שלמה', () => {
  const wait = retryAfterMs(429, headers({ 'x-ratelimit-reset': null }), opts());
  assert.equal(wait, 2000);
});

test('כותרת איפוס שעברה כבר לא מייצרת המתנה שלילית', () => {
  const wait = retryAfterMs(429, headers(), opts({ nowMs: NOW + 300_000 }));
  assert.ok(wait > 0 && wait <= 61_000);
});

test('כותרת איפוס מופרכת נחתכת לגבול הגיוני ולא מייצרת שינה של שעות', () => {
  const wait = retryAfterMs(429, headers({ 'x-ratelimit-reset': String(RESET_EPOCH + 99999) }), opts({ maxWaitMs: 999_999 }));
  assert.equal(wait, 61_000);
});

test('הסימן שמבדיל מכסה מדחייה', () => {
  assert.ok(isRetryableFailure(`${RATE_LIMITED}: Too many requests`));
  assert.equal(isRetryableFailure('Invalid body params'), false);
  assert.equal(isRetryableFailure(null), false);
});
