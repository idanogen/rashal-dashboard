import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'node:crypto';
import { supabaseAdmin } from './_lib/supabase-admin.js';
import { issueResetLink } from './_lib/reset-link.js';
import {
  codeForVerdict, httpStatusFor, normalizeMobile, requestMessage, type RequestCode,
} from './_lib/reset-request.js';

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
  action?: 'verify' | 'submit' | 'request';
  token?: string;
  password?: string;
  phone?: string;
}

function clientIp(req: VercelRequest): string | null {
  const fwd = req.headers['x-forwarded-for'];
  const raw = Array.isArray(fwd) ? fwd[0] : fwd;
  return raw ? raw.split(',')[0]!.trim().slice(0, 64) : null;
}

/**
 * ── בקשת איפוס מהמסך הציבורי (עידן, 18/09/2026) ──────────────────────────
 *
 * 🔴🔴 **זו הכתובת היחידה במערכת שאדם לא מזוהה יכול לגרום לה לשלוח
 * הודעת וואטסאפ.** לכן הסדר כאן קשיח: קודם השער שסופר ורושם, ורק
 * אחריו מגיעים למסד ולטלפון של מישהו.
 *
 * ⭐ **הזיהוי הוא המספר, והמספר נקרא מכרטיס העובד.** גוף הבקשה קובע
 * רק *את מי מחפשים*, לעולם לא לאן שולחים: המספר שממנו מחפשים הוא גם
 * המספר ששמור על הכרטיס, ולכן אי אפשר לבקש קישור של חשבון זר למכשיר
 * אחר. [[rashal_password_reset_link]]
 *
 * 🔴 המספר עצמו אינו נכתב ליומן הבקשות, רק `sha256` שלו עם פלפל מהשרת:
 * טבלה שמוזנת מנקודת קצה פתוחה לא תהפוך לרשימת הניידים של עובדי ר.שעל.
 */
const HASH_PEPPER = process.env.RESET_HASH_PEPPER ?? process.env.PRIORITY_SYNC_SECRET ?? '';

async function handleRequest(req: VercelRequest, res: VercelResponse, body: Body) {
  const phone = normalizeMobile((body.phone ?? '').toString());
  if (!phone) {
    // קלט שאינו נייד ישראלי לא נספר בתקרות: אין מה למנות, ואין למי לשלוח.
    return res.status(200).json({ ok: false, code: 'bad_phone', message: requestMessage('bad_phone') });
  }

  const phoneHash = createHash('sha256').update(`${HASH_PEPPER}:${phone}`).digest('hex');
  const { data: gate, error: gateErr } = await supabaseAdmin
    .rpc('password_reset_request_gate', { p_phone_hash: phoneHash, p_ip: clientIp(req) });
  if (gateErr) {
    console.error('[password-reset] gate', gateErr.message);
    return res.status(503).json({ ok: false, code: 'failed', message: requestMessage('failed') });
  }
  const verdict = String((gate as { verdict?: string })?.verdict ?? 'ok');
  const requestId = (gate as { id?: string })?.id ?? null;
  const ttl = Number((gate as { ttl_minutes?: number })?.ttl_minutes ?? 15);

  const close = async (code: RequestCode) => {
    if (requestId) await supabaseAdmin.rpc('password_reset_request_outcome', { p_id: requestId, p_outcome: code });
    return res.status(httpStatusFor(code)).json({ ok: code === 'sent', code, message: requestMessage(code, ttl) });
  };

  const blocked = codeForVerdict(verdict);
  if (blocked) return await close(blocked);

  // 🔴 חשבון מושבת נראה כאן בדיוק כמו מספר שאינו רשום. מי שהושבת
  //    בכוונה לא מקבל דרך חזרה, וגם לא רמז שהחשבון קיים.
  const { data: matches } = await supabaseAdmin
    .from('profiles')
    .select('id, username, full_name')
    .eq('phone_e164', phone)
    .eq('disabled', false);

  const rows = matches ?? [];
  if (rows.length === 0) return await close('no_user');
  // 🔴 יש אינדקס ייחודי שאמור למנוע את זה, אבל ניחוש כאן שולח קישור
  //    לחשבון הלא נכון, ולכן עוצרים במקום לבחור.
  if (rows.length > 1) return await close('ambiguous');

  const target = rows[0] as { id: string; username: string; full_name: string | null };
  const issued = await issueResetLink({
    userId: target.id,
    phoneE164: phone,
    name: (target.full_name || target.username || '').toString(),
    createdBy: null,
  });
  if (!issued.ok) {
    console.error('[password-reset] issue failed', issued.code, issued.error);
    return await close(issued.code === 'suppressed' ? 'suppressed' : 'failed');
  }
  return await close('sent');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const body = (req.body ?? {}) as Body;
  if (body.action === 'request') return await handleRequest(req, res, body);
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
