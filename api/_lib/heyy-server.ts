// Server-side heyy.io client. Handles BOTH demo mode (no real API call,
// just log to DB) and real mode (POST to api.heyy.io). Switch via HEYY_MODE env.

const HEYY_BASE = process.env.HEYY_BASE_URL ?? 'https://api.heyy.io/api/v2.0';
const HEYY_KEY = process.env.HEYY_API_KEY ?? '';
const HEYY_CHANNEL_ID = process.env.HEYY_CHANNEL_ID ?? '';
const HEYY_MODE = (process.env.HEYY_MODE ?? 'demo').toLowerCase(); // 'demo' | 'real'

export const isHeyyDemo = HEYY_MODE !== 'real';

export interface HeyyApiResult {
  ok: boolean;
  waMessageId?: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  statusDetail?: string;
}

interface HeyyApiResponse {
  waMessageId?: string;
  status?: string;
  error?: { message?: string } | string;
  message?: string;
}

/**
 * Sends a free-text WhatsApp message via heyy. ONLY valid within a 24h
 * window after the customer messaged us. Use sendTemplate otherwise.
 */
export async function heyySendText(phoneE164: string, body: string): Promise<HeyyApiResult> {
  if (isHeyyDemo) {
    return { ok: true, waMessageId: `demo-${Date.now()}`, status: 'sent', statusDetail: '[DEMO] not sent to heyy' };
  }
  if (!HEYY_KEY || !HEYY_CHANNEL_ID) {
    return { ok: false, status: 'failed', statusDetail: 'Missing HEYY_API_KEY or HEYY_CHANNEL_ID env' };
  }

  try {
    const res = await fetch(`${HEYY_BASE}/${HEYY_CHANNEL_ID}/whatsapp_messages/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HEYY_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phoneNumber: phoneE164, type: 'TEXT', bodyText: body }),
    });
    const json = (await res.json().catch(() => ({}))) as HeyyApiResponse;
    if (!res.ok) {
      const errMsg = typeof json.error === 'string' ? json.error : json.error?.message ?? json.message ?? `HTTP ${res.status}`;
      return { ok: false, status: 'failed', statusDetail: errMsg };
    }
    // Meta-rejected templates come back as 200 with empty waMessageId — same applies to text
    if (!json.waMessageId) {
      return { ok: false, status: 'failed', statusDetail: 'heyy returned empty waMessageId (likely outside 24h window — use template)' };
    }
    return { ok: true, waMessageId: json.waMessageId, status: (json.status as HeyyApiResult['status']) ?? 'sent' };
  } catch (err) {
    return { ok: false, status: 'failed', statusDetail: err instanceof Error ? err.message : 'unknown error' };
  }
}

/**
 * Sends an approved WhatsApp template. Required when no 24h window is open.
 */
export async function heyySendTemplate(
  phoneE164: string,
  templateId: string,
  parameters: string[]
): Promise<HeyyApiResult> {
  if (isHeyyDemo) {
    return { ok: true, waMessageId: `demo-tpl-${Date.now()}`, status: 'sent', statusDetail: '[DEMO] not sent to heyy' };
  }
  if (!HEYY_KEY || !HEYY_CHANNEL_ID) {
    return { ok: false, status: 'failed', statusDetail: 'Missing HEYY_API_KEY or HEYY_CHANNEL_ID env' };
  }
  if (templateId.startsWith('DEMO-')) {
    return { ok: false, status: 'failed', statusDetail: `Template ${templateId} is a placeholder — register the real template in heyy and update src/lib/heyy/templates.ts` };
  }

  try {
    const res = await fetch(`${HEYY_BASE}/${HEYY_CHANNEL_ID}/whatsapp_messages/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HEYY_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phoneNumber: phoneE164, type: 'TEMPLATE', templateId, parameters }),
    });
    const json = (await res.json().catch(() => ({}))) as HeyyApiResponse;
    if (!res.ok) {
      const errMsg = typeof json.error === 'string' ? json.error : json.error?.message ?? json.message ?? `HTTP ${res.status}`;
      return { ok: false, status: 'failed', statusDetail: errMsg };
    }
    if (!json.waMessageId) {
      return { ok: false, status: 'failed', statusDetail: 'heyy returned empty waMessageId — Meta likely rejected the template' };
    }
    return { ok: true, waMessageId: json.waMessageId, status: (json.status as HeyyApiResult['status']) ?? 'sent' };
  } catch (err) {
    return { ok: false, status: 'failed', statusDetail: err instanceof Error ? err.message : 'unknown error' };
  }
}
