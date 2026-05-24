/**
 * Browser-side data access for whatsapp_inbound / whatsapp_outbound.
 *
 * Uses the same supabase client (anon key + RLS) as the rest of the app.
 * Writes from the dashboard (manual notes, marking processed) go through here.
 * Actual heyy send goes through /api/heyy-send (see client.ts).
 */

import { supabase } from '@/lib/supabase';
import type {
  CustomerReplyStatus,
  WhatsAppInbound,
  WhatsAppInboundStatus,
  WhatsAppOutbound,
} from './types';

interface InboundRow {
  id: string;
  provider_message_id: string | null;
  phone_e164: string;
  phone_local: string | null;
  body_text: string | null;
  raw_payload: unknown;
  status: WhatsAppInboundStatus;
  order_id: string | null;
  parsed_reply_status: CustomerReplyStatus | null;
  notes: string | null;
  is_demo: boolean;
  received_at: string;
  processed_at: string | null;
  created_at: string;
}

interface OutboundRow {
  id: string;
  wa_message_id: string | null;
  phone_e164: string;
  message_kind: 'text' | 'template';
  template_id: string | null;
  template_params: unknown;
  body_text: string | null;
  reminder_kind: WhatsAppOutbound['reminderKind'] | null;
  status: WhatsAppOutbound['status'];
  status_detail: string | null;
  order_id: string | null;
  triggered_by: string | null;
  is_demo: boolean;
  sent_at: string;
  delivered_at: string | null;
  created_at: string;
}

function inboundFromRow(r: InboundRow): WhatsAppInbound {
  return {
    id: r.id,
    providerMessageId: r.provider_message_id ?? undefined,
    phoneE164: r.phone_e164,
    phoneLocal: r.phone_local ?? undefined,
    bodyText: r.body_text ?? undefined,
    rawPayload: r.raw_payload,
    status: r.status,
    orderId: r.order_id ?? undefined,
    parsedReplyStatus: r.parsed_reply_status ?? undefined,
    notes: r.notes ?? undefined,
    isDemo: r.is_demo,
    receivedAt: r.received_at,
    processedAt: r.processed_at ?? undefined,
    createdAt: r.created_at,
  };
}

function outboundFromRow(r: OutboundRow): WhatsAppOutbound {
  return {
    id: r.id,
    waMessageId: r.wa_message_id ?? undefined,
    phoneE164: r.phone_e164,
    messageKind: r.message_kind,
    templateId: r.template_id ?? undefined,
    templateParams: Array.isArray(r.template_params) ? (r.template_params as string[]) : undefined,
    bodyText: r.body_text ?? undefined,
    reminderKind: r.reminder_kind ?? undefined,
    status: r.status,
    statusDetail: r.status_detail ?? undefined,
    orderId: r.order_id ?? undefined,
    triggeredBy: r.triggered_by ?? undefined,
    isDemo: r.is_demo,
    sentAt: r.sent_at,
    deliveredAt: r.delivered_at ?? undefined,
    createdAt: r.created_at,
  };
}

export async function fetchInbound(limit = 200): Promise<WhatsAppInbound[]> {
  const { data, error } = await supabase
    .from('whatsapp_inbound')
    .select('*')
    .order('received_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`fetchInbound: ${error.message}`);
  return (data as InboundRow[] | null ?? []).map(inboundFromRow);
}

export async function fetchOutbound(limit = 200): Promise<WhatsAppOutbound[]> {
  const { data, error } = await supabase
    .from('whatsapp_outbound')
    .select('*')
    .order('sent_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`fetchOutbound: ${error.message}`);
  return (data as OutboundRow[] | null ?? []).map(outboundFromRow);
}

export async function fetchOutboundForOrder(orderId: string): Promise<WhatsAppOutbound[]> {
  const { data, error } = await supabase
    .from('whatsapp_outbound')
    .select('*')
    .eq('order_id', orderId)
    .order('sent_at', { ascending: false });
  if (error) throw new Error(`fetchOutboundForOrder: ${error.message}`);
  return (data as OutboundRow[] | null ?? []).map(outboundFromRow);
}

export async function markInboundProcessed(id: string, notes?: string): Promise<void> {
  const { error } = await supabase
    .from('whatsapp_inbound')
    .update({
      status: 'processed',
      processed_at: new Date().toISOString(),
      ...(notes ? { notes } : {}),
    })
    .eq('id', id);
  if (error) throw new Error(`markInboundProcessed: ${error.message}`);
}

/**
 * Simulate an inbound message in demo mode by POSTing to our own /api/heyy-webhook
 * with the same payload shape heyy would send. This exercises the real webhook
 * code path — parse reply, match to order, update orders.customer_reply_status.
 */
export async function simulateInbound(input: {
  phoneE164: string;
  bodyText: string;
}): Promise<{ ok: boolean; inboundId?: string; matchedOrderId?: string | null }> {
  const payload = {
    event: 'message.received',
    data: {
      id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sender: 'inbound',
      content: { body: input.bodyText },
      contact: { phoneNumber: input.phoneE164 },
      handle: { value: input.phoneE164 },
    },
    _demo: true,
  };
  const res = await fetch('/api/heyy-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; inboundId?: string; matchedOrderId?: string | null };
  return { ok: json.ok === true, inboundId: json.inboundId, matchedOrderId: json.matchedOrderId };
}

/** Check whether a reminder of this kind was sent for this order in the cooldown window. */
export async function wasRecentlyReminded(
  orderId: string,
  reminderKind: string,
  cooldownHours = 48
): Promise<boolean> {
  const cutoff = new Date(Date.now() - cooldownHours * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('whatsapp_reminder_log')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', orderId)
    .eq('reminder_kind', reminderKind)
    .gte('sent_at', cutoff);
  if (error) throw new Error(`wasRecentlyReminded: ${error.message}`);
  return (count ?? 0) > 0;
}
