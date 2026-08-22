import type { VercelRequest } from '@vercel/node';
import { timingSafeEqual } from 'node:crypto';
import { requireUser, type AuthedUser } from './require-user.js';

/**
 * מי מורשה להפעיל שליחה.
 *
 * 🔴 `api/heyy-send` נפרס **בלי אימות בכלל**, וכל מי שהחזיק את הכתובת יכול
 * היה לשלוח וואטסאפ מהמספר הרשמי של ר.שעל, על חשבון ה-heyy של עוגן, בלי
 * שנדע. זה היה ידוע ונדחה במכוון שלושה סבבים. נסגר 22/08/2026.
 *
 * ⭐ שני סוגי קוראים, ולכל אחד הזדהות משלו:
 *   · **אדם** (הדשבורד, החלונית בפריוריטי) ⟵ ה-JWT של הסשן שלו.
 *   · **מכונה** (מנוע הסקרים, שרץ ב-pg_cron ואין לו משתמש) ⟵ סוד משותף,
 *     באותו דפוס בדיוק של `PRIORITY_SYNC_SECRET` שכבר חי בפרויקט.
 */
export type Caller =
  | { kind: 'user'; user: AuthedUser; label: string }
  | { kind: 'service'; label: string };

/**
 * 🔴 השוואה בזמן קבוע. השוואת מחרוזות רגילה נעצרת בתו הראשון שנבדל,
 * ולכן זמן התגובה מדליף את הסוד תו-תו למי שמודד.
 */
function secretMatches(given: string): boolean {
  const want = process.env.RASHAL_SEND_SECRET ?? '';
  if (!want || !given) return false;
  const a = Buffer.from(given, 'utf8');
  const b = Buffer.from(want, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function requireCaller(req: VercelRequest): Promise<Caller | null> {
  const given = String(req.headers['x-send-secret'] ?? '');
  if (given) {
    if (secretMatches(given)) return { kind: 'service', label: 'service' };
    // סוד שגוי הוא ניסיון, לא טעות הקלדה. נרשם, בלי הסוד עצמו.
    console.warn('[auth] x-send-secret נדחה');
    return null;
  }

  const user = await requireUser(req);
  if (user) return { kind: 'user', user, label: user.email ?? user.id };

  return null;
}

/**
 * 🔴 **נעילה סגורה כברירת מחדל.** אם `RASHAL_SEND_SECRET` לא מוגדר בסביבה,
 * הקורא המכונתי לא יוכל להזדהות והשליחה שלו תיעצר. זו ההתנהגות הרצויה:
 * נקודת קצה ששולחת בשם החברה ואינה יודעת לאמת אסור לה לשלוח.
 * הפונקציה קיימת כדי שהכשל יהיה **רועש בלוג** ולא שקט בתשובה.
 */
export function warnIfSecretMissing(where: string): void {
  if (!process.env.RASHAL_SEND_SECRET) {
    console.error(`[auth] ${where}: RASHAL_SEND_SECRET לא מוגדר. קוראים מכונתיים ייחסמו.`);
  }
}
