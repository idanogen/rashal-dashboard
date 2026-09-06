import { supabaseAdmin } from './supabase-admin.js';
import { normalizePhone } from './phone.js';
import { describeAttachments, describeButtons } from './attachments.js';
import { isWaiting } from './inbox.js';

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
    contactLabel: string | null;
    suggested: Array<{ customer_number: string; customer_name: string | null; city?: string | null; by?: string; label?: string | null }> | null;
    identityAskedAt: string | null;
    messageCount: number | null;
    lastMessageAt: string | null;
    unansweredSince: string | null;
    /** עדיין מחכה לעובד: יש חוב מענה ואיש לא פתח מאז ההודעה האחרונה. */
    waiting: boolean;
    readAt: string | null;
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

  // ⭐ מה-view המסווג: `auto_kind` נגזר פעם אחת במסד (wa_auto_kind), ושני
  // המסכים מציירים לפיו. ראה "להרזות את ההתכתבות", 06/09/2026.
  const { data: messages, error: msgErr } = await supabaseAdmin
    .from('wa_messages_classified')
    .select('id, direction, body, attachments, status, template_id, entity_type, entity_key, author, sent_at, auto_kind')
    .eq('conversation_id', conv.id)
    .order('sent_at', { ascending: true })
    .limit(500);

  if (msgErr) throw new Error(msgErr.message);

  // ── תשובת הסקר, על ההודעה שבה הוא נשלח ──────────────────
  //
  // ⭐ עידן, 25/08/2026: "את האימוג'י כאשר עונים תדביק גם להודעה
  // שנשלחה לבן אדם בצ'אט עצמו." כלומר לא רק חיווי על הלקוח, אלא על
  // **ההודעה הזאת** ומה יצא ממנה.
  //
  // ⭐ **ההצמדה לפי הטוקן, שהוא מזהה חד-חד-ערכי.** הטוקן יושב בכתובת
  // של כפתור התבנית (`.../s/<token>`), ולכן אין כאן ניחוש לפי זמן או
  // לפי נוסח, וגם כששלחנו לאותו לקוח שני סקרים כל אחד מקבל את שלו.
  // 🔴 ובלי סינון `is_test` כאן, בניגוד לחיווי שברשימה: שם השאלה היא
  // "כמה הלקוח מרוצה" ובדיקה היא רעש, וכאן השאלה היא "מה יצא מההודעה
  // הזאת", ובדיקה היא התשובה הנכונה.
  const tokens = new Set<string>();
  for (const m of messages ?? []) {
    const raw = JSON.stringify((m as { attachments?: unknown }).attachments ?? '');
    for (const hit of raw.matchAll(/\/s\/([0-9a-zA-Z_-]{8,64})/g)) tokens.add(hit[1]);
  }
  const answered = new Map<string, { score: number | null; answeredAt: string | null; comment: string | null }>();
  if (tokens.size) {
    try {
      const { data: rows } = await supabaseAdmin
        .from('customer_surveys')
        .select('token, q1_satisfaction, answered_at, comment')
        .in('token', Array.from(tokens))
        .not('answered_at', 'is', null);
      for (const r of (rows ?? []) as Array<Record<string, unknown>>) {
        answered.set(String(r.token), {
          score: r.q1_satisfaction == null ? null : Number(r.q1_satisfaction),
          answeredAt: (r.answered_at as string) ?? null,
          comment: (r.comment as string) ?? null,
        });
      }
    } catch (e) {
      // 🔴 נכשל בשקט. חיווי סקר אינו סיבה להפיל שרשור שיחה.
      console.error('[thread] surveys failed', e instanceof Error ? e.message : e);
    }
  }
  const surveyFor = (attachments: unknown) => {
    if (!answered.size) return undefined;
    const raw = JSON.stringify(attachments ?? '');
    for (const hit of raw.matchAll(/\/s\/([0-9a-zA-Z_-]{8,64})/g)) {
      const found = answered.get(hit[1]);
      if (found) return found;
    }
    return undefined;
  };

  // ── מצב של הודעה אוטומטית: ממתינה, נענתה, או שהרלוונטיות עברה ──
  //
  // עידן, 06/09/2026: "בקשה למילוי סקר, אין סיבה שהיא תרדוף אותנו לעד".
  // ההכרעה כאן, פעם אחת: הדשבורד והחלונית רק מציירים. הכללים שאושרו:
  // סקר: נענה = הציון במקום הבקשה; לא נענה אחרי 14 יום = פג.
  // בקשת תמונה/תזכורת: נענה = תמונה התקבלה; פג = הבקשה בוטלה/ללא מענה.
  // בדרך אליך: פג בסוף אותו היום. תיאום: נענה אם הלקוח כתב תוך 48 שעות,
  // פג אחרי 3 ימים. אחר: פג אחרי יום.
  type AutoState = 'pending' | 'answered' | 'expired';
  const mediaReqs: Array<{ state: string; first_sent_at: string | null; reminder_sent_at: string | null; media_received_at: string | null }> = [];
  if ((messages ?? []).some((m) => (m as { auto_kind?: string | null }).auto_kind?.startsWith('photo'))) {
    try {
      const { data: mrs } = await supabaseAdmin
        .from('media_requests')
        .select('state, first_sent_at, reminder_sent_at, media_received_at')
        .eq('phone_e164', conv.phone_e164)
        .order('created_at', { ascending: false })
        .limit(20);
      for (const r of (mrs ?? []) as typeof mediaReqs) mediaReqs.push(r);
    } catch (e) {
      console.error('[thread] media requests failed', e instanceof Error ? e.message : e);
    }
  }
  const inboundTimes = (messages ?? []).filter((m) => m.direction === 'in').map((m) => new Date(m.sent_at as string).getTime());
  const DAY = 86_400_000;
  const nowMs = Date.now();
  const autoStateFor = (m: { sent_at: string; attachments?: unknown }, kind: string): { state: AutoState; result: string | null } => {
    const at = new Date(m.sent_at).getTime();
    const age = nowMs - at;
    if (kind === 'survey') {
      const s = surveyFor(m.attachments);
      if (s?.answeredAt) return { state: 'answered', result: s.score != null ? `סקר: ${s.score} מתוך 5${s.comment ? ` · "${s.comment}"` : ''}` : 'סקר נענה' };
      return { state: age > 14 * DAY ? 'expired' : 'pending', result: null };
    }
    if (kind === 'photo_request' || kind === 'photo_reminder') {
      // הבקשה שהודעה זו יצאה בשמה: הקרובה ביותר בזמן השליחה (עד 15 דקות).
      let best: (typeof mediaReqs)[number] | null = null; let bestGap = Infinity;
      for (const r of mediaReqs) {
        const ts = [r.first_sent_at, r.reminder_sent_at].filter(Boolean).map((x) => Math.abs(new Date(x as string).getTime() - at));
        const gap = ts.length ? Math.min(...ts) : Infinity;
        if (gap < bestGap) { bestGap = gap; best = r; }
      }
      if (best && bestGap <= 15 * 60_000) {
        if (best.state === 'media_received') return { state: 'answered', result: 'תמונה התקבלה' };
        if (['cancelled', 'no_response', 'skipped', 'replied_no_media'].includes(best.state)) return { state: 'expired', result: null };
        return { state: 'pending', result: null };
      }
      return { state: age > 3 * DAY ? 'expired' : 'pending', result: null };
    }
    if (kind === 'on_way') {
      const sameDay = new Date(m.sent_at).toDateString() === new Date().toDateString();
      return { state: sameDay ? 'pending' : 'expired', result: null };
    }
    if (kind === 'coordination') {
      if (inboundTimes.some((x) => x > at && x - at <= 2 * DAY)) return { state: 'answered', result: 'הלקוח ענה' };
      return { state: age > 3 * DAY ? 'expired' : 'pending', result: null };
    }
    return { state: age > DAY ? 'expired' : 'pending', result: null };
  };

  // ── שם השולח האמיתי ─────────────────────────────────────
  //
  // 🔴 `author` נכתב כ-`user:<email>`, והמיילים אצל רשעל מגובבים
  // (`u<40hex>@rashal.internal`), ולכן כל הודעה יוצאת הוצגה לצוות
  // כ"עובד" סתמי. השם האמיתי (עמי גז, שלומי קורן) חי ב-`profiles.full_name`,
  // והפענוח כאן רטרואקטיבי: גם הודעות ישנות מקבלות שם בלי לגעת בנתונים.
  const AUTHOR_EMAIL = /^user:(.+@.+)$/;
  const emails = new Set<string>();
  for (const m of messages ?? []) {
    const hit = AUTHOR_EMAIL.exec(String((m as { author?: unknown }).author ?? ''));
    if (hit) emails.add(hit[1].toLowerCase());
  }
  const authorNames = new Map<string, string>();
  if (emails.size) {
    try {
      const { data: profs } = await supabaseAdmin
        .from('profiles')
        .select('email, full_name, username')
        .in('email', Array.from(emails));
      // 🔴 יש פרופילים בלי full_name (רודי, נהג): שם המשתמש עדיף על "עובד".
      for (const p of (profs ?? []) as Array<{ email?: string | null; full_name?: string | null; username?: string | null }>) {
        const name = p.full_name || p.username;
        if (p.email && name) authorNames.set(p.email.toLowerCase(), name);
      }
    } catch (e) {
      // נכשל בשקט: שם שולח אינו סיבה להפיל שרשור.
      console.error('[thread] author names failed', e instanceof Error ? e.message : e);
    }
  }
  const authorNameFor = (author: unknown): string | null => {
    const hit = AUTHOR_EMAIL.exec(String(author ?? ''));
    return hit ? authorNames.get(hit[1].toLowerCase()) ?? null : null;
  };

  return {
    conversation: {
      id: conv.id,
      phone: conv.phone_local,
      phoneE164: conv.phone_e164,
      contactName: conv.contact_name,
      customerNumber: conv.customer_number,
      customerName: conv.customer_name,
      contactLabel: conv.contact_label ?? null,
      suggested: Array.isArray(conv.suggested) ? conv.suggested : null,
      identityAskedAt: conv.identity_asked_at ?? null,
      messageCount: conv.message_count,
      lastMessageAt: conv.last_message_at,
      unansweredSince: conv.unanswered_since,
      // ⭐ אותה הכרעה בדיוק שהרשימה משתמשת בה. שני מנגנונים על אותו
      // מסך היו נותנים נקודה כתומה על שיחה שכבר ירדה מהרשימה.
      // [[label_and_math_from_two_mechanisms]]
      waiting: isWaiting(conv),
      readAt: conv.read_at ?? null,
    },
    window: windowState(conv.last_inbound_at),
    // 🔴 **המצורפים עוברים תרגום ולא נמסרים כמו שהם.** ראה
    // `describeAttachments`: המטען הגולמי מכיל כתובת S3 ציבורית לכל
    // קובץ ואת הנתיב הפנימי שלנו, ומכיל גם כפתורי תבנית שאינם קבצים.
    messages: (messages ?? []).map((m) => {
      const autoKind = ((m as { auto_kind?: string | null }).auto_kind ?? null) as string | null;
      const st = autoKind ? autoStateFor(m as { sent_at: string; attachments?: unknown }, autoKind) : null;
      const { auto_kind: _drop, ...rest } = m as typeof m & { auto_kind?: unknown };
      return {
      ...rest,
      // ⭐ הסיווג לתצוגה: אדם מקבל בועה, אוטומט מקבל שורה. ראה למעלה.
      kind: autoKind ? 'auto' : 'human',
      autoKind,
      autoState: st?.state ?? null,
      autoResult: st?.result ?? null,
      author_name: authorNameFor((m as { author?: unknown }).author),
      attachments: describeAttachments(m.attachments),
      // ⭐ הכפתור שהלקוח קיבל, ואיתו הקישור עצמו. הוא יושב באותו מערך,
      // והוא **לא** קובץ. ראה `describeButtons`.
      buttons: describeButtons(m.attachments),
      survey: surveyFor(m.attachments),
      };
    }),
  };
}
