/**
 * "מי נתקע היום" (02/11/2026, שלב 3 בתוכנית הלוגים), הלוגיקה הטהורה.
 * בלי ייבוא, נבדק ב-`test/app-day-summary.test.mjs`.
 *
 * הנתונים מ-`app_day_summary()` במסד, אותה פונקציה שסיכום הבוקר במייל קורא.
 * כאן רק ההכרעה מי דורש תשומת לב ובאיזה צבע.
 */
export interface DayUser {
  name: string;
  role: string | null;
  app: 'driver' | 'dashboard';
  version: string | null;
  device: string | null;
  first_seen: string;
  last_seen: string;
  sessions: number;
  screens: number;
  errors: number;
  crashes: number;
  rejected: number;
  image_errors: number;
  forms_opened: number;
  forms_blocked: number;
  forms_cancelled: number;
  forms_saved: number;
  forms_failed: number;
  forms_sent: number;
  problems: number;
  /** שגיאות לפי שם, לניכוי הצפויות. */
  error_names: Record<string, number>;
}

export interface DayError { name: string; n: number; users: number; sample: string | null }
export interface DayBlock { form_key: string; reason: string; n: number; users: string | null }
export interface DayProblem {
  occurred_at: string; user_name: string | null; screen: string | null; stop_id: string | null;
  customer_name: string | null; topic: string | null; text: string | null; app_version: string | null;
}
export interface DaySilent { name: string; stops: number }

export interface DaySummary {
  day: string;
  events: number;
  users: DayUser[];
  top_errors: DayError[];
  form_blocks: DayBlock[];
  problems: DayProblem[];
  silent: DaySilent[];
}

/**
 * שגיאות שידוע שהן צפויות ואינן תקיעה של המשתמש. הן עדיין מוצגות ברשימת
 * השגיאות עם ההסבר, אבל לא צובעות את המשתמש.
 */
export const KNOWN_ERRORS: Record<string, string> = {
  registerForPush: 'התראות דחיפה עוד לא הוגדרו (Firebase, שלב 3 בטבלת מה נשאר). צפוי.',
};

export type Flag = 'red' | 'amber' | 'ok';

/** שגיאות המשתמש בלי הצפויות. */
export function unexpectedErrors(u: DayUser): number {
  return Object.entries(u.error_names ?? {}).reduce((sum, [name, n]) => sum + (name in KNOWN_ERRORS ? 0 : n), 0);
}

/** אדום: דיווח, קריסה, שמירה שנכשלה או פעולה שנדחתה. כתום: נחסם או נטש טופס, תמונות לא נטענו, שגיאה. */
export function userFlag(u: DayUser): Flag {
  if (u.problems > 0 || u.crashes > 0 || u.forms_failed > 0 || u.rejected > 0) return 'red';
  if (u.forms_blocked > 0 || u.forms_cancelled > 0 || u.image_errors > 0 || unexpectedErrors(u) > 0) return 'amber';
  return 'ok';
}

const REASON_LABEL: Record<string, string> = {
  missing_fields: 'שדות חובה חסרים',
  bad_id: 'תעודת זהות לא תקינה',
  missing_signature: 'חתימה חסרה',
  missing_photo: 'צילום חסר',
};

export function blockReasonLabel(reason: string): string {
  return REASON_LABEL[reason] ?? reason;
}

/** "לפני 5 דק׳" מתוך הפרש במילישניות. */
export function agoLabel(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min < 1) return 'עכשיו';
  if (min < 60) return `לפני ${min} דק׳`;
  const h = Math.floor(min / 60);
  return h < 24 ? `לפני ${h} שע׳` : `לפני ${Math.floor(h / 24)} ימים`;
}

/** סדר התצוגה: אדום, כתום, תקין; בתוך כל צבע האחרון שנראה קודם. */
export function sortUsers(users: DayUser[]): DayUser[] {
  const rank: Record<Flag, number> = { red: 0, amber: 1, ok: 2 };
  return [...users].sort((a, b) => rank[userFlag(a)] - rank[userFlag(b)] || b.last_seen.localeCompare(a.last_seen));
}
