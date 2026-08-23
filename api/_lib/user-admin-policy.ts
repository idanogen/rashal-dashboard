/**
 * מי רשאי לעשות מה במסך המשתמשים.
 *
 * ⭐ **הוצא לקובץ בלי שום ייבוא יחסי בכוונה**, כדי שאפשר יהיה לבדוק את
 * ההרשאות בבדיקות יחידה בלי להרים שרת. זו נקודת ההכרעה היחידה: המסך
 * מסתיר כפתורים, אבל מי שמסתיר כפתור לא הגן על כלום.
 *
 * 🔴 **שלושת האיסורים על "מנהל צוות", והסיבה לכל אחד:**
 * 1. **אין מחיקת משתמש.** מחיקה היא בלתי הפיכה ומוחקת גם את ההיסטוריה
 *    של מי שפעל בשם המשתמש. השבתה עושה את אותה עבודה והפיכה.
 * 2. **אסור לגעת במנהל מערכת.** מי שיכול לאפס סיסמה למנהל מערכת יכול
 *    להתחבר בתור מנהל מערכת, כלומר הוא מנהל מערכת בפועל.
 * 3. **אסור להעניק "מנהל מערכת".** אותה הסלמה, בדלת אחרת.
 */

export type ManagerRole = 'admin' | 'team_manager';

export interface PolicyInput {
  /** התפקיד של מי שמבצע את הפעולה */
  callerRole: string;
  callerId: string;
  action: string;
  /** התפקיד הנוכחי של מי שהפעולה מופנית אליו, אם יש כזה */
  targetRole?: string | null;
  targetId?: string | null;
  /** התפקיד המבוקש, ב-`create` וב-`set_role` */
  newRole?: string | null;
}

export type PolicyResult = { ok: true } | { ok: false; error: string; status: number };

const MANAGER_ROLES: ManagerRole[] = ['admin', 'team_manager'];

export function checkUserAdminPolicy(i: PolicyInput): PolicyResult {
  if (!MANAGER_ROLES.includes(i.callerRole as ManagerRole)) {
    return { ok: false, error: 'caller may not manage users', status: 403 };
  }
  if (i.callerRole === 'admin') return { ok: true };

  // מכאן והלאה: מנהל צוות בלבד.
  if (i.action === 'delete') {
    return {
      ok: false,
      error: 'מנהל צוות אינו יכול למחוק משתמש. אפשר להשבית אותו, וזו פעולה הפיכה.',
      status: 403,
    };
  }

  // 🔴 העצמי מותר גם אם הוא במקרה מנהל מערכת, אחרת אדם ננעל מחוץ לחשבון
  // שלו. שאר הכללים עדיין חלים עליו, ובראשם איסור ההעלאה לתפקיד.
  const isSelf = !!i.targetId && i.targetId === i.callerId;

  if (!isSelf && i.targetRole === 'admin') {
    return {
      ok: false,
      error: 'מנהל צוות אינו יכול לשנות משתמש שהוא מנהל מערכת.',
      status: 403,
    };
  }

  if (i.newRole === 'admin') {
    return {
      ok: false,
      error: 'רק מנהל מערכת יכול להעניק את התפקיד "מנהל מערכת".',
      status: 403,
    };
  }

  return { ok: true };
}
