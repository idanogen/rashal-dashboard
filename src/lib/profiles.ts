import { supabase } from './supabase';
import type { Profile, UserRole } from '@/types/profile';
import type { DriverName } from '@/types/route';

type ProfileRow = {
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  role: string;
  disabled: boolean;
  linked_driver: DriverName | null;
  created_at: string;
  updated_at: string | null;
};

function rowToProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    email: row.email,
    username: row.username ?? undefined,
    fullName: row.full_name ?? undefined,
    role: (row.role as UserRole) ?? 'viewer',
    disabled: row.disabled,
    linkedDriver: row.linked_driver ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  };
}

export async function fetchAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw new Error(`fetchAllProfiles: ${error.message}`);
  return (data as ProfileRow[] | null ?? []).map(rowToProfile);
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(`fetchProfile: ${error.message}`);
  return data ? rowToProfile(data as ProfileRow) : null;
}

export async function updateOwnProfile(
  userId: string,
  fields: { fullName?: string }
): Promise<Profile> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('fullName' in fields) row.full_name = fields.fullName ?? null;
  const { data, error } = await supabase
    .from('profiles')
    .update(row)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw new Error(`updateOwnProfile: ${error.message}`);
  return rowToProfile(data as ProfileRow);
}

// ─── Admin API client (POSTs to /api/admin-users with the user's JWT) ───

export type AdminAction =
  | {
      action: 'create';
      username: string;
      password?: string;
      fullName?: string;
      role: UserRole;
      linkedDriver?: DriverName;
    }
  | { action: 'delete'; userId: string }
  | { action: 'set_role'; userId: string; role: UserRole }
  | { action: 'set_username'; userId: string; username: string }
  | { action: 'set_linked_driver'; userId: string; linkedDriver: DriverName | null }
  | { action: 'set_disabled'; userId: string; disabled: boolean }
  | { action: 'set_password'; userId: string; password?: string };

export interface AdminResponse {
  ok: boolean;
  error?: string;
  userId?: string;
  username?: string;
  /** Returned by `create` and `set_password` — caller shows this once. */
  password?: string;
}

export async function callAdminApi(payload: AdminAction): Promise<AdminResponse> {
  const session = (await supabase.auth.getSession()).data.session;
  const token = session?.access_token;
  if (!token) throw new Error('לא מחובר');

  const res = await fetch('/api/admin-users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => ({}))) as AdminResponse;
  if (!res.ok || !json.ok) {
    throw new Error(json.error ?? `שגיאה: HTTP ${res.status}`);
  }
  return json;
}
