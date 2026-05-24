import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabase-admin';
import { extractMessage, parseCustomerReply } from './_lib/extract';
import { normalizePhone, toE164 } from './_lib/phone';

// heyy webhook receiver.
//
// Configure in heyy UI → Channels → Webhooks → "WhatsApp Message Received":
//   URL:    https://rashal-dashboard.vercel.app/api/heyy-webhook
//   Method: POST
//   Header: X-Heyy-Secret: <value of HEYY_WEBHOOK_SECRET env>  (optional but recommended)
//
// ALWAYS returns 200, even on validation errors — heyy retries on 4xx/5xx,
// and validation errors are not server errors. We log them to DB instead.

const SECRET = process.env.HEYY_WEBHOOK_SECRET;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Optional shared-secret auth (heyy does not sign payloads)
  if (SECRET) {
    const got = req.headers['x-heyy-secret'] ?? req.headers['x-webhook-secret'];
    if (got !== SECRET) {
      return res.status(401).json({ error: 'bad secret' });
    }
  }

  const payload = req.body;
  const extracted = extractMessage(payload);

  // Ignore non-message events and outbound echoes
  if (extracted.ignoredReason) {
    return res.status(200).json({ ok: true, ignored: extracted.ignoredReason });
  }

  const phoneE164 = toE164(extracted.rawPhone);
  const phoneLocal = normalizePhone(extracted.rawPhone);

  if (!phoneE164 || !extracted.rawText) {
    // Save the raw payload anyway for debugging — but don't process
    await supabaseAdmin.from('whatsapp_inbound').insert({
      provider_message_id: extracted.providerId,
      phone_e164: phoneE164 ?? 'unknown',
      phone_local: phoneLocal,
      body_text: extracted.rawText,
      raw_payload: payload,
      status: 'failed',
      notes: 'missing phone or text',
    });
    return res.status(200).json({ ok: false, error: 'missing phone or text' });
  }

  // Idempotency check
  if (extracted.providerId) {
    const { data: existing } = await supabaseAdmin
      .from('whatsapp_inbound')
      .select('id')
      .eq('provider_message_id', extracted.providerId)
      .maybeSingle();
    if (existing) {
      return res.status(200).json({ ok: true, deduped: extracted.providerId });
    }
  }

  // Match to an order by phone (local format)
  let orderId: string | null = null;
  if (phoneLocal) {
    const { data: matchingOrders } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('phone', phoneLocal)
      .order('created_at', { ascending: false })
      .limit(1);
    orderId = matchingOrders?.[0]?.id ?? null;
  }

  // Parse the reply text
  const parsed = parseCustomerReply(extracted.rawText);

  // Save inbound
  const { data: inboundRow, error: insertErr } = await supabaseAdmin
    .from('whatsapp_inbound')
    .insert({
      provider_message_id: extracted.providerId,
      phone_e164: phoneE164,
      phone_local: phoneLocal,
      body_text: extracted.rawText,
      raw_payload: payload,
      status: 'received',
      order_id: orderId,
      parsed_reply_status: parsed.status,
    })
    .select()
    .single();

  if (insertErr) {
    console.error('[heyy-webhook] DB insert failed:', insertErr.message);
    // Returning 500 here is intentional — DB is down, retry is appropriate
    return res.status(500).json({ ok: false, error: insertErr.message });
  }

  // If we matched an order AND parsed a status, update the order
  if (orderId && parsed.status) {
    const orderUpdate: Record<string, unknown> = {
      customer_reply_status: parsed.status,
    };
    if (parsed.requestedTime) {
      orderUpdate.customer_requested_time = parsed.requestedTime;
    }
    await supabaseAdmin.from('orders').update(orderUpdate).eq('id', orderId);
  }

  // Mark inbound as processed
  await supabaseAdmin
    .from('whatsapp_inbound')
    .update({ status: 'processed', processed_at: new Date().toISOString() })
    .eq('id', inboundRow.id);

  return res.status(200).json({
    ok: true,
    inboundId: inboundRow.id,
    matchedOrderId: orderId,
    parsedStatus: parsed.status,
  });
}
