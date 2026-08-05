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
  service_calls: (since: string) =>
    `/DOCUMENTS_Q?$select=DOCNO,CUSTNAME,CDES,STARTDATE,STATUSDATE,PHONENUM,SUSERLOGIN,Y_149_0_ESHB,Y_2578_0_ESHB,Y_2632_5_ESH,MALFDES,SYMDES,CALLTYPECODE,SERVTDES,SERNUM,PARTNAME,PARTDES,WARDATEFINAL,RSHL_INSTDATE` +
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

Deno.serve(async (req: Request) => {
  let job = "pull-core", trigger = "manual";
  try {
    const b = await req.json();
    if (b?.job) job = String(b.job);
    if (b?.trigger) trigger = String(b.trigger);
  } catch { /* defaults */ }
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
