import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabase-admin.js';
import { extractMessage, parseCustomerReply } from './_lib/extract.js';
import { normalizePhone, toE164 } from './_lib/phone.js';
import { recordToThread } from './_lib/wa-thread.js';
import { copyMediaForMessage } from './_lib/wa-media.js';

/**
 * מקלט הוובהוקים של heyy.
 *
 * הגדרה: heyy → הגדרות → וובהוקים → הוסף וובהוק
 *   כתובת:  https://rashal-dashboard.vercel.app/api/heyy-webhook?k=<HEYY_WEBHOOK_SECRET>
 *   ערוץ:   ר.שעל שירותי עזר לנכים
 *   אירועים: הודעה נכנסה · הודעה נשלחה · הודעה עודכנה
 *
 * 🔴 הסוד יושב בכתובת ולא בכותרת, כי **בטופס של heyy אין שדה לכותרת מותאמת**.
 * בלי זה האנדפוינט פתוח לכל מי שמחזיק את הכתובת, וכל אחד יכול להזריק
 * "הודעות מלקוח" מזויפות. הכותרות עדיין נתמכות, למקרה שהם יוסיפו את השדה.
 *
 * 🔴 קודם שומרים, אחר כך מפרשים. כל מטען נכנס נכתב ל-`heyy_webhook_log`
 * לפני כל ניסיון טיפול. אין ל-heyy תיעוד למבנה המטענים, ושמות האירועים
 * מוכרים לנו רק מהתוויות בעברית בממשק. מטען שלא הצלחנו לפרש נשאר ביומן
 * עם `handled=false`, וזה מה שנקרא כדי ללמוד את המבנה האמיתי.
 *
 * מחזיר 200 כמעט תמיד, כי heyy עושה retry על 4xx/5xx ושגיאת ולידציה
 * אינה תקלת שרת. היוצא מן הכלל הוא נפילת מסד, ששם retry דווקא נכון.
 */

const SECRET = process.env.HEYY_WEBHOOK_SECRET;

/** בורר את הערך הראשון שקיים מתוך כמה נתיבים אפשריים במטען. */
function pick(obj: unknown, paths: string[]): string | null {
  for (const path of paths) {
    let cur: any = obj;
    for (const part of path.split('.')) {
      if (cur === null || cur === undefined) break;
      cur = cur[part];
    }
    if (typeof cur === 'string' && cur.trim()) return cur.trim();
    if (typeof cur === 'number') return String(cur);
  }
  return null;
}

function isAuthorized(req: VercelRequest): boolean {
  if (!SECRET) return true; // לא הוגדר סוד — לא חוסמים, אבל זו חשיפה
  const fromQuery = typeof req.query.k === 'string' ? req.query.k : null;
  const fromHeader = req.headers['x-heyy-secret'] ?? req.headers['x-webhook-secret'];
  return fromQuery === SECRET || fromHeader === SECRET;
}

/**
 * לאיזה מסלול טיפול שייך האירוע.
 *
 * ההתאמה רופפת בכוונה: אנחנו מכירים את שלושת האירועים מהתווית בעברית
 * בממשק של heyy ולא מתיעוד, ולכן לא נסמוך על מחרוזת מדויקת.
 */
function routeOf(event: string | null, payload: any): 'inbound' | 'status' | 'outbound' | 'unknown' {
  const e = (event ?? '').toLowerCase();
  if (e.includes('updat')) return 'status';
  if (e.includes('receiv') || e.includes('inbound')) return 'inbound';
  if (e.includes('sent') || e.includes('outbound')) return 'outbound';

  // בלי שם אירוע: מנחשים לפי כיוון ההודעה, ואם גם זה חסר נשארים ב-unknown
  const sender = pick(payload, ['data.sender', 'message.sender', 'sender']);
  if (sender === 'inbound') return 'inbound';
  if (sender === 'outbound') return 'outbound';
  return 'unknown';
}

/**
 * ממפה סטטוס של heyy לערכי האנום שלנו.
 *
 * מחזור החיים המלא נצפה חי (20/08/2026, הודעה אחת):
 *   pending → pending → delivered → delivered → read
 * כלומר heyy יורה כמה עדכונים לאותו סטטוס, והעדכון אינו מגיע פעם אחת.
 * לכן העדכון חייב להיות אידמפוטנטי, וזה מה שהוא.
 */
function mapStatus(raw: string | null): 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s.includes('deliver') && !s.includes('undeliver')) return 'delivered';
  if (s.includes('read') || s.includes('seen')) return 'read';
  if (s.includes('fail') || s.includes('error') || s.includes('reject') || s.includes('undeliver')) return 'failed';
  if (s.includes('sent')) return 'sent';
  // pending אינו שינוי מסירה, אבל הוא סטטוס מוכר. בלי זה כל שליחה
  // היתה מייצרת שתי שורות "לא מוכר" ביומן ומטביעה את מה שבאמת חריג.
  if (s.includes('pending') || s.includes('queue') || s.includes('accept')) return 'pending';
  return null;
}

/** דירוג התקדמות. סטטוס לא נסוג אחורה בגלל עדכון שהגיע מאוחר. */
const STATUS_RANK: Record<string, number> = {
  pending: 0, sent: 1, delivered: 2, read: 3, failed: 4,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'bad secret' });
  }

  const payload = (req.body ?? {}) as any;
  const event = pick(payload, ['event', 'type', 'eventName']);
  const route = routeOf(event, payload);

  const waMessageId = pick(payload, [
    'data.id', 'data.waMessageId', 'data.messageId',
    'message.id', 'id', 'waMessageId',
  ]);
  const rawPhoneForLog = pick(payload, [
    'data.contact.phoneNumber', 'data.handle.value', 'data.to', 'data.from',
    'message.from', 'from', 'to',
  ]);

  // 🔴 שמירה לפני פירוש. גם מטען שלא נבין לא ילך לאיבוד.
  const { data: logRow } = await supabaseAdmin
    .from('heyy_webhook_log')
    .insert({
      event,
      route,
      wa_message_id: waMessageId,
      phone_e164: toE164(rawPhoneForLog),
      payload,
      handled: false,
    })
    .select('id')
    .single();

  const logId = logRow?.id ?? null;

  const finish = async (handled: boolean, note: string, body: Record<string, unknown>) => {
    if (logId) {
      await supabaseAdmin
        .from('heyy_webhook_log')
        .update({ handled, note })
        .eq('id', logId);
    }
    return res.status(200).json({ ok: handled, route, ...body });
  };

  const vendorMessageId = pick(payload, ['data.vendorId', 'data.vendorMessageId', 'vendorId']);

  // ⭐ שכבת השיחות נכתבת מכאן, ומכאן בלבד, לכל שלושת האירועים.
  // כך גם הודעה שעובד הקליד ידנית בממשק של heyy נוחתת בשרשור.
  // הקריאה אידמפוטנטית לפי מזהה ההודעה, ולכן עדכון חוזר לא מכפיל.
  // כישלון כאן לא מפיל את הטיפול: השכבה הישנה עדיין נכתבת למטה.
  if (payload?.data) {
    const thread = await recordToThread(payload.data);
    if (!thread.ok) console.error('[heyy-webhook] thread record failed:', thread.error);

    // ── עותק משלנו לקבצים ────────────────────────────────
    //
    // 🔴 הכתובות של heyy פגות אחרי 24 שעות, וזה מדוד ולא משוער. בלי
    // עותק, כל שרשור שישן מיממה מציג ריבועים שבורים.
    //
    // ⭐ **וזה רץ על כל אירוע, לא רק על הראשון, וזו הנקודה.** heyy יורה
    // `pending` ואז `delivered` ואז `read` על אותה הודעה, כלומר יש כאן
    // שלוש עד חמש הזדמנויות חוזרות להעתיק קובץ שנפל, בתוך שניות
    // ובלי שום תשתית תזמון נוספת. קובץ שכבר הועתק מדולג מיד.
    //
    // 🔴 והכישלון כאן בכוונה לא מפיל את הוובהוק: הודעה בלי קובץ עדיין
    // הודעה, קובץ בלי הודעה הוא כלום.
    const hasFiles = Array.isArray(payload.data?.content?.attachments)
      && payload.data.content.attachments.length > 0;
    if (thread.ok && hasFiles && waMessageId) {
      try {
        const media = await copyMediaForMessage(waMessageId);
        if (media && media.state !== 'stored' && media.state !== 'none') {
          console.error('[heyy-webhook] media not stored', { waMessageId, state: media.state });
        }
      } catch (e) {
        console.error('[heyy-webhook] media copy threw', e instanceof Error ? e.message : e);
      }
    }
  }

  if (route === 'status') {
    return handleStatus(payload, waMessageId, vendorMessageId, finish);
  }
  if (route === 'outbound') {
    // הד של הודעה יוצאת. מטופל היום רק כדי לעדכן סטטוס אם יש כזה,
    // ולא יוצר שורה חדשה: השורה נוצרת בשליחה עצמה ב-api/heyy-send.
    return handleStatus(payload, waMessageId, vendorMessageId, finish);
  }
  if (route !== 'inbound') {
    return finish(false, `אירוע לא מוכר: ${event ?? 'ללא שם'}`, { ignored: true });
  }

  return handleInbound(payload, finish, res);
}

type Finish = (handled: boolean, note: string, body: Record<string, unknown>) => Promise<unknown>;

/**
 * עדכון סטטוס מסירה על שורת ההודעה היוצאת.
 *
 * ההתאמה נעשית על **שני** המזהים, כי heyy מחזיק שניים לכל הודעה
 * (`data.id` שלו ו-`data.vendorId` של מטא), ולא מובטח שעדכון יגיע
 * באותו אחד שבו נשלחה התשובה לשליחה.
 */
async function handleStatus(
  payload: any,
  waMessageId: string | null,
  vendorMessageId: string | null,
  finish: Finish,
) {
  const status = mapStatus(
    pick(payload, ['data.status', 'data.state', 'message.status', 'status', 'state']),
  );

  if (!waMessageId && !vendorMessageId) {
    return finish(false, 'עדכון סטטוס בלי מזהה הודעה', { error: 'no message id' });
  }
  if (!status) {
    return finish(false, 'עדכון סטטוס בלי סטטוס מוכר', { error: 'no status' });
  }

  const matchers = [
    waMessageId ? `wa_message_id.eq.${waMessageId}` : null,
    vendorMessageId ? `vendor_message_id.eq.${vendorMessageId}` : null,
  ].filter(Boolean) as string[];

  const { data: rows } = await supabaseAdmin
    .from('whatsapp_outbound')
    .select('id, status, vendor_message_id, delivered_at')
    .or(matchers.join(','));

  if (!rows?.length) {
    // הודעה שנשלחה מהממשק של heyy ולא דרכנו. לא שגיאה, אבל שווה לדעת.
    return finish(false, 'אין שורה יוצאת עם המזהה הזה', { status, matched: 0 });
  }

  // 🔴 heyy יורה כמה עדכונים, ולא בהכרח לפי הסדר. סטטוס לא נסוג אחורה:
  // עדכון `delivered` שמגיע אחרי `read` לא ימחק את העובדה שההודעה נקראה.
  const current = rows[0].status as string;
  if ((STATUS_RANK[status] ?? -1) <= (STATUS_RANK[current] ?? -1) && current !== 'pending') {
    return finish(true, `הסטטוס כבר ${current}, ${status} לא מוריד אותו`, { status: current, matched: rows.length });
  }

  const update: Record<string, unknown> = { status };
  if ((status === 'delivered' || status === 'read') && !rows[0].delivered_at) {
    update.delivered_at = new Date().toISOString();
  }
  if (status === 'failed') {
    update.status_detail = JSON.stringify(payload?.data?.errors ?? payload?.errors ?? null);
  }
  // ה-wamid של מטא חוזר רק בוובהוק, לא בתשובת השליחה. משלימים אותו כאן.
  if (vendorMessageId && !rows[0].vendor_message_id) {
    update.vendor_message_id = vendorMessageId;
  }

  const { data: updated, error } = await supabaseAdmin
    .from('whatsapp_outbound')
    .update(update)
    .or(matchers.join(','))
    .select('id');

  if (error) {
    console.error('[heyy-webhook] status update failed:', error.message);
    return finish(false, `כשל בעדכון סטטוס: ${error.message}`, { error: error.message });
  }
  return finish(true, `סטטוס עודכן ל-${status}`, { status, matched: updated?.length ?? 0 });
}

/** הודעה נכנסת מלקוח. */
async function handleInbound(payload: any, finish: Finish, res: VercelResponse) {
  const extracted = extractMessage(payload);

  if (extracted.ignoredReason) {
    return finish(false, extracted.ignoredReason, { ignored: extracted.ignoredReason });
  }

  const phoneE164 = toE164(extracted.rawPhone);
  const phoneLocal = normalizePhone(extracted.rawPhone);

  // 🔴🔴 **הודעה עם קובץ ובלי טקסט אינה כישלון.**
  //
  // עד 24/08/2026 היא נרשמה כאן כ-`failed` עם "missing phone or text",
  // והוובהוק סומן `handled: false`. זה קרה באמת ב-20/08, כשנכנסה תמונה
  // בלי מילה. **השרשור עצמו כן קיבל אותה** (`recordToThread` רץ לפני
  // הפיצול למסלולים), אבל הלוג הכריז על אובדן שלא קרה.
  //
  // ⭐ וזה הסוג הגרוע של רעש: מי שיסרוק את הלוג יחפש הודעה אבודה שלא
  // אבדה, ויתעלם בפעם הבאה גם מכישלון אמיתי. לוג שמכריז על כשל שגוי
  // שוחק את הערך של כל שאר השורות בו.
  //
  // 🔴 המסלול הישן עצמו באמת דורש טקסט, כי כל תפקידו הוא לפרש תשובת
  // לקוח על הזמנה ("מתאים" / "מחר בבוקר"). תמונה אינה תשובה כזאת, ולכן
  // היא מדולגת בכוונה, ונאמר במפורש שהיא כבר בשרשור.
  const hasAttachments = Array.isArray(payload?.data?.content?.attachments)
    && payload.data.content.attachments.length > 0;

  if (phoneE164 && !extracted.rawText && hasAttachments) {
    return finish(true, 'קובץ בלי טקסט: נרשם בשרשור, ואינו תשובת לקוח לפירוש', {
      skipped: 'media_without_text',
    });
  }

  if (!phoneE164 || !extracted.rawText) {
    await supabaseAdmin.from('whatsapp_inbound').insert({
      provider_message_id: extracted.providerId,
      phone_e164: phoneE164 ?? 'unknown',
      phone_local: phoneLocal,
      body_text: extracted.rawText,
      raw_payload: payload,
      status: 'failed',
      notes: 'missing phone or text',
    });
    return finish(false, 'חסר טלפון או טקסט', { error: 'missing phone or text' });
  }

  if (extracted.providerId) {
    const { data: existing } = await supabaseAdmin
      .from('whatsapp_inbound')
      .select('id')
      .eq('provider_message_id', extracted.providerId)
      .maybeSingle();
    if (existing) {
      return finish(true, 'כפילות, דולג', { deduped: extracted.providerId });
    }
  }

  let orderId: string | null = null;
  if (phoneLocal) {
    const { data: matchingOrders } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('phone', phoneLocal)
      .order('created_at', { ascending: false })
      .limit(1);
    orderId = matchingOrders?.[0]?.id ?? null;
  }

  const parsed = parseCustomerReply(extracted.rawText);

  const { data: inboundRow, error: insertErr } = await supabaseAdmin
    .from('whatsapp_inbound')
    .insert({
      provider_message_id: extracted.providerId,
      phone_e164: phoneE164,
      phone_local: phoneLocal,
      body_text: extracted.rawText,
      raw_payload: payload,
      status: 'received',
      order_id: orderId,
      parsed_reply_status: parsed.status,
    })
    .select()
    .single();

  if (insertErr) {
    console.error('[heyy-webhook] DB insert failed:', insertErr.message);
    // 🔴 500 במכוון, ויחיד בקובץ: המסד נפל, ו-retry של heyy הוא בדיוק
    // מה שרוצים. שגיאת ולידציה לעומת זאת אף פעם לא מחזירה 5xx.
    return res.status(500).json({ ok: false, error: insertErr.message });
  }

  if (orderId && parsed.status) {
    const orderUpdate: Record<string, unknown> = { customer_reply_status: parsed.status };
    if (parsed.requestedTime) orderUpdate.customer_requested_time = parsed.requestedTime;
    await supabaseAdmin.from('orders').update(orderUpdate).eq('id', orderId);
  }

  await supabaseAdmin
    .from('whatsapp_inbound')
    .update({ status: 'processed', processed_at: new Date().toISOString() })
    .eq('id', inboundRow.id);

  return finish(true, 'הודעה נכנסת נקלטה', {
    inboundId: inboundRow.id,
    matchedOrderId: orderId,
    parsedStatus: parsed.status,
  });
}
