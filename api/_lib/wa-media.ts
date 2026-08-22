import { supabaseAdmin } from './supabase-admin.js';

/**
 * עותק משלנו לכל קובץ שעובר בשיחה.
 *
 * 🔴🔴 **הכתובות של heyy פגות אחרי 24 שעות.** זה לא ניחוש: במטען האמיתי
 * של החשבונית שנשלחה ב-22/08/2026 כתוב בכתובת עצמה
 * `X-Amz-Expires=86400`. כלומר תיבת שיחות שמציגה היסטוריה תראה ריבועים
 * שבורים בכל מה שישן מיממה, וזה הופך את המילה "היסטוריה" ללא נכונה.
 *
 * ⭐ ל-heyy יש נתיב שמנפיק כתובת קבועה שאינה פגה, **והוא נדחה במכוון**:
 * הכתובת ההיא ציבורית, וכאן מדובר במסמכים של לקוחות בחברת שירותי עזר
 * לנכים. הדלי שלנו פרטי, והקריאה עוברת דרך כתובת חתומה לזמן קצר.
 */

export const BUCKET = 'wa-media';

/** 🔴 תקרה. קובץ ענק יפיל את הפונקציה, ואז גם ההודעה עצמה לא תירשם. */
const MAX_BYTES = 15 * 1024 * 1024;
/** שעון עצר למשיכה. בלעדיו וובהוק אחד תוקע את כל הצינור. */
const FETCH_MS = 8000;
/** אחרי כמה ניסיונות מפסיקים לנסות ומודים בכישלון בגלוי. */
const MAX_TRIES = 6;

export interface HeyyFile {
  id?: string;
  url?: string;
  name?: string;
  size?: number;
  type?: string;
  contentType?: string;
}

export interface HeyyAttachment {
  id?: string;
  type?: string;
  file?: HeyyFile;
  /** הנתיב אצלנו. קיים רק אחרי שההעתקה הצליחה. */
  stored_path?: string;
  /** למה ההעתקה נכשלה, כשנכשלה. נשמר כדי שאפשר יהיה לאבחן בלי לוגים. */
  stored_error?: string;
}

export type MediaState = 'none' | 'stored' | 'pending' | 'failed';

/**
 * שם קובץ בטוח לנתיב אחסון.
 *
 * 🔴 שמות המסמכים אצלנו עבריים (`תעודת משלוח.pdf`), ומפתחות אחסון עם
 * תווים שאינם ASCII נדחים או נשברים בחתימה. הסיומת נשמרת כי היא מה
 * שקובע איך הדפדפן יציג את הקובץ.
 */
function safeKey(name: string | undefined, fallback: string): string {
  const raw = String(name ?? '').trim();
  const dot = raw.lastIndexOf('.');
  const ext = dot > 0 ? raw.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) : '';
  // 🔴 **הנקודה אסורה בגזע השם, ורק הסיומת מחזיקה אחת.** בגרסה הראשונה
  // היא הייתה ברשימת המותרים, ולכן `../../secrets/keys.pem` הפך ל-
  // `..-..-secrets-keys.pem`: הלוכסנים נעלמו אבל `..` שרד. השם מגיע
  // מהמטען של heyy, כלומר מצד שלישי, ואין סיבה לתת לו נקודות בכלל.
  const base = raw
    .slice(0, dot > 0 ? dot : undefined)
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const stem = base || fallback;
  return ext ? `${stem}.${ext}` : stem;
}

async function fetchBounded(url: string): Promise<{ bytes: Buffer; contentType: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`http ${res.status}`);

    // 🔴 בדיקת גודל **לפני** הקריאה לזיכרון, כשהספק טרח להצהיר עליו.
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > MAX_BYTES) throw new Error(`too large: ${declared}`);

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) throw new Error(`too large: ${buf.length}`);
    if (!buf.length) throw new Error('empty body');

    return {
      bytes: buf,
      contentType: res.headers.get('content-type') || 'application/octet-stream',
    };
  } finally {
    clearTimeout(timer);
  }
}

export interface StoreResult {
  state: MediaState;
  attachments: HeyyAttachment[];
  /** כמה קבצים הועתקו בקריאה הזאת. אפס פירושו שלא היה מה לעשות. */
  copied: number;
}

/**
 * מעתיק את כל הקבצים של הודעה אחת לדלי שלנו.
 *
 * ⭐ **אידמפוטנטי:** קובץ שכבר נושא `stored_path` מדולג. heyy יורה כמה
 * אירועים על אותה הודעה (`pending` ואז `delivered` ואז `read`), וזה
 * דווקא לטובתנו: כל אירוע כזה הוא הזדמנות חוזרת להעתיק קובץ שנפל,
 * בתוך שניות ובלי שום תשתית נוספת.
 */
export async function storeAttachments(
  conversationId: string,
  heyyMessageId: string,
  attachments: HeyyAttachment[],
): Promise<StoreResult> {
  if (!attachments.length) return { state: 'none', attachments, copied: 0 };

  const out: HeyyAttachment[] = [];
  let copied = 0;
  let anyPending = false;

  for (let i = 0; i < attachments.length; i++) {
    const att = attachments[i] ?? {};
    if (att.stored_path) {
      out.push(att);
      continue;
    }

    const url = att.file?.url;
    if (!url) {
      // מצורף בלי כתובת אינו כישלון שאפשר לתקן בניסיון חוזר.
      out.push({ ...att, stored_error: 'אין כתובת לקובץ' });
      continue;
    }

    const fileId = att.file?.id || String(i);
    const path = `${conversationId}/${heyyMessageId}/${fileId}-${safeKey(att.file?.name, 'file')}`;

    try {
      const { bytes, contentType } = await fetchBounded(url);
      const { error } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(path, bytes, {
          contentType: att.file?.contentType || contentType,
          upsert: true,
        });
      if (error) throw new Error(error.message);

      out.push({ ...att, stored_path: path, stored_error: undefined });
      copied++;
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      // 🔴 כישלון נרשם **על המצורף עצמו**, לא רק בלוג. לוג מסתובב, והשאלה
      // "למה אין פה קובץ" נשאלת חודשיים אחרי.
      out.push({ ...att, stored_error: detail.slice(0, 200) });
      anyPending = true;
      console.error('[wa-media] copy failed', { path, detail });
    }
  }

  const allStored = out.every((a) => a.stored_path || (!a.file?.url && a.stored_error));
  return {
    state: allStored ? 'stored' : anyPending ? 'pending' : 'failed',
    attachments: out,
    copied,
  };
}

/**
 * ההעתקה מופעלת על שורת הודעה קיימת, אחרי שהוובהוק כבר רשם אותה.
 *
 * 🔴 **הסדר הזה מכוון.** ההעתקה עלולה להיכשל או להתעכב, והרישום של
 * ההודעה עצמה חשוב יותר: הודעה בלי קובץ עדיין הודעה, קובץ בלי הודעה
 * הוא כלום. לכן קודם נרשמת ההודעה, ורק אחריה נוגעים בקבצים.
 */
export async function copyMediaForMessage(heyyMessageId: string): Promise<StoreResult | null> {
  const { data: row, error } = await supabaseAdmin
    .from('wa_messages')
    .select('id, conversation_id, attachments, media_state, media_tries')
    .eq('heyy_message_id', heyyMessageId)
    .maybeSingle();

  if (error) {
    console.error('[wa-media] lookup failed', error.message);
    return null;
  }
  if (!row) return null;

  const atts = (Array.isArray(row.attachments) ? row.attachments : []) as HeyyAttachment[];
  if (!atts.length) {
    if (row.media_state !== 'none') {
      await supabaseAdmin.from('wa_messages').update({ media_state: 'none' }).eq('id', row.id);
    }
    return { state: 'none', attachments: atts, copied: 0 };
  }
  if (row.media_state === 'stored') return { state: 'stored', attachments: atts, copied: 0 };

  const tries = Number(row.media_tries ?? 0);
  if (row.media_state === 'failed' && tries >= MAX_TRIES) {
    return { state: 'failed', attachments: atts, copied: 0 };
  }

  const result = await storeAttachments(row.conversation_id, heyyMessageId, atts);

  // 🔴 אחרי שהניסיונות מוצו, "ממתין" הופך ל"נכשל". ההבדל אינו סמנטי:
  // "ממתין" לנצח הוא בדיוק הכשל השקט שהעמודה הזאת נועדה למנוע.
  const nextTries = tries + 1;
  const state: MediaState =
    result.state === 'pending' && nextTries >= MAX_TRIES ? 'failed' : result.state;

  const { error: upErr } = await supabaseAdmin
    .from('wa_messages')
    .update({ attachments: result.attachments, media_state: state, media_tries: nextTries })
    .eq('id', row.id);

  if (upErr) console.error('[wa-media] state update failed', upErr.message);
  return { ...result, state };
}
