import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from './_lib/supabase-admin.js';

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

type AllowedRole = 'admin' | 'dispatcher' | 'driver' | 'viewer';
const ALLOWED_ROLES: AllowedRole[] = ['admin', 'dispatcher', 'driver', 'viewer'];

// Any value of the `driver_name` enum may be linked to a user. The enum holds
// both delivery drivers and service technicians (a user with role='driver' gets
// the field dashboard, and RLS filters their stops by the linked assignee).
// MUST stay in sync with the driver_name enum in the DB and AssigneeName in src/types/route.ts.
type DriverName = 'רודי' | 'מוחמד' | 'דוד' | 'מוהנד' | 'אולג' | 'ישראל' | 'אבי';
const ALLOWED_DRIVERS: DriverName[] = ['רודי', 'מוחמד', 'דוד', 'מוהנד', 'אולג', 'ישראל', 'אבי'];

interface AdminAction {
  action:
    | 'create'
    | 'delete'
    | 'set_role'
    | 'set_username'
    | 'set_linked_driver'
    | 'set_disabled'
    | 'set_password';
  username?: string;
  password?: string;
  fullName?: string;
  role?: AllowedRole;
  linkedDriver?: DriverName | null;
  userId?: string;
  disabled?: boolean;
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

async function requireAdmin(req: VercelRequest): Promise<{ userId: string } | { error: string; status: number }> {
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
  if (profile.role !== 'admin') return { error: 'caller is not admin', status: 403 };

  return { userId: userData.user.id };
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

  const guard = await requireAdmin(req);
  if ('error' in guard) return res.status(guard.status).json({ ok: false, error: guard.error });

  const body = req.body as AdminAction;
  if (!body?.action) return res.status(400).json({ ok: false, error: 'missing action' });

  try {
    switch (body.action) {
      case 'create': {
        const v = validateUsername(body.username);
        if (!v.ok) return res.status(400).json({ ok: false, error: v.error });
        const username = v.value;
        if (await usernameTaken(username)) {
          return res.status(409).json({ ok: false, error: `שם המשתמש ${username} כבר תפוס` });
        }
        const role = body.role && ALLOWED_ROLES.includes(body.role) ? body.role : 'viewer';
        const linkedDriver = role === 'driver' && body.linkedDriver && ALLOWED_DRIVERS.includes(body.linkedDriver)
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
        if (!v.ok) return res.status(400).json({ ok: false, error: v.error });
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
        const driver = body.linkedDriver && ALLOWED_DRIVERS.includes(body.linkedDriver) ? body.linkedDriver : null;
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

      default:
        return res.status(400).json({ ok: false, error: `unknown action: ${body.action}` });
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'unknown error' });
  }
}
