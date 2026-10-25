// Server-side heyy.io client. Handles BOTH demo mode (no real API call,
// just log to DB) and real mode. Switch via HEYY_MODE env.
//
// ⭐ 25/10/2026: הגרסה הישנה של heyy (v2.0) נסגרת ב-01/11/2026. שתי הפונקציות
// כאן שומרות על החתימה הישנה, כדי שאף קורא (מנועי הסקר, "בדרך", בקשת
// התמונות, דוח הבוקר, התזכורת, התיבה) לא ישתנה, ומבפנים הן רצות על v3
// (`heyy-v3.ts`). המכסה, 429 והאיסור על ניסיון חוזר ב-5xx עברו לשם.
import { sendTemplate, sendText, type SendTemplateResult } from './heyy-v3.js';
import { variablesToV3 } from './heyy-variables.js';

const HEYY_KEY = process.env.HEYY_API_KEY ?? '';
const HEYY_CHANNEL_ID = process.env.HEYY_CHANNEL_ID ?? '';
const HEYY_MODE = (process.env.HEYY_MODE ?? 'demo').toLowerCase(); // 'demo' | 'real'

export const isHeyyDemo = HEYY_MODE !== 'real';

export interface HeyyApiResult {
  ok: boolean;
  /** מזהה ההודעה אצל heyy (`data.id`). זה מה שחוזר גם בוובהוק העדכון. */
  waMessageId?: string;
  /** מזהה ההודעה אצל מטא (`data.vendorId`, בפורמט `wamid.*`). */
  vendorMessageId?: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  statusDetail?: string;
  /** נחסם על מכסת קצב ולא נדחה. ראוי לניסיון חוזר, ואסור לסמן ככישלון סופי. */
  retryable?: boolean;
}

/**
 * 🔴 הלקח מ-20/08/2026: בלי מזהה אין מעקב מסירה, וההודעה נשארת `pending`
 * לנצח. v3 מחזיר את `data.id`; כשאין, `detail` כבר מכיל את התשובה הגולמית.
 */
function toApiResult(r: SendTemplateResult): HeyyApiResult {
  return {
    ok: r.ok,
    waMessageId: r.messageId,
    vendorMessageId: r.vendorMessageId,
    status: r.status,
    statusDetail: r.detail,
    retryable: r.retryable === true,
  };
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
  return toApiResult(await sendText({ phoneE164, body }));
}

/**
 * Sends an approved WhatsApp template. Required when no 24h window is open.
 *
 * 🔴 המשתנים מגיעים במבנה הישן `[{name, value}]` **לפי שם** (השם חייב להתאים
 * לעורך התבניות של heyy), ומומרים לאובייקט של v3 ב-`variablesToV3`.
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
    return {
      ok: false,
      status: 'failed',
      statusDetail: `Template ${templateId} is a placeholder: register the real template in heyy and update src/lib/heyy/templates.ts`,
    };
  }
  return toApiResult(await sendTemplate({ phoneE164, templateId, variables: variablesToV3(variables) }));
}
