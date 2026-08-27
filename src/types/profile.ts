import type { AssigneeName } from './route';

export type UserRole =
  | 'admin'
  | 'management'
  | 'team_manager'
  | 'dispatcher'
  | 'driver'
  | 'viewer';

/**
 * ⭐ **`management` רואה כסף, ואינו נוגע בהגדרות המערכת.**
 *
 * 🔴 עידן, 26/08/2026: "כל דבר שמדבר על כסף ומחזורי מכירות חשוף רק
 * להרשאת הנהלה, שזה נכון לעכשיו שלומי ורונן בלבד."
 *
 * הפער שהוא סוגר: עד היום דשבורד ההנהלה היה פתוח למנהל מערכת בלבד,
 * ולכן כדי ששלומי יראה אותו הוא קיבל **מנהל מערכת מלא** עם ניהול
 * משתמשים ותבניות וואטסאפ. תפקיד ביניים מפריד בין "לראות מספרים" לבין
 * "לשנות את המערכת", ואלה שתי סמכויות שונות לגמרי.
 *
 * 🔴 האכיפה במסד (`is_management()`), לא במסך: סכום שרק מוסתר בדפדפן
 * עדיין נוסע אליו ונשלף משם.
 */
export const MONEY_ROLES: UserRole[] = ['admin', 'management'];

/**
 * ⭐ **`team_manager` הוא סדרן ועוד.** הוא רואה ועושה כל מה שסדרן עושה,
 * ובנוסף מנהל משתמשים ואת צוות השטח. הוא **אינו** מנהל מערכת: אין לו
 * מחיקת משתמש, אין לו תבניות וואטסאפ, ואסור לו לגעת במנהל מערכת או
 * להעניק את התפקיד. שלושת האיסורים נאכפים ב-`api/admin-users.ts`.
 */
export const USER_MANAGER_ROLES: UserRole[] = ['admin', 'team_manager'];

export const ALLOWED_ROLES: UserRole[] = ['admin', 'management', 'team_manager', 'dispatcher', 'driver', 'viewer'];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'מנהל מערכת',
  management: 'הנהלה',
  team_manager: 'מנהל צוות',
  dispatcher: 'שולח (מנהל משלוחים)',
  driver: 'נהג',
  viewer: 'צפייה בלבד',
};

export interface Profile {
  id: string;
  email: string;
  /** Admin-managed handle used for login (Hebrew or English). Maps to a synthetic
   *  ASCII email under the hood — see `usernameToEmail` in src/lib/username.ts. */
  username?: string;
  fullName?: string;
  role: UserRole;
  disabled: boolean;
  /** כשהתפקיד הוא 'driver', מקשר את המשתמש לשורה בטבלת `assignees` (נהג או טכנאי). */
  linkedDriver?: AssigneeName;
  createdAt: string;
  updatedAt?: string;
}

/** Domain used for synthetic emails behind username-based logins. */
export const USERNAME_EMAIL_DOMAIN = 'rashal.internal';
/** 3-30 chars: Latin letters, Hebrew letters (א-ת incl. finals), digits, . _ - (no spaces). */
export const USERNAME_PATTERN = /^[a-zA-Z0-9._א-ת-]{3,30}$/u;
