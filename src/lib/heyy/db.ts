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
import { normalizePhone } from './phone';
import { parseCustomerReply } from './extract';

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
 * Simulate an inbound message in demo mode. Does the SAME work the real
 * /api/heyy-webhook does — parse, match to order, update orders — but runs
 * client-side via the anon supabase client. This avoids needing `vercel dev`
 * for local demo work.
 *
 * In production with HEYY_MODE=real, the real heyy → /api/heyy-webhook path
 * is exercised; this function is only called from the DemoSimulator UI.
 */
export async function simulateInbound(input: {
  phoneE164: string;
  bodyText: string;
}): Promise<{ ok: boolean; inboundId?: string; matchedOrderId?: string | null }> {
  const phoneLocal = normalizePhone(input.phoneE164);

  // Match to a real order by phone (most-recent)
  let orderId: string | null = null;
  if (phoneLocal) {
    const { data: matchingOrders } = await supabase
      .from('orders')
      .select('id')
      .eq('phone', phoneLocal)
      .order('created_at', { ascending: false })
      .limit(1);
    orderId = matchingOrders?.[0]?.id ?? null;
  }

  // Deterministic parser (same as server)
  const parsed = parseCustomerReply(input.bodyText);

  const providerMessageId = `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const { data: inboundRow, error: insertErr } = await supabase
    .from('whatsapp_inbound')
    .insert({
      provider_message_id: providerMessageId,
      phone_e164: input.phoneE164,
      phone_local: phoneLocal,
      body_text: input.bodyText,
      raw_payload: { simulated: true, source: 'dashboard-demo' },
      status: 'received',
      order_id: orderId,
      parsed_reply_status: parsed.status,
      is_demo: true,
    })
    .select()
    .single();
  if (insertErr) throw new Error(`simulateInbound: ${insertErr.message}`);

  // If matched + parsed → update the order
  if (orderId && parsed.status) {
    const orderUpdate: Record<string, unknown> = { customer_reply_status: parsed.status };
    if (parsed.requestedTime) orderUpdate.customer_requested_time = parsed.requestedTime;
    await supabase.from('orders').update(orderUpdate).eq('id', orderId);

    // If there's a planned calendar_stops for this order, also mark it as customer-confirmed
    if (parsed.status === 'מתאים') {
      await supabase
        .from('calendar_stops')
        .update({
          coordination_status: 'customer_confirmed',
          coordinated_at: new Date().toISOString(),
        })
        .eq('order_id', orderId)
        .eq('status', 'planned');
    } else if (parsed.status === 'לא מתאים' || parsed.status === 'בקשת שינוי') {
      await supabase
        .from('calendar_stops')
        .update({
          coordination_status: parsed.status === 'לא מתאים' ? 'customer_rejected' : 'customer_change',
          coordinated_at: new Date().toISOString(),
        })
        .eq('order_id', orderId)
        .eq('status', 'planned');
    }
  }

  await supabase
    .from('whatsapp_inbound')
    .update({ status: 'processed', processed_at: new Date().toISOString() })
    .eq('id', inboundRow.id);

  return { ok: true, inboundId: inboundRow.id, matchedOrderId: orderId };
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
