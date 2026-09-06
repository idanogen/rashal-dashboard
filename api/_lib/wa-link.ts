// ─── שיוך שיחה לא מזוהה ללקוח, ומה שבא אחריו ─────────────────────────────
//
// הבעיה (עידן, 06/09/2026, מהמשרד של ר.שעל): לקוחה בלי נייד, הבת שולחת
// תמונה מהטלפון שלה. ההודעה מזוהה לפי טלפון בלבד, ולכן השיחה נשארת
// "לא מזוהה" והתמונה לא מגיעה לקריאה ולא לכרטיס הלקוח בפריוריטי.
//
// שלושה מסלולים, כולם נגמרים כאן:
//   א. שליחה "למספר אחר" מהכרטיס של הלקוח זוכרת את המספר (`rememberContact`).
//   ב. "שייך ללקוח" על שיחה לא מזוהה (`linkConversation`).
//   ג. תשובה אוטומטית שמבקשת שם ות.ז., ואז הצעה לאישור (`askIdentity`,
//      `suggestFromReply`). 🔴 אף פעם לא שיוך בלי לחיצה של עובד.
//
// ⭐ אחרי השיוך, התמונות שכבר נשלחו עוברות ללקוח **רטרואקטיבית**: הן
// מועתקות מהדלי הפרטי של הוואטסאפ לדלי הציבורי של ציר הזמן, ונרשמות
// כאירוע על הקריאה הפתוחה של הלקוח (אם יש) או ישירות על כרטיס הלקוח.
// משם הדחיפה הרגילה לפריוריטי לוקחת אותן (`priority_push_candidates`).

import { supabaseAdmin } from './supabase-admin.js';
import { heyySendText } from './heyy-server.js';
import { BUCKET as WA_BUCKET, type HeyyAttachment } from './wa-media.js';

const TIMELINE_BUCKET = 'timeline-files';

export interface LinkResult {
  ok: true;
  customerNumber: string;
  customerName: string;
  photos: number;
  serviceCallId: string | null;
}

interface LinkedMessage {
  id: string;
  heyy_message_id: string | null;
  sent_at: string;
  body: string | null;
  attachments: HeyyAttachment[];
}

function extFromPath(path: string, fallback = 'jpg'): string {
  const m = /\.([a-z0-9]{2,5})$/i.exec(path);
  return m ? m[1].toLowerCase() : fallback;
}

/**
 * הקריאה הפתוחה של הלקוח שמחכה לתמונה, אם יש כזאת. התמונה נרשמת עליה
 * (ומדליקה את החיווי הירוק), ולא רק על הכרטיס.
 */
async function openMediaRequestFor(customerNumber: string): Promise<{ id: string; service_call_id: string } | null> {
  const { data } = await supabaseAdmin
    .from('media_requests')
    .select('id, service_call_id, state, created_at, service_calls!inner(customer_number)')
    .eq('service_calls.customer_number', customerNumber)
    .in('state', ['pending', 'first_sent', 'reminder_sent'])
    .order('created_at', { ascending: false })
    .limit(1);
  const row = (data as Array<{ id: string; service_call_id: string }> | null)?.[0];
  return row?.service_call_id ? { id: row.id, service_call_id: row.service_call_id } : null;
}

/**
 * מעתיק את התמונות של ההודעות (שכבר יושבות בדלי הפרטי) לדלי הציבורי,
 * ורושם אירוע ציר-זמן על הלקוח. מחזיר כמה תמונות נרשמו.
 */
async function mirrorPhotosToCustomer(
  conversationId: string,
  customerNumber: string,
  label: string | null,
  messages: LinkedMessage[],
): Promise<{ photos: number; serviceCallId: string | null }> {
  const mr = await openMediaRequestFor(customerNumber);
  let photos = 0;

  for (const m of messages) {
    const imageUrls: string[] = [];
    const names: string[] = [];
    let i = 0;
    for (const att of m.attachments ?? []) {
      i++;
      const kind = String(att.file?.contentType ?? att.file?.type ?? att.type ?? '').toLowerCase();
      if (!/image|video/.test(kind)) continue;
      if (!att.stored_path) continue; // העותק שלנו עוד לא נוצר; יגיע בסבב הבא של הוובהוק
      const dl = await supabaseAdmin.storage.from(WA_BUCKET).download(att.stored_path);
      if (dl.error || !dl.data) { console.error('[wa-link] download failed', att.stored_path, dl.error?.message); continue; }
      const buf = Buffer.from(await dl.data.arrayBuffer());
      const ext = extFromPath(att.stored_path, kind.includes('video') ? 'mp4' : 'jpg');
      const path = `wa-link/${conversationId}/${m.id}-${i}.${ext}`;
      const up = await supabaseAdmin.storage.from(TIMELINE_BUCKET).upload(path, buf, {
        contentType: att.file?.contentType || dl.data.type || undefined,
        upsert: true,
      });
      if (up.error) { console.error('[wa-link] upload failed', path, up.error.message); continue; }
      const { data: pub } = supabaseAdmin.storage.from(TIMELINE_BUCKET).getPublicUrl(path);
      if (pub?.publicUrl) { imageUrls.push(pub.publicUrl); names.push(att.file?.name ?? `קובץ ${i}`); }
    }
    if (!imageUrls.length) continue;

    const who = label ? `${label} (וואטסאפ)` : 'הלקוח (וואטסאפ)';
    const text = m.body ? `תמונה מוואטסאפ: ${m.body}` : 'תמונה מוואטסאפ';
    const { error } = await supabaseAdmin.from('timeline_events').insert({
      id: crypto.randomUUID(),
      service_call_id: mr?.service_call_id ?? null,
      customer_number: customerNumber,
      type: 'file_upload',
      user_id: 'wa-customer',
      user_name: who,
      content: text,
      files: names,
      metadata: { imageUrls, source: 'conversation-link', wa_message_id: m.id, conversation_id: conversationId },
      created_at: m.sent_at,
    });
    if (error) { console.error('[wa-link] timeline insert failed', error.message); continue; }
    photos += imageUrls.length;
  }

  // התמונה סוגרת את בקשת "תמונה לפני טכנאי" של הלקוח, כאילו הגיעה ממנו.
  if (photos && mr) {
    await supabaseAdmin
      .from('media_requests')
      .update({ state: 'media_received', media_received_at: new Date().toISOString() })
      .eq('id', mr.id);
  }
  return { photos, serviceCallId: mr?.service_call_id ?? null };
}

export async function linkConversation(opts: {
  conversationId: string;
  customerNumber: string;
  label: string | null;
  remember: boolean;
  author: string;
  source?: 'linked_by_user' | 'identity_reply';
}): Promise<LinkResult> {
  const { data, error } = await supabaseAdmin.rpc('wa_link_conversation', {
    p_conversation: opts.conversationId,
    p_customer: opts.customerNumber,
    p_label: opts.label,
    p_remember: opts.remember,
    p_author: opts.author,
    p_source: opts.source ?? 'linked_by_user',
  });
  if (error) throw new Error(error.message);
  const r = data as { customer_number: string; customer_name: string; messages: LinkedMessage[] };
  const mirrored = await mirrorPhotosToCustomer(opts.conversationId, r.customer_number, opts.label, r.messages ?? []);
  return { ok: true, customerNumber: r.customer_number, customerName: r.customer_name, ...mirrored };
}

export async function rememberContact(opts: {
  customerNumber: string; phone: string; label: string | null; author: string;
}): Promise<void> {
  const { error } = await supabaseAdmin.rpc('wa_remember_contact', {
    p_customer: opts.customerNumber,
    p_phone: opts.phone,
    p_label: opts.label,
    p_author: opts.author,
    p_source: 'sent_from_card',
  });
  if (error) throw new Error(error.message);
}

export interface PhoneCandidate {
  customer_number: string; customer_name: string | null; city: string | null;
  source: string; label: string | null; score: number;
}
export async function candidatesForPhone(phone: string): Promise<PhoneCandidate[]> {
  const { data, error } = await supabaseAdmin.rpc('wa_customers_for_phone', { p_phone: phone });
  if (error) throw new Error(error.message);
  return (data as PhoneCandidate[]) ?? [];
}

// ─── מסלול ג: בקשת שם ות.ז. אוטומטית ─────────────────────────────────────
// הנוסח ומתג ההפעלה יושבים במסד (`wa_identity_settings`), כדי שעמי או שלומי
// יוכלו לשנות את הנוסח בלי פריסה.

interface IdentitySettings { enabled: boolean; ask_text: string; }

async function identitySettings(): Promise<IdentitySettings> {
  const { data } = await supabaseAdmin.from('wa_identity_settings').select('enabled, ask_text').eq('id', true).maybeSingle();
  return (data as IdentitySettings | null) ?? { enabled: false, ask_text: '' };
}

/**
 * מה לעשות עם הודעה נכנסת בשיחה שלא מזוהה. נקרא מהוובהוק אחרי הרישום.
 * מחזיר מה קרה, לצורך לוג בלבד. לעולם לא זורק.
 */
export async function afterInboundUnidentified(opts: {
  conversationId: string; phoneE164: string; text: string | null; hasVisualMedia: boolean;
}): Promise<string> {
  try {
    const { data: conv } = await supabaseAdmin
      .from('wa_conversations')
      .select('id, customer_number, identity_asked_at, suggested')
      .eq('id', opts.conversationId)
      .maybeSingle();
    if (!conv || conv.customer_number) return 'identified';

    // יותר ממועמד אחד לפי הטלפון: לא מנחשים, מציעים.
    const cands = await candidatesForPhone(opts.phoneE164);
    if (cands.length > 1) {
      const suggested = cands.slice(0, 4).map((c) => ({
        customer_number: c.customer_number, customer_name: c.customer_name, city: c.city, by: 'phone', label: c.label,
      }));
      await supabaseAdmin.from('wa_conversations').update({ suggested }).eq('id', conv.id);
      return 'phone_candidates';
    }

    // תשובה לבקשת הזיהוי: ת.ז. או שם.
    if (opts.text && conv.identity_asked_at) {
      const { data: sug, error } = await supabaseAdmin.rpc('wa_suggest_customers', { p_text: opts.text });
      if (error) throw new Error(error.message);
      const list = Array.isArray(sug) ? sug : [];
      if (list.length) {
        await supabaseAdmin.from('wa_conversations').update({ suggested: list }).eq('id', conv.id);
        return `suggested:${list.length}`;
      }
      return 'no_match';
    }

    // תמונה ראשונה ממספר זר: מבקשים שם ות.ז., פעם אחת.
    if (opts.hasVisualMedia && !conv.identity_asked_at) {
      const cfg = await identitySettings();
      if (!cfg.enabled || !cfg.ask_text.trim()) return 'ask_disabled';
      const r = await heyySendText(opts.phoneE164, cfg.ask_text.trim());
      if (!r.ok) return `ask_failed:${r.statusDetail ?? ''}`;
      await supabaseAdmin.from('wa_conversations').update({ identity_asked_at: new Date().toISOString() }).eq('id', conv.id);
      if (r.waMessageId) {
        await supabaseAdmin.rpc('wa_attribute_message', {
          p_heyy_message_id: r.waMessageId, p_author: 'cron', p_entity_type: null, p_entity_key: null,
        });
      }
      return 'asked';
    }
    return 'nothing';
  } catch (e) {
    console.error('[wa-link] afterInboundUnidentified', e instanceof Error ? e.message : e);
    return 'error';
  }
}
