import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabase-admin.js';

// Priority OData Pull — sync endpoint (see docs/SYNC-PULL-PLAN.md)
//
// Called by the Make scenario "OGEN - rashal-priority-pull" (client's Make account):
//   GET  /api/priority-sync                  → returns OData-ready `since` watermarks
//   POST /api/priority-sync?kind=orders      → upsert ORDERS rows (adoption logic)
//   POST /api/priority-sync?kind=service_calls → upsert DOCUMENTS_Q rows
//   POST /api/priority-sync?kind=customers   → upsert CUSTOMERS rows into cache
//   POST /api/priority-sync?kind=pickups     → upsert DOCUMENTS_N rows (+ lines/contact)
//
// Auth: header `x-sync-secret` must equal env PRIORITY_SYNC_SECRET.
//
// Column-ownership contract (CRITICAL — see plan §4):
//   Priority owns: customer identity/contact fields, natural keys.
//   The app owns:  order_status / service_call_status / delivery_date /
//                  customer_reply_status / anything users edit.
//   On UPDATE we only ever touch Priority-owned columns.

export const config = { maxDuration: 60 };

const SECRET = process.env.PRIORITY_SYNC_SECRET;

type Row = Record<string, unknown>;
const s = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t.length ? t : null;
};
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

// OData DateTimeOffset formatter: 2026-07-04T06:00:00Z (no millis, no quotes)
const odataTs = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

async function getWatermark(key: string, fallbackDays: number): Promise<Date> {
  const { data, error } = await supabaseAdmin
    .from('sync_state').select('watermark').eq('key', key).maybeSingle();
  if (error) throw new Error(`sync_state read (${key}): ${error.message}`);
  if (data?.watermark) return new Date(data.watermark as string);
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - fallbackDays);
  return d;
}

async function setWatermark(key: string, iso: string) {
  const { error } = await supabaseAdmin
    .from('sync_state')
    .upsert({ key, watermark: iso, updated_at: new Date().toISOString() });
  if (error) throw new Error(`sync_state write (${key}): ${error.message}`);
}

// Key-order-independent serialization. Postgres stores jsonb with its own key
// order (by key length, then bytewise), so `items` built as {part,desc,qty,...}
// reads back as {qty,desc,part,...}. A plain JSON.stringify comparison would
// call every row with items "changed" and defeat the no-op guard entirely.
function canonical(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

// Value-equality for the change check below. Priority sends everything as text,
// Postgres returns typed values, and `items`/`lines` are jsonb — so compare
// loosely: null/undefined are the same absence, objects by their canonical shape.
const ISO_LIKE = /^\d{4}-\d{2}-\d{2}([T ]|$)/;

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || a === undefined) return b === null || b === undefined;
  if (b === null || b === undefined) return false;
  if (typeof a === 'object' || typeof b === 'object') {
    return canonical(a) === canonical(b);
  }
  const sa = String(a), sb = String(b);
  if (sa === sb) return true;
  // Date/timestamp columns never round-trip literally: Priority sends
  // "2026-01-01T00:00:00+02:00" while Postgres hands back "2026-01-01" for a
  // date column and UTC-normalised text for a timestamptz. Compare the instant
  // (or the calendar day, when either side is date-only) instead of the text.
  if (ISO_LIKE.test(sa) && ISO_LIKE.test(sb)) {
    if (sa.length === 10 || sb.length === 10) return sa.slice(0, 10) === sb.slice(0, 10);
    const ta = Date.parse(sa), tb = Date.parse(sb);
    if (Number.isFinite(ta) && Number.isFinite(tb)) return ta === tb;
  }
  return false;
}

function maxDate(rows: Row[], field: string): string | null {
  let max: string | null = null;
  for (const r of rows) {
    const v = s(r[field]);
    if (v && (!max || v > max)) max = v;
  }
  return max;
}

// ---------------------------------------------------------------------------
// GET — watermarks for the Make scenario's $filter clauses
// ---------------------------------------------------------------------------
async function handleGet(res: VercelResponse) {
  // Overlap windows: ORDERS.STATUSDATE has DAY granularity → look back a full
  // extra day. DOCUMENTS_Q.STATUSDATE has minute granularity → 15 min is plenty.
  const [orders, calls, customers, pickups] = await Promise.all([
    getWatermark('orders', 3),
    getWatermark('service_calls', 3),
    getWatermark('customers', 90), // retention rule: 90-day window
    getWatermark('pickups', 90),
  ]);
  orders.setUTCHours(orders.getUTCHours() - 25);
  calls.setUTCMinutes(calls.getUTCMinutes() - 15);
  customers.setUTCMinutes(customers.getUTCMinutes() - 15);
  pickups.setUTCMinutes(pickups.getUTCMinutes() - 15); // DOCUMENTS_N.UDATE has minute granularity
  return res.status(200).json({
    orders_since: odataTs(orders),
    calls_since: odataTs(calls),
    customers_since: odataTs(customers),
    pickups_since: odataTs(pickups),
  });
}

// ---------------------------------------------------------------------------
// customers → priority_customers cache (plain upsert by custname)
// ---------------------------------------------------------------------------
async function upsertCustomers(rows: Row[]) {
  const mapped = rows
    .filter((r) => s(r.CUSTNAME))
    .map((r) => ({
      custname: s(r.CUSTNAME)!,
      cdes: s(r.CUSTDES),
      address: s(r.ADDRESS),
      city: s(r.STATE),
      phone: s(r.PHONE),
      fax: s(r.FAX),
      agent: s(r.AGENTNAME),
      health_fund: s(r.MCUSTDES),
      opened_by: s(r.OWNERLOGIN),
      priority_udate: s(r.CREATEDDATE),
      synced_at: new Date().toISOString(),
    }));
  // Same no-op guard as runAdoption: CREATEDDATE has day granularity, so every
  // run re-sends the same customers. `synced_at` changes on every pass by
  // definition, so it is excluded from the comparison and only rides along on
  // rows that actually changed.
  const names = mapped.map((m) => m.custname);
  const current = new Map<string, Row>();
  for (let i = 0; i < names.length; i += 200) {
    const { data, error } = await supabaseAdmin
      .from('priority_customers').select('*').in('custname', names.slice(i, i + 200));
    if (error) throw new Error(`customers change check: ${error.message}`);
    for (const d of data ?? []) current.set((d as Row).custname as string, d as Row);
  }
  const changedCustomers = mapped.filter((m) => {
    const cur = current.get(m.custname);
    if (!cur) return true;
    return Object.keys(m).some(
      (k) => k !== 'synced_at' && k !== 'custname' && !sameValue((m as Row)[k], cur[k]),
    );
  });
  for (let i = 0; i < changedCustomers.length; i += 500) {
    const { error } = await supabaseAdmin
      .from('priority_customers')
      .upsert(changedCustomers.slice(i, i + 500), { onConflict: 'custname' });
    if (error) throw new Error(`customers upsert: ${error.message}`);
  }
  // Self-paging backfill guard: the scenario pulls $orderby=CREATEDDATE asc&$top=4000.
  // A full page whose rows all share one CREATEDDATE (bulk-import day) would stall
  // the watermark forever - bump it by a day in that case.
  let wm = maxDate(rows, 'CREATEDDATE');
  const minWm = rows.length ? [...rows].map((r) => s(r.CREATEDDATE)).filter(Boolean).sort()[0] : null;
  if (wm && rows.length >= 4000 && wm === minWm) {
    const bumped = new Date(wm);
    bumped.setUTCDate(bumped.getUTCDate() + 1);
    wm = bumped.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }
  if (wm) await setWatermark('customers', wm);
  return {
    received: rows.length,
    upserted: changedCustomers.length,
    unchanged: mapped.length - changedCustomers.length,
    watermark: wm,
  };
}

// ---------------------------------------------------------------------------
// Adoption engine — shared by orders + service_calls (plan §6)
//   1. natural key exists       → UPDATE Priority-owned fields only
//   2. unkeyed row matches      → ADOPT: attach key + fill missing fields
//      (same customer_name, created_at within ±3 days of the Priority date)
//   3. no match                 → INSERT
// ---------------------------------------------------------------------------
interface AdoptConfig {
  table: 'orders' | 'service_calls' | 'pickups';
  keyCol: 'priority_order_id' | 'priority_call_id' | 'priority_pickup_id';
  naturalKey: (r: Row) => string | null;
  docDate: (r: Row) => string | null;       // Priority-side creation date
  insertRow: (r: Row) => Row;               // full row for INSERT
  updateRow: (r: Row) => Row;               // Priority-owned fields for UPDATE
  adoptRow: (r: Row, existing: Row) => Row; // key + fill-missing for ADOPT
}

async function runAdoption(rows: Row[], cfg: AdoptConfig) {
  const stats = { received: rows.length, updated: 0, adopted: 0, inserted: 0, skipped: 0, unchanged: 0 };

  // dedupe batch by natural key (Priority can repeat rows across pages)
  const byKey = new Map<string, Row>();
  for (const r of rows) {
    const k = cfg.naturalKey(r);
    if (k) byKey.set(k, r);
    else stats.skipped++;
  }
  const keys = [...byKey.keys()];
  if (!keys.length) return stats;

  // which keys already exist?
  const existingKeys = new Set<string>();
  for (let i = 0; i < keys.length; i += 200) {
    const { data, error } = await supabaseAdmin
      .from(cfg.table).select(cfg.keyCol).in(cfg.keyCol, keys.slice(i, i + 200));
    if (error) throw new Error(`${cfg.table} key lookup: ${error.message}`);
    for (const d of data ?? []) existingKeys.add((d as Row)[cfg.keyCol] as string);
  }

  // preload unkeyed rows for in-memory adoption matching.
  // WINDOWED to the batch's doc-date range (PostgREST caps un-paginated reads
  // at 1,000 rows - the classic trap that already bit this project once),
  // and PAGINATED within the window for safety.
  const docDates = [...byKey.values()].map((r) => cfg.docDate(r)).filter(Boolean) as string[];
  const PAD = 4 * 24 * 3600 * 1000;
  const winFrom = new Date(Math.min(...docDates.map((d) => new Date(d).getTime())) - PAD).toISOString();
  const winTo = new Date(Math.max(...docDates.map((d) => new Date(d).getTime())) + PAD).toISOString();
  const unkeyed: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from(cfg.table)
      .select(`id, customer_name, phone, created_at, duplicate_of, ${cfg.keyCol}`)
      .is(cfg.keyCol, null)
      .gte('created_at', winFrom)
      .lte('created_at', winTo)
      .range(from, from + 999);
    if (error) throw new Error(`${cfg.table} unkeyed load: ${error.message}`);
    unkeyed.push(...((data ?? []) as Row[]));
    if (!data || data.length < 1000) break;
  }
  const claimed = new Set<string>();

  const findAdoptee = (r: Row): Row | null => {
    const name = s(r.CDES);
    const dd = cfg.docDate(r);
    if (!name || !dd) return null;
    const docMs = new Date(dd).getTime();
    const THREE_DAYS = 3 * 24 * 3600 * 1000;
    const candidates = unkeyed.filter((u) =>
      !claimed.has(u.id as string) &&
      s(u.customer_name) === name &&
      Math.abs(new Date(u.created_at as string).getTime() - docMs) <= THREE_DAYS
    );
    if (!candidates.length) return null;
    // prefer the head row (not marked duplicate), then the closest in time
    candidates.sort((a, b) => {
      const dupA = a.duplicate_of ? 1 : 0, dupB = b.duplicate_of ? 1 : 0;
      if (dupA !== dupB) return dupA - dupB;
      return Math.abs(new Date(a.created_at as string).getTime() - docMs)
           - Math.abs(new Date(b.created_at as string).getTime() - docMs);
    });
    return candidates[0];
  };

  const inserts: Row[] = [];
  const updates: Row[] = [];
  const CONC = 10;
  const pending: Row[] = [...byKey.values()];

  for (let i = 0; i < pending.length; i += CONC) {
    await Promise.all(pending.slice(i, i + CONC).map(async (r) => {
      const key = cfg.naturalKey(r)!;
      if (existingKeys.has(key)) {
        // bulk path: collected and upserted-by-key in batches below (fast)
        updates.push({ [cfg.keyCol]: key, ...cfg.updateRow(r) });
        return;
      }
      // Idan's retention rule (04/07): never INSERT records older than 90 days.
      // Existing rows (keyed/adopted) are always fair game for updates.
      const dd = cfg.docDate(r);
      if (dd && new Date(dd).getTime() < Date.now() - 90 * 24 * 3600 * 1000) {
        const adopteeOld = findAdoptee(r);
        if (!adopteeOld) { stats.skipped++; return; }
      }
      const adoptee = findAdoptee(r);
      if (adoptee) {
        claimed.add(adoptee.id as string);
        const { error } = await supabaseAdmin
          .from(cfg.table).update(cfg.adoptRow(r, adoptee)).eq('id', adoptee.id);
        if (error) throw new Error(`${cfg.table} adopt ${key}: ${error.message}`);
        stats.adopted++;
        return;
      }
      inserts.push(cfg.insertRow(r));
    }));
  }

  // Drop no-op writes before touching the table.
  // Priority re-sends the same rows on every run (ORDERS.STATUSDATE has DAY
  // granularity, so the watermark sits at midnight and the window covers ~2
  // days; pickup addresses use a rolling 3-day window). Re-upserting an
  // identical row still bumps updated_at and still emits a realtime UPDATE, so
  // every open client was invalidating and refetching the whole table every 20
  // minutes. Compare against the current values and keep only real changes.
  let changed = updates;
  if (updates.length) {
    const cols = new Set<string>([cfg.keyCol]);
    for (const u of updates) for (const k of Object.keys(u)) cols.add(k);
    const selectList = [...cols].join(',');
    const updKeys = updates.map((u) => u[cfg.keyCol] as string);
    const current = new Map<string, Row>();
    for (let i = 0; i < updKeys.length; i += 200) {
      const { data, error } = await supabaseAdmin
        .from(cfg.table).select(selectList).in(cfg.keyCol, updKeys.slice(i, i + 200));
      if (error) throw new Error(`${cfg.table} change check: ${error.message}`);
      // `select()` takes a runtime-built column list, so supabase-js cannot infer
      // the row shape here — hence the cast through unknown.
      for (const d of (data ?? []) as unknown as Row[]) {
        current.set(d[cfg.keyCol] as string, d);
      }
    }
    changed = updates.filter((u) => {
      const cur = current.get(u[cfg.keyCol] as string);
      if (!cur) return true; // row vanished between the two reads — let the upsert handle it
      return Object.keys(u).some((k) => k !== cfg.keyCol && !sameValue(u[k], cur[k]));
    });
    stats.unchanged = updates.length - changed.length;
  }

  // bulk update of already-keyed rows: upsert by the natural key.
  // Only Priority-owned columns are in the payload, so app-owned columns
  // (order_status etc.) stay untouched. Requires a FULL unique index on keyCol.
  // NOTE: rows in one PostgREST upsert must share the exact same column set —
  // and a missing column would be nulled on conflict — so group by signature.
  const groups = new Map<string, Row[]>();
  for (const u of changed) {
    const sig = Object.keys(u).sort().join(',');
    (groups.get(sig) ?? groups.set(sig, []).get(sig)!).push(u);
  }
  for (const rows_ of groups.values()) {
    for (let i = 0; i < rows_.length; i += 500) {
      const { error } = await supabaseAdmin
        .from(cfg.table)
        .upsert(rows_.slice(i, i + 500), { onConflict: cfg.keyCol });
      if (error) throw new Error(`${cfg.table} bulk update: ${error.message}`);
    }
  }
  stats.updated = changed.length;

  for (let i = 0; i < inserts.length; i += 500) {
    const { error } = await supabaseAdmin.from(cfg.table).insert(inserts.slice(i, i + 500));
    if (error) throw new Error(`${cfg.table} insert: ${error.message}`);
  }
  stats.inserted = inserts.length;
  return stats;
}

// ---------------------------------------------------------------------------
// Priority status → app status (agreed with Idan 05/08/2026).
//
// Priority is authoritative for TERMINAL states only. While a record is still
// open there (מאושרת לבצוע / לביצוע / שובצה / להמשך טיפול) we leave the app
// status alone, so the dispatcher's own flow is never overwritten. This is the
// same contract pickups already had via STATDES — orders and service calls
// simply never had their status pulled, which is why 96% of them sat "open"
// forever.
//
// "שובצה" is deliberately unmapped: its meaning at Rashal is unconfirmed.
// ---------------------------------------------------------------------------
// 09/08/2026 — 'בוצעה' and 'שולמה' removed. Neither means the goods reached the
// customer: Priority sets 'בוצעה' at billing time, often days before the drive,
// and 73% of new orders land already carrying it, so the dispatcher never saw
// them. Proven against Ami's delivery sheet for 10/08. Only cancellation is
// authoritative now; every other close belongs to the app (dispatcher/driver).
const ORDER_TERMINAL: Record<string, string> = {
  'מבוטלת': 'בוטל',
};
const CALL_TERMINAL: Record<string, string> = {
  'בוצעה': 'בוצע',
  'סופית': 'בוצע',
  'מבוטלת': 'בוטל',
};

// ORDERITEMS_SUBFORM → items jsonb: מה בדיוק מספקים (עמי #2)
function mapItems(r: Row): Row[] | null {
  const sub = r.ORDERITEMS_SUBFORM;
  if (!Array.isArray(sub) || !sub.length) return null;
  return (sub as Row[]).map((i) => ({
    part: s(i.PARTNAME),
    desc: s(i.PDES),
    qty: typeof i.TQUANT === 'number' ? i.TQUANT : Number(i.TQUANT) || null,
    serial: s(i.SERIALNAME),
  }));
}

// ---------------------------------------------------------------------------
// orders ← ORDERS (enriched with address/city from the customers cache)
// ---------------------------------------------------------------------------
async function upsertOrders(rows: Row[]) {
  // batch-load customer cache for enrichment
  const custnames = [...new Set(rows.map((r) => s(r.CUSTNAME)).filter(Boolean))] as string[];
  const cache = new Map<string, Row>();
  for (let i = 0; i < custnames.length; i += 200) {
    const { data, error } = await supabaseAdmin
      .from('priority_customers').select('*').in('custname', custnames.slice(i, i + 200));
    if (error) throw new Error(`customer cache load: ${error.message}`);
    for (const c of data ?? []) cache.set((c as Row).custname as string, c as Row);
  }

  const stats = await runAdoption(rows, {
    table: 'orders',
    keyCol: 'priority_order_id',
    naturalKey: (r) => s(r.ORDNAME),
    docDate: (r) => s(r.CURDATE),
    insertRow: (r) => {
      const c = cache.get(s(r.CUSTNAME) ?? '') ?? {};
      return {
        priority_order_id: s(r.ORDNAME),
        customer_number: s(r.CUSTNAME),
        customer_name: s(r.CDES),
        agent: s(r.AGENTNAME) ?? s(c.agent),
        phone: s(r.Y_151_0_ESHB) ?? s(c.phone),
        address: s(c.address),
        city: s(c.city),
        fax: s(c.fax),
        health_fund: s(c.health_fund) ?? s(r.TYPEDES),
        opened_by: s(c.opened_by) ?? s(r.DOERNAME),
        customer_status: 'לקוח חדש',
        created_at: s(r.CURDATE) ?? new Date().toISOString(),
        items: mapItems(r),
        priority_status: s(r.ORDSTATUSDES),
        // order_status: terminal Priority states land closed straight away;
        // anything still open falls through to the DB default 'ממתין לתאום'
        ...(ORDER_TERMINAL[s(r.ORDSTATUSDES) ?? '']
          ? { order_status: ORDER_TERMINAL[s(r.ORDSTATUSDES)!] }
          : {}),
      };
    },
    updateRow: (r) => {
      const c = cache.get(s(r.CUSTNAME) ?? '') ?? {};
      const u: Row = {
        customer_number: s(r.CUSTNAME),
        customer_name: s(r.CDES),
        agent: s(r.AGENTNAME) ?? s(c.agent),
        priority_status: s(r.ORDSTATUSDES),
      };
      // Priority closed it → close ours too. Still open there → don't touch,
      // the dispatcher owns the ממתין/תואמה flow.
      const term = ORDER_TERMINAL[s(r.ORDSTATUSDES) ?? ''];
      if (term) u.order_status = term;
      // contact fields only when Priority actually has a value
      const phone = s(r.Y_151_0_ESHB) ?? s(c.phone); if (phone) u.phone = phone;
      const address = s(c.address); if (address) u.address = address;
      const city = s(c.city); if (city) u.city = city;
      const hf = s(c.health_fund) ?? s(r.TYPEDES); if (hf) u.health_fund = hf;
      const items = mapItems(r); if (items) u.items = items;
      return u;
    },
    adoptRow: (r, ex) => {
      const c = cache.get(s(r.CUSTNAME) ?? '') ?? {};
      const u: Row = {
        priority_order_id: s(r.ORDNAME),
        customer_number: s(r.CUSTNAME),
      };
      if (!s(ex.phone)) { const p = s(r.Y_151_0_ESHB) ?? s(c.phone); if (p) u.phone = p; }
      const items = mapItems(r); if (items) u.items = items;
      return u;
    },
  });

  const wm = maxDate(rows, 'STATUSDATE') ?? maxDate(rows, 'CURDATE');
  if (wm) await setWatermark('orders', wm);
  return { ...stats, watermark: wm };
}

// ---------------------------------------------------------------------------
// service_calls ← DOCUMENTS_Q
// ---------------------------------------------------------------------------
async function upsertServiceCalls(rows: Row[]) {
  const stats = await runAdoption(rows, {
    table: 'service_calls',
    keyCol: 'priority_call_id',
    naturalKey: (r) => s(r.DOCNO),
    docDate: (r) => s(r.STARTDATE),
    insertRow: (r) => ({
      priority_call_id: s(r.DOCNO),
      customer_number: s(r.CUSTNAME),
      customer_name: s(r.CDES),
      phone: s(r.PHONENUM),
      address: s(r.Y_149_0_ESHB),
      city: s(r.Y_2578_0_ESHB),
      health_fund: s(r.Y_2632_5_ESH),
      opened_by: s(r.SUSERLOGIN),
      customer_status: 'לקוח קיים',
      created_at: s(r.STARTDATE) ?? new Date().toISOString(),
      // פרטי מכשיר (עמי #4)
      device_serial: s(r.SERNUM),
      device_name: s(r.PARTNAME),
      device_desc: s(r.PARTDES),
      warranty_until: s(r.WARDATEFINAL),
      install_date: s(r.RSHL_INSTDATE),
      // מה בתקלה (עמי #2)
      fault_desc: s(r.MALFDES),
      symptom_desc: s(r.SYMDES),
      call_type: s(r.CALLTYPECODE),
      service_type: s(r.SERVTDES),
      priority_status: s(r.CALLSTATUSCODE),
      // service_call_status: terminal Priority states land closed; anything
      // still open falls through to the DB default 'קריאה חדשה'
      ...(CALL_TERMINAL[s(r.CALLSTATUSCODE) ?? '']
        ? { service_call_status: CALL_TERMINAL[s(r.CALLSTATUSCODE)!] }
        : {}),
    }),
    updateRow: (r) => {
      const u: Row = {
        customer_number: s(r.CUSTNAME),
        customer_name: s(r.CDES),
        priority_status: s(r.CALLSTATUSCODE),
      };
      const term = CALL_TERMINAL[s(r.CALLSTATUSCODE) ?? ''];
      if (term) u.service_call_status = term;
      const phone = s(r.PHONENUM); if (phone) u.phone = phone;
      const address = s(r.Y_149_0_ESHB); if (address) u.address = address;
      const city = s(r.Y_2578_0_ESHB); if (city) u.city = city;
      const hf = s(r.Y_2632_5_ESH); if (hf) u.health_fund = hf;
      // פרטי מכשיר (עמי #4) — בבעלות פריוריטי, מתרעננים תמיד כשיש ערך
      const ser = s(r.SERNUM); if (ser) u.device_serial = ser;
      const dn = s(r.PARTNAME); if (dn) u.device_name = dn;
      const dd = s(r.PARTDES); if (dd) u.device_desc = dd;
      const wu = s(r.WARDATEFINAL); if (wu) u.warranty_until = wu;
      const inst = s(r.RSHL_INSTDATE); if (inst) u.install_date = inst;
      const fd = s(r.MALFDES); if (fd) u.fault_desc = fd;
      const sy = s(r.SYMDES); if (sy) u.symptom_desc = sy;
      const ct = s(r.CALLTYPECODE); if (ct) u.call_type = ct;
      const st = s(r.SERVTDES); if (st) u.service_type = st;
      return u;
    },
    adoptRow: (r, ex) => {
      const u: Row = {
        priority_call_id: s(r.DOCNO),
        customer_number: s(r.CUSTNAME),
      };
      if (!s(ex.phone)) { const p = s(r.PHONENUM); if (p) u.phone = p; }
      return u;
    },
  });

  const wm = maxDate(rows, 'STATUSDATE') ?? maxDate(rows, 'STARTDATE');
  if (wm) await setWatermark('service_calls', wm);
  return { ...stats, watermark: wm };
}

// ---------------------------------------------------------------------------
// pickups ← DOCUMENTS_N (+ TRANSORDER_N_SUBFORM lines, DOCUMENTS_DCONT_SUBFORM address)
// ---------------------------------------------------------------------------
// TRANSORDER_N_SUBFORM → lines jsonb
function mapPickupLines(r: Row): Row[] | null {
  const sub = r.TRANSORDER_N_SUBFORM;
  if (!Array.isArray(sub) || !sub.length) return null;
  return (sub as Row[]).map((l) => ({
    trans: num(l.TRANS),
    kline: num(l.KLINE),
    part: s(l.PARTNAME),
    desc: s(l.PDES),
    qty: num(l.TQUANT),
    unit: s(l.TUNITNAME),
    barcode: s(l.BARCODE),
    sourceOrder: s(l.ORDNAME),
    returnReason: s(l.RETREASONDES),
  }));
}

// DOCUMENTS_DCONT_SUBFORM → phone / address / city (per-document contact)
function pickupContact(r: Row): { phone: string | null; address: string | null; city: string | null } {
  const raw = r.DOCUMENTS_DCONT_SUBFORM;
  const c = (Array.isArray(raw) ? raw[0] : raw) as Row | undefined;
  return {
    phone: s(c?.PHONE),
    address: s(c?.ADRS),
    city: s(c?.STATE),
  };
}

// STATDES → app pickup_status. Priority is authoritative for the terminal states
// (collected / cancelled); the open flow (ממתין↔תואם איסוף) stays app-owned.
//   סופית  = collected → 'נאסף'
//   מבוטלת = cancelled → 'בוטל'
//   טיוטא  = still open → null (don't touch app status on update)
function pickupStatusFromPriority(statdes: string | null): string | null {
  if (statdes === 'סופית') return 'נאסף';
  if (statdes === 'מבוטלת') return 'בוטל';
  return null;
}

async function upsertPickups(rows: Row[]) {
  const stats = await runAdoption(rows, {
    table: 'pickups',
    keyCol: 'priority_pickup_id',
    naturalKey: (r) => s(r.DOCNO),
    docDate: (r) => s(r.CURDATE),
    insertRow: (r) => {
      const c = pickupContact(r);
      return {
        priority_pickup_id: s(r.DOCNO),
        priority_doc: num(r.DOC),
        customer_number: s(r.CUSTNAME),
        customer_name: s(r.CDES) ?? s(r.CUSTNAME) ?? '—',
        phone: c.phone,
        address: c.address,
        city: c.city,
        priority_status: s(r.STATDES),
        pickup_date: s(r.CURDATE),
        source_order: s(r.ORDNAME),
        delivery_note: s(r.ODOCNO),
        reference: s(r.REFERENCE),
        to_warehouse: s(r.TOWARHSDES),
        agent: s(r.AGENTNAME),
        opened_by: s(r.OWNERLOGIN),
        total_qty: num(r.TOTQUANT),
        total_price: num(r.TOTPRICE),
        lines: mapPickupLines(r),
        priority_udate: s(r.UDATE),
        // initial operational status derived from Priority (סופית→נאסף etc.),
        // open drafts start as 'ממתין לתאום'.
        pickup_status: pickupStatusFromPriority(s(r.STATDES)) ?? 'ממתין לתאום',
      };
    },
    updateRow: (r) => {
      const c = pickupContact(r);
      const u: Row = {
        customer_number: s(r.CUSTNAME),
        priority_status: s(r.STATDES),
        priority_udate: s(r.UDATE),
      };
      const name = s(r.CDES); if (name) u.customer_name = name;
      if (c.phone) u.phone = c.phone;
      if (c.address) u.address = c.address;
      if (c.city) u.city = c.city;
      const so = s(r.ORDNAME); if (so) u.source_order = so;
      const dn = s(r.ODOCNO); if (dn) u.delivery_note = dn;
      const tw = s(r.TOWARHSDES); if (tw) u.to_warehouse = tw;
      const tq = num(r.TOTQUANT); if (tq != null) u.total_qty = tq;
      const tp = num(r.TOTPRICE); if (tp != null) u.total_price = tp;
      const lines = mapPickupLines(r); if (lines) u.lines = lines;
      // Priority pushes terminal states only (collected/cancelled); the open
      // ממתין↔תואם-איסוף flow stays app-owned and is left untouched here.
      const ps = pickupStatusFromPriority(s(r.STATDES)); if (ps) u.pickup_status = ps;
      return u;
    },
    adoptRow: (r) => ({
      priority_pickup_id: s(r.DOCNO),
      customer_number: s(r.CUSTNAME),
    }),
  });

  const wm = maxDate(rows, 'UDATE');
  if (wm) await setWatermark('pickups', wm);
  return { ...stats, watermark: wm };
}

// ---------------------------------------------------------------------------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SECRET) return res.status(500).json({ error: 'PRIORITY_SYNC_SECRET not configured' });
  if (req.headers['x-sync-secret'] !== SECRET) {
    return res.status(401).json({ error: 'bad secret' });
  }

  try {
    if (req.method === 'GET') return await handleGet(res);

    if (req.method === 'POST') {
      const kind = String(req.query.kind ?? '');
      // Make posts the raw OData response body: { "@odata.context": ..., "value": [...] }
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const rows: Row[] = Array.isArray(body?.value) ? body.value : [];

      if (kind === 'customers') return res.status(200).json(await upsertCustomers(rows));
      if (kind === 'orders') return res.status(200).json(await upsertOrders(rows));
      if (kind === 'service_calls') return res.status(200).json(await upsertServiceCalls(rows));
      if (kind === 'pickups') return res.status(200).json(await upsertPickups(rows));
      return res.status(400).json({ error: `unknown kind: ${kind}` });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[priority-sync]', msg);
    return res.status(500).json({ error: msg });
  }
}
