import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabase-admin.js';
import { heyySendTemplate, isHeyyDemo } from './_lib/heyy-server.js';
import { toE164 } from './_lib/phone.js';

// Runs daily via Vercel Cron (see vercel.json). Schedule "0 6 * * *" = 06:00 UTC = 09:00 Israel (08:00 in winter).
//
// For every order with delivery_date = today AND a phone, sends the 'delivery_reminder' template.
// Skips orders that have an outbound reminder of the same kind within the last 24h (cooldown).
//
// Vercel Cron requests carry a 'user-agent' starting with 'vercel-cron/' — we don't bother validating it
// since the function is idempotent (cooldown + reminder_log protect against accidental re-runs).

// The template ID is loaded from src/lib/heyy/templates.ts in the UI. The server keeps its own copy
// because /api can't import from src/.
const DELIVERY_REMINDER_TEMPLATE_ID = process.env.HEYY_TEMPLATE_DELIVERY_REMINDER ?? 'DEMO-delivery-reminder';

interface OrderRow {
  id: string;
  customer_name: string | null;
  phone: string | null;
  address: string | null;
  delivery_date: string | null;
}

function todayIsoDate(): string {
  // Israel time — Vercel Cron is UTC; for date math at 06:00 UTC, "today in Israel" is the same date.
  // Simpler than pulling a tz lib.
  return new Date().toISOString().slice(0, 10);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow GET (Vercel Cron) and POST (manual trigger)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const today = todayIsoDate();

  // Pull all orders scheduled for delivery today (only non-completed)
  const { data: orders, error } = await supabaseAdmin
    .from('orders')
    .select('id, customer_name, phone, address, delivery_date')
    .eq('delivery_date', today)
    .neq('order_status', 'סופק')
    .neq('order_status', 'אין במלאי')
    .not('phone', 'is', null);

  if (error) {
    console.error('[cron] orders fetch failed:', error.message);
    return res.status(500).json({ ok: false, error: error.message });
  }

  const rows = (orders as OrderRow[] | null) ?? [];
  const results: Array<{ orderId: string; status: 'sent' | 'skipped' | 'failed'; detail?: string }> = [];

  for (const order of rows) {
    if (!order.phone) {
      results.push({ orderId: order.id, status: 'skipped', detail: 'no phone' });
      continue;
    }

    // Cooldown: any reminder in last 24h
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from('whatsapp_reminder_log')
      .select('id')
      .eq('order_id', order.id)
      .eq('reminder_kind', 'delivery_reminder')
      .gte('sent_at', cutoff)
      .limit(1);
    if (recent && recent.length > 0) {
      results.push({ orderId: order.id, status: 'skipped', detail: 'cooldown' });
      continue;
    }

    const e164 = toE164(order.phone);
    if (!e164) {
      results.push({ orderId: order.id, status: 'skipped', detail: 'invalid phone' });
      continue;
    }

    const parameters = [
      order.customer_name ?? 'לקוח',
      '08:00',
      '18:00',
      order.address ?? '',
    ];

    const result = await heyySendTemplate(e164, DELIVERY_REMINDER_TEMPLATE_ID, parameters);

    // Log outbound
    const { data: outboundRow } = await supabaseAdmin
      .from('whatsapp_outbound')
      .insert({
        wa_message_id: result.waMessageId ?? null,
        phone_e164: e164,
        message_kind: 'template',
        template_id: DELIVERY_REMINDER_TEMPLATE_ID,
        template_params: parameters,
        reminder_kind: 'delivery_reminder',
        status: result.status,
        status_detail: result.statusDetail,
        order_id: order.id,
        triggered_by: 'cron',
        is_demo: isHeyyDemo,
      })
      .select()
      .single();

    if (result.ok) {
      await supabaseAdmin.from('whatsapp_reminder_log').insert({
        order_id: order.id,
        reminder_kind: 'delivery_reminder',
        phone_e164: e164,
        outbound_id: outboundRow?.id,
      });
      await supabaseAdmin
        .from('orders')
        .update({ last_reminder_at: new Date().toISOString() })
        .eq('id', order.id);
      results.push({ orderId: order.id, status: 'sent' });
    } else {
      results.push({ orderId: order.id, status: 'failed', detail: result.statusDetail });
    }

    // Small delay between sends to avoid rate-limiting heyy
    await new Promise((r) => setTimeout(r, 80));
  }

  return res.status(200).json({
    ok: true,
    isDemo: isHeyyDemo,
    date: today,
    totalCandidates: rows.length,
    sent: results.filter((r) => r.status === 'sent').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    failed: results.filter((r) => r.status === 'failed').length,
    results,
  });
}
