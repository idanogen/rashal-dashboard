import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabase-admin.js';

// Priority PUSH — field-chat + photos → customer card (see docs/CHAT-TO-PRIORITY-PLAN.md)
//
// Rashal wants the field-crew chat AND photos mirrored INTO Priority, on the
// CUSTOMER CARD. Our chat is per-order / per-service-call; we aggregate to the
// customer (customer_number = Priority CUSTNAME).
//
// Symmetric to the pull: Priority credentials live in the client's Make keychain,
// so Make drives the write. This endpoint is the outbox. It returns a FLAT list
// of "writes" — each is one ready-to-POST Priority OData call (url + json body).
// Make iterates, POSTs each to Priority, then acks per event.
//   GET  /api/priority-push          → { writes: [{event_id, url, body}, ...] }
//   POST /api/priority-push?ack      → mark event ids pushed  { ids: [...] }
//
// Text  → CUSTOMERS('<cust>')/INTERNALDIALOGTEXT_SUBFORM  {TEXT, APPEND:true}
// Photo → CUSTOMERS('<cust>')/CUSTEXTFILE_SUBFORM         {EXTFILEDES, EXTFILENAME:"data:<mime>;base64,..."}
//         (mechanism cracked 04/07: data-URI in EXTFILENAME → Priority stores a real file)

export const config = { maxDuration: 60 };

const SECRET = process.env.PRIORITY_SYNC_SECRET;
const PRIORITY = 'https://p.priority-connect.online/odata/Priority/tabb4ce6.ini/shaal';
const EVENT_BATCH = 12;           // אירועים לריצה
const MAX_PAYLOAD = 3_000_000;    // תקרת base64 מצטבר לתגובה (מתחת ל-4.5MB של Vercel)

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

  // claim timeout: אירוע שנתפס ולא אושר תוך 10 דק' (ריצה שקרסה) — משוחרר לניסיון חוזר
  const claimCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  let query = supabaseAdmin
    .from('timeline_events')
    .select('id, order_id, service_call_id, type, user_name, content, metadata, created_at')
    .is('pushed_to_priority_at', null)
    .or(`push_claimed_at.is.null,push_claimed_at.lt.${claimCutoff}`)
    .in('type', ['comment', 'file_upload']);

  if (testCust) {
    const [{ data: o }, { data: c }] = await Promise.all([
      supabaseAdmin.from('orders').select('id').eq('customer_number', testCust),
      supabaseAdmin.from('service_calls').select('id').eq('customer_number', testCust),
    ]);
    const oIds = (o ?? []).map((r) => (r as Row).id as string);
    const cIds = (c ?? []).map((r) => (r as Row).id as string);
    const clauses: string[] = [];
    if (oIds.length) clauses.push(`order_id.in.(${oIds.join(',')})`);
    if (cIds.length) clauses.push(`service_call_id.in.(${cIds.join(',')})`);
    if (!clauses.length) return res.status(200).json({ writes: [] });
    query = query.or(clauses.join(','));
  }

  const { data: events, error } = await query
    .order('created_at', { ascending: true })
    .limit(EVENT_BATCH);
  if (error) throw new Error(`outbox read: ${error.message}`);
  const rows = (events ?? []) as Row[];
  if (!rows.length) return res.status(200).json({ writes: [] });

  // resolve customer_number + context per event
  const orderIds = [...new Set(rows.map((r) => s(r.order_id)).filter(Boolean))] as string[];
  const callIds = [...new Set(rows.map((r) => s(r.service_call_id)).filter(Boolean))] as string[];
  const orderMap = new Map<string, { cust: string | null; ctx: string }>();
  const callMap = new Map<string, { cust: string | null; ctx: string }>();
  if (orderIds.length) {
    const { data } = await supabaseAdmin
      .from('orders').select('id, customer_number, priority_order_id').in('id', orderIds);
    for (const o of (data ?? []) as Row[])
      orderMap.set(o.id as string, { cust: s(o.customer_number), ctx: `הזמנה ${s(o.priority_order_id) ?? ''}`.trim() });
  }
  if (callIds.length) {
    const { data } = await supabaseAdmin
      .from('service_calls').select('id, customer_number, priority_call_id').in('id', callIds);
    for (const c of (data ?? []) as Row[])
      callMap.set(c.id as string, { cust: s(c.customer_number), ctx: `קריאה ${s(c.priority_call_id) ?? ''}`.trim() });
  }

  const writes: Row[] = [];
  let payload = 0;
  let skipped = 0;

  for (const ev of rows) {
    const src = ev.order_id ? orderMap.get(ev.order_id as string) : callMap.get(ev.service_call_id as string);
    if (!src?.cust) { skipped++; continue; } // אין מפתח לקוח → יידחף כשיסונכרן
    const cust = src.cust;
    const meta = ev.metadata as { imageUrls?: string[] } | null;
    const images = meta?.imageUrls ?? [];

    if (ev.type === 'comment') {
      writes.push({
        event_id: ev.id,
        url: custUrl(cust, 'INTERNALDIALOGTEXT_SUBFORM'),
        body: JSON.stringify({ TEXT: formatLine(ev, src.ctx), APPEND: true }),
      });
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
      }
      // אירוע העלאה בלי תמונות תקינות → אין מה לדחוף, נסמן כטופל דרך ack הרגיל של הבא
    }
    if (payload > MAX_PAYLOAD) break;
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

  return res.status(200).json({ writes, skipped });
}

async function handleAck(req: VercelRequest, res: VercelResponse) {
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const ids: string[] = Array.isArray(body?.ids) ? body.ids : [];
  if (!ids.length) return res.status(200).json({ acked: 0 });
  const { error } = await supabaseAdmin
    .from('timeline_events')
    .update({ pushed_to_priority_at: new Date().toISOString() })
    .in('id', ids);
  if (error) throw new Error(`ack: ${error.message}`);
  return res.status(200).json({ acked: ids.length });
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
