import { supabaseAdmin } from './supabase-admin.js';
import { normalizePhone } from './phone.js';

/**
 * טעינת שרשור השיחה של לקוח אחד, ומצב חלון 24 השעות של מטא.
 *
 * מקום אחד ולא שניים: גם `api/conversation` (הדשבורד) וגם
 * `api/priority-context` (החלונית בפריוריטי) מחזירים בדיוק את אותו מבנה.
 * שני מימושים של אותה שאילתה נפרדים בשקט, ואז מסך אחד מראה שיחה
 * והשני מראה "עוד לא דיברתם" על אותו לקוח.
 */

const WINDOW_HOURS = 24;

export interface WindowState {
  open: boolean;
  expiresAt: string | null;
  minutesLeft: number;
  reason: string | null;
}

export function closedWindow(reason = 'אין הודעה נכנסת'): WindowState {
  return { open: false, expiresAt: null, minutesLeft: 0, reason };
}

/**
 * מצב חלון 24 השעות.
 *
 * נגזר מ-`last_inbound_at` בזמן הקריאה ולא נשמר כעמודה, כי עמודה שמורה
 * מתיישנת בשקט. הפער בין "החלון נסגר לפני דקה" ל"המסך עדיין מראה פתוח"
 * הוא בדיוק הפער שגורם למשתמש לשלוח טקסט חופשי שלא יימסר לעולם, ולקבל
 * מ-heyy תשובת הצלחה על זה.
 */
export function windowState(lastInboundAt: string | null): WindowState {
  if (!lastInboundAt) return closedWindow();

  const expires = new Date(new Date(lastInboundAt).getTime() + WINDOW_HOURS * 3600_000);
  const minutesLeft = Math.floor((expires.getTime() - Date.now()) / 60_000);

  return {
    open: minutesLeft > 0,
    expiresAt: expires.toISOString(),
    minutesLeft: Math.max(0, minutesLeft),
    reason: minutesLeft > 0 ? null : 'עברו 24 שעות מההודעה האחרונה של הלקוח',
  };
}

export interface ThreadResult {
  conversation: {
    id: string;
    phone: string | null;
    phoneE164: string | null;
    contactName: string | null;
    customerNumber: string | null;
    customerName: string | null;
    messageCount: number | null;
    lastMessageAt: string | null;
    unansweredSince: string | null;
  } | null;
  window: WindowState;
  messages: unknown[];
}

/**
 * 🔴 הנרמול חייב להיות זהה לזה שרשם את השיחה. `wa_normalize_phone` במסד
 * מיושר תו בתו ל-`normalizePhone` כאן, ויש טסט שנועל את ההסכמה
 * (`test/phone-parity.test.mjs`). שתי צורות נרמול שונות על אותו מספר
 * מחזירות "אין שיחה" על לקוח שיש לו שיחה, וזה כשל שקט.
 */
export async function loadThread(by: { phone?: string | null; customer?: string | null }): Promise<ThreadResult> {
  let query = supabaseAdmin.from('wa_conversations').select('*');

  if (by.phone) {
    const norm = normalizePhone(by.phone);
    if (!norm) throw new Error('invalid phone');
    query = query.eq('phone_local', norm);
  } else if (by.customer) {
    query = query.eq('customer_number', by.customer);
  } else {
    throw new Error('need phone or customer');
  }

  const { data: conv, error } = await query
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);

  // לקוח בלי שיחה אינו שגיאה. החלונית תציג "עוד לא דיברתם".
  if (!conv) return { conversation: null, window: closedWindow(), messages: [] };

  const { data: messages, error: msgErr } = await supabaseAdmin
    .from('wa_messages')
    .select('id, direction, body, attachments, status, template_id, entity_type, entity_key, author, sent_at')
    .eq('conversation_id', conv.id)
    .order('sent_at', { ascending: true })
    .limit(500);

  if (msgErr) throw new Error(msgErr.message);

  return {
    conversation: {
      id: conv.id,
      phone: conv.phone_local,
      phoneE164: conv.phone_e164,
      contactName: conv.contact_name,
      customerNumber: conv.customer_number,
      customerName: conv.customer_name,
      messageCount: conv.message_count,
      lastMessageAt: conv.last_message_at,
      unansweredSince: conv.unanswered_since,
    },
    window: windowState(conv.last_inbound_at),
    messages: messages ?? [],
  };
}
