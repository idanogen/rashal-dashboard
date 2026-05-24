import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from './_lib/supabase-admin.js';

// Admin user-management endpoint. Single POST endpoint with `action` switch.
//
//   POST /api/admin-users
//   Header: Authorization: Bearer <user JWT>     ← supabase access token
//   Body: { action, ...payload }
//
//   actions:
//     invite           — create user with temp password + send invite email
//     create           — create user with given password (no email)
//     delete           — hard-delete user + profile
//     set_role         — update profile.role
//     set_disabled     — toggle profile.disabled
//     reset_password   — generate new temp password
//
// Caller must be an admin (profile.role = 'admin', not disabled).
// Uses service_role to make admin API calls (bypasses RLS).

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

type AllowedRole = 'admin' | 'dispatcher' | 'driver' | 'viewer';
const ALLOWED_ROLES: AllowedRole[] = ['admin', 'dispatcher', 'driver', 'viewer'];

type DriverName = 'רודי דויד' | 'נהג חיצוני מועלם';
const ALLOWED_DRIVERS: DriverName[] = ['רודי דויד', 'נהג חיצוני מועלם'];

interface AdminAction {
  action: 'invite' | 'create' | 'delete' | 'set_role' | 'set_disabled' | 'reset_password' | 'set_linked_driver';
  email?: string;
  password?: string;
  fullName?: string;
  role?: AllowedRole;
  linkedDriver?: DriverName | null;
  userId?: string;
  disabled?: boolean;
  redirectTo?: string;
}

function generateTempPassword(): string {
  // 12 chars, mixed
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let out = '';
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
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

  // Verify token by asking supabase who it belongs to
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return { error: 'invalid token', status: 401 };

  // Check profile.role via service role (skip RLS)
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const guard = await requireAdmin(req);
  if ('error' in guard) return res.status(guard.status).json({ ok: false, error: guard.error });

  const body = req.body as AdminAction;
  if (!body?.action) return res.status(400).json({ ok: false, error: 'missing action' });

  try {
    switch (body.action) {
      case 'invite': {
        if (!body.email) return res.status(400).json({ ok: false, error: 'missing email' });
        const role = body.role && ALLOWED_ROLES.includes(body.role) ? body.role : 'viewer';
        const linkedDriver = role === 'driver' && body.linkedDriver && ALLOWED_DRIVERS.includes(body.linkedDriver)
          ? body.linkedDriver : null;
        const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(body.email, {
          data: { full_name: body.fullName ?? null, role },
          redirectTo: body.redirectTo,
        });
        if (error) return res.status(400).json({ ok: false, error: error.message });
        if (data.user?.id) {
          await supabaseAdmin
            .from('profiles')
            .upsert(
              { id: data.user.id, email: body.email, full_name: body.fullName ?? null, role, linked_driver: linkedDriver },
              { onConflict: 'id' }
            );
        }
        return res.status(200).json({ ok: true, userId: data.user?.id, email: body.email });
      }

      case 'create': {
        if (!body.email) return res.status(400).json({ ok: false, error: 'missing email' });
        const role = body.role && ALLOWED_ROLES.includes(body.role) ? body.role : 'viewer';
        const linkedDriver = role === 'driver' && body.linkedDriver && ALLOWED_DRIVERS.includes(body.linkedDriver)
          ? body.linkedDriver : null;
        const password = body.password || generateTempPassword();
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email: body.email,
          password,
          email_confirm: true,
          user_metadata: { full_name: body.fullName ?? null, role },
        });
        if (error) return res.status(400).json({ ok: false, error: error.message });
        if (data.user?.id) {
          await supabaseAdmin
            .from('profiles')
            .upsert(
              { id: data.user.id, email: body.email, full_name: body.fullName ?? null, role, linked_driver: linkedDriver },
              { onConflict: 'id' }
            );
        }
        return res.status(200).json({
          ok: true,
          userId: data.user?.id,
          email: body.email,
          tempPassword: password,
        });
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
        // profile row will cascade-delete via FK on auth.users
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
        // Also ban/unban at the auth layer to block login immediately
        await supabaseAdmin.auth.admin.updateUserById(body.userId, {
          ban_duration: body.disabled ? '876000h' : 'none', // ~100 years vs unban
        });
        return res.status(200).json({ ok: true });
      }

      case 'reset_password': {
        if (!body.userId) return res.status(400).json({ ok: false, error: 'missing userId' });
        const password = body.password || generateTempPassword();
        const { error } = await supabaseAdmin.auth.admin.updateUserById(body.userId, { password });
        if (error) return res.status(400).json({ ok: false, error: error.message });
        return res.status(200).json({ ok: true, tempPassword: password });
      }

      default:
        return res.status(400).json({ ok: false, error: `unknown action: ${body.action}` });
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'unknown error' });
  }
}
