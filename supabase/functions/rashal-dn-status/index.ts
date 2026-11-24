// rashal-dn-status: סטטוס "סופק" לתעודת משלוח בפריוריטי (DOCUMENTS_D.STATDES).
//
// עידן, 24/11/2026: "הוספתי בתעודות משלוח סטטוס חדש בשם סופק, אני רוצה שכל משלוח
// יעבור לסטטוס הזה". הנהג לוחץ "בוצע" על אספקה, והתעודה (SH) של אותה אספקה עוברת
// מטיוטא לסופק. עד היום "בוצע" לא נגע בפריוריטי, והתעודה נשארה טיוטא עד שהמשרד סגר.
//
// מצבים, בגוף הבקשה { mode, docno?, status? }:
//   inspect → קריאה בלבד של תעודה אחת: סטטוס, תאריכים, הזמנה.
//   set     → תעודה אחת: קריאה, PATCH לסטטוס, קריאה חוזרת. רק מטיוטא (FROM_OK).
//   live    → מהתור `priority_dn_status_candidates()` (הקרון `rashal-dn-status`, כל 5 דקות):
//             כותב, מעדכן את העותק שלנו (status + status_since = רגע האספקה), ורושם ביומן
//             `priority_dn_status_log`. תקלה זמנית (408/429/5xx) לא נרשמת וחוזרת בריצה הבאה.
// 🔴 הכתיבה מחתימה UDATE ב-UTC בזמן שפריוריטי מחזירה שעון ישראל עם Z, ולכן הדלתא לא תחזיר
//    אותה: העותק שלנו מתעדכן כאן ולא מהסנכרון (כמו STATUSDATE בקריאות, 15/09).
// 🔴 x-sync-secret חובה: הפונקציה משנה סטטוס אצל הלקוח.
// 🔴 401/403 עוצרים מיד, בלי ניסיון נוסף (ניסיונות חוזרים נועלים את חשבון הממשק).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireSecret } from "../_shared/require-secret.ts";

const PRIORITY = "https://p.priority-connect.online/odata/Priority/tabb4ce6.ini/shaal";
const TARGET = "סופק";
/** מאילו סטטוסים מותר לעבור לסופק. סופית/מבוטלת לא נוגעים. */
const FROM_OK = new Set(["טיוטא", "טיוטה"]);
const FIELDS = "DOCNO,STATDES,CURDATE,UDATE,ORDNAME,CDES,IVALL";

const TIME_BUDGET_MS = 110_000;
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const headers = () => ({
  Authorization: "Basic " + btoa(`${Deno.env.get("PRIORITY_USER")}:${Deno.env.get("PRIORITY_PASSWORD")}`),
  "User-Agent": "OgenSync/1.0", Accept: "application/json", "Content-Type": "application/json",
});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const okDocno = (d: string) => /^SH\d{4,20}$/.test(d);
const keyUrl = (docno: string) => `${PRIORITY}/DOCUMENTS_D(DOCNO='${encodeURIComponent(docno)}',TYPE='D')`;

class AuthStop extends Error {}

async function call(url: string, init: RequestInit = {}) {
  const res = await fetch(url, { ...init, headers: headers() });
  const body = await res.text();
  if (res.status === 401 || res.status === 403) throw new AuthStop(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  return { status: res.status, body };
}

function message(body: string): string {
  try {
    const j = JSON.parse(body);
    const m = j?.error?.message ?? j?.FORM?.InterfaceErrors?.text ?? j?.FORM?.message ?? j?.FORM?.text;
    if (typeof m === "string" && m.trim()) return m.trim().slice(0, 300);
  } catch { /* not json */ }
  return body.replace(/\s+/g, " ").slice(0, 300);
}

async function read(docno: string): Promise<Record<string, unknown> | null> {
  const r = await call(`${keyUrl(docno)}?$select=${FIELDS}`);
  if (r.status !== 200) return { http: r.status, message: message(r.body) };
  return JSON.parse(r.body);
}

/** תעודה אחת: מטיוטא לסופק, עם קריאה חוזרת שמוכיחה שנקלט. */
async function setDelivered(docno: string) {
  const before = await read(docno);
  if (before && "http" in before) {
    const h = Number(before.http);
    const retry = h === 408 || h === 429 || h >= 500;
    return { outcome: retry ? "retry" : "failed", http: h, message: String(before.message ?? ""), before };
  }
  const from = String(before?.STATDES ?? "");
  if (from === TARGET) return { outcome: "done", note: "כבר סופק", before };
  if (!FROM_OK.has(from)) return { outcome: "skipped", note: `סטטוס ${from || "לא ידוע"}`, before };
  const p = await call(keyUrl(docno), { method: "PATCH", body: JSON.stringify({ STATDES: TARGET }) });
  const after = await read(docno);
  const ok = (p.status === 200 || p.status === 204) && after?.STATDES === TARGET;
  const retry = p.status === 408 || p.status === 429 || p.status >= 500;
  return { outcome: ok ? "done" : retry ? "retry" : "failed", http: p.status, message: message(p.body), before, after };
}

type Candidate = { stop_id: string; docno: string | null; note_status: string | null; matches: number; completed_at: string };

async function log(row: Record<string, unknown>) {
  const { error } = await sb.from("priority_dn_status_log").upsert(row, { onConflict: "stop_id" });
  if (error) console.error("[dn-status] log", error.message);
}

async function live(max: number) {
  const started = Date.now();
  const { data, error } = await sb.rpc("priority_dn_status_candidates", { p_limit: max });
  if (error) throw new Error(`candidates: ${error.message}`);
  const out = { done: 0, failed: 0, skipped: 0, retry: 0 };
  for (const c of (data ?? []) as Candidate[]) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
    if (c.matches !== 1 || !c.docno) {
      await log({ stop_id: c.stop_id, outcome: "skipped", matches: c.matches, message: "יותר מתעודה אחת להזמנה" });
      out.skipped++;
      continue;
    }
    const r = await setDelivered(c.docno);
    if (r.outcome === "retry") { out.retry++; continue; }
    const from = String((r.before as Record<string, unknown> | null)?.STATDES ?? "");
    await log({
      stop_id: c.stop_id, docno: c.docno, outcome: r.outcome, from_status: from || null, matches: 1,
      http: "http" in r ? r.http : null, message: "note" in r ? r.note : ("message" in r ? String(r.message).slice(0, 300) : null),
    });
    if (r.outcome === "done") {
      const { error: upErr } = await sb.from("delivery_notes")
        .update({ status: TARGET, status_since: c.completed_at }).eq("priority_doc_id", c.docno);
      if (upErr) console.error("[dn-status] local copy", upErr.message);
    }
    out[r.outcome as "done" | "failed" | "skipped"]++;
  }
  return out;
}

Deno.serve(async (req: Request) => {
  const denied = requireSecret(req);
  if (denied) return denied;
  const body = await req.json().catch(() => ({})) as { mode?: string; docno?: string; max?: number };
  const mode = body.mode ?? "inspect";
  const docno = String(body.docno ?? "").trim().toUpperCase();
  try {
    if (mode === "inspect") {
      if (!okDocno(docno)) return json({ ok: false, error: "docno SH… חסר" }, 400);
      return json({ ok: true, doc: await read(docno) });
    }
    if (mode === "set") {
      if (!okDocno(docno)) return json({ ok: false, error: "docno SH… חסר" }, 400);
      return json({ ok: true, result: await setDelivered(docno) });
    }
    if (mode === "live") return json({ ok: true, ...(await live(Math.min(Number(body.max) || 40, 100))) });
    return json({ ok: false, error: `mode לא מוכר: ${mode}` }, 400);
  } catch (e) {
    const auth = e instanceof AuthStop;
    return json({ ok: false, auth, error: String(e).slice(0, 300) }, auth ? 502 : 500);
  }
});
