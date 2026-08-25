import { supabaseAdmin } from './supabase-admin.js';

/**
 * רישום הודעה לשכבת השיחות (`wa_conversations` + `wa_messages`).
 *
 * ⭐ **הוובהוק הוא הכותב היחיד לשכבה הזאת, גם להודעות יוצאות.**
 * זו החלטה ולא נוחות: `message.sent` נורה על כל הודעה שיוצאת מהערוץ,
 * כולל כזו שעובד הקליד ידנית בממשק של heyy. אם היינו רושמים רק ממה
 * שיצא דרך `api/heyy-send`, השרשור היה חסר בדיוק את החלק האנושי,
 * ושיחה חלקית גרועה מאין שיחה: היא נראית שלמה.
 *
 * המטען של הוובהוק גם עשיר יותר מתשובת השליחה. יש בו `chat.id`,
 * פרטי איש הקשר וחותמת הזמן האמיתית של ההודעה.
 */

export interface HeyyMessageData {
  id?: string;
  vendorId?: string;
  chat?: { id?: string };
  contact?: { id?: string; firstName?: string; lastName?: string; phoneNumber?: string };
  handle?: { value?: string };
  content?: { body?: string; attachments?: unknown[] };
  status?: string;
  sender?: string;
  timestamp?: string;
  messageTemplateId?: string;
}

/** שם התצוגה של איש הקשר כפי ש-heyy מכיר אותו. */
function contactName(c: HeyyMessageData['contact']): string | null {
  const parts = [c?.firstName, c?.lastName].filter(Boolean).map((s) => String(s).trim());
  // heyy מחזיר לפעמים את אותו ערך בשני השדות (פרופיל וואטסאפ בלי שם משפחה)
  const unique = parts.filter((p, i) => parts.indexOf(p) === i);
  const name = unique.join(' ').trim();
  return name || null;
}

export interface RecordResult {
  ok: boolean;
  conversationId?: string;
  error?: string;
}

export async function recordToThread(
  data: HeyyMessageData,
  opts: { entityType?: string | null; entityKey?: string | null; author?: string | null } = {},
): Promise<RecordResult> {
  const phone = data.contact?.phoneNumber ?? data.handle?.value ?? null;
  if (!phone) return { ok: false, error: 'no phone' };

  const direction = data.sender === 'outbound' ? 'out' : 'in';

  const { data: convId, error } = await supabaseAdmin.rpc('wa_record_message', {
    p_heyy_message_id: data.id ?? null,
    p_vendor_message_id: data.vendorId ?? null,
    p_chat_id: data.chat?.id ?? null,
    p_contact_id: data.contact?.id ?? null,
    p_phone_e164: phone,
    p_contact_name: contactName(data.contact),
    p_direction: direction,
    p_body: data.content?.body ?? null,
    p_attachments: (data.content?.attachments ?? []) as unknown,
    p_status: data.status ?? null,
    p_template_id: data.messageTemplateId ?? null,
    p_entity_type: opts.entityType ?? null,
    p_entity_key: opts.entityKey ?? null,
    p_author: opts.author ?? null,
    p_sent_at: data.timestamp ?? new Date().toISOString(),
  });

  if (error) {
    console.error('[wa-thread] rpc failed:', error.message);
    return { ok: false, error: error.message };
  }

  // ⭐⭐ **בקשת הסרה נקלטת ברגע שהיא נאמרת.** רשימת מושתקים שמתמלאת
  // ביד היא רשימה שתישאר ריקה, ואז שורת ההסרה בתבנית היא הבטחה שאין
  // מי שמקיים. [[whatsapp_template_submission_traps]]
  //
  // 🔴 **רק על הודעה נכנסת, ורק כשההודעה כולה היא הבקשה.** הזיהוי
  // עצמו (`wa_is_optout`) הוא התאמה מלאה לרשימה סגורה, כי לקוח
  // שהושתק בטעות נעלם מאיתנו בלי שאיש ידע.
  if (direction === 'in' && data.content?.body) {
    const { error: muteErr } = await supabaseAdmin.rpc('wa_note_optout', {
      p_phone: phone,
      p_body: data.content.body,
    });
    // 🔴 כשל כאן אינו מפיל את קליטת ההודעה: היא כבר נשמרה, וזה העיקר.
    if (muteErr) console.error('[wa-thread] optout note failed:', muteErr.message);
  }

  return { ok: true, conversationId: (convId as string) ?? undefined };
}
