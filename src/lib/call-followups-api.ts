import { supabase } from './supabase';
import {
  rowToFollowup,
  type CallFollowup,
  type CallFollowupRow,
  type FollowupDesk,
  type FollowupKind,
  type FollowupUrgency,
} from './call-followups';

/**
 * הכרעות על ביקורים שחזרו ורכש חלקים (15/11/2026). כל מה שלא נסגר, וסגורות
 * מ-14 הימים האחרונים לציר "הגיעו". RLS: צוות המשרד. בלי כתיבה לפריוריטי.
 */
export async function fetchCallFollowups(): Promise<CallFollowup[]> {
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('call_followups')
    .select('*')
    .or(`status.neq.closed,updated_at.gte.${since}`)
    .order('decided_at', { ascending: false })
    .range(0, 999);
  if (error) throw new Error(`call_followups: ${error.message}`);
  return ((data ?? []) as CallFollowupRow[]).map(rowToFollowup);
}

export interface FollowupDeskRow { desk: FollowupDesk; label: string; profileId: string | null }

export async function fetchFollowupDesks(): Promise<FollowupDeskRow[]> {
  const { data, error } = await supabase.from('call_followup_desks').select('desk,label,profile_id');
  if (error) throw new Error(`call_followup_desks: ${error.message}`);
  return ((data ?? []) as Array<{ desk: FollowupDesk; label: string; profile_id: string | null }>).map((r) => ({
    desk: r.desk, label: r.label, profileId: r.profile_id ?? null,
  }));
}

export interface DecisionInput {
  stopId: string;
  kind: FollowupKind;
  item?: string | null;
  urgency?: FollowupUrgency;
  note?: string | null;
}

/**
 * הכרעה על ביקור שחזר. שורה אחת לביקור: הכרעה מחדש מעדכנת אותה, והטריגר
 * במסד פותח את הבקשה מההתחלה כשהסוג השתנה. פרטי הקריאה נצרבים בשרת.
 */
export async function decideFollowup(input: DecisionInput, me: { id: string; name: string }): Promise<CallFollowup> {
  const fields = {
    kind: input.kind,
    item: input.item?.trim() || null,
    urgency: input.urgency ?? 'normal',
    note: input.note?.trim() || null,
  };
  const { data: existing, error: readErr } = await supabase
    .from('call_followups')
    .select('id,kind')
    .eq('stop_id', input.stopId)
    .maybeSingle();
  if (readErr) throw new Error(`call_followups read: ${readErr.message}`);

  if (existing) {
    // אותו סוג אחרי "לא ניתן להשיג" = ניסיון נוסף: חוזרים ל"לא הוזמן".
    const reopen = existing.kind === input.kind ? { status: 'open', unavailable_note: null, unavailable_at: null, unavailable_by_name: null } : {};
    const { data, error } = await supabase
      .from('call_followups')
      .update({ ...fields, ...reopen, decided_by: me.id, decided_by_name: me.name, decided_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw new Error(`call_followups update: ${error.message}`);
    return rowToFollowup(data as CallFollowupRow);
  }
  const { data, error } = await supabase
    .from('call_followups')
    .insert({ stop_id: input.stopId, ...fields, decided_by: me.id, decided_by_name: me.name })
    .select()
    .single();
  if (error) throw new Error(`call_followups insert: ${error.message}`);
  return rowToFollowup(data as CallFollowupRow);
}

export type PartsAction =
  | { type: 'ordered'; eta: string | null; poNumber: string | null }
  | { type: 'eta'; eta: string | null }
  | { type: 'arrived' }
  | { type: 'unavailable'; note: string };

/** הפעולות של אלכס על בקשה. מחזיר את השורה המעודכנת או זורק שגיאה בעברית. */
export async function applyPartsAction(id: string, action: PartsAction, me: { name: string }): Promise<CallFollowup> {
  const now = new Date().toISOString();
  let patch: Record<string, unknown>;
  if (action.type === 'ordered') {
    patch = { status: 'ordered', eta: action.eta || null, po_number: action.poNumber?.trim() || null, ordered_at: now, ordered_by_name: me.name };
  } else if (action.type === 'eta') {
    patch = { eta: action.eta || null };
  } else if (action.type === 'arrived') {
    patch = { status: 'arrived', arrived_at: now, arrived_by_name: me.name };
  } else {
    if (!action.note.trim()) throw new Error('צריך לכתוב למה אי אפשר להשיג');
    patch = { status: 'unavailable', unavailable_note: action.note.trim(), unavailable_at: now, unavailable_by_name: me.name };
  }
  const { data, error } = await supabase.from('call_followups').update(patch).eq('id', id).select().single();
  if (error) throw new Error(`call_followups: ${error.message}`);
  return rowToFollowup(data as CallFollowupRow);
}
