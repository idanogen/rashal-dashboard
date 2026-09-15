// rashal-call-status — כתיבת סטטוס לקריאת שירות בפריוריטי (DOCUMENTS_Q.CALLSTATUSCODE).
//
// החלטת עידן 15/09/2026: "סיימתי כאן" → בוצעה, "המשך טיפול" → להמשך טיפול,
// "לא בוצע" → כלום. התור והיומן: public.priority_call_status_writes.
// שני מקורות: `backfill-2026-09-15` (גל ההשלמה של 136 קריאות, בוצע) ו-`stop`
// (הזרם השוטף: הטריגר `trg_enqueue_call_status` כותב, הקרון
// `rashal-call-status-from-stops` מריץ את מצב live כל 5 דקות כשיש ממתינים).
//
// ארבעה מצבים, בגוף הבקשה { mode, source?, max?, key_form?, docno? }:
//   probe   → בלי שינוי נתון. קורא קריאה אחת מהתור, מוצא איזו צורת מפתח עובדת,
//             ושולח PATCH עם ערך לא חוקי: דחייה מנומקת מוכיחה שהשדה ניתן לכתיבה
//             (learnings.md, 19/08). אם במקרה הערך נקלט, מחזירים מיד את המקורי.
//   dry     → קריאה בלבד: רושם לכל שורה ממתינה מה הסטטוס שלה עכשיו בפריוריטי.
//   inspect → קריאה בלבד של קריאה אחת לפי docno: סטטוס ו-STATUSDATE.
//   live    → לכל שורה: קריאה, כתיבה רק אם הסטטוס מותר, קריאה חוזרת.
//
// ✅ אומת 15/09/2026: המפתח הוא DOCUMENTS_Q(DOCNO='SC…',TYPE='Q'), השדה נבדק מול
//    טבלת הסטטוסים, והמעבר שובצה → בוצעה עובר (136 קריאות, גל ההשלמה).
// 🔴 ניסיון אחד לכל קריאה, בלי ריטריי. PATCH אידמפוטנטי, אבל 401/403 חוזרים
//    נועלים את חשבון הממשק (priority_auth_probing_locks_the_account), ולכן
//    תשובת הרשאה עוצרת את כל הריצה.
// 🔴 x-sync-secret חובה: מפתח ה-anon ציבורי, ופונקציה שמשנה סטטוס אצל הלקוח
//    לא יכולה להיות פתוחה לכל מי שמחזיק אותו.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const PRIORITY = "https://p.priority-connect.online/odata/Priority/tabb4ce6.ini/shaal";
const UA = "OgenSync/1.0";
const DEFAULT_SOURCE = "backfill-2026-09-15";
const TIME_BUDGET_MS = 110_000; // Edge Function חיה כ-150 שניות
const MAX_CONSECUTIVE_FAILURES = 2;
// שלוש דקות חסד לזרם השוטף: לחיצה בטעות שתוקנה מיד לא מגיעה לפריוריטי.
// אותו מספר יושב בתנאי של הקרון במיגרציה 20260915_call_status_from_stops.sql.
const STOP_GRACE_MS = 3 * 60_000;

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const basicAuth = () =>
  "Basic " + btoa(`${Deno.env.get("PRIORITY_USER")}:${Deno.env.get("PRIORITY_PASSWORD")}`);
const headers = () => ({
  Authorization: basicAuth(), "User-Agent": UA, Accept: "application/json", "Content-Type": "application/json",
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

class AuthStop extends Error {}

type Resp = { status: number; body: string };

async function call(url: string, init: RequestInit = {}): Promise<Resp> {
  const res = await fetch(url, { ...init, headers: headers() });
  const body = await res.text();
  if (res.status === 401 || res.status === 403) throw new AuthStop(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  return { status: res.status, body };
}

const okDocno = (d: string) => /^SC\d+$/.test(d);
const keyUrl = (docno: string, form: "typed" | "plain") =>
  form === "typed" ? `${PRIORITY}/DOCUMENTS_Q(DOCNO='${docno}',TYPE='Q')` : `${PRIORITY}/DOCUMENTS_Q('${docno}')`;

/** סטטוס נוכחי לפי סינון, הצורה המאומתת של הסנכרון. null = הקריאה לא נמצאה. */
async function readStatuses(docnos: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const filter = docnos.map((d) => `DOCNO eq '${d}'`).join(" or ");
  const r = await call(`${PRIORITY}/DOCUMENTS_Q?$filter=${encodeURIComponent(filter)}&$select=DOCNO,CALLSTATUSCODE`);
  if (r.status !== 200) throw new Error(`read HTTP ${r.status}: ${r.body.slice(0, 200)}`);
  for (const row of (JSON.parse(r.body).value ?? []) as { DOCNO: string; CALLSTATUSCODE: string }[]) {
    out.set(row.DOCNO, row.CALLSTATUSCODE);
  }
  return out;
}

interface QueueRow {
  id: number;
  priority_call_id: string;
  expected_from: string | null;
  allowed_from: string[] | null;
  target_status: string;
}

async function pending(source: string, limit: number): Promise<QueueRow[]> {
  let q = sb.from("priority_call_status_writes")
    .select("id, priority_call_id, expected_from, allowed_from, target_status")
    .eq("source", source).eq("state", "pending");
  if (source === "stop") {
    q = q.lt("created_at", new Date(Date.now() - STOP_GRACE_MS).toISOString()).order("created_at", { ascending: true });
  } else {
    q = q.order("visit_completed_at", { ascending: false });
  }
  const { data, error } = await q.limit(limit);
  if (error) throw new Error(`queue read: ${error.message}`);
  return ((data ?? []) as QueueRow[]).filter((r) => okDocno(r.priority_call_id));
}

async function probe(source: string) {
  const [row] = await pending(source, 1);
  if (!row) return { ok: false, note: "אין שורה ממתינה לבדיקה" };
  const docno = row.priority_call_id;
  const before = (await readStatuses([docno])).get(docno) ?? null;
  const report: Record<string, unknown> = { docno, status_by_filter: before };

  // איזו צורת מפתח מחזירה את המסמך
  let form: "typed" | "plain" | null = null;
  for (const f of ["typed", "plain"] as const) {
    const r = await call(`${keyUrl(docno, f)}?$select=DOCNO,CALLSTATUSCODE`);
    report[`get_${f}`] = { http: r.status, body: r.body.slice(0, 160) };
    if (r.status === 200 && !form) form = f;
  }
  if (!form) return { ok: false, ...report, note: "אף צורת מפתח לא החזירה את המסמך" };
  report.key_form = form;

  // בדיקה שלילית: ערך שאינו סטטוס קיים
  const neg = await call(keyUrl(docno, form), { method: "PATCH", body: JSON.stringify({ CALLSTATUSCODE: "ZZZOGENTEST" }) });
  report.negative_patch = { http: neg.status, body: neg.body.slice(0, 300) };
  const after = (await readStatuses([docno])).get(docno) ?? null;
  report.status_after_negative = after;
  if (after !== before && before) {
    // לא אמור לקרות בשדה מאומת. אם קרה, מחזירים מיד.
    const back = await call(keyUrl(docno, form), { method: "PATCH", body: JSON.stringify({ CALLSTATUSCODE: before }) });
    report.restored = { http: back.status, now: (await readStatuses([docno])).get(docno) ?? null };
  }
  report.writable = neg.status === 400 && after === before;
  return { ok: true, ...report };
}

/**
 * קריאה בלבד של קריאה אחת: סטטוס ו-STATUSDATE, ו"תאור התקלה" / "תאור התיקון".
 * ✅ 15/09/2026: `DOCTEXT_Q_2_SUBFORM` (תאור התקלה) ו-`DOCTEXT_Q_SUBFORM`
 * (תאור התיקון) קיימים ופתוחים לממשק, שדות TEXT · APPEND · SIGNATURE.
 * נקראים בנתיב ניווט ולא ב-$expand, כי $expand על DOCUMENTS_Q מסרב ל-$select
 * על ההורה (learnings.md, 19/08).
 */
async function inspect(docno: string) {
  if (!okDocno(docno)) return { ok: false, note: "docno לא תקין" };
  const r = await call(`${keyUrl(docno, "typed")}?$select=DOCNO,CALLSTATUSCODE,STATUSDATE,STARTDATE`);
  const texts: Record<string, unknown> = {};
  for (const sub of ["DOCTEXT_Q_2_SUBFORM", "DOCTEXT_Q_SUBFORM"]) {
    const t = await call(`${keyUrl(docno, "typed")}/${sub}`);
    texts[sub] = { http: t.status, body: t.body.slice(0, 2000) };
  }
  return { ok: r.status === 200, http: r.status, body: r.body.slice(0, 400), texts };
}

async function dry(source: string, max: number) {
  const rows = await pending(source, max);
  let seen = 0;
  const tally: Record<string, number> = {};
  for (let i = 0; i < rows.length; i += 20) {
    const chunk = rows.slice(i, i + 20);
    const st = await readStatuses(chunk.map((r) => r.priority_call_id));
    for (const r of chunk) {
      const s = st.get(r.priority_call_id) ?? "(לא נמצאה)";
      tally[s] = (tally[s] ?? 0) + 1;
      await sb.from("priority_call_status_writes").update({ seen_status: s, seen_at: new Date().toISOString() }).eq("id", r.id);
      seen++;
    }
  }
  return { ok: true, seen, tally };
}

/**
 * 🔴 העדכון הסופי של השורה מותנה בכך שהיא עדיין ממתינה ועם אותו יעד. אם
 * הטכנאי שינה את הסימון בזמן שהריצה עבדה, הטריגר כבר עדכן את היעד, והשורה
 * נשארת ממתינה לריצה הבאה במקום להיסגר על סמך סימון שהתבטל.
 */
async function settle(r: QueueRow, patch: Record<string, unknown>) {
  await sb.from("priority_call_status_writes").update(patch)
    .eq("id", r.id).eq("state", "pending").eq("target_status", r.target_status);
}

async function live(source: string, max: number, form: "typed" | "plain", t0: number) {
  const rows = await pending(source, max);
  const res = { done: 0, already: 0, skipped: 0, failed: 0, stopped: null as string | null };
  let streak = 0;
  for (const r of rows) {
    if (Date.now() - t0 > TIME_BUDGET_MS) { res.stopped = "time budget"; break; }
    const docno = r.priority_call_id;
    const now = new Date().toISOString();
    const allowed = r.expected_from ? [r.expected_from] : (r.allowed_from ?? []);
    const before = (await readStatuses([docno])).get(docno) ?? null;

    if (before === r.target_status) {
      // כבר שם, למשל המשרד קדם אותנו. אין כתיבה, רק רישום ועדכון העותק.
      await settle(r, { state: "done", status_before: before, status_after: before, http_status: null, error: null, attempted_at: now });
      await sb.from("service_calls").update({ priority_status: before }).eq("priority_call_id", docno);
      res.already++;
      continue;
    }
    if (!before || !allowed.includes(before)) {
      await settle(r, {
        state: "skipped", status_before: before, attempted_at: now,
        error: before
          ? `הסטטוס בפריוריטי "${before}", ואינו אחד מ: ${allowed.join(" · ")}`
          : "הקריאה לא נמצאה בפריוריטי",
      });
      res.skipped++;
      continue;
    }
    const p = await call(keyUrl(docno, form), { method: "PATCH", body: JSON.stringify({ CALLSTATUSCODE: r.target_status }) });
    const after = (await readStatuses([docno])).get(docno) ?? null;
    const ok = (p.status === 200 || p.status === 204) && after === r.target_status;
    await settle(r, {
      state: ok ? "done" : "failed", status_before: before, status_after: after, http_status: p.status,
      error: ok ? null : p.body.slice(0, 300), attempted_at: now,
    });
    // 🔴 העותק שלנו מתעדכן מכאן, מהערך שנקרא בחזרה מפריוריטי. הסנכרון מושך
    // קריאות לפי `STATUSDATE ge <since>`, וסימן-המים שלו בשעון ישראל עם סיומת Z.
    // נמדד 15/09/2026 (SC2603041): PATCH דרך הממשק כן מזיז את STATUSDATE, אבל
    // חותם אותו ב-UTC (08:48Z בכתיבה של 11:48 שעון ישראל), כלומר שלוש שעות
    // "מאחורי" סימן-המים, והמשיכה לא רואה אותו לעולם. בלי השורה הזאת העותק
    // היה נשאר "שובצה" לנצח.
    if (ok) await sb.from("service_calls").update({ priority_status: after }).eq("priority_call_id", docno);
    if (ok) { res.done++; streak = 0; } else { res.failed++; streak++; }
    if (streak >= MAX_CONSECUTIVE_FAILURES) { res.stopped = `${streak} כשלים ברצף`; break; }
  }
  return { ok: res.failed === 0, ...res };
}

Deno.serve(async (req: Request) => {
  const secret = Deno.env.get("PRIORITY_SYNC_SECRET") ?? "";
  if (!secret || req.headers.get("x-sync-secret") !== secret) return json({ error: "unauthorized" }, 401);

  let b: { mode?: string; source?: string; max?: number; key_form?: string; docno?: string } = {};
  try { b = await req.json(); } catch { /* empty */ }
  const mode = b.mode ?? "";
  const source = b.source ?? DEFAULT_SOURCE;
  const max = Math.min(Math.max(1, Number(b.max ?? 10) || 10), 60);
  if (!["probe", "dry", "inspect", "live"].includes(mode)) return json({ error: "mode must be probe | dry | inspect | live" }, 400);
  if (mode === "live" && b.key_form !== "typed" && b.key_form !== "plain") {
    return json({ error: "live requires key_form from a successful probe" }, 400);
  }

  const t0 = Date.now();
  const { data: run } = await sb.from("sync_runs")
    .insert({ job: `call-status-${mode}`, trigger_source: source === "stop" ? "cron" : "manual" }).select("id").single();
  let result: Record<string, unknown>;
  let status = "success";
  try {
    result = mode === "probe" ? await probe(source)
      : mode === "dry" ? await dry(source, max)
      : mode === "inspect" ? await inspect(String(b.docno ?? ""))
      : await live(source, max, b.key_form as "typed" | "plain", t0);
    if (result.ok === false) status = "error";
  } catch (e) {
    status = "error";
    result = { ok: false, error: String(e instanceof Error ? e.message : e).slice(0, 300), auth_stop: e instanceof AuthStop };
  }
  if (run?.id) {
    await sb.from("sync_runs").update({
      status, finished_at: new Date().toISOString(), duration_ms: Date.now() - t0,
      error_summary: status === "error" ? JSON.stringify(result).slice(0, 900) : null,
    }).eq("id", run.id);
  }
  return json({ run_id: run?.id ?? null, mode, source, ...result });
});
