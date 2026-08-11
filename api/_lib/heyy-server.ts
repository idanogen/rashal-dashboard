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
    // waMessageId ריק אינו כישלון — heyy שולח אסינכרונית ומחזיר PENDING.
    // דחייה אמיתית (למשל חלון 24 השעות סגור) מגיעה ב-errors[].
    const j = json as HeyyApiResponse & { data?: { waMessageId?: string; status?: string; errors?: unknown[] } };
    const rejected = j.data?.errors;
    if (Array.isArray(rejected) && rejected.length) {
      return { ok: false, status: 'failed', statusDetail: `heyy rejected: ${JSON.stringify(rejected).slice(0, 300)}` };
    }
    const waMessageId = j.data?.waMessageId ?? j.waMessageId ?? '';
    const rawStatus = (j.data?.status ?? j.status ?? 'PENDING').toString().toLowerCase();
    const status: HeyyApiResult['status'] = rawStatus === 'pending' ? 'pending' : (rawStatus as HeyyApiResult['status']);
    return { ok: true, waMessageId, status };
  } catch (err) {
    return { ok: false, status: 'failed', statusDetail: err instanceof Error ? err.message : 'unknown error' };
  }
}

/**
 * Sends an approved WhatsApp template. Required when no 24h window is open.
 *
 * 🔴 שלושה תיקונים (11/08/2026) אחרי שהחשבון חובר לראשונה. הקוד המקורי נכתב
 * במאי מול מצב דמו בלבד, ולכן אף אחד מהם לא התגלה עד שהצינור נפתח באמת.
 * המבנה הנכון הועתק מפרויקט עובד בפרודקשן (metalpress-wa-notify):
 *
 *   1. השדה הוא `messageTemplateId`, לא `templateId`. השם השגוי החזיר
 *      "Invalid body params" בלי לרמוז איזה שדה אשם.
 *   2. המשתנים הם `variables: [{name, value}]` **לפי שם**, לא מערך ערכים
 *      לפי מיקום. אינדקס מספרי לא עובד, והערכים חוזרים ריקים אצל הלקוח.
 *      השם חייב להתאים לשם שהוגדר בעורך התבניות של heyy.
 *   3. תשובה תקינה היא `status:"PENDING"` עם `waMessageId` **ריק**. heyy
 *      שולח אסינכרונית. הקוד הישן פירש את זה ככישלון ודיווח שגיאה על
 *      הודעות שיצאו בסדר גמור.
 */
export async function heyySendTemplate(
  phoneE164: string,
  templateId: string,
  variables: Array<{ name: string; value: string }> = []
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
      body: JSON.stringify({
        phoneNumber: phoneE164,
        type: 'TEMPLATE',
        messageTemplateId: templateId,
        ...(variables.length ? { variables } : {}),
      }),
    });
    const json = (await res.json().catch(() => ({}))) as HeyyApiResponse & {
      data?: { waMessageId?: string; status?: string; errors?: unknown[] };
    };
    if (!res.ok) {
      const errMsg = typeof json.error === 'string' ? json.error : json.error?.message ?? json.message ?? `HTTP ${res.status}`;
      return { ok: false, status: 'failed', statusDetail: errMsg };
    }

    // דחייה אמיתית מגיעה ב-errors[], לא בהיעדר waMessageId.
    const rejected = json.data?.errors;
    if (Array.isArray(rejected) && rejected.length) {
      return { ok: false, status: 'failed', statusDetail: `heyy rejected: ${JSON.stringify(rejected).slice(0, 300)}` };
    }

    const waMessageId = json.data?.waMessageId ?? json.waMessageId ?? '';
    const rawStatus = (json.data?.status ?? json.status ?? 'PENDING').toString().toLowerCase();
    // PENDING = התקבל לשליחה. הסטטוס הסופי מגיע מאוחר יותר דרך webhook.
    const status: HeyyApiResult['status'] = rawStatus === 'pending' ? 'pending' : (rawStatus as HeyyApiResult['status']);
    return { ok: true, waMessageId, status, statusDetail: waMessageId ? undefined : 'accepted by heyy (async dispatch)' };
  } catch (err) {
    return { ok: false, status: 'failed', statusDetail: err instanceof Error ? err.message : 'unknown error' };
  }
}
