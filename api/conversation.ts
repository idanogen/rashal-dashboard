import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabase-admin.js';
import { normalizePhone } from './_lib/phone.js';

/**
 * השיחה המלאה מול לקוח אחד. זו נקודת הקצה שהחלונית בפריוריטי צורכת.
 *
 *   GET /api/conversation?phone=0523694547
 *   GET /api/conversation?customer=101143
 *
 * 🔴 **דורש משתמש מחובר.** נלמד מ-`api/heyy-send`, שנפרס בלי אימות בכלל
 * ומאפשר לכל מי שמחזיק את הכתובת לשלוח וואטסאפ מהמספר של הלקוח. נקודת
 * קצה חדשה לא נולדת פתוחה. כאן החשיפה חמורה אף יותר, כי מדובר בתוכן
 * שיחות של מטופלים.
 *
 * מחזיר גם את מצב **חלון 24 השעות של מטא**, שהוא לא קישוט אלא הדבר
 * שקובע אם מותר לכתוב טקסט חופשי או רק תבנית מאושרת.
 */

const WINDOW_HOURS = 24;

async function requireUser(req: VercelRequest): Promise<{ ok: true; userId: string } | { ok: false }> {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return { ok: false };

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return { ok: false };
  return { ok: true, userId: data.user.id };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const user = await requireUser(req);
  if (!user.ok) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const phone = typeof req.query.phone === 'string' ? req.query.phone : null;
  const customer = typeof req.query.customer === 'string' ? req.query.customer : null;

  if (!phone && !customer) {
    return res.status(400).json({ ok: false, error: 'need phone or customer' });
  }

  // 🔴 הנרמול חייב להיות זהה לזה שרשם את השיחה. `wa_normalize_phone`
  // במסד מיושר תו בתו ל-`normalizePhone` כאן, ויש טסט שמאמת את ההסכמה
  // (`test/phone-parity.test.mjs`). שתי צורות נרמול שונות על אותו מספר
  // מחזירות "אין שיחה" על לקוח שיש לו שיחה, וזה כשל שקט.
  let query = supabaseAdmin.from('wa_conversations').select('*');
  if (phone) {
    const norm = normalizePhone(phone);
    if (!norm) return res.status(400).json({ ok: false, error: 'invalid phone' });
    query = query.eq('phone_local', norm);
  } else {
    query = query.eq('customer_number', customer as string);
  }

  const { data: conv, error } = await query
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[conversation] lookup failed', error);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }

  if (!conv) {
    // לקוח בלי שיחה אינו שגיאה. החלונית תציג "עוד לא דיברתם".
    return res.status(200).json({ ok: true, conversation: null, messages: [], window: closedWindow() });
  }

  const { data: messages, error: msgErr } = await supabaseAdmin
    .from('wa_messages')
    .select('id, direction, body, attachments, status, template_id, entity_type, entity_key, author, sent_at')
    .eq('conversation_id', conv.id)
    .order('sent_at', { ascending: true })
    .limit(500);

  if (msgErr) {
    console.error('[conversation] messages failed', msgErr);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }

  return res.status(200).json({
    ok: true,
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
  });
}

function closedWindow() {
  return { open: false, expiresAt: null as string | null, minutesLeft: 0, reason: 'אין הודעה נכנסת' };
}

/**
 * מצב חלון 24 השעות.
 *
 * נגזר מ-`last_inbound_at` בזמן הקריאה ולא נשמר כעמודה, כי עמודה שמורה
 * מתיישנת בשקט. הפער בין "החלון נסגר לפני דקה" ל"המסך עדיין מראה פתוח"
 * הוא בדיוק הפער שגורם למשתמש לשלוח טקסט חופשי שלא יימסר לעולם, ולקבל
 * מ-heyy תשובת הצלחה על זה.
 */
function windowState(lastInboundAt: string | null) {
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
