import { supabase } from './supabase';

/** סוגי פעולות שנמדדות. מחרוזת חופשית — אלה הנפוצות. */
export type ActivityAction =
  | 'stop_completed'
  | 'stop_not_completed'
  | 'navigate'
  | 'call'
  | 'coordinate_open'
  | 'chat_open'
  | 'login'
  | (string & {});

export interface ActivityInput {
  action: ActivityAction;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  entityType?: 'calendar_stop' | 'order' | 'service_call' | 'route';
  entityId?: string;
  sourceType?: 'delivery' | 'service' | 'task';
  customerName?: string;
  metadata?: Record<string, unknown>;
}

/**
 * רישום פעולה ללוג (fire-and-forget). **לעולם לא זורק** — מדידת עבודה
 * אסור שתשבור חוויית משתמש. נכשל בשקט עם warning בלבד.
 */
export async function logActivity(input: ActivityInput): Promise<void> {
  try {
    const { error } = await supabase.from('activity_events').insert({
      action: input.action,
      actor_id: input.actorId ?? null,
      actor_name: input.actorName ?? null,
      actor_role: input.actorRole ?? null,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      source_type: input.sourceType ?? null,
      customer_name: input.customerName ?? null,
      metadata: input.metadata ?? {},
    });
    if (error) console.warn('[activity] log failed:', error.message);
  } catch (err) {
    console.warn('[activity] log error:', err);
  }
}
