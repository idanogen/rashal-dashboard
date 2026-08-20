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
 * המקור לטוקן: הסשן של המשתמש בדשבורד. התוסף בפריוריטי מחזיק את אותו
 * סשן בדיוק, אחרי שהעובד התחבר פעם אחת בפופאפ של התוסף.
 */
export interface AuthedUser {
  id: string;
  email: string | null;
}

export async function requireUser(req: VercelRequest): Promise<AuthedUser | null> {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}
