import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabase-admin.js';

// Priority PUSH — field-chat + photos → customer card (see docs/CHAT-TO-PRIORITY-PLAN.md)
//
// Rashal wants the field-crew chat AND photos mirrored INTO Priority, on the
// CUSTOMER CARD. Our chat is per-order / per-service-call; we aggregate to the
// customer (customer_number = Priority CUSTNAME).
//
// 🔴🔴 **ר.שעל לא עובדים עם Make מ-04/08/2026.** מי שמריץ את הכתיבה הוא
// ה-Edge Function שלנו `supabase/functions/rashal-push` (pg_cron, כל רבע
// שעה, סיסמת פריוריטי ב-Edge Secrets). ההערה הישנה כאן ("Make drives the
// write") הטעתה ב-06/09 ועידן הדליק מנורה אדומה. [[rashal_make_to_code_migration]]
// This endpoint is the outbox. It returns a FLAT list of "writes" — each is one
// ready-to-POST Priority OData call (url + json body). `rashal-push` iterates,
// POSTs each to Priority, then acks per event id (including `contact:<uuid>`).
//   GET  /api/priority-push          → { writes: [{event_id, url, body}, ...] }
//   POST /api/priority-push?ack      → mark event ids pushed  { ids: [...] }
//
// Text  → CUSTOMERS('<cust>')/INTERNALDIALOGTEXT_SUBFORM  {TEXT, APPEND:true}
// Photo → CUSTOMERS('<cust>')/CUSTEXTFILE_SUBFORM         {EXTFILEDES, EXTFILENAME:"data:<mime>;base64,..."}
//         (mechanism cracked 04/07: data-URI in EXTFILENAME → Priority stores a real file)

export const config = { maxDuration: 60 };

const SECRET = process.env.PRIORITY_SYNC_SECRET;
const PRIORITY = 'https://p.priority-connect.online/odata/Priority/tabb4ce6.ini/shaal';
const EVENT_BATCH = 12;           // אירועים *שנדחפים* בריצה
const MAX_PAYLOAD = 3_000_000;    // תקרת base64 מצטבר לתגובה (מתחת ל-4.5MB של Vercel)

// 🔴 חסם ראש-תור (התגלה 11/08/2026, תקוע מ-06/07):
// אירוע שאין לישות שלו customer_number מדולג — אבל דילוג אינו ack, ולכן הוא
// נשאר בראש התור. כשהקריאה שלפה בדיוק EVENT_BATCH אירועים, 12 חוסמים כאלה
// גרמו לכל ריצה להחזיר אפס כתיבות, בעוד 509 אירועים תקינים ממתינים מאחוריהם.
// הריצות דיווחו success, ולכן הוואצ'דוג היה ירוק לאורך חמישה שבועות.
//
// התיקון: סורקים חלון רחב, והמכסה נספרת על אירועים *שנדחפים בפועל*. אירוע
// בלי מפתח לקוח פשוט לא צורך מכסה, ויעלה מעצמו כשהסנכרון ישלים לו את המספר.
const SCAN_LIMIT = 400;

type Row = Record<string, unknown>;
const s = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t.length ? t : null;
};

function formatLine(ev: Row, ctx: string): string {
  const who = s(ev.user_name) ?? 'משתמש';
  const when = new Date(ev.created_at as string).toLocaleString('he-IL', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });
  const text = s(ev.content) ?? '';
  return `[${who} · ${when} · ${ctx}] ${text}`;
}

function custUrl(cust: string, sub: string): string {
  return `${PRIORITY}/CUSTOMERS('${encodeURIComponent(cust)}')/${sub}`;
}

// מוריד תמונה מה-Storage שלנו ומחזיר data URI (base64) — פורמט שפריוריטי מזהה כקובץ
async function toDataUri(url: string): Promise<{ dataUri: string; ext: string } | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const mime = r.headers.get('content-type') ?? 'image/jpeg';
    const buf = Buffer.from(await r.arrayBuffer());
    const ext = mime.split('/')[1]?.split(';')[0] ?? 'jpg';
    return { dataUri: `data:${mime};base64,${buf.toString('base64')}`, ext };
  } catch {
    return null;
  }
}

async function handleGet(req: VercelRequest, res: VercelResponse) {
  const testCust = s(req.query.test_custname);

  // 🔴🔴 **חסם ראש-תור, גלגול שני (03/09/2026).** הסריקה של 400 הישנים
  // ביותר התמלאה באירועים שלעולם לא יידחפו (בלי הזמנה/קריאה, בלי מספר
  // לקוח, העלאה בלי תמונה), וכל ריצה החזירה "success, writes: 0" בזמן
  // ש-111 אירועים תקינים, 56 מהם תמונות, חיכו מאחור. תמונה של לקוחה
  // חיכתה 30 שעות והיא שאלה "?????" בוואטסאפ.
  // ⭐ הבחירה עוברת למסד (`priority_push_candidates`): הסינון על "יש לקוח"
  // ו"יש תמונה" נעשה בשאילתה, ולכן אירוע שאי אפשר לדחוף לא תופס מקום.
  const { data: events, error } = await supabaseAdmin
    .rpc('priority_push_candidates', { p_limit: SCAN_LIMIT, p_custname: testCust });
  if (error) throw new Error(`outbox read: ${error.message}`);
  const rows = (events ?? []) as Row[];
  // כמה עוד ממתינים מעבר למכסה: ריצה שמחזירה אפס כתיבות בזמן שיש ממתינים
  // היא תקלה, לא שקט, וזה מה שהפונקציה הדוחפת והוואצ'דוג בודקים.
  const pending = rows.length;
  if (!rows.length) return res.status(200).json({ writes: [], skipped: 0, pending });

  const writes: Row[] = [];
  let payload = 0;
  let skipped = 0;
  const pushedEvents = new Set<string>();

  for (const ev of rows) {
    // המכסה נספרת על אירועים שנדחפו בפועל, לא על אירועים שנסרקו.
    if (pushedEvents.size >= EVENT_BATCH) break;

    const src = { cust: s(ev.cust), ctx: s(ev.ctx) ?? '' };
    if (!src.cust) { skipped++; continue; } // לא אמור לקרות: הפונקציה במסד כבר סיננה
    const cust = src.cust;
    const meta = ev.metadata as { imageUrls?: string[] } | null;
    const images = meta?.imageUrls ?? [];

    if (ev.type === 'comment') {
      writes.push({
        event_id: ev.id,
        url: custUrl(cust, 'INTERNALDIALOGTEXT_SUBFORM'),
        body: JSON.stringify({ TEXT: formatLine(ev, src.ctx), APPEND: true }),
      });
      pushedEvents.add(ev.id as string);
    } else {
      // file_upload: כל תמונה = נספח בכרטיס הלקוח (data URI)
      let idx = 0;
      for (const url of images) {
        if (payload > MAX_PAYLOAD) break; // עצור לפני שנחרוג — יישלף בריצה הבאה
        const file = await toDataUri(url);
        if (!file) continue;
        idx++;
        const des = `${src.ctx} ${new Date(ev.created_at as string).toLocaleDateString('he-IL')} (${idx}).${file.ext}`.slice(0, 60);
        const body = JSON.stringify({ EXTFILEDES: des, EXTFILENAME: file.dataUri });
        payload += body.length;
        writes.push({ event_id: ev.id, url: custUrl(cust, 'CUSTEXTFILE_SUBFORM'), body });
        pushedEvents.add(ev.id as string);
      }
      // אירוע העלאה בלי תמונות תקינות → אין מה לדחוף, נסמן כטופל דרך ack הרגיל של הבא
    }
    if (payload > MAX_PAYLOAD) break;
  }

  // ─── אנשי קשר חדשים → CUSTPERSONNEL_SUBFORM (החלטת עידן, 06/09/2026) ──
  // מספר של בן משפחה שקישרנו לוואטסאפ נכתב גם לכרטיס הלקוח בפריוריטי, כאיש
  // קשר. המיפוי מבית הידע של רוני (אומת חי אצל ר.שעל 12/07): NAME = שם מלא,
  // POSITIONDES = קרבה או תפקיד, CELLPHONE = נייד, STATDES = פעיל.
  // 🔴 `PHONE` בתת-הטופס הוא מזהה שורה פנימי, לא טלפון. לא נוגעים בו.
  // ה-ack חוזר עם מזהה בקידומת `contact:` ומסומן על customer_contacts.
  const contactIds: string[] = [];
  if (!testCust) {
    const { data: contacts, error: cErr } = await supabaseAdmin.rpc('priority_contact_candidates', { p_limit: 20 });
    if (cErr) console.error('[priority-push] contact candidates', cErr.message);
    for (const c of (contacts as Array<Record<string, unknown>> | null) ?? []) {
      const cust = s(c.customer_number);
      const phone = s(c.phone_local);
      if (!cust || !phone) continue;
      const label = (s(c.label) ?? '').trim();
      // "הבת, מיכל" → NAME "מיכל", POSITIONDES "הבת". בלי פסיק: הכל בשם.
      const [rel, name] = label.includes(',') ? label.split(',', 2).map((x) => x.trim()) : ['', label];
      const body = JSON.stringify({
        NAME: (name || 'איש קשר וואטסאפ').slice(0, 48),
        POSITIONDES: (rel || 'וואטסאפ').slice(0, 48),
        CELLPHONE: phone,
        STATDES: 'פעיל',
      });
      writes.push({ event_id: `contact:${c.id}`, url: custUrl(cust, 'CUSTPERSONNEL_SUBFORM'), body });
      contactIds.push(c.id as string);
    }
    if (contactIds.length) {
      await supabaseAdmin.from('customer_contacts')
        .update({ priority_push_claimed_at: new Date().toISOString() })
        .in('id', contactIds);
    }
  }

  // תופסים את האירועים שאנו מחזירים — GET מקביל/כפול לא יקבל אותם שוב (מונע כפילות בפריוריטי)
  const claimedIds = [...new Set(writes.map((w) => w.event_id as string))];
  if (claimedIds.length) {
    const { error: claimErr } = await supabaseAdmin
      .from('timeline_events')
      .update({ push_claimed_at: new Date().toISOString() })
      .in('id', claimedIds);
    if (claimErr) throw new Error(`claim: ${claimErr.message}`);
  }

  return res.status(200).json({ writes, skipped, pending });
}

async function handleAck(req: VercelRequest, res: VercelResponse) {
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const all: string[] = Array.isArray(body?.ids) ? body.ids.map(String) : [];
  if (!all.length) return res.status(200).json({ acked: 0 });
  const contactIds = all.filter((x) => x.startsWith('contact:')).map((x) => x.slice('contact:'.length));
  const ids = all.filter((x) => !x.startsWith('contact:'));
  if (ids.length) {
    const { error } = await supabaseAdmin
      .from('timeline_events')
      .update({ pushed_to_priority_at: new Date().toISOString() })
      .in('id', ids);
    if (error) throw new Error(`ack: ${error.message}`);
  }
  if (contactIds.length) {
    const { error } = await supabaseAdmin
      .from('customer_contacts')
      .update({ priority_pushed_at: new Date().toISOString(), priority_push_claimed_at: null })
      .in('id', contactIds);
    if (error) throw new Error(`ack contacts: ${error.message}`);
  }
  return res.status(200).json({ acked: all.length });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SECRET) return res.status(500).json({ error: 'PRIORITY_SYNC_SECRET not configured' });
  if (req.headers['x-sync-secret'] !== SECRET) return res.status(401).json({ error: 'bad secret' });
  try {
    if (req.method === 'GET') return await handleGet(req, res);
    if (req.method === 'POST') return await handleAck(req, res);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[priority-push]', msg);
    return res.status(500).json({ error: msg });
  }
}
