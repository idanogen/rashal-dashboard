import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabase-admin.js';
import { heyySendTemplate, heyySendText, isHeyyDemo } from './_lib/heyy-server.js';
import { toE164 } from './_lib/phone.js';

// Send endpoint called from the browser. Wraps heyySendText / heyySendTemplate,
// logs the result to whatsapp_outbound, and (for reminders) writes whatsapp_reminder_log.

interface SendBody {
  kind: 'text' | 'template';
  phoneE164: string;
  bodyText?: string;
  templateId?: string;
  parameters?: string[];
  orderId?: string;
  reminderKind?: 'delivery_reminder' | 'schedule_request' | 'team_notification' | 'custom';
  triggeredBy?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const body = req.body as SendBody;

  if (!body || !body.kind || !body.phoneE164) {
    return res.status(400).json({ ok: false, error: 'missing kind or phoneE164' });
  }

  const e164 = toE164(body.phoneE164);
  if (!e164) {
    return res.status(400).json({ ok: false, error: 'invalid phone' });
  }

  // Cooldown check (only for reminders attached to an order)
  if (body.orderId && body.reminderKind) {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from('whatsapp_reminder_log')
      .select('id, sent_at')
      .eq('order_id', body.orderId)
      .eq('reminder_kind', body.reminderKind)
      .gte('sent_at', cutoff)
      .limit(1);
    if (recent && recent.length > 0) {
      return res.status(429).json({
        ok: false,
        statusDetail: `cooldown: a ${body.reminderKind} was already sent for this order in the last 48h`,
        isDemo: isHeyyDemo,
      });
    }
  }

  // Call heyy
  const result =
    body.kind === 'text'
      ? await heyySendText(e164, body.bodyText ?? '')
      : await heyySendTemplate(e164, body.templateId ?? '', body.parameters ?? []);

  // Log to whatsapp_outbound regardless of success
  const { data: outboundRow, error: outboundErr } = await supabaseAdmin
    .from('whatsapp_outbound')
    .insert({
      wa_message_id: result.waMessageId ?? null,
      phone_e164: e164,
      message_kind: body.kind,
      template_id: body.kind === 'template' ? body.templateId : null,
      template_params: body.kind === 'template' ? body.parameters ?? [] : null,
      body_text: body.kind === 'text' ? body.bodyText : null,
      reminder_kind: body.reminderKind ?? null,
      status: result.status,
      status_detail: result.statusDetail,
      order_id: body.orderId ?? null,
      triggered_by: body.triggeredBy ?? null,
      is_demo: isHeyyDemo,
    })
    .select()
    .single();

  if (outboundErr) {
    console.error('[heyy-send] DB insert failed:', outboundErr.message);
    return res.status(500).json({ ok: false, error: outboundErr.message, isDemo: isHeyyDemo });
  }

  // Write reminder log on success (for cooldown enforcement)
  if (result.ok && body.orderId && body.reminderKind) {
    await supabaseAdmin.from('whatsapp_reminder_log').insert({
      order_id: body.orderId,
      reminder_kind: body.reminderKind,
      phone_e164: e164,
      outbound_id: outboundRow.id,
    });

    // Update orders.last_reminder_at for quick display
    await supabaseAdmin
      .from('orders')
      .update({ last_reminder_at: new Date().toISOString() })
      .eq('id', body.orderId);
  }

  return res.status(result.ok ? 200 : 502).json({
    ok: result.ok,
    waMessageId: result.waMessageId,
    status: result.status,
    statusDetail: result.statusDetail,
    isDemo: isHeyyDemo,
    outboundId: outboundRow.id,
  });
}
