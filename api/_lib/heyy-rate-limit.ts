/**
 * מכסת הקצב של heyy, והמדיניות מה מותר לנסות שוב.
 *
 * **נמדד חי מול החשבון שלנו (25/08/2026), לא נלקח מהתיעוד בלבד:**
 * 100 בקשות לדקה בתוכנית Hobby, חלון קבוע של דקה, לכל החשבון ביחד.
 * כל תשובה נושאת `x-ratelimit-limit` · `x-ratelimit-remaining` ·
 * `x-ratelimit-reset` (חותמת יוניקס בשניות). חריגה מחזירה 429 עם
 * `messageKey: "rate_limit_exceeded"`.
 *
 * 🔴 **גם בקשה שנכשלת נספרת.** חמש קריאות שהחזירו 400 הורידו את המונה
 * מ-99 ל-94, ולכן לולאת ניסיונות על שגיאת ולידציה שורפת את המכסה של
 * כל המערכת. מכאן הכלל הראשון: **4xx לעולם לא נשלח שוב**, חוץ מ-429.
 *
 * 🔴🔴 **והכלל השני, החשוב יותר: שליחה אינה קריאה.**
 * 429 בטוח לגמרי לניסיון חוזר, כי המשמעות המפורשת שלו היא שהבקשה
 * **לא בוצעה**. לעומת זאת 500 או timeout על שליחת הודעה הם **דו משמעיים**:
 * ייתכן מאוד שהוואטסאפ כבר יצא ללקוח, ורק התשובה אלינו אבדה. ניסיון חוזר
 * שם שולח ללקוח את אותה הודעה פעמיים, וזה נזק גדול יותר מהודעה שלא יצאה.
 * לכן מסלול השליחה מנסה שוב **רק על 429**, ומסלול הקריאה (תבניות, ערוצים)
 * מנסה גם על 5xx.
 */

/** מה שנקרא מהכותרות. שדה חסר נשאר null ולא מקבל ניחוש. */
export interface RateLimitInfo {
  limit: number | null;
  remaining: number | null;
  /** מילישניות מאז 1970, מתי המונה מתאפס. */
  resetAtMs: number | null;
}

type HeaderBag = { get(name: string): string | null };

export function rateLimitInfo(headers: HeaderBag): RateLimitInfo {
  const num = (raw: string | null): number | null => {
    if (raw == null || raw.trim() === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  const reset = num(headers.get('x-ratelimit-reset'));
  return {
    limit: num(headers.get('x-ratelimit-limit')),
    remaining: num(headers.get('x-ratelimit-remaining')),
    // 🔴 השעה מגיעה בשניות ולא במילישניות. פי אלף טעות כאן הופכת המתנה
    // של חצי דקה להמתנה של אחת עשרה שעות בתוך פונקציה בת דקה.
    resetAtMs: reset == null ? null : reset * 1000,
  };
}

export interface RetryOptions {
  /** האם מותר לנסות שוב על שגיאת שרת. שקר במסלול שליחה. */
  retryServerErrors: boolean;
  /** תקרת ההמתנה הכוללת. פונקציית Vercel חיה 60 שניות, ולכן זה לא אינסופי. */
  maxWaitMs: number;
  /** כמה מילישניות כבר המתנו בקריאה הזאת. */
  waitedMs: number;
  /** ניסיון נוכחי, החל מ-0. */
  attempt: number;
  /** מקסימום ניסיונות חוזרים. */
  maxAttempts: number;
  nowMs: number;
}

/**
 * 🔴 **המתנה קצרה בכוונה, וזו החלטה ולא פשרה.**
 * חלון המכסה של heyy הוא דקה, ופונקציית Vercel חיה 60 שניות סך הכל.
 * כלומר 429 שנופל בתחילת החלון **אי אפשר להמתין לו בתוך הבקשה**, ולנסות
 * זאת פירושו לתקוע את הפונקציה עד שהיא נהרגת באמצע השליחה.
 *
 * ⭐ לכן החלוקה: אם האיפוס קרוב (עד 15 שניות) ממתינים ושולחים מיד, ואם
 * לא מוותרים ומחזירים `retryable`, **והפריט חוזר לתור** במקום להיעלם.
 * התור הוא התיקון האמיתי כאן; ההמתנה היא רק קיצור דרך למקרה הקל.
 */
export const DEFAULT_RETRY: Pick<RetryOptions, 'maxWaitMs' | 'maxAttempts'> = {
  maxWaitMs: 15000,
  maxAttempts: 2,
};

/**
 * כמה להמתין לפני ניסיון חוזר, או null כשאסור או אין טעם לנסות שוב.
 *
 * 🔴 מחזיר null גם כשההמתנה הדרושה חורגת מהתקציב. **זה לא כישלון סופי**:
 * המתקשר אמור להחזיר את הפריט לתור ולא לסמן אותו כנכשל, אחרת הודעה
 * שנחסמה על מכסה נעלמת לתמיד. זו בדיוק התקלה שהייתה כאן.
 */
export function retryAfterMs(
  status: number,
  headers: HeaderBag,
  opts: RetryOptions,
): number | null {
  if (opts.attempt >= opts.maxAttempts) return null;

  const isRateLimited = status === 429;
  const isServerError = status >= 500;

  if (!isRateLimited && !(isServerError && opts.retryServerErrors)) return null;

  let wait: number;
  if (isRateLimited) {
    const { resetAtMs } = rateLimitInfo(headers);
    const untilReset = resetAtMs == null ? null : resetAtMs - opts.nowMs;
    // ⭐ שנייה אחת מעבר לאיפוס, כדי לא להיתקל בשעון שנע קצת אחרת אצלם.
    // בלי כותרת שמישה נופלים על השהיה קצרה, ולא על דקה שלמה של שינה.
    wait = untilReset != null && untilReset > 0 ? untilReset + 1000 : 2000 * (opts.attempt + 1);
    // חלון של דקה, ולכן המתנה ארוכה מזה פירושה כותרת שבורה.
    if (wait > 61000) wait = 61000;
  } else {
    wait = 1000 * 2 ** opts.attempt;
  }

  if (opts.waitedMs + wait > opts.maxWaitMs) return null;
  return wait;
}

/** סימן מוסכם שהכישלון הוא מכסה ולא תוכן, כדי שהקורא ידע להחזיר לתור. */
export const RATE_LIMITED = 'rate_limited';

/** האם הכישלון הזה ראוי לניסיון חוזר מאוחר יותר. */
export function isRetryableFailure(detail: string | null | undefined): boolean {
  return typeof detail === 'string' && detail.includes(RATE_LIMITED);
}
