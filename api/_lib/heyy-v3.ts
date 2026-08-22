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

/**
 * כותרת הדפדפן שבה השרת מושך את המסמך מפריוריטי. ראה `uploadFileFromUrl`.
 */
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

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

/** סוג התוכן שנשלח ל-heyy פר סוג קובץ. ראה `uploadFileFromUrl`. */
const MIME: Partial<Record<HeyyFileType, string>> = { document: 'application/pdf' };

/**
 * מעלה קובץ ל-heyy ומחזיר את המזהה שלו.
 *
 * ⭐ מקבל **כתובת** ולא בייטים, כי המקור שלנו הוא ה-PDF שפריוריטי מייצר
 * בכתובת זמנית. מושכים משם ודוחפים ל-heyy באותה נשימה.
 */
export async function uploadFileFromUrl(
  url: string,
  filename: string,
  type: HeyyFileType = 'document',
): Promise<{ fileId: string }> {
  if (!KEY) throw new Error('missing HEYY_API_KEY');

  const src = await fetch(url, {
    signal: AbortSignal.timeout(20000),
    // 🔴 **בלי כותרת דפדפן פריוריטי מחזירה 403 על כל נתיב.**
    // נמדד חי (22/08/2026) על `p.priority-connect.online/netfiles/`:
    // `curl` → 403 · `node` → 403 · בלי כותרת בכלל → 403 · ואפילו
    // `Mozilla/5.0` לבדו → 403. מה שעובר הוא כותרת עם בלוק הפלטפורמה
    // בסוגריים, למשל `Mozilla/5.0 (Macintosh) ...`, ואז 404 על קובץ
    // שאינו קיים, כלומר הנתיב **פתוח ואינו דורש סשן**.
    // המשמעות: הקובץ נגיש לשרת שלנו, וכל מה שחסם היה הכותרת.
    // בלי התיקון הזה כל שליחת מסמך הייתה נופלת ב-`document_fetch_failed`,
    // ונראית בדיוק כמו "הכתובת דורשת את הסשן של הדפדפן" — אבחנה שגויה
    // שהייתה שולחת אותנו לשכתב את מסלול ההפקה בלי סיבה.
    headers: { 'User-Agent': BROWSER_UA },
  });
  if (!src.ok) throw new Error(`source file ${src.status}`);
  const raw = await src.blob();

  // 🔴 מטא חוסמת מסמך מעל 100MB, ומעשית כל דבר מעל כמה מגה מגיע לאט
  // מאוד ללקוח. עדיף להיעצר כאן מאשר לגלות מהלקוח.
  if (raw.size > 50 * 1024 * 1024) throw new Error('file too large');

  // 🔴 **סוג התוכן נקבע כאן ולא נלקח כפי שהוא מפריוריטי.**
  // `FormData` גוזר את ה-`Content-Type` של החלק מ-`blob.type`, ופריוריטי
  // עשויה להחזיר `application/octet-stream` או כלום. צד שני שבודק סוג
  // דוחה את זה, וזה נראה כמו "הקובץ פסול" במקום "התווית שגויה".
  const blob =
    MIME[type] && raw.type !== MIME[type] ? new Blob([raw], { type: MIME[type] }) : raw;

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
      size: raw.size,
      sourceType: raw.type || '(ריק)',
      sentType: blob.type,
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
