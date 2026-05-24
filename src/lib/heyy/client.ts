/**
 * Browser-side heyy client.
 *
 * It does NOT call heyy directly (CORS + secret leak). Instead it POSTs to our
 * own /api/heyy-send Vercel function, which forwards to heyy (or simulates in demo mode).
 *
 * Server-side heyy calls live in /api/_lib/heyy-server.ts.
 */
import type {
  HeyySendResult,
  SendTemplateParams,
  SendTextParams,
} from './types';
import { toE164 } from './phone';

const SEND_ENDPOINT = '/api/heyy-send';

interface SendRequestBody {
  kind: 'text' | 'template';
  phoneE164: string;
  bodyText?: string;
  templateId?: string;
  parameters?: string[];
  orderId?: string;
  reminderKind?: string;
  triggeredBy?: string;
}

async function postSend(body: SendRequestBody): Promise<HeyySendResult> {
  const res = await fetch(SEND_ENDPOINT, {
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

export async function sendText(params: SendTextParams): Promise<HeyySendResult> {
  const e164 = toE164(params.phone);
  if (!e164) {
    return { ok: false, status: 'failed', statusDetail: 'invalid phone', isDemo: false };
  }
  return postSend({
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
    return { ok: false, status: 'failed', statusDetail: 'invalid phone', isDemo: false };
  }
  return postSend({
    kind: 'template',
    phoneE164: e164,
    templateId: params.templateId,
    parameters: params.parameters,
    orderId: params.orderId,
    reminderKind: params.reminderKind,
    triggeredBy: params.triggeredBy,
  });
}

/** Demo mode indicator for the UI — true when VITE_HEYY_MODE !== 'real'. */
export function isDemoMode(): boolean {
  return (import.meta.env.VITE_HEYY_MODE ?? 'demo') !== 'real';
}
