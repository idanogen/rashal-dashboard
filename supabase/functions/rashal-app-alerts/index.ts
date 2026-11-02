// rashal-app-alerts — לוגים של תקופת ההרצה, הפעמון (02/11/2026, שלב 3 בתוכנית הלוגים).
// רץ מ-pg_cron כל 5 דקות. שני דברים, שניהם לעידן בלבד במייל:
//   1. דיווח "יש בעיה" מהאפליקציה: מייל מיד, עם הנושא, הלקוח והמסך.
//   2. סיכום בוקר: בימים א-ו מ-7:00, פעם אחת ליום, על יום העבודה הקודם.
// ⭐ הסיכום קורא את app_day_summary, אותה פונקציה שהמסך "מי נתקע היום" קורא.
// 🔴 הסמן (sync_alerts) מתקדם רק אחרי שהמייל יצא, אחרת דיווח נבלע.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireSecret } from "../_shared/require-secret.ts";
import { israelParts, morningDue, morningEmail, problemsEmail, summaryDay, type ProblemRow, type Summary } from "./compose.ts";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const ALERT_EMAIL = Deno.env.get("ALERT_EMAIL") ?? "idan@ogensolutions.biz";
const ALERT_FROM = Deno.env.get("ALERT_FROM") ?? "Ogen Sync <onboarding@resend.dev>";
const PROBLEMS_JOB = "app-problems";
const MORNING_JOB = "app-morning";
const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

async function sendEmail(subject: string, inner: string, color: string): Promise<boolean> {
  if (!RESEND_KEY) { console.error("no RESEND_API_KEY"); return false; }
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1a2332;font-size:15px;line-height:1.6">` +
    `<div style="border-inline-start:5px solid ${color};background:#fafbfd;border-radius:10px;padding:14px 18px;max-width:600px">` +
    inner + `</div><div style="color:#8a96a8;font-size:12px;margin-top:12px">לוגים של תקופת ההרצה · עוגן סולושנס</div></div>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: ALERT_FROM, to: [ALERT_EMAIL], subject, html }),
  });
  if (!r.ok) console.error("resend failed:", r.status, (await r.text()).slice(0, 200));
  return r.ok;
}

async function checkProblems(now: Date, prev: Record<string, unknown> | undefined): Promise<string> {
  // ריצה ראשונה: שעה אחורה, לא כל ההיסטוריה.
  const since = (prev?.last_alerted_at as string | undefined) ?? new Date(now.getTime() - 3600_000).toISOString();
  const { data, error } = await sb.from("app_events")
    .select("received_at,occurred_at,user_name,screen,app_version,stop_id,detail")
    .eq("kind", "stuck").eq("name", "problem_report").gt("received_at", since)
    .order("received_at", { ascending: true }).limit(20);
  if (error) return `query failed: ${error.message}`;
  if (!data?.length) return "ok";

  const stopIds = [...new Set(data.map((r) => r.stop_id).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (stopIds.length) {
    const { data: stops, error: sErr } = await sb.from("calendar_stops").select("id,customer_name").in("id", stopIds);
    if (sErr) console.error("[app-alerts] stop names", sErr.message);
    for (const s of stops ?? []) names.set(s.id as string, s.customer_name as string);
  }
  const rows: ProblemRow[] = data.map((r) => ({
    received_at: r.received_at, occurred_at: r.occurred_at, user_name: r.user_name, screen: r.screen,
    app_version: r.app_version, customer_name: r.stop_id ? names.get(r.stop_id) ?? null : null,
    topic: (r.detail as Record<string, string>)?.topic ?? null, text: (r.detail as Record<string, string>)?.text ?? null,
  }));
  const { subject, html } = problemsEmail(rows);
  if (!(await sendEmail(subject, html, "#c2410c"))) return "email failed";
  await sb.from("sync_alerts").upsert({
    job: PROBLEMS_JOB, state: "ok", last_alerted_at: rows[rows.length - 1].received_at,
    detail: `${rows.length} reports`, updated_at: now.toISOString(),
  });
  return `ALERT sent (${rows.length})`;
}

async function checkMorning(now: Date, prev: Record<string, unknown> | undefined): Promise<string> {
  const lastDay = (prev?.detail as string | undefined) ?? null;
  if (!morningDue(now, lastDay)) return "not due";
  const { day: today, dow } = israelParts(now);
  const day = summaryDay(today, dow);
  const { data, error } = await sb.rpc("app_day_summary", { p_day: day });
  if (error) return `summary failed: ${error.message}`;
  const s = data as Summary;
  const d = new Date(day + "T12:00:00Z");
  const label = `יום ${DAY_NAMES[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
  const { subject, html } = morningEmail(s, label);
  if (!(await sendEmail(subject, html, "#14223a"))) return "email failed";
  await sb.from("sync_alerts").upsert({ job: MORNING_JOB, state: "ok", detail: today, updated_at: now.toISOString() });
  return `morning sent (${day})`;
}

Deno.serve(async (req: Request) => {
  const denied = requireSecret(req);
  if (denied) return denied;
  const now = new Date();
  const { data: alertRows } = await sb.from("sync_alerts").select("*").in("job", [PROBLEMS_JOB, MORNING_JOB]);
  const alerts = new Map((alertRows ?? []).map((a: Record<string, unknown>) => [a.job as string, a]));
  const report: Record<string, string> = {};
  for (const [job, fn] of [[PROBLEMS_JOB, checkProblems], [MORNING_JOB, checkMorning]] as const) {
    try {
      report[job] = await fn(now, alerts.get(job));
    } catch (e) {
      report[job] = `crashed: ${e instanceof Error ? e.message : String(e)}`;
      console.error(`[app-alerts] ${job} crashed`, e);
    }
  }
  return new Response(JSON.stringify({ at: now.toISOString(), report }), { headers: { "Content-Type": "application/json" } });
});
