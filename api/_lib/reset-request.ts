/**
 * הבקשה מהמסך הציבורי: נרמול המספר ומה אומרים לאדם.
 *
 * 🔴 קובץ טהור בלי ייבוא, כדי שייבדק (`test/reset-request.test.mjs`).
 *
 * ⭐ **הנוסח יושב כאן ולא בדפדפן ולא בשני עותקים**, כי זה בדיוק המקום
 * שבו החלטה של עידן הופכת למשפט שמישהו קורא בשש בבוקר במסך ההתחברות.
 */

/** התוצאות האפשריות של בקשת איפוס מהמסך הציבורי. */
export type RequestCode =
  | 'sent'
  | 'no_user'
  | 'ambiguous'
  | 'bad_phone'
  | 'rate'
  | 'disabled'
  | 'suppressed'
  | 'failed';

/**
 * נייד ישראלי → `+9725XXXXXXXX`, וכל השאר `null`.
 * מקבל `054-123-4567`, `054 1234567`, `+972541234567`, `972541234567`.
 * 🔴 קו נייח (`03…`) מוחזר `null`: אין לאן לשלוח וואטסאפ, ועדיף לומר
 *    את זה מיד מאשר "נשלח" שלא יגיע לעולם.
 */
export function normalizeMobile(raw: string): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return null;
  let local: string;
  if (digits.startsWith('972')) local = `0${digits.slice(3)}`;
  else if (digits.startsWith('0')) local = digits;
  else local = `0${digits}`;
  return /^05[0-9]{8}$/.test(local) ? `+972${local.slice(1)}` : null;
}

/** פסק הדין של השער במסד → הקוד שהאדם רואה. */
export function codeForVerdict(verdict: string): RequestCode | null {
  if (verdict === 'ok') return null;
  if (verdict === 'disabled') return 'disabled';
  return 'rate';
}

/**
 * מה נאמר לאדם. **החלטת עידן 18/09/2026: מספר שאינו רשום מקבל תשובה
 * מפורשת** ולא נוסח אחיד. הנימוק: 23 עובדים, תשעה מהם בלי מספר, ותשובה
 * מעורפלת משאירה אותם מול מסך שלא קורה בו כלום. מה שנחשף למי שאינו
 * עובד הוא רק האם מספר מסוים שייך לר.שעל.
 */
export function requestMessage(code: RequestCode, ttlMinutes = 15): string {
  switch (code) {
    case 'sent':
      return `שלחנו קישור לוואטסאפ שלך. הוא תקף ל-${ttlMinutes} דקות, ובסופו תבחר סיסמה חדשה.`;
    case 'no_user':
      return 'המספר הזה לא רשום במערכת. אפשר לפנות למנהל והוא ישלח קישור.';
    case 'ambiguous':
      return 'המספר הזה רשום ליותר מחשבון אחד, ולכן לא שלחנו. יש לפנות למנהל.';
    case 'bad_phone':
      return 'צריך מספר נייד ישראלי, למשל 0541234567.';
    case 'rate':
      return 'נשלחו כבר כמה בקשות מהמספר הזה. אפשר לנסות שוב בעוד שעה, או לפנות למנהל.';
    case 'disabled':
      return 'איפוס עצמי כבוי כרגע. יש לפנות למנהל.';
    case 'suppressed':
      return 'המספר הזה חסום לקבלת הודעות מאיתנו. יש לפנות למנהל.';
    case 'failed':
      return 'ההודעה לא יצאה. אפשר לנסות שוב בעוד כמה דקות, או לפנות למנהל.';
  }
}

/**
 * 🔴 **מצב HTTP אחיד ל-200 בכל תוצאה שאינה תקלת שרת.** המסך מציג את
 * ההודעה כפי שהיא, ו-4xx על "אין משתמש" היה הופך כל בדיקת קונסולה
 * לחיווי נוח למי שסורק מספרים.
 */
export function httpStatusFor(code: RequestCode): number {
  return code === 'failed' ? 502 : 200;
}
