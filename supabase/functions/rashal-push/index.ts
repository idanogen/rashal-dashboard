// rashal-push — המחליף הישיר של תרחיש chat-push של Make (9479946).
// מושך את ה-outbox מה-Vercel endpoint, דוחף כל כתיבה לפריוריטי (כרטיס לקוח),
// ומאשר (ack) רק אירועים שכל הכתיבות שלהם הצליחו — אירוע חלקי יחזור בריצה הבאה
// (claim של 10 דק' בצד ה-outbox מונע משיכה כפולה במקביל).
// ⚠זהירות: POST לפריוריטי אינו אידמפוטנטי — אסור ששני pollers ירוצו במקביל (Make כובה לפני תזמון הפונקציה הזו).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const OUTBOX = "https://rashal-dashboard.vercel.app/api/priority-push";
const UA = "OgenSync/1.0";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const syncSecret = () => Deno.env.get("PRIORITY_SYNC_SECRET") ?? "";
const basicAuth = () =>
  "Basic " + btoa(`${Deno.env.get("PRIORITY_USER")}:${Deno.env.get("PRIORITY_PASSWORD")}`);

async function logEvent(ev: Record<string, unknown>) {
  const { error } = await sb.from("sync_events").insert(ev);
  if (error) console.error("sync_events insert failed:", error.message);
}

async function fetchRetry(runId: number, entity: string, url: string, init: RequestInit, urlPath: string) {
  const delays = [0, 2000, 5000];
  let lastErr = "";
  for (let i = 0; i < delays.length; i++) {
    if (delays[i]) await new Promise((r) => setTimeout(r, delays[i]));
    const t0 = Date.now();
    try {
      const res = await fetch(url, init);
      const body = await res.text();
      await logEvent({
        run_id: runId, entity, attempt: i + 1, http_status: res.status, ok: res.ok,
        duration_ms: Date.now() - t0, url_path: urlPath,
        error_snippet: res.ok ? null : body.slice(0, 300),
      });
      if (res.ok) return { res, body, attempts: i + 1 };
      lastErr = `HTTP ${res.status}: ${body.slice(0, 200)}`;
    } catch (e) {
      lastErr = String(e).slice(0, 300);
      await logEvent({ run_id: runId, entity, attempt: i + 1, ok: false, duration_ms: Date.now() - t0, url_path: urlPath, error_snippet: lastErr });
    }
  }
  return { res: null, body: lastErr, attempts: delays.length };
}

Deno.serve(async (req: Request) => {
  let trigger = "manual";
  try { const b = await req.json(); if (b?.trigger) trigger = String(b.trigger); } catch { /* default */ }

  const t0 = Date.now();
  const { data: runRow, error: runErr } = await sb
    .from("sync_runs").insert({ job: "push-chat", trigger_source: trigger }).select("id").single();
  if (runErr || !runRow) {
    return new Response(JSON.stringify({ error: `sync_runs insert: ${runErr?.message}` }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
  const runId = runRow.id as number;
  let retries = 0;
  const errors: string[] = [];

  // 1) משיכת ה-outbox (ה-GET גם תופס claim בצד השרת)
  const ob = await fetchRetry(runId, "outbox", OUTBOX, { headers: { "x-sync-secret": syncSecret() } }, "/api/priority-push GET");
  retries += ob.attempts - 1;
  if (!ob.res) {
    await sb.from("sync_runs").update({ status: "error", finished_at: new Date().toISOString(), duration_ms: Date.now() - t0, retries, error_summary: `outbox: ${ob.body.slice(0, 300)}` }).eq("id", runId);
    return new Response(JSON.stringify({ run_id: runId, ok: false, stage: "outbox" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  const parsed = JSON.parse(ob.body) as { writes?: { event_id: string; url: string; body: string }[]; skipped?: number };
  const writes = parsed.writes ?? [];

  // 2) דחיפה לפריוריטי, כתיבה-כתיבה. מעקב הצלחה פר-אירוע.
  const evOk = new Map<string, boolean>();
  let pushed = 0;
  for (const w of writes) {
    const path = w.url.replace(/^https?:\/\/[^/]+/, "").split("?")[0];
    const pr = await fetchRetry(runId, "push_write", w.url, {
      method: "POST",
      headers: { Authorization: basicAuth(), "User-Agent": UA, "Content-Type": "application/json" },
      body: w.body,
    }, path);
    retries += pr.attempts - 1;
    const ok = !!pr.res;
    if (ok) pushed++;
    else errors.push(`write ${w.event_id}: ${pr.body.slice(0, 150)}`);
    evOk.set(w.event_id, (evOk.get(w.event_id) ?? true) && ok);
  }

  // 3) ack רק לאירועים שהושלמו במלואם
  const ackIds = [...evOk.entries()].filter(([, ok]) => ok).map(([id]) => id);
  let acked = 0;
  if (ackIds.length) {
    const ack = await fetchRetry(runId, "ack", `${OUTBOX}?ack=1`, {
      method: "POST",
      headers: { "x-sync-secret": syncSecret(), "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ackIds }),
    }, "/api/priority-push?ack");
    retries += ack.attempts - 1;
    if (ack.res) { try { acked = JSON.parse(ack.body)?.acked ?? 0; } catch { /* best-effort */ } }
    else errors.push(`ack: ${ack.body.slice(0, 150)}`);
  }

  const status = errors.length === 0 ? "success" : (pushed > 0 || acked > 0 ? "partial" : "error");
  await sb.from("sync_runs").update({
    status, finished_at: new Date().toISOString(), duration_ms: Date.now() - t0,
    rows_fetched: writes.length, rows_upserted: acked, retries,
    error_summary: errors.length ? errors.join(" | ").slice(0, 900) : null,
  }).eq("id", runId);

  return new Response(JSON.stringify({ run_id: runId, job: "push-chat", status, writes: writes.length, pushed, acked, skipped: parsed.skipped ?? 0 }), {
    headers: { "Content-Type": "application/json" },
  });
});
