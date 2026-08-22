/**
 * לקוח ל-API של heyy בגרסה 3.
 *
 * ⭐ **ל-heyy יש API לתבניות, וגם שליחה עם מדיה. שניהם ב-v3 בלבד.**
 * הבדיקה הראשונה שלנו רצה על `api.heyy.io/api/v2.0` והחזירה 404 על
 * ארבעה נתיבים, ומזה הוסק בטעות שאין API לתבניות.
 * 🔴 **הלקח: "אין API" נגזר מגרסה אחת שנבדקה, לא מהמוצר.** התיעוד יושב
 * ב-`docs.heyy.io` ומגיעים אליו מקישור "מפתחים" בתחתית ההגדרות.
 *
 * ⚠️ v2.0 נשאר בשימוש ב-`heyy-server.ts` (סקרים, תזכורות). לא נגענו בו
 * כדי לא לשבור מסלול שעובד, ולכן שתי הגרסאות חיות זו לצד זו.
 */

const V3 = process.env.HEYY_V3_BASE_URL ?? 'https://api.heyy.io/v3';
const KEY = process.env.HEYY_API_KEY ?? '';
const CHANNEL = process.env.HEYY_CHANNEL_ID ?? '';

function headers(json = true): Record<string, string> {
  return {
    Authorization: `Bearer ${KEY}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

/** 🔴 שעון עצר. בלעדיו קריאה שנתקעת תוקעת פונקציה שלמה. */
async function call(path: string, init: RequestInit, ms = 20000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(`${V3}${path}`, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ── תבניות ─────────────────────────────────────────────

export interface HeyyAttachment {
  id: string;
  type: 'document' | 'video' | 'image' | 'audio' | 'button';
  fileId?: string;
  buttonType?: string;
  text?: string;
  url?: string;
}

export interface HeyyTemplate {
  id: string;
  name: string;
  status: string;
  category: 'utility' | 'marketing' | 'authentication';
  body: string;
  variables: string[];
  attachments: HeyyAttachment[];
}

interface RawTemplate {
  id: string;
  name: string;
  status: string;
  channelId?: string;
  variables?: string[];
  messageContent?: { body?: string; attachments?: HeyyAttachment[] };
  vendorDetails?: { category?: string };
}

/**
 * כל התבניות של הערוץ.
 *
 * 🔴 מסונן לערוץ שלנו. חשבון heyy יכול להחזיק כמה ערוצים, ותבנית של
 * ערוץ אחר לא ניתנת לשליחה משלנו והייתה נכשלת רק ברגע השליחה.
 */
export async function listTemplates(): Promise<HeyyTemplate[]> {
  if (!KEY) throw new Error('missing HEYY_API_KEY');

  const res = await call('/message_templates/search', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ pagination: { page: 0, limit: 100 } }),
  });
  if (!res.ok) throw new Error(`heyy templates ${res.status}`);

  const json = (await res.json()) as { data?: RawTemplate[] };
  return (json.data ?? [])
    .filter((t) => !CHANNEL || !t.channelId || t.channelId === CHANNEL)
    .map((t) => {
      const cat = t.vendorDetails?.category;
      return {
        id: t.id,
        name: t.name,
        status: t.status,
        category: cat === 'marketing' || cat === 'authentication' ? cat : 'utility',
        body: t.messageContent?.body ?? '',
        // ⭐ הרשימה של heyy, לא גזירה מהנוסח. משתנה שיושב בכפתור
        // (`{{var.token}}` בתבנית הסקר) לא מופיע בגוף בכלל.
        variables: Array.isArray(t.variables) ? t.variables : [],
        attachments: Array.isArray(t.messageContent?.attachments)
          ? (t.messageContent!.attachments as HeyyAttachment[])
          : [],
      };
    });
}

// ── העלאת קובץ ─────────────────────────────────────────

export type HeyyFileType = 'image' | 'video' | 'audio' | 'document';

/** סוג התוכן שנשלח ל-heyy פר סוג קובץ. ראה `uploadFileBytes`. */
const MIME: Partial<Record<HeyyFileType, string>> = { document: 'application/pdf' };

/**
 * מעלה בייטים ל-heyy ומחזיר את מזהה הקובץ.
 *
 * 🔴🔴 **הגרסה הקודמת קיבלה כתובת ומשכה אותה בעצמה, וזו הייתה טעות.**
 * הכתובת שפריוריטי מחזירה
 * (`/html/priority/netfiles/<ini>/<guid>.pdf`)
 * **דורשת את הסשן של הדפדפן**, ובלעדיו היא מחזירה **200 עם דף ההתחברות
 * של פריוריטי** ולא 401 ולא 403. נמדד חי 22/08/2026 על מסמך אמיתי:
 * `status=200 · content-type=text/html · 16,563 בייט · priform · login`.
 * בדיקת `res.ok` בלבד עברה, ולכן העלינו ל-heyy דף התחברות בשם
 * `SH2603398.pdf`, ו-heyy דחתה ב-400. כלומר ההעלאה לא נכשלה, היא
 * **הצליחה לשלוח זבל**, וזו אותה משפחת מלכודות שכבר עלתה לנו:
 * **תשובת 200 אינה אימות.**
 *
 * ⭐ לכן הבייטים מגיעים מהתוסף, שרץ בתוך הסשן הפתוח וכן מקבל את הקובץ.
 */
export async function uploadFileBytes(
  bytes: Buffer,
  filename: string,
  type: HeyyFileType = 'document',
): Promise<{ fileId: string }> {
  if (!KEY) throw new Error('missing HEYY_API_KEY');

  // 🔴 **שער שאי אפשר לעקוף: או שזה PDF, או שכלום לא יוצא.**
  // זו ההגנה שהייתה חסרה. היא לא בודקת שם קובץ ולא סוג מוצהר, אלא את
  // הבייטים עצמם, ולכן דף התחברות, דף שגיאה או HTML כלשהו נעצרים כאן
  // ולא מגיעים ללקוח בשם החברה.
  if (type === 'document' && bytes.subarray(0, 5).toString('latin1') !== '%PDF-') {
    const head = bytes.subarray(0, 120).toString('utf8').replace(/\s+/g, ' ');
    console.error('[heyy] not a pdf', { filename, size: bytes.length, head });
    throw new Error(`not a pdf (${bytes.length} bytes): ${head.slice(0, 120)}`);
  }

  // 🔴 מטא חוסמת מסמך מעל 100MB, ומעשית כל דבר מעל כמה מגה מגיע לאט
  // מאוד ללקוח. עדיף להיעצר כאן מאשר לגלות מהלקוח.
  if (bytes.length > 20 * 1024 * 1024) throw new Error('file too large');

  // 🔴 סוג התוכן נקבע כאן ולא נגזר מהמקור: `FormData` לוקח אותו מה-blob,
  // וצד שני שבודק סוג דוחה `application/octet-stream` בלי להסביר.
  const blob = new Blob([new Uint8Array(bytes)], { type: MIME[type] ?? 'application/octet-stream' });

  const form = new FormData();
  form.append('type', type);
  form.append('file', blob, filename);

  const res = await call('/files', { method: 'POST', headers: headers(false), body: form }, 60000);
  const body = await res.text();

  let json: { data?: { id?: string } } = {};
  try {
    json = JSON.parse(body) as { data?: { id?: string } };
  } catch {
    /* גוף שאינו JSON נשאר בטקסט, וזה בדיוק מה שרוצים לראות בשגיאה */
  }

  // 🔴 **הסיבה של heyy נשמרת.** הגרסה הראשונה זרקה `heyy upload 400` בלבד,
  // ואז אין מה לעשות עם זה חוץ מלנחש: איזה שדה, איזה סוג, איזו מגבלה.
  // תשובת שגיאה של ספק היא הנתון היקר ביותר ברגע כזה, ואסור לזרוק אותה.
  if (!res.ok || !json.data?.id) {
    console.error('[heyy] upload rejected', {
      status: res.status,
      filename,
      type,
      size: bytes.length,
      body: body.slice(0, 500),
    });
    throw new Error(`heyy upload ${res.status}: ${body.slice(0, 300) || '(גוף ריק)'}`);
  }
  return { fileId: json.data.id };
}

// ── שליחת תבנית ────────────────────────────────────────

export interface SendTemplateResult {
  ok: boolean;
  messageId?: string;
  vendorMessageId?: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  detail?: string;
}

/**
 * שולח תבנית, עם מדיה אם יש.
 *
 * 🔴 **המשתנים כאן הם אובייקט שטוח `{שם: ערך}`**, ולא מערך
 * `[{name, value}]` כמו ב-v2.0. שתי הגרסאות חיות אצלנו במקביל, וקל
 * מאוד להעביר בטעות את המבנה של האחת לשנייה.
 *
 * 🔴 **הקובץ מזוהה בשני מזהים:** `id` הוא הקובץ המצורף **בתוך התבנית**
 * (מגיע מהגדרת התבנית), ו-`fileId` הוא הקובץ שהועלה בפועל. חסר אחד מהם
 * והמסמך פשוט לא מצורף.
 */
export async function sendTemplate(opts: {
  phoneE164: string;
  templateId: string;
  variables: Record<string, string>;
  attachments?: Array<{ id: string; fileId: string }>;
}): Promise<SendTemplateResult> {
  if (!KEY || !CHANNEL) {
    return { ok: false, status: 'failed', detail: 'missing HEYY_API_KEY or HEYY_CHANNEL_ID' };
  }

  try {
    const res = await call('/messages/send_template', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        chat: { channelId: CHANNEL, phoneNumber: opts.phoneE164 },
        messageTemplate: {
          id: opts.templateId,
          variables: opts.variables,
          ...(opts.attachments?.length ? { attachments: opts.attachments } : {}),
        },
      }),
    });

    const json = (await res.json().catch(() => ({}))) as {
      data?: { id?: string; vendorId?: string; status?: string; errors?: unknown[] };
      message?: string;
      error?: string;
    };

    if (!res.ok) {
      const detail = json.error ?? json.message ?? `HTTP ${res.status}`;
      return { ok: false, status: 'failed', detail: String(detail).slice(0, 300) };
    }

    // 🔴 דחייה אמיתית מגיעה ב-errors[], לא בהיעדר מזהה. אותה מלכודת
    // שכבר עלתה לנו ב-v2.0.
    const rejected = json.data?.errors;
    if (Array.isArray(rejected) && rejected.length) {
      return { ok: false, status: 'failed', detail: JSON.stringify(rejected).slice(0, 300) };
    }

    const raw = String(json.data?.status ?? 'pending').toLowerCase();
    return {
      ok: true,
      messageId: json.data?.id,
      vendorMessageId: json.data?.vendorId,
      status: (['sent', 'delivered', 'read', 'failed'].includes(raw) ? raw : 'pending') as SendTemplateResult['status'],
      detail: json.data?.id ? undefined : `אין מזהה בתשובה: ${JSON.stringify(json).slice(0, 200)}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return { ok: false, status: 'failed', detail: msg };
  }
}
