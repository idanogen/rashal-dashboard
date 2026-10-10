import { supabase } from './supabase';
import { rowToMessage, type StaffMessage, type StaffMessageRow, type StaffPerson } from './staff-chat';

/** כל ההודעות שלי (נשלחו אליי או ממני). RLS מגביל לזה ממילא. 1,000 האחרונות. */
export async function fetchStaffMessages(): Promise<StaffMessage[]> {
  const { data, error } = await supabase
    .from('staff_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .range(0, 999);
  if (error) throw new Error(`staff_messages: ${error.message}`);
  return ((data ?? []) as StaffMessageRow[]).map(rowToMessage);
}

/** אנשי הצוות הפעילים: משרד ונהגים. `profiles` קריא לכל מחובר. */
export async function fetchStaffPeople(): Promise<StaffPerson[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, username, email, role, disabled, linked_driver')
    .eq('disabled', false)
    .order('full_name', { ascending: true });
  if (error) throw new Error(`profiles: ${error.message}`);
  return ((data ?? []) as Array<Record<string, unknown>>).map((p) => ({
    id: String(p.id),
    name: String((p.full_name as string)?.trim() || (p.linked_driver as string) || (p.username as string) || (p.email as string) || 'עובד'),
    role: String(p.role ?? ''),
    linkedDriver: (p.linked_driver as string) ?? null,
  }));
}

export async function sendStaffMessage(me: { id: string; name: string }, to: StaffPerson, body: string): Promise<StaffMessage> {
  const { data, error } = await supabase
    .from('staff_messages')
    .insert({ sender_id: me.id, sender_name: me.name, recipient_id: to.id, recipient_name: to.name, body: body.trim() })
    .select()
    .single();
  if (error) throw new Error(`staff_messages insert: ${error.message}`);
  return rowToMessage(data as StaffMessageRow);
}

export async function markStaffRead(peerId: string): Promise<number> {
  const { data, error } = await supabase.rpc('staff_mark_read', { p_peer: peerId });
  if (error) throw new Error(`staff_mark_read: ${error.message}`);
  return Number(data ?? 0);
}

// ─── סדר ונעיצה לכל עובד (09/10/2026) ───────────────────────────────────
export interface StaffPrefsRow { pinned: string[] | null; sort_order: string[] | null }

export async function fetchStaffPrefs(userId: string): Promise<{ pinned: string[]; sortOrder: string[] }> {
  const { data, error } = await supabase.from('staff_chat_prefs').select('pinned, sort_order').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(`staff_chat_prefs: ${error.message}`);
  const r = (data ?? null) as StaffPrefsRow | null;
  return { pinned: r?.pinned ?? [], sortOrder: r?.sort_order ?? [] };
}

export async function saveStaffPrefs(userId: string, prefs: { pinned: string[]; sortOrder: string[] }): Promise<void> {
  const { error } = await supabase
    .from('staff_chat_prefs')
    .upsert({ user_id: userId, pinned: prefs.pinned, sort_order: prefs.sortOrder, updated_at: new Date().toISOString() });
  if (error) throw new Error(`staff_chat_prefs upsert: ${error.message}`);
}
