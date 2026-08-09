// rashal-sync — המחליף הישיר של תרחישי המשיכה של Make (MAKE-MIGRATION-PLAN §2-3).
// שומר על הארכיטקטורה הקיימת: ה-upsert/adoption נשאר ב-Vercel inbox (/api/priority-sync);
// הפונקציה מחליפה רק את מה ש-Make עשה: תזמון + משיכת OData + החזרת הגוף ל-inbox.
// עם מה ש-Make לא נתן: retry×3 + backoff לכל קריאה, לוגים מלאים (sync_runs/sync_events),
// ואפס כיבוי-על-כשל — תמיד ממשיכים לריצה הבאה (הלקח מ-26/07: Make כיבה בשקט אחרי 3 כשלים).
// הפעלה: POST {"job":"pull-core"|"pull-pickups"|"pull-pickup-addresses","trigger":"cron"|"manual"}
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const PRIORITY = "https://p.priority-connect.online/odata/Priority/tabb4ce6.ini/shaal";
const INBOX = "https://rashal-dashboard.vercel.app/api/priority-sync";
const UA = "OgenSync/1.0";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const syncSecret = () => Deno.env.get("PRIORITY_SYNC_SECRET") ?? "";
const basicAuth = () =>
  "Basic " + btoa(`${Deno.env.get("PRIORITY_USER")}:${Deno.env.get("PRIORITY_PASSWORD")}`);

type Ev = {
  run_id: number; entity: string; attempt: number; http_status?: number;
  ok: boolean; duration_ms: number; rows?: number; url_path?: string; error_snippet?: string;
};
async function logEvent(ev: Ev) {
  const { error } = await sb.from("sync_events").insert(ev);
  if (error) console.error("sync_events insert failed:", error.message);
}

// קריאת HTTP עם עד 3 נסיונות + backoff (2s/5s) — פריוריטי-קונקט מנתק ~50% מהקריאות (לקח #22).
async function fetchRetry(
  runId: number, entity: string, url: string, init: RequestInit, urlPath: string,
): Promise<{ res: Response | null; body: string; attempts: number }> {
  const delays = [0, 2000, 5000];
  let lastErr = "";
  for (let i = 0; i < delays.length; i++) {
    if (delays[i]) await new Promise((r) => setTimeout(r, delays[i]));
    const t0 = Date.now();
    try {
      const res = await fetch(url, init);
      const body = await res.text();
      const ok = res.ok;
      await logEvent({
        run_id: runId, entity, attempt: i + 1, http_status: res.status, ok,
        duration_ms: Date.now() - t0, url_path: urlPath,
        error_snippet: ok ? undefined : body.slice(0, 300),
      });
      if (ok) return { res, body, attempts: i + 1 };
      lastErr = `HTTP ${res.status}: ${body.slice(0, 200)}`;
    } catch (e) {
      lastErr = String(e).slice(0, 300);
      await logEvent({
        run_id: runId, entity, attempt: i + 1, ok: false,
        duration_ms: Date.now() - t0, url_path: urlPath, error_snippet: lastErr,
      });
    }
  }
  return { res: null, body: lastErr, attempts: delays.length };
}

// השאילתות — העתק נאמן 1:1 מה-blueprints של Make (נמשכו 04/08/2026)
const Q = {
  customers: (since: string) =>
    `/CUSTOMERS?$select=CUSTNAME,CUSTDES,ADDRESS,STATE,PHONE,FAX,AGENTNAME,MCUSTDES,OWNERLOGIN,CREATEDDATE` +
    `&$filter=${encodeURIComponent(`CREATEDDATE ge ${since}`)}&$orderby=CREATEDDATE%20asc&$top=4000`,
  orders: (since: string) =>
    `/ORDERS?$select=ORDNAME,CUSTNAME,CDES,CURDATE,STATUSDATE,ORDSTATUSDES,AGENTNAME,TYPEDES,DOERNAME,Y_151_0_ESHB` +
    `&$expand=${encodeURIComponent("ORDERITEMS_SUBFORM($select=PARTNAME,PDES,TQUANT,SERIALNAME)")}` +
    `&$filter=${encodeURIComponent(`STATUSDATE ge ${since}`)}&$orderby=STATUSDATE%20asc&$top=8000`,
  // CALLSTATUSCODE added 05/08/2026 — the call's status in Priority. Without it
  // nothing ever closed on our side and 96% of calls sat in "קריאה חדשה".
  service_calls: (since: string) =>
    `/DOCUMENTS_Q?$select=DOCNO,CUSTNAME,CDES,STARTDATE,STATUSDATE,PHONENUM,SUSERLOGIN,Y_149_0_ESHB,Y_2578_0_ESHB,Y_2632_5_ESH,MALFDES,SYMDES,CALLTYPECODE,CALLSTATUSCODE,SERVTDES,SERNUM,PARTNAME,PARTDES,WARDATEFINAL,RSHL_INSTDATE` +
    `&$filter=${encodeURIComponent(`STATUSDATE ge ${since}`)}&$orderby=STATUSDATE%20asc&$top=1500`,
  pickups_lines: (since: string) =>
    `/DOCUMENTS_N?$select=DOCNO,DOC,CUSTNAME,CDES,CURDATE,STATDES,ORDNAME,ODOCNO,REFERENCE,TOWARHSDES,AGENTNAME,OWNERLOGIN,TOTQUANT,TOTPRICE,UDATE` +
    `&$expand=${encodeURIComponent("TRANSORDER_N_SUBFORM($select=TRANS,KLINE,PARTNAME,PDES,TQUANT,TUNITNAME,BARCODE,ORDNAME,RETREASONDES)")}` +
    `&$filter=${encodeURIComponent(`UDATE ge ${since}`)}&$orderby=UDATE%20asc&$top=8000`,
  pickups_addresses: (since: string) =>
    `/DOCUMENTS_N?$select=DOCNO,DOC,CUSTNAME,CDES,CURDATE,STATDES,ORDNAME,ODOCNO,REFERENCE,TOWARHSDES,AGENTNAME,OWNERLOGIN,TOTQUANT,TOTPRICE,UDATE` +
    `&$expand=${encodeURIComponent("DOCUMENTS_DCONT_SUBFORM($select=ADRS,STATE,PHONE,FAX)")}` +
    `&$filter=${encodeURIComponent(`UDATE ge ${since}`)}&$orderby=UDATE%20asc&$top=8000`,
};

// חלון מתגלגל 3 ימים לכתובות איסוף (כמו addDays(now;-3) ב-Make)
function rolling3Days(): string {
  const d = new Date(Date.now() - 3 * 24 * 3600 * 1000);
  return `${d.toISOString().slice(0, 10)}T00:00:00Z`;
}

interface Step { entity: string; kind: string; buildUrl: (wm: Record<string, string>) => string | null }
const JOBS: Record<string, Step[]> = {
  "pull-core": [
    { entity: "customers", kind: "customers", buildUrl: (w) => w.customers_since ? Q.customers(w.customers_since) : null },
    { entity: "orders", kind: "orders", buildUrl: (w) => w.orders_since ? Q.orders(w.orders_since) : null },
    { entity: "service_calls", kind: "service_calls", buildUrl: (w) => w.calls_since ? Q.service_calls(w.calls_since) : null },
  ],
  "pull-pickups": [
    { entity: "pickups_lines", kind: "pickups", buildUrl: (w) => w.pickups_since ? Q.pickups_lines(w.pickups_since) : null },
  ],
  "pull-pickup-addresses": [
    { entity: "pickups_addresses", kind: "pickups", buildUrl: () => Q.pickups_addresses(rolling3Days()) },
  ],
};

// ── Cleanup mapping (agreed with Idan 05/08/2026) ──────────────────────────
// Priority is authoritative for TERMINAL states only. Anything still open there
// (מאושרת לבצוע / לביצוע / שובצה / להמשך טיפול) leaves our status untouched, so
// the dispatcher's own flow is never overwritten. "שובצה" is deliberately NOT
// mapped — its meaning at Rashal is still unconfirmed.
// 09/08/2026 — "בוצעה" and "שולמה" removed, see api/priority-sync.ts for the
// full reasoning. Priority sets "בוצעה" at billing time, before the drive.
const ORDER_TERMINAL: Record<string, string> = {
  "מבוטלת": "בוטל",
};
const CALL_TERMINAL: Record<string, string> = {
  "בוצעה": "בוצע",
  "סופית": "בוצע",
  "מבוטלת": "בוטל",
};

// Our oldest row is 19/03/2026, so one bounded window covers everything we hold.
// (Paging with $skip blew the function's 150s idle timeout.)
const CLEANUP_SINCE = "2026-03-01T00:00:00Z";

// Statuses for one entity, in a single bounded request. Read-only.
async function fetchPriorityStatuses(
  entity: string, select: string, dateField: string,
): Promise<Row[]> {
  const auth = { headers: { Authorization: basicAuth(), "User-Agent": UA, Accept: "application/json" } };
  const url = `${PRIORITY}/${entity}?$select=${select}` +
    `&$filter=${encodeURIComponent(`${dateField} ge ${CLEANUP_SINCE}`)}` +
    `&$orderby=${dateField}%20asc&$top=30000`;
  const res = await fetch(url, auth);
  if (!res.ok) throw new Error(`${entity} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (JSON.parse(await res.text())?.value ?? []) as Row[];
}

type Row = Record<string, unknown>;

// Dry-run: what WOULD the cleanup do? Writes nothing. One entity per call, to
// stay inside the function's 150s idle timeout.
async function reportCleanup(which: string): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};

  const plan = async (
    label: string, entity: string, keyField: string, statusField: string, dateField: string,
    table: string, keyCol: string, statusCol: string, openDefault: string,
    terminal: Record<string, string>,
  ) => {
    const pri = await fetchPriorityStatuses(entity, `${keyField},${statusField},${dateField}`, dateField);
    const byKey = new Map<string, string>();
    for (const r of pri) {
      const k = String(r[keyField] ?? "").trim();
      if (k) byKey.set(k, String(r[statusField] ?? "(null)"));
    }

    // our linked rows
    const ours: Row[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from(table)
        .select(`id,${keyCol},${statusCol}`).not(keyCol, "is", null).range(from, from + 999);
      if (error) throw new Error(`${table} read: ${error.message}`);
      ours.push(...((data ?? []) as Row[]));
      if (!data || data.length < 1000) break;
    }

    const wouldChange: Record<string, number> = {};
    const openBreakdown: Record<string, number> = {};
    const closingIds: string[] = [];
    let notFoundInPriority = 0, staysOpen = 0, alreadyCorrect = 0;
    for (const o of ours) {
      const p = byKey.get(String(o[keyCol]));
      if (p === undefined) { notFoundInPriority++; continue; }
      const target = terminal[p];
      if (!target) {
        staysOpen++;
        openBreakdown[p] = (openBreakdown[p] ?? 0) + 1;
        continue;
      }
      const cur = String(o[statusCol] ?? openDefault);
      if (cur === target) { alreadyCorrect++; continue; }
      wouldChange[`${cur} → ${target}`] = (wouldChange[`${cur} → ${target}`] ?? 0) + 1;
      closingIds.push(o.id as string);
    }

    // Side effect worth knowing before we run: a record Priority already closed
    // may still be sitting on the dispatcher's calendar as a planned stop.
    const stopCol = table === 'orders' ? 'order_id' : 'service_call_id';
    let openStopsOnClosing = 0;
    for (let i = 0; i < closingIds.length; i += 200) {
      const { data, error } = await sb.from('calendar_stops')
        .select('id').in(stopCol, closingIds.slice(i, i + 200))
        .in('status', ['planned', 'in_progress']);
      if (error) throw new Error(`calendar_stops check: ${error.message}`);
      openStopsOnClosing += (data ?? []).length;
    }

    out[label] = {
      priority_rows: pri.length,
      our_linked_rows: ours.length,
      would_change: wouldChange,
      would_change_total: Object.values(wouldChange).reduce((a, b) => a + b, 0),
      stays_open: staysOpen,
      stays_open_by_priority_status: openBreakdown,
      already_correct: alreadyCorrect,
      not_found_in_priority: notFoundInPriority,
      active_calendar_stops_on_closing_rows: openStopsOnClosing,
    };
  };

  if (which === "orders" || which === "both") {
    try {
      await plan("orders", "ORDERS", "ORDNAME", "ORDSTATUSDES", "STATUSDATE",
        "orders", "priority_order_id", "order_status", "ממתין לתאום", ORDER_TERMINAL);
    } catch (e) { out.orders = String(e).slice(0, 300); }
  }

  if (which === "service_calls" || which === "both") {
    try {
      await plan("service_calls", "DOCUMENTS_Q", "DOCNO", "CALLSTATUSCODE", "STATUSDATE",
        "service_calls", "priority_call_id", "service_call_status", "קריאה חדשה", CALL_TERMINAL);
    } catch (e) { out.service_calls = String(e).slice(0, 300); }
  }

  return out;
}

// Backfill: apply Priority's terminal statuses to rows we already hold.
// Deliberately does NOT touch calendar_stops — Idan's call 05/08: a stop that is
// still planned stays on the dispatcher's calendar even when Priority already
// closed the record, because "בוצעה" is sometimes set for billing before the
// drive actually happens. Those rows are reported instead (job report-stuck-stops).
async function applyCleanup(which: string): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};

  const run = async (
    label: string, entity: string, keyField: string, statusField: string, dateField: string,
    table: string, keyCol: string, statusCol: string,
    terminal: Record<string, string>,
  ) => {
    const pri = await fetchPriorityStatuses(entity, `${keyField},${statusField},${dateField}`, dateField);
    const byKey = new Map<string, string>();
    for (const r of pri) {
      const k = String(r[keyField] ?? "").trim();
      if (k) byKey.set(k, String(r[statusField] ?? ""));
    }

    const ours: Row[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from(table)
        .select(`id,${keyCol},${statusCol},priority_status`).not(keyCol, "is", null).range(from, from + 999);
      if (error) throw new Error(`${table} read: ${error.message}`);
      ours.push(...((data ?? []) as Row[]));
      if (!data || data.length < 1000) break;
    }

    // group by (target status, priority_status) so each UPDATE hits many ids
    const buckets = new Map<string, string[]>();
    let statusOnly = 0;
    for (const o of ours) {
      const p = byKey.get(String(o[keyCol]));
      if (p === undefined) continue;
      const target = terminal[p];
      const curApp = String(o[statusCol] ?? "");
      const curPri = o.priority_status === null ? "" : String(o.priority_status);
      const needsApp = target && curApp !== target;
      const needsPri = curPri !== p;
      if (!needsApp && !needsPri) continue;
      if (!needsApp) statusOnly++;
      const bk = `${needsApp ? target : ""}|${p}`;
      (buckets.get(bk) ?? buckets.set(bk, []).get(bk)!).push(o.id as string);
    }

    let appChanged = 0, priChanged = 0;
    for (const [bk, ids] of buckets) {
      const [target, pri_] = bk.split("|");
      const patch: Row = { priority_status: pri_ };
      if (target) patch[statusCol] = target;
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const { error } = await sb.from(table).update(patch).in("id", chunk);
        if (error) throw new Error(`${table} update: ${error.message}`);
        priChanged += chunk.length;
        if (target) appChanged += chunk.length;
      }
    }
    out[label] = { priority_rows: pri.length, our_linked_rows: ours.length, status_closed: appChanged, priority_status_written: priChanged, priority_status_only: statusOnly };
  };

  if (which === "orders" || which === "both") {
    await run("orders", "ORDERS", "ORDNAME", "ORDSTATUSDES", "STATUSDATE",
      "orders", "priority_order_id", "order_status", ORDER_TERMINAL);
  }
  if (which === "service_calls" || which === "both") {
    await run("service_calls", "DOCUMENTS_Q", "DOCNO", "CALLSTATUSCODE", "STATUSDATE",
      "service_calls", "priority_call_id", "service_call_status", CALL_TERMINAL);
  }
  return out;
}

// Records Priority has already closed that still carry an open stop on the
// dispatcher's calendar. Read-only — the sweep deliberately leaves these alone,
// so this is how they surface for a human to clear.
async function reportStuckStops(): Promise<Record<string, unknown>> {
  const rows: Row[] = [];

  const { data: stops, error } = await sb.from("calendar_stops")
    .select("id,order_id,service_call_id,delivery_date,driver,status")
    .in("status", ["planned", "in_progress"]);
  if (error) throw new Error(`calendar_stops: ${error.message}`);

  const orderIds = (stops ?? []).map((s) => (s as Row).order_id).filter(Boolean) as string[];
  const callIds = (stops ?? []).map((s) => (s as Row).service_call_id).filter(Boolean) as string[];

  const load = async (table: string, ids: string[], statusCol: string, keyCol: string, closed: string[]) => {
    const m = new Map<string, Row>();
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error: e } = await sb.from(table)
        .select(`id,${keyCol},customer_name,city,${statusCol},priority_status`)
        .in("id", ids.slice(i, i + 200)).in(statusCol, closed);
      if (e) throw new Error(`${table}: ${e.message}`);
      for (const r of (data ?? []) as unknown as Row[]) m.set(r.id as string, r);
    }
    return m;
  };

  const closedOrders = await load("orders", orderIds, "order_status", "priority_order_id", ["סופק", "בוטל"]);
  const closedCalls = await load("service_calls", callIds, "service_call_status", "priority_call_id", ["בוצע", "בוטל"]);

  for (const s of (stops ?? []) as unknown as Row[]) {
    const o = s.order_id ? closedOrders.get(s.order_id as string) : undefined;
    const c = s.service_call_id ? closedCalls.get(s.service_call_id as string) : undefined;
    const src = o ?? c;
    if (!src) continue;
    rows.push({
      kind: o ? "משלוח" : "שירות",
      ref: o ? o.priority_order_id : c!.priority_call_id,
      customer_name: src.customer_name,
      city: src.city,
      new_status: o ? o.order_status : c!.service_call_status,
      priority_status: src.priority_status,
      delivery_date: s.delivery_date,
      driver: s.driver,
      stop_status: s.status,
    });
  }
  rows.sort((a, b) => String(a.delivery_date).localeCompare(String(b.delivery_date)));
  return { count: rows.length, rows };
}

// Read-only schema probe. Priority field names differ per environment (Roni's
// learning #1: `$select` with an unknown field returns 400 naming it), and the
// credentials only exist as Edge Function secrets — so discovery has to happen
// here. Fixed queries only; no caller-supplied path, so this cannot be used as
// an open proxy to Priority.
async function probe(): Promise<Record<string, unknown>> {
  const auth = { headers: { Authorization: basicAuth(), "User-Agent": UA, Accept: "application/json" } };
  const out: Record<string, unknown> = {};

  // 1. which ORDSTATUSDES values actually occur, and how often
  try {
    const res = await fetch(`${PRIORITY}/ORDERS?$select=ORDNAME,ORDSTATUSDES,STATUSDATE&$orderby=STATUSDATE%20desc&$top=500`, auth);
    const body = await res.text();
    if (res.ok) {
      const counts: Record<string, number> = {};
      for (const r of JSON.parse(body)?.value ?? []) {
        const k = String(r.ORDSTATUSDES ?? "(null)");
        counts[k] = (counts[k] ?? 0) + 1;
      }
      out.order_status_values = counts;
    } else out.order_status_values = `HTTP ${res.status}: ${body.slice(0, 200)}`;
  } catch (e) { out.order_status_values = String(e).slice(0, 200); }

  // 2. which CALLSTATUSCODE values occur on service calls (the status field we
  //    never mapped — discovered from a full-row dump on 05/08)
  try {
    const res = await fetch(`${PRIORITY}/DOCUMENTS_Q?$select=DOCNO,CALLSTATUSCODE,STATUSDATE&$orderby=STATUSDATE%20desc&$top=500`, auth);
    const body = await res.text();
    if (res.ok) {
      const counts: Record<string, number> = {};
      for (const r of JSON.parse(body)?.value ?? []) {
        const k = String(r.CALLSTATUSCODE ?? "(null)");
        counts[k] = (counts[k] ?? 0) + 1;
      }
      out.call_status_values = counts;
    } else out.call_status_values = `HTTP ${res.status}: ${body.slice(0, 200)}`;
  } catch (e) { out.call_status_values = String(e).slice(0, 200); }

  return out;
}

// Field discovery. Priority field names differ per environment and `$select`
// with an unknown one returns 400 (Roni's learning #1), so we never guess: pull
// one full row per entity and list the keys. Used to pick the right date field
// for the reconcile window — notably whether CUSTOMERS carries an update date
// at all, or only CREATEDDATE (which never moves after creation).
async function probeFields(): Promise<Record<string, unknown>> {
  const auth = { headers: { Authorization: basicAuth(), "User-Agent": UA, Accept: "application/json" } };
  const out: Record<string, unknown> = {};

  for (const entity of ["CUSTOMERS", "ORDERS", "DOCUMENTS_Q", "DOCUMENTS_N"]) {
    try {
      const res = await fetch(`${PRIORITY}/${entity}?$top=1`, auth);
      const body = await res.text();
      if (!res.ok) { out[entity] = `HTTP ${res.status}: ${body.slice(0, 200)}`; continue; }
      const row = JSON.parse(body)?.value?.[0] ?? {};
      const keys = Object.keys(row);
      out[entity] = {
        total_fields: keys.length,
        // the fields that could bound a reconcile window
        date_like: keys.filter((k) => /DATE|UDATE|TIME/i.test(k)).sort(),
        all: keys.sort(),
      };
    } catch (e) { out[entity] = String(e).slice(0, 200); }
  }

  return out;
}

// ─── ריצת השוואה (reconcile) ────────────────────────────────────────────────
// המשיכות הרגילות הן הפרשיות בלבד: כל אחת שואלת רק על מה שזז מאז הווטרמרק.
// רשומה שנוצרה לפני שהסנכרון התחיל, או שהווטרמרק דילג עליה, לא תיכנס לעולם,
// ואף אחד לא ידע. זה מה שקרה ב-09/08: 3 אספקות מהגיליון של עמי לא היו קיימות
// אצלנו בשום טבלה, בזמן שכל ארבע העבודות דיווחו success.
//
// הריצה הזו לא משתמשת בווטרמרק. היא מושכת את המצב המלא של חלון זמן ומשווה
// מול מה שיש לנו. **קריאה בלבד, לא מתקנת כלום** — מדווחת, ועידן מחליט.
const RECONCILE: Record<string, {
  entity: string; key: string; dateField: string; extra: string[];
  table: string; keyCol: string; nameCol: string;
}> = {
  customers: {
    entity: "CUSTOMERS", key: "CUSTNAME", dateField: "CREATEDDATE",
    extra: ["CUSTDES", "PHONE", "STATE", "ADDRESS", "STATUSDATE"],
    table: "priority_customers", keyCol: "custname", nameCol: "cdes",
  },
  orders: {
    entity: "ORDERS", key: "ORDNAME", dateField: "CURDATE",
    extra: ["CDES", "ORDSTATUSDES", "STATUSDATE"],
    table: "orders", keyCol: "priority_order_id", nameCol: "customer_name",
  },
  service_calls: {
    entity: "DOCUMENTS_Q", key: "DOCNO", dateField: "STARTDATE",
    extra: ["CDES", "CALLSTATUSCODE", "STATUSDATE"],
    table: "service_calls", keyCol: "priority_call_id", nameCol: "customer_name",
  },
  pickups: {
    entity: "DOCUMENTS_N", key: "DOCNO", dateField: "CURDATE",
    extra: ["CDES", "STATDES", "UDATE"],
    table: "pickups", keyCol: "priority_pickup_id", nameCol: "customer_name",
  },
};

/** כל המפתחות שיש לנו בטבלה, בדפדוף. PostgREST חותך ב-1000 בשקט. */
async function ourKeys(table: string, keyCol: string): Promise<Set<string>> {
  const out = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(keyCol)
      .not(keyCol, "is", null).range(from, from + 999);
    if (error) throw new Error(`${table}.${keyCol}: ${error.message}`);
    for (const r of data ?? []) {
      const v = (r as Record<string, unknown>)[keyCol];
      if (v) out.add(String(v).trim());
    }
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function reconcile(which: string, days: number): Promise<Record<string, unknown>> {
  const cfg = RECONCILE[which];
  if (!cfg) return { error: `unknown entity '${which}'`, known: Object.keys(RECONCILE) };

  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 19) + "Z";
  const select = [cfg.key, cfg.dateField, ...cfg.extra].join(",");
  const url = `${PRIORITY}/${cfg.entity}?$select=${select}` +
    `&$filter=${encodeURIComponent(`${cfg.dateField} ge ${since}`)}` +
    `&$orderby=${cfg.dateField}%20asc&$top=8000`;

  const auth = { headers: { Authorization: basicAuth(), "User-Agent": UA, Accept: "application/json" } };
  const res = await fetch(url, auth);
  const body = await res.text();
  if (!res.ok) return { entity: cfg.entity, error: `HTTP ${res.status}`, detail: body.slice(0, 300) };

  const rows: Row[] = JSON.parse(body)?.value ?? [];
  const have = await ourKeys(cfg.table, cfg.keyCol);

  const missing: Row[] = [];
  for (const r of rows) {
    const k = String(r[cfg.key] ?? "").trim();
    if (k && !have.has(k)) missing.push(r);
  }

  // כמה מהרשומות בחלון נגעו בהן אחרי היצירה. אם המספר גבוה, משיכה שמסננת
  // לפי תאריך יצירה בלבד מפספסת עדכונים באופן שיטתי (המקרה של CUSTOMERS).
  let touchedAfterCreate = 0;
  if (cfg.extra.includes("STATUSDATE")) {
    for (const r of rows) {
      const c = String(r[cfg.dateField] ?? "").slice(0, 10);
      const s = String(r.STATUSDATE ?? "").slice(0, 10);
      if (c && s && s > c) touchedAfterCreate++;
    }
  }

  return {
    entity: cfg.entity,
    window_days: days,
    since,
    in_priority: rows.length,
    we_hold_total: have.size,
    missing_in_us: missing.length,
    touched_after_create: touchedAfterCreate,
    // דגימה לפעולה ידנית — שם, טלפון ועיר, לא רק מזהים
    sample: missing.slice(0, 50).map((r) => ({
      key: r[cfg.key],
      name: r.CDES ?? r.CUSTDES,
      phone: r.PHONE ?? null,
      city: r.STATE ?? null,
      date: r[cfg.dateField],
    })),
  };
}

// ─── ריצת ההשוואה היומית ────────────────────────────────────────────────────
// אותה השוואה, אבל אוטומטית ושותקת. מתריעה רק על חוסר אמיתי: רשומה שנוצרה
// בפריוריטי לפני היום ועדיין לא אצלנו. רשומה מהיום היא פיגור רגיל בין ריצות
// ולא חריגה, אחרת ההתראה תצפצף כל בוקר ותיהפך לרעש שמתעלמים ממנו.
//
// הרציונל: הוואצ'דוג סופר ריצות מוצלחות ולכן היה ירוק לאורך כל התקופה שבה
// המערכת החביאה 73% מהעבודה. ניטור שלא בודק תוכן לא תופס כשל סמנטי.
const RESEND_KEY = () => Deno.env.get("RESEND_API_KEY") ?? "";
const ALERT_EMAIL = () => Deno.env.get("ALERT_EMAIL") ?? "idan@ogensolutions.biz";
const ALERT_FROM = () => Deno.env.get("ALERT_FROM") ?? "Ogen Sync <onboarding@resend.dev>";

async function sendAlertEmail(subject: string, html: string): Promise<boolean> {
  const key = RESEND_KEY();
  if (!key) { console.error("reconcile-daily: no RESEND_API_KEY"); return false; }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: ALERT_FROM(), to: [ALERT_EMAIL()], subject, html }),
  });
  if (!r.ok) console.error("resend failed:", r.status, (await r.text()).slice(0, 200));
  return r.ok;
}

const LABELS: Record<string, string> = {
  customers: "לקוחות", orders: "הזמנות",
  service_calls: "קריאות שירות", pickups: "איסופים",
};

async function reconcileDaily(days: number): Promise<Record<string, unknown>> {
  const todayUtc = new Date().toISOString().slice(0, 10);
  const summary: Record<string, unknown> = {};
  const anomalies: { entity: string; rows: Row[] }[] = [];
  let checked = 0;

  for (const which of Object.keys(RECONCILE)) {
    let r: Record<string, unknown>;
    try { r = await reconcile(which, days); }
    catch (e) { summary[which] = { error: String(e).slice(0, 200) }; continue; }

    if (r.error) { summary[which] = r; continue; }

    // חוסר אמיתי = נוצר לפני היום ועדיין לא אצלנו
    const sample = (r.sample ?? []) as Row[];
    const real = sample.filter((s) => String(s.date ?? "").slice(0, 10) < todayUtc);
    checked += Number(r.in_priority ?? 0);

    summary[which] = {
      in_priority: r.in_priority,
      missing_total: r.missing_in_us,
      missing_real: real.length,
      missing_today_only: Number(r.missing_in_us ?? 0) - real.length,
    };
    if (real.length) anomalies.push({ entity: which, rows: real });
  }

  const totalReal = anomalies.reduce((a, b) => a + b.rows.length, 0);

  await sb.from("reconcile_runs").insert({
    window_days: days,
    rows_checked: checked,
    missing_real: totalReal,
    summary,
    details: anomalies.length ? anomalies : null,
  });

  if (totalReal > 0) {
    const blocks = anomalies.map((a) => {
      const rows = a.rows.slice(0, 25).map((s) =>
        `<tr><td style="padding:4px 10px;font-family:monospace">${s.key}</td>` +
        `<td style="padding:4px 10px">${s.name ?? ""}</td>` +
        `<td style="padding:4px 10px">${s.city ?? ""}</td>` +
        `<td style="padding:4px 10px" dir="ltr">${s.phone ?? ""}</td>` +
        `<td style="padding:4px 10px">${String(s.date ?? "").slice(0, 10)}</td></tr>`).join("");
      return `<h3 style="margin:18px 0 6px">${LABELS[a.entity] ?? a.entity} · ${a.rows.length}</h3>` +
        `<table style="border-collapse:collapse;font-size:13px">${rows}</table>`;
    }).join("");

    await sendAlertEmail(
      `רשעל · ${totalReal} רשומות קיימות בפריוריטי ולא אצלנו`,
      `<div dir="rtl" style="font-family:system-ui,sans-serif;color:#14223a">
         <p>ריצת ההשוואה היומית מצאה רשומות שנפתחו בפריוריטי לפני היום ולא הגיעו למערכת.</p>
         <p style="color:#666;font-size:13px">רשומות שנוצרו היום לא נספרות, הן פיגור רגיל בין ריצות.</p>
         ${blocks}
       </div>`,
    );
  }

  return { ran_at: new Date().toISOString(), window_days: days, missing_real: totalReal, summary };
}

Deno.serve(async (req: Request) => {
  let job = "pull-core", trigger = "manual";
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
    if (body?.job) job = String(body.job);
    if (body?.trigger) trigger = String(body.trigger);
  } catch { /* defaults */ }

  if (job === "probe") {
    return new Response(JSON.stringify(await probe(), null, 2), { headers: { "Content-Type": "application/json" } });
  }
  if (job === "probe-fields") {
    return new Response(JSON.stringify(await probeFields(), null, 2), { headers: { "Content-Type": "application/json" } });
  }
  if (job === "reconcile-daily") {
    const days = Number(body?.days ?? 30);
    return new Response(JSON.stringify(await reconcileDaily(days), null, 2), { headers: { "Content-Type": "application/json" } });
  }
  if (job === "reconcile") {
    const days = Number(body?.days ?? 30);
    const which = body?.entity ? [String(body.entity)] : Object.keys(RECONCILE);
    const out: Record<string, unknown> = { ran_at: new Date().toISOString() };
    for (const w of which) {
      try { out[w] = await reconcile(w, days); }
      catch (e) { out[w] = { error: String(e).slice(0, 300) }; }
    }
    return new Response(JSON.stringify(out, null, 2), { headers: { "Content-Type": "application/json" } });
  }
  if (job === "report-cleanup") {
    const which = body?.entity ? String(body.entity) : "orders";
    return new Response(JSON.stringify(await reportCleanup(which), null, 2), { headers: { "Content-Type": "application/json" } });
  }
  if (job === "report-stuck-stops") {
    return new Response(JSON.stringify(await reportStuckStops(), null, 2), { headers: { "Content-Type": "application/json" } });
  }
  if (job === "apply-cleanup") {
    const which = body?.entity ? String(body.entity) : "orders";
    try {
      return new Response(JSON.stringify(await applyCleanup(which), null, 2), { headers: { "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e).slice(0, 500) }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
  }

  const steps = JOBS[job];
  if (!steps) {
    return new Response(JSON.stringify({ error: `unknown job: ${job}` }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const t0 = Date.now();
  const { data: runRow, error: runErr } = await sb
    .from("sync_runs").insert({ job, trigger_source: trigger }).select("id").single();
  if (runErr || !runRow) {
    return new Response(JSON.stringify({ error: `sync_runs insert: ${runErr?.message}` }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
  const runId = runRow.id as number;

  let watermarks: Record<string, string> = {};
  let fetched = 0, upserted = 0, retries = 0;
  const errors: string[] = [];

  if (job !== "pull-pickup-addresses") {
    const wm = await fetchRetry(runId, "watermarks", INBOX, {
      headers: { "x-sync-secret": syncSecret() },
    }, "/api/priority-sync GET");
    retries += wm.attempts - 1;
    if (!wm.res) {
      await sb.from("sync_runs").update({
        status: "error", finished_at: new Date().toISOString(),
        duration_ms: Date.now() - t0, retries, error_summary: `watermarks: ${wm.body.slice(0, 300)}`,
      }).eq("id", runId);
      return new Response(JSON.stringify({ run_id: runId, ok: false, stage: "watermarks" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    watermarks = JSON.parse(wm.body);
  }

  const results: Record<string, unknown> = {};
  for (const step of steps) {
    const path = step.buildUrl(watermarks);
    if (!path) { results[step.entity] = "skipped (no watermark)"; continue; }
    const pr = await fetchRetry(runId, step.entity, PRIORITY + path, {
      headers: { Authorization: basicAuth(), "User-Agent": UA, Accept: "application/json" },
    }, path.split("?")[0]);
    retries += pr.attempts - 1;
    if (!pr.res) { errors.push(`${step.entity}: ${pr.body.slice(0, 200)}`); results[step.entity] = "fetch failed"; continue; }

    let rows = 0;
    try { rows = (JSON.parse(pr.body)?.value ?? []).length; } catch { /* count best-effort */ }
    fetched += rows;

    const post = await fetchRetry(runId, `inbox:${step.kind}`, `${INBOX}?kind=${step.kind}`, {
      method: "POST",
      headers: { "x-sync-secret": syncSecret(), "Content-Type": "application/json" },
      body: pr.body,
    }, `/api/priority-sync?kind=${step.kind}`);
    retries += post.attempts - 1;
    if (!post.res) { errors.push(`inbox:${step.kind}: ${post.body.slice(0, 200)}`); results[step.entity] = `fetched ${rows}, inbox failed`; continue; }
    let up = 0;
    try {
      const j = JSON.parse(post.body);
      // ה-inbox מחזיר upserted (לקוחות) או updated/inserted/adopted (שאר הישויות)
      up = j?.upserted ?? ((j?.updated ?? 0) + (j?.inserted ?? 0) + (j?.adopted ?? 0));
    } catch { /* shape best-effort */ }
    upserted += up;
    results[step.entity] = { rows, inbox: post.body.slice(0, 200) };
  }

  const status = errors.length === 0 ? "success" : (errors.length < steps.length ? "partial" : "error");
  await sb.from("sync_runs").update({
    status, finished_at: new Date().toISOString(), duration_ms: Date.now() - t0,
    rows_fetched: fetched, rows_upserted: upserted, retries,
    watermark_before: watermarks, error_summary: errors.length ? errors.join(" | ").slice(0, 900) : null,
  }).eq("id", runId);

  return new Response(JSON.stringify({ run_id: runId, job, status, fetched, upserted, retries, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
