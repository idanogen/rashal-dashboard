import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from './_lib/supabase-admin.js';
import { checkUserAdminPolicy } from './_lib/user-admin-policy.js';
import { sendTemplate } from './_lib/heyy-v3.js';

// Admin user-management endpoint. Single POST endpoint with `action` switch.
//
//   POST /api/admin-users
//   Header: Authorization: Bearer <user JWT>     ← supabase access token
//   Body: { action, ...payload }
//
//   actions:
//     create           — create user with username + (optional) password. Auth.users gets a
//                        synthetic email = `{username}@rashal.internal`.
//     delete           — hard-delete user + profile.
//     set_role         — update profile.role.
//     set_username     — rename a user; auth.users.email is regenerated from the new username.
//     set_linked_driver— attach/detach a driver enum to a driver-role user.
//     set_disabled     — toggle profile.disabled + ban/unban at the auth layer.
//     set_password     — set/rotate password (optionally explicit, otherwise auto-generate).
//     send_reset_link  — שולח לאדם קישור אישי בוואטסאפ, והוא בוחר סיסמה בעצמו.
//     set_phone        — מספר הטלפון שאליו יישלח קישור האיפוס.
//
// Caller must be an admin (profile.role = 'admin', not disabled).
// Uses service_role to make admin API calls (bypasses RLS).

// Strip trailing junk from env values: real whitespace AND a literal `\n`
// (backslash + n, char codes 92,110) that got baked into the Vercel env var.
// Left in, it corrupts the apikey header → GoTrue "Invalid API key" → getUser
// fails → requireAdmin returns 401.
const cleanEnv = (s?: string): string | undefined => s?.replace(/(?:\\n|\s)+$/g, '');
const SUPABASE_URL = cleanEnv(process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL);
const SUPABASE_ANON = cleanEnv(process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY);

const USERNAME_DOMAIN = 'rashal.internal';
// 3-30 chars: Latin letters, Hebrew letters (א-ת incl. finals), digits, . _ - .
const USERNAME_PATTERN = /^[a-zA-Z0-9._א-ת-]{3,30}$/u;

type AllowedRole = 'admin' | 'team_manager' | 'dispatcher' | 'driver' | 'viewer';
const ALLOWED_ROLES: AllowedRole[] = ['admin', 'team_manager', 'dispatcher', 'driver', 'viewer'];

// 🔴 **הרשימה הקבועה של השמות נמחקה ב-23/08/2026.** היא הייתה עותק שלישי
// של אותה רשימה (טיפוס במסד + src/types/route.ts + כאן), ושכחה לעדכן
// אחד מהם הייתה שולחת "invalid driver" על עובד שקיים. מקור האמת היחיד
// הוא טבלת `assignees`, והשיוך נבדק מולה בזמן אמת.
type DriverName = string;

async function isKnownAssignee(name: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('assignees')
    .select('name')
    .eq('name', name)
    .maybeSingle();
  return !!data;
}

interface AdminAction {
  action:
    | 'create'
    | 'delete'
    | 'set_role'
    | 'set_username'
    | 'set_linked_driver'
    | 'set_disabled'
    | 'set_password'
    | 'send_reset_link'
    | 'set_phone';
  username?: string;
  password?: string;
  fullName?: string;
  role?: AllowedRole;
  linkedDriver?: DriverName | null;
  userId?: string;
  disabled?: boolean;
  phoneE164?: string | null;
}

/** תוקף הקישור. רבע שעה מספיק כדי לפתוח הודעה, וקצר מכדי להישכח פתוח. */
const RESET_TTL_MINUTES = 15;
/**
 * המפתח במרשם התבניות (`wa_templates`), לא מזהה התבנית עצמו.
 * 🔴 חייב להסכים עם `keyFor()` ב-`_lib/templates-sync.ts`, שגוזר את המפתח
 *    משם התבנית ב-heyy. שם התבנית שם: `rashal_password_reset`.
 */
const RESET_TEMPLATE_KEY = 'rashal_password_reset';

/**
 * 🔴🔴 **התבנית הזאת נשלפת ישירות ולא דרך `getTemplate`, בכוונה.**
 * `getTemplate` מסנן `active = true`, ו-`active` פירושו "מוצעת לצוות
 * בחלונית" — החלטת תצוגה, לא החלטת הרשאה. תבנית חדשה נכנסת מהסנכרון
 * **כבויה**, ולכן שימוש בשער ההוא היה גורם לכך שכפתור האיפוס נשבר בשקט
 * עד שמישהו ידליק מתג שנועד למשהו אחר לגמרי.
 * מה שכן נבדק הוא שמטא אישרה אותה: תבנית שאינה `active` אצל heyy תיבלע.
 */
async function getResetTemplate(): Promise<{ id: string; status: string | null } | null> {
  const { data } = await supabaseAdmin
    .from('wa_templates')
    .select('heyy_template_id, heyy_status')
    .eq('key', RESET_TEMPLATE_KEY)
    .maybeSingle();
  return data ? { id: data.heyy_template_id as string, status: (data.heyy_status as string) ?? null } : null;
}

/** למסך המנהל: אישור שההודעה יצאה למספר הנכון, בלי להציג אותו במלואו. */
function maskPhone(p: string): string {
  return p.length <= 4 ? p : `${p.slice(0, 5)}****${p.slice(-2)}`;
}

function generateTempPassword(): string {
  // 10 chars, no easily-confused glyphs (0/O, 1/I/l). Mixed case + digit + symbol.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let out = '';
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// MUST stay identical to normalizeUsername in src/lib/username.ts.
function normalizeUsername(raw: string): string {
  return raw.trim().normalize('NFC').toLowerCase();
}

const ASCII_HANDLE = /^[a-zA-Z0-9._-]+$/;

/**
 * Map a (normalized) handle to a synthetic ASCII email.
 * GoTrue rejects non-ASCII email local parts, so Hebrew handles are hashed.
 * MUST stay byte-for-byte identical to usernameToEmail in src/lib/username.ts.
 */
function usernameToEmail(username: string): string {
  if (ASCII_HANDLE.test(username)) return `${username}@${USERNAME_DOMAIN}`;
  const hex = createHash('sha256').update(username, 'utf8').digest('hex').slice(0, 40);
  return `u${hex}@${USERNAME_DOMAIN}`;
}

function validateUsername(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof raw !== 'string' || !raw.trim()) return { ok: false, error: 'missing username' };
  const norm = normalizeUsername(raw);
  if (!USERNAME_PATTERN.test(norm)) {
    return {
      ok: false,
      error: 'username must be 3-30 chars: Hebrew/Latin letters, digits, . _ -',
    };
  }
  return { ok: true, value: norm };
}

async function requireUserManager(
  req: VercelRequest,
): Promise<{ userId: string; role: string } | { error: string; status: number }> {
  const auth = req.headers.authorization ?? req.headers.Authorization;
  const token = typeof auth === 'string' && auth.startsWith('Bearer ')
    ? auth.slice('Bearer '.length).trim()
    : null;
  if (!token) return { error: 'missing Bearer token', status: 401 };

  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return { error: 'server misconfigured: missing SUPABASE_URL or SUPABASE_ANON_KEY', status: 500 };
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return { error: 'invalid token', status: 401 };

  const { data: profile, error: profErr } = await supabaseAdmin
    .from('profiles')
    .select('role, disabled')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (profErr || !profile) return { error: 'profile not found', status: 403 };
  if (profile.disabled) return { error: 'user disabled', status: 403 };

  // ההכרעה עצמה יושבת ב-`_lib/user-admin-policy.ts`, שם יש עליה בדיקות.
  return { userId: userData.user.id, role: profile.role as string };
}

/** Returns true if any other profile already owns the given username (case-insensitive). */
async function usernameTaken(username: string, excludeUserId?: string): Promise<boolean> {
  let q = supabaseAdmin
    .from('profiles')
    .select('id')
    .ilike('username', username)
    .limit(1);
  if (excludeUserId) q = q.neq('id', excludeUserId);
  const { data } = await q;
  return !!(data && data.length > 0);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const guard = await requireUserManager(req);
  if ('error' in guard) return res.status(guard.status).json({ ok: false, error: guard.error });

  const body = req.body as AdminAction;
  if (!body?.action) return res.status(400).json({ ok: false, error: 'missing action' });

  // 🔴 **התפקיד של היעד נקרא מהמסד ולא מהבקשה.** לקוח יכול להצהיר כל
  // דבר, וההגנה "אסור לגעת במנהל מערכת" הייתה נופלת על הצהרה שקרית.
  let targetRole: string | null = null;
  if (body.userId) {
    const { data: target } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', body.userId)
      .maybeSingle();
    targetRole = (target?.role as string) ?? null;
  }

  const policy = checkUserAdminPolicy({
    callerRole: guard.role,
    callerId: guard.userId,
    action: body.action,
    targetId: body.userId ?? null,
    targetRole,
    newRole: body.role ?? null,
  });
  if (!policy.ok) return res.status(policy.status).json({ ok: false, error: policy.error });

  try {
    switch (body.action) {
      case 'create': {
        const v = validateUsername(body.username);
        if ('error' in v) return res.status(400).json({ ok: false, error: v.error });
        const username = v.value;
        if (await usernameTaken(username)) {
          return res.status(409).json({ ok: false, error: `שם המשתמש ${username} כבר תפוס` });
        }
        const role = body.role && ALLOWED_ROLES.includes(body.role) ? body.role : 'viewer';
        const linkedDriver =
          role === 'driver' && body.linkedDriver && (await isKnownAssignee(body.linkedDriver))
            ? body.linkedDriver
            : null;
        const password = body.password?.trim() ? body.password.trim() : generateTempPassword();
        if (password.length < 6) {
          return res.status(400).json({ ok: false, error: 'password must be at least 6 chars' });
        }
        const email = usernameToEmail(username);
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true, // skip the email-verification flow entirely
          user_metadata: {
            full_name: body.fullName ?? null,
            role,
            username,
          },
        });
        if (error) return res.status(400).json({ ok: false, error: error.message });
        if (data.user?.id) {
          await supabaseAdmin
            .from('profiles')
            .upsert(
              {
                id: data.user.id,
                email,
                username,
                full_name: body.fullName ?? null,
                role,
                linked_driver: linkedDriver,
              },
              { onConflict: 'id' }
            );
        }
        return res.status(200).json({
          ok: true,
          userId: data.user?.id,
          username,
          password,
        });
      }

      case 'set_username': {
        if (!body.userId) return res.status(400).json({ ok: false, error: 'missing userId' });
        const v = validateUsername(body.username);
        if ('error' in v) return res.status(400).json({ ok: false, error: v.error });
        const username = v.value;
        if (await usernameTaken(username, body.userId)) {
          return res.status(409).json({ ok: false, error: `שם המשתמש ${username} כבר תפוס` });
        }
        // Look up the target user to decide if we should rewrite the auth email too.
        const { data: target } = await supabaseAdmin
          .from('profiles')
          .select('email')
          .eq('id', body.userId)
          .maybeSingle();
        const currentEmail = target?.email ?? '';
        // Only rewrite the auth email when the user is on the synthetic domain.
        // Real-email accounts (e.g. the seed admin) keep their original email so they
        // can still log in with it.
        const newEmail = currentEmail.endsWith(`@${USERNAME_DOMAIN}`)
          ? usernameToEmail(username)
          : null;
        if (newEmail) {
          const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(body.userId, {
            email: newEmail,
            email_confirm: true,
            user_metadata: { username },
          });
          if (authErr) return res.status(400).json({ ok: false, error: authErr.message });
        } else {
          await supabaseAdmin.auth.admin.updateUserById(body.userId, {
            user_metadata: { username },
          });
        }
        const { error } = await supabaseAdmin
          .from('profiles')
          .update({
            username,
            ...(newEmail ? { email: newEmail } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq('id', body.userId);
        if (error) return res.status(400).json({ ok: false, error: error.message });
        return res.status(200).json({ ok: true, userId: body.userId, username });
      }

      case 'set_linked_driver': {
        if (!body.userId) return res.status(400).json({ ok: false, error: 'missing userId' });
        const driver =
          body.linkedDriver && (await isKnownAssignee(body.linkedDriver)) ? body.linkedDriver : null;
        const { error } = await supabaseAdmin
          .from('profiles')
          .update({ linked_driver: driver, updated_at: new Date().toISOString() })
          .eq('id', body.userId);
        if (error) return res.status(400).json({ ok: false, error: error.message });
        return res.status(200).json({ ok: true });
      }

      case 'delete': {
        if (!body.userId) return res.status(400).json({ ok: false, error: 'missing userId' });
        if (body.userId === guard.userId) return res.status(400).json({ ok: false, error: 'cannot delete yourself' });
        const { error } = await supabaseAdmin.auth.admin.deleteUser(body.userId);
        if (error) return res.status(400).json({ ok: false, error: error.message });
        await supabaseAdmin.from('profiles').delete().eq('id', body.userId);
        return res.status(200).json({ ok: true });
      }

      case 'set_role': {
        if (!body.userId || !body.role) return res.status(400).json({ ok: false, error: 'missing userId or role' });
        if (!ALLOWED_ROLES.includes(body.role)) return res.status(400).json({ ok: false, error: 'invalid role' });
        if (body.userId === guard.userId && body.role !== 'admin')
          return res.status(400).json({ ok: false, error: 'cannot demote yourself' });
        const { error } = await supabaseAdmin
          .from('profiles')
          .update({ role: body.role, updated_at: new Date().toISOString() })
          .eq('id', body.userId);
        if (error) return res.status(400).json({ ok: false, error: error.message });
        return res.status(200).json({ ok: true });
      }

      case 'set_disabled': {
        if (!body.userId || typeof body.disabled !== 'boolean')
          return res.status(400).json({ ok: false, error: 'missing userId or disabled' });
        if (body.userId === guard.userId && body.disabled === true)
          return res.status(400).json({ ok: false, error: 'cannot disable yourself' });
        const { error } = await supabaseAdmin
          .from('profiles')
          .update({ disabled: body.disabled, updated_at: new Date().toISOString() })
          .eq('id', body.userId);
        if (error) return res.status(400).json({ ok: false, error: error.message });
        await supabaseAdmin.auth.admin.updateUserById(body.userId, {
          ban_duration: body.disabled ? '876000h' : 'none',
        });
        return res.status(200).json({ ok: true });
      }

      case 'set_password': {
        if (!body.userId) return res.status(400).json({ ok: false, error: 'missing userId' });
        const password = body.password?.trim() ? body.password.trim() : generateTempPassword();
        if (password.length < 6) {
          return res.status(400).json({ ok: false, error: 'password must be at least 6 chars' });
        }
        const { error } = await supabaseAdmin.auth.admin.updateUserById(body.userId, { password });
        if (error) return res.status(400).json({ ok: false, error: error.message });
        return res.status(200).json({ ok: true, password });
      }


      /**
       * ⭐ **שליחת קישור איפוס אישי, נוסף על `set_password` ולא במקומו.**
       * ב-`set_password` המנהל רואה סיסמה על המסך ומקריא אותה; כאן הוא לא
       * רואה שום סיסמה, והאדם בוחר אותה בעצמו במסך `/reset/<אסימון>`.
       *
       * 🔴 **המספר נלקח מהכרטיס במסד ולעולם לא מהבקשה.** מספר שמגיע
       * מהדפדפן פירושו שמי שמחזיק טוקן של מנהל צוות יכול להפנות איפוס
       * של חשבון כלשהו למכשיר שלו עצמו. זו הנקודה שבה המנגנון כולו
       * נשבר או מחזיק, ולכן היא לא ניתנת להעברה בפרמטר.
       *
       * 🔴 **האסימון הגולמי לא נשמר.** במסד יושבת רק טביעת `sha256` שלו,
       * כך שדליפת הטבלה אינה דליפת מפתחות. הערך עצמו חי בהודעה ובכתובת.
       */
      /**
       * 🔴 **המספר הזה מכריע לאן הולך קישור האיפוס**, ולכן הוא נשמר רק
       * מכאן, בתפקיד השירות, אחרי בדיקת ההרשאה. הטריגר במסד חוסם שינוי
       * שלו מהדפדפן, כדי שאדם לא יפנה את האיפוס של עצמו למכשיר אחר.
       */
      case 'set_phone': {
        if (!body.userId) return res.status(400).json({ ok: false, error: 'missing userId' });
        const raw = (body.phoneE164 ?? '').toString().trim();
        let phone: string | null = null;
        if (raw) {
          const digits = raw.replace(/[^0-9+]/g, '');
          // 05X... ישראלי מקומי הופך ל-E.164. כל השאר חייב להגיע עם +.
          if (/^0[2-9][0-9]{7,8}$/.test(digits)) phone = `+972${digits.slice(1)}`;
          else if (/^\+[1-9][0-9]{7,14}$/.test(digits)) phone = digits;
          else return res.status(400).json({ ok: false, error: 'מספר לא תקין. לדוגמה: 0501234567' });
        }
        const { error } = await supabaseAdmin
          .from('profiles')
          .update({ phone_e164: phone, updated_at: new Date().toISOString() })
          .eq('id', body.userId);
        if (error) return res.status(400).json({ ok: false, error: error.message });
        return res.status(200).json({ ok: true, phoneE164: phone });
      }

      case 'send_reset_link': {
        if (!body.userId) return res.status(400).json({ ok: false, error: 'missing userId' });

        const { data: target } = await supabaseAdmin
          .from('profiles')
          .select('id, username, full_name, phone_e164, disabled')
          .eq('id', body.userId)
          .maybeSingle();
        if (!target) return res.status(404).json({ ok: false, error: 'המשתמש לא נמצא' });

        // חשבון מושבת לא מקבל דרך חזרה. מי שהושבת בכוונה לא אמור לאפס סיסמה.
        if (target.disabled) {
          return res.status(400).json({ ok: false, error: 'החשבון מושבת. יש להפעיל אותו לפני שליחת איפוס.' });
        }
        if (!target.phone_e164) {
          return res.status(400).json({
            ok: false,
            error: 'אין טלפון על כרטיס המשתמש. יש להוסיף מספר בעריכת המשתמש ואז לשלוח.',
          });
        }

        const template = await getResetTemplate();
        if (!template) {
          return res.status(503).json({
            ok: false,
            error: 'תבנית איפוס הסיסמה עדיין לא מסונכרנת מ-heyy. אפשר להשתמש בינתיים בכפתור המפתח.',
          });
        }
        // 🔴 תבנית שמטא עוד לא אישרה נבלעת אצלה בשקט ומחזירה הצלחה.
        if (template.status && template.status !== 'active') {
          return res.status(503).json({
            ok: false,
            error: `תבנית האיפוס אינה מאושרת (${template.status}). אפשר להשתמש בינתיים בכפתור המפתח.`,
          });
        }

        // 🔴 קישור פתוח קודם מת ברגע שנשלח חדש. אחרת נשארות בשטח כמה
        //    כתובות חיות לאותו חשבון, וכל אחת מהן מספיקה כדי להשתלט עליו.
        await supabaseAdmin
          .from('password_reset_tokens')
          .update({ expires_at: new Date().toISOString() })
          .eq('user_id', target.id)
          .is('used_at', null)
          .gt('expires_at', new Date().toISOString());

        const token = randomBytes(32).toString('base64url');
        const tokenHash = createHash('sha256').update(token).digest('hex');
        const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60_000).toISOString();

        const { data: row, error: insErr } = await supabaseAdmin
          .from('password_reset_tokens')
          .insert({
            user_id: target.id,
            token_hash: tokenHash,
            expires_at: expiresAt,
            created_by: guard.userId,
            sent_to_phone: target.phone_e164,
          })
          .select('id')
          .single();
        if (insErr) return res.status(500).json({ ok: false, error: insErr.message });

        const sent = await sendTemplate({
          phoneE164: target.phone_e164,
          templateId: template.id,
          variables: {
            name: (target.full_name || target.username || '').toString(),
            token,
          },
        });

        await supabaseAdmin
          .from('password_reset_tokens')
          .update({ send_ok: sent.ok, send_detail: sent.ok ? null : String(sent.detail ?? '').slice(0, 300) })
          .eq('id', row.id);

        // 🔴 שליחה שנכשלה משאירה אסימון חי שאיש לא קיבל. הוא נסגר מיד,
        //    אחרת הוא ממתין רבע שעה ככתובת תקפה שאין לה בעלים.
        if (!sent.ok) {
          await supabaseAdmin
            .from('password_reset_tokens')
            .update({ expires_at: new Date().toISOString() })
            .eq('id', row.id);
          return res.status(502).json({
            ok: false,
            error: `ההודעה לא יצאה: ${sent.detail ?? 'שגיאה לא ידועה'}`,
          });
        }

        return res.status(200).json({
          ok: true,
          sentTo: maskPhone(target.phone_e164),
          expiresInMinutes: RESET_TTL_MINUTES,
        });
      }

      default:
        return res.status(400).json({ ok: false, error: `unknown action: ${body.action}` });
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'unknown error' });
  }
}
