// Server-side heyy.io client. Handles BOTH demo mode (no real API call,
// just log to DB) and real mode (POST to api.heyy.io). Switch via HEYY_MODE env.
//
// 🔴 **תאריך מת: 1 בנובמבר 2026.** הנתיב כאן הוא הגרסה הישנה של heyy,
// והם מסיימים אותה במפורש בתאריך הזה. המחליף הוא `POST /v3/messages/send`,
// וההגירה חייבת לקרות לפני. ראה `docs/heyy-limits.md`.
import { retryAfterMs, rateLimitInfo, DEFAULT_RETRY, RATE_LIMITED } from './heyy-rate-limit.js';

const HEYY_BASE = process.env.HEYY_BASE_URL ?? 'https://api.heyy.io/api/v2.0';
const HEYY_KEY = process.env.HEYY_API_KEY ?? '';
const HEYY_CHANNEL_ID = process.env.HEYY_CHANNEL_ID ?? '';
const HEYY_MODE = (process.env.HEYY_MODE ?? 'demo').toLowerCase(); // 'demo' | 'real'

export const isHeyyDemo = HEYY_MODE !== 'real';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * שליחה אחת מול heyy, עם כיבוד מכסת הקצב.
 *
 * 🔴🔴 **עד 26/08/2026 429 חזר מכאן כ-`failed` רגיל**, ומנוע הסקרים סימן
 * את השורה `status: 'failed'` ושחרר אותה רק לבדיקה ידנית. כלומר סקר
 * שנחסם על מכסה היה **נעלם לתמיד**, ודווקא ברגע העמוס שבו נשלחות הרבה
 * הודעות בבת אחת.
 *
 * ⭐ **מנסים שוב רק על 429, אף פעם לא על 5xx.** 429 אומר מפורשות שהבקשה
 * לא בוצעה, ולכן הוא בטוח. שגיאת שרת על שליחה היא דו משמעית: ייתכן
 * שהוואטסאפ כבר יצא ללקוח, וכפילות גרועה מהודעה חסרה.
 */
async function sendWithRateLimit(body: unknown): Promise<Response> {
  let waitedMs = 0;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${HEYY_BASE}/${HEYY_CHANNEL_ID}/whatsapp_messages/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${HEYY_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) return res;

    const wait = retryAfterMs(res.status, res.headers, {
      retryServerErrors: false,
      maxWaitMs: DEFAULT_RETRY.maxWaitMs,
      waitedMs,
      attempt,
      maxAttempts: DEFAULT_RETRY.maxAttempts,
      nowMs: Date.now(),
    });
    if (wait == null) {
      if (res.status === 429) {
        console.error('[heyy] rate limited, giving up', rateLimitInfo(res.headers));
      }
      return res;
    }
    console.warn('[heyy] rate limited, waiting', { waitMs: wait, attempt });
    await sleep(wait);
    waitedMs += wait;
  }
}

/** מוסיף לשגיאה את הסימן שאומר "מכסה, לא דחייה", כדי שהקורא יחזיר לתור. */
function failureDetail(status: number, message: string): string {
  return status === 429 ? `${RATE_LIMITED}: ${message}` : message;
}


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
 * מחלץ את שני המזהים מתשובת heyy.
 *
 * 🔴 הלקח שעלה ביוקר (20/08/2026): הקוד חיפש `data.waMessageId`, **שדה
 * שלא קיים בסכימה של heyy בכלל**. הוא החזיר תמיד undefined, נשמר כמחרוזת
 * ריקה, וכל הודעה שיצאה מאז שהחשבון חובר נשארה `pending` לנצח. זה כלל
 * את הודעות הסקר שאנחנו יודעים בוודאות שנמסרו ונענו.
 *
 * המבנה האמיתי נלמד ממטען וובהוק חי, לא מתיעוד (אין כזה):
 *   data.id        מזהה פנימי של heyy
 *   data.vendorId  wamid.* של מטא
 *
 * ההערה הישנה "waMessageId ריק אינו כישלון, heyy שולח אסינכרונית" היתה
 * נכונה בחצי: heyy באמת שולח אסינכרונית, אבל **המזהה כן חוזר מיד**, ובלעדיו
 * אין שום דרך לקשור עדכון מסירה להודעה. שקט נראה בדיוק כמו תקינות.
 */
function extractIds(json: any): { waMessageId: string; vendorMessageId: string } {
  const d = json?.data ?? json ?? {};
  return {
    waMessageId: String(d.id ?? d.waMessageId ?? d.messageId ?? json?.id ?? '').trim(),
    vendorMessageId: String(d.vendorId ?? d.vendorMessageId ?? '').trim(),
  };
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
    const res = await sendWithRateLimit({ phoneNumber: phoneE164, type: 'TEXT', bodyText: body });
    const json = (await res.json().catch(() => ({}))) as HeyyApiResponse;
    if (!res.ok) {
      const errMsg = typeof json.error === 'string' ? json.error : json.error?.message ?? json.message ?? `HTTP ${res.status}`;
      return { ok: false, status: 'failed', retryable: res.status === 429, statusDetail: failureDetail(res.status, errMsg) };
    }
    // דחייה אמיתית (למשל חלון 24 השעות סגור) מגיעה ב-errors[].
    const j = json as any;
    const rejected = j.data?.errors;
    if (Array.isArray(rejected) && rejected.length) {
      return { ok: false, status: 'failed', statusDetail: `heyy rejected: ${JSON.stringify(rejected).slice(0, 300)}` };
    }
    const { waMessageId, vendorMessageId } = extractIds(j);
    const rawStatus = (j.data?.status ?? j.status ?? 'PENDING').toString().toLowerCase();
    const status: HeyyApiResult['status'] = rawStatus === 'pending' ? 'pending' : (rawStatus as HeyyApiResult['status']);
    // 🔴 בלי מזהה אין מעקב מסירה. שומרים את התשובה הגולמית כדי שהמקרה
    // יהיה גלוי בשורה עצמה ולא ייעלם בשקט כמו שקרה עד היום.
    return {
      ok: true,
      waMessageId,
      vendorMessageId,
      status,
      statusDetail: waMessageId ? undefined : `אין מזהה בתשובת heyy: ${JSON.stringify(json).slice(0, 300)}`,
    };
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
    const res = await sendWithRateLimit({
      phoneNumber: phoneE164,
      type: 'TEMPLATE',
      messageTemplateId: templateId,
      ...(variables.length ? { variables } : {}),
    });
    const json = (await res.json().catch(() => ({}))) as HeyyApiResponse & {
      data?: { waMessageId?: string; status?: string; errors?: unknown[] };
    };
    if (!res.ok) {
      const errMsg = typeof json.error === 'string' ? json.error : json.error?.message ?? json.message ?? `HTTP ${res.status}`;
      return { ok: false, status: 'failed', retryable: res.status === 429, statusDetail: failureDetail(res.status, errMsg) };
    }

    // דחייה אמיתית מגיעה ב-errors[], לא בהיעדר מזהה.
    const rejected = json.data?.errors;
    if (Array.isArray(rejected) && rejected.length) {
      return { ok: false, status: 'failed', statusDetail: `heyy rejected: ${JSON.stringify(rejected).slice(0, 300)}` };
    }

    const { waMessageId, vendorMessageId } = extractIds(json);
    const rawStatus = (json.data?.status ?? json.status ?? 'PENDING').toString().toLowerCase();
    // PENDING = התקבל לשליחה. הסטטוס הסופי מגיע מאוחר יותר דרך webhook.
    const status: HeyyApiResult['status'] = rawStatus === 'pending' ? 'pending' : (rawStatus as HeyyApiResult['status']);
    return {
      ok: true,
      waMessageId,
      vendorMessageId,
      status,
      statusDetail: waMessageId ? undefined : `אין מזהה בתשובת heyy: ${JSON.stringify(json).slice(0, 300)}`,
    };
  } catch (err) {
    return { ok: false, status: 'failed', statusDetail: err instanceof Error ? err.message : 'unknown error' };
  }
}
