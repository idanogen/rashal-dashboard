import type { VercelRequest } from '@vercel/node';
import { supabaseAdmin } from './supabase-admin.js';

/**
 * אימות המשתמש שמאחורי הקריאה, מתוך ה-JWT של Supabase.
 *
 * 🔴 למה זה קובץ נפרד: `api/heyy-send` נפרס בלי אימות בכלל, וכל מי שמחזיק
 * את הכתובת יכול לשלוח וואטסאפ מהמספר הרשמי של הלקוח. הסיבה שזה קרה היא
 * שהאימות היה "משהו שכותבים בכל נקודת קצה מחדש", ולכן אפשר לשכוח אותו.
 * כאן זו שורה אחת, ואין תירוץ לדלג עליה.
 *
 * 🔴🔴 23/09/2026 (סקירת אבטחה): טוקן תקף לבדו אינו הרשאה. עד היום כל
 * חשבון, כולל נהג, קרא את כל תיקי הלקוחות והשיחות דרך `api/conversation`
 * ו-`api/priority-context`. מעכשיו `requireUser` דוחה חשבון מושבת או בלי
 * תפקיד, ו-`requireOffice` משאיר רק את תפקידי המשרד (אותה רשימה של
 * `is_office_staff()` במסד ושל המסך `/inbox`).
 *
 * המקור לטוקן: הסשן של המשתמש בדשבורד. התוסף בפריוריטי מחזיק את אותו
 * סשן בדיוק, אחרי שהעובד התחבר פעם אחת בפופאפ של התוסף.
 */
export interface AuthedUser {
  id: string;
  email: string | null;
  role: string;
}

export const OFFICE_ROLES: ReadonlySet<string> = new Set(['admin', 'team_manager', 'dispatcher', 'viewer', 'management']);

export async function requireUser(req: VercelRequest): Promise<AuthedUser | null> {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role, disabled')
    .eq('id', data.user.id)
    .maybeSingle();
  if (!profile || profile.disabled || !profile.role) return null;

  return { id: data.user.id, email: data.user.email ?? null, role: String(profile.role) };
}

/** משתמש מחובר עם תפקיד משרד. נהג וחשבון בלי תפקיד מקבלים null. */
export async function requireOffice(req: VercelRequest): Promise<AuthedUser | null> {
  const user = await requireUser(req);
  return user && OFFICE_ROLES.has(user.role) ? user : null;
}
