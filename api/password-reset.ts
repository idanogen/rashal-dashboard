import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'node:crypto';
import { supabaseAdmin } from './_lib/supabase-admin.js';

/**
 * המסלול הציבורי של קישור איפוס הסיסמה.
 *
 *   POST /api/password-reset   { action: 'verify' | 'submit', token, password? }
 *
 * 🔴 **זו נקודת הקצה היחידה במערכת שמשנה סיסמה בלי משתמש מחובר**, ולכן
 * כל מה שכאן נכתב מתוך ההנחה שהקורא עוין. שלושת העוגנים:
 *
 * 1. **האסימון הגולמי לא קיים במסד.** מחפשים לפי `sha256` שלו. מי
 *    שקורא את הטבלה מחזיק טביעות, לא מפתחות.
 * 2. **התשובה על אסימון שגוי זהה לתשובה על אסימון שפג.** ניסוח נפרד
 *    ("האסימון קיים אבל פג") מספר לתוקף שהוא קלע לערך אמיתי.
 * 3. **האסימון נסגר לפני שהסיסמה משתנה ובאותה בקשה.** סגירה אחרי
 *    השינוי מותירה חלון שבו שתי בקשות במקביל עוברות שתיהן.
 *
 * 🔴 **אין כאן החזרת שם משתמש לפני אימות.** `verify` מחזיר את השם רק
 * אחרי שהאסימון נמצא תקף, אחרת הכתובת הזאת הופכת למנוע ניחוש שמות.
 */

const MIN_PASSWORD = 8;

/** תשובה אחת ויחידה לכל אסימון שאינו תקף, יהיה הטעם אשר יהיה. */
const BAD_TOKEN = 'הקישור אינו תקף או שפג תוקפו. אפשר לבקש קישור חדש מהמנהל.';

interface Body {
  action?: 'verify' | 'submit';
  token?: string;
  password?: string;
}

function clientIp(req: VercelRequest): string | null {
  const fwd = req.headers['x-forwarded-for'];
  const raw = Array.isArray(fwd) ? fwd[0] : fwd;
  return raw ? raw.split(',')[0]!.trim().slice(0, 64) : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const body = (req.body ?? {}) as Body;
  const token = (body.token ?? '').toString().trim();
  // 🔴 תקרת אורך לפני כל חישוב: אסימון תקין הוא 43 תווים, וכל מה שמעבר
  //    לזה הוא ניסיון להאכיל את הפונקציה בקלט ענק.
  if (!token || token.length > 200) return res.status(400).json({ ok: false, error: BAD_TOKEN });

  const tokenHash = createHash('sha256').update(token).digest('hex');

  const { data: row } = await supabaseAdmin
    .from('password_reset_tokens')
    .select('id, user_id, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  const valid = !!row && !row.used_at && new Date(row.expires_at).getTime() > Date.now();
  if (!valid) return res.status(400).json({ ok: false, error: BAD_TOKEN });

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('username, full_name, disabled')
    .eq('id', row!.user_id)
    .maybeSingle();

  // חשבון שהושבת אחרי שהקישור נשלח לא נפתח דרך הקישור.
  if (!profile || profile.disabled) return res.status(400).json({ ok: false, error: BAD_TOKEN });

  if (body.action === 'verify') {
    return res.status(200).json({
      ok: true,
      username: profile.username,
      fullName: profile.full_name,
      expiresAt: row!.expires_at,
    });
  }

  if (body.action !== 'submit') return res.status(400).json({ ok: false, error: 'unknown action' });

  const password = (body.password ?? '').toString();
  if (password.length < MIN_PASSWORD) {
    return res.status(400).json({ ok: false, error: `הסיסמה חייבת להיות באורך ${MIN_PASSWORD} תווים לפחות.` });
  }
  if (password.length > 72) {
    // מגבלת bcrypt. סיסמה ארוכה יותר נחתכת בשקט, וזה מבלבל בהתחברות.
    return res.status(400).json({ ok: false, error: 'הסיסמה ארוכה מדי. עד 72 תווים.' });
  }

  // 🔴 **סוגרים קודם, ומוודאים שאנחנו אלה שסגרנו.** התנאי `is('used_at', null)`
  //    הוא הנעילה: שתי בקשות מקבילות על אותו אסימון, רק אחת מהן תחזיר שורה.
  const { data: claimed } = await supabaseAdmin
    .from('password_reset_tokens')
    .update({ used_at: new Date().toISOString(), used_ip: clientIp(req) })
    .eq('id', row!.id)
    .is('used_at', null)
    .select('id');
  if (!claimed || claimed.length === 0) return res.status(400).json({ ok: false, error: BAD_TOKEN });

  const { error } = await supabaseAdmin.auth.admin.updateUserById(row!.user_id, { password });
  if (error) {
    // האסימון כבר סגור ולא נפתח מחדש. שחזור שלו כאן היה מחזיר לשטח
    // כתובת חיה בעקבות תקלה, וזה בדיוק ההפך ממה שרוצים.
    return res.status(500).json({ ok: false, error: 'עדכון הסיסמה נכשל. יש לבקש קישור חדש.' });
  }

  return res.status(200).json({ ok: true, username: profile.username });
}
