/**
 * Browser-side heyy client.
 *
 * Two modes:
 *
 *   Real mode (VITE_HEYY_MODE=real):
 *     POSTs to /api/heyy-send Vercel function, which forwards to heyy.io.
 *
 *   Demo mode (default — VITE_HEYY_MODE !== 'real'):
 *     Writes directly to whatsapp_outbound table via supabase (anon + RLS).
 *     No /api call. Works on local Vite dev (no `vercel dev` needed).
 *
 * The /api/heyy-send function also has demo mode for production deploys
 * before the real heyy account is connected.
 */
import { supabase } from '@/lib/supabase';
import type {
  HeyySendResult,
  SendTemplateParams,
  SendTextParams,
} from './types';
import { toE164 } from './phone';
import { getTemplate, isPlaceholderTemplate } from './templates';

interface SendRequestBody {
  kind: 'text' | 'template';
  phoneE164: string;
  bodyText?: string;
  templateId?: string;
  parameters?: string[];
  orderId?: string;
  calendarStopId?: string;
  reminderKind?: string;
  triggeredBy?: string;
}

/** Demo mode indicator for the UI — true when VITE_HEYY_MODE !== 'real'. */
export function isDemoMode(): boolean {
  return (import.meta.env.VITE_HEYY_MODE ?? 'demo') !== 'real';
}

async function sendInDemoMode(body: SendRequestBody): Promise<HeyySendResult> {
  // Cooldown check (mirror of /api logic, simplified)
  if (body.orderId && body.reminderKind) {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from('whatsapp_reminder_log')
      .select('id')
      .eq('order_id', body.orderId)
      .eq('reminder_kind', body.reminderKind)
      .gte('sent_at', cutoff)
      .limit(1);
    if (recent && recent.length > 0) {
      return {
        ok: false,
        status: 'failed',
        statusDetail: `cooldown: a ${body.reminderKind} was already sent for this order in the last 48h`,
        isDemo: true,
      };
    }
  }

  // Insert outbound log
  const waMessageId = `demo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const { data: outboundRow, error } = await supabase
    .from('whatsapp_outbound')
    .insert({
      wa_message_id: waMessageId,
      phone_e164: body.phoneE164,
      message_kind: body.kind,
      template_id: body.kind === 'template' ? body.templateId : null,
      template_params: body.kind === 'template' ? body.parameters ?? [] : null,
      body_text: body.kind === 'text' ? body.bodyText : null,
      reminder_kind: body.reminderKind ?? null,
      status: 'sent',
      status_detail: '[DEMO] not sent to heyy — local demo mode',
      order_id: body.orderId ?? null,
      triggered_by: body.triggeredBy ?? null,
      is_demo: true,
    })
    .select()
    .single();

  if (error) {
    return { ok: false, status: 'failed', statusDetail: error.message, isDemo: true };
  }

  // Reminder log on success
  if (body.orderId && body.reminderKind) {
    await supabase.from('whatsapp_reminder_log').insert({
      order_id: body.orderId,
      reminder_kind: body.reminderKind,
      phone_e164: body.phoneE164,
      outbound_id: outboundRow.id,
    });
    await supabase
      .from('orders')
      .update({ last_reminder_at: new Date().toISOString() })
      .eq('id', body.orderId);
  }

  return { ok: true, waMessageId, status: 'sent', isDemo: true };
}

async function postSend(body: SendRequestBody): Promise<HeyySendResult> {
  const res = await fetch('/api/heyy-send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Partial<HeyySendResult> & {
    error?: string;
  };
  if (!res.ok || json.ok === false) {
    return {
      ok: false,
      status: 'failed',
      statusDetail: json.statusDetail ?? json.error ?? `HTTP ${res.status}`,
      isDemo: json.isDemo ?? false,
    };
  }
  return {
    ok: true,
    waMessageId: json.waMessageId,
    status: json.status ?? 'sent',
    statusDetail: json.statusDetail,
    isDemo: json.isDemo ?? false,
  };
}

async function send(body: SendRequestBody): Promise<HeyySendResult> {
  return isDemoMode() ? sendInDemoMode(body) : postSend(body);
}

export async function sendText(params: SendTextParams): Promise<HeyySendResult> {
  const e164 = toE164(params.phone);
  if (!e164) {
    return { ok: false, status: 'failed', statusDetail: 'invalid phone', isDemo: isDemoMode() };
  }
  return send({
    kind: 'text',
    phoneE164: e164,
    bodyText: params.body,
    orderId: params.orderId,
    reminderKind: params.reminderKind,
    triggeredBy: params.triggeredBy,
  });
}

export async function sendTemplate(params: SendTemplateParams): Promise<HeyySendResult> {
  const e164 = toE164(params.phone);
  if (!e164) {
    return { ok: false, status: 'failed', statusDetail: 'invalid phone', isDemo: isDemoMode() };
  }

  // In real mode, calling with a placeholder template ID would fail at heyy.
  // Surface that early in demo mode too — useful warning for the user.
  if (!isDemoMode() && isPlaceholderTemplate(params.templateId)) {
    const tpl = getTemplate(params.reminderKind ?? 'custom');
    return {
      ok: false,
      status: 'failed',
      statusDetail: `Template "${tpl.label}" עדיין placeholder (${params.templateId}). עדכן ב-src/lib/heyy/templates.ts אחרי אישור Meta.`,
      isDemo: false,
    };
  }

  return send({
    kind: 'template',
    phoneE164: e164,
    templateId: params.templateId,
    parameters: params.parameters,
    orderId: params.orderId,
    reminderKind: params.reminderKind,
    triggeredBy: params.triggeredBy,
  });
}
