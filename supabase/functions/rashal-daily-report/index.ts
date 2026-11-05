// rashal-daily-report — דוח מערכת יומי לעידן ב-19:00 שעון ישראל (05/11/2026).
// הקרון קורא ב-16:00 וב-17:00 UTC; הפונקציה שולחת רק כשהשעה בישראל היא 19 ורק פעם ביום
// (daily_report_log). הנתונים: daily_report_data() במסד. הרינדור: render.ts (טהור, נבדק מ-node).
// גוף הבקשה: { force: true } שולח מיד בלי שער שעה (אבל לא פעמיים באותו יום, אלא אם resend: true),
//             { dry: true } מחזיר את ה-HTML בלי לשלוח, { date: 'YYYY-MM-DD' } דוח על יום אחר.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireSecret } from "../_shared/require-secret.ts";
import { renderReport, type ReportData } from "./render.ts";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const ALERT_FROM = Deno.env.get("ALERT_FROM") ?? "Ogen Sync <onboarding@resend.dev>";
// הנמענים: ALERT_EMAIL (עידן) + DAILY_REPORT_EMAIL (פסיקים, אופציונלי).
const TO = [...new Set([
  Deno.env.get("ALERT_EMAIL") ?? "idan@ogensolutions.biz",
  ...(Deno.env.get("DAILY_REPORT_EMAIL") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
])];
const SEND_HOUR = 19;

function israelNow(): { hour: number; date: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem", hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { hour: Number(get("hour")) % 24, date: `${get("year")}-${get("month")}-${get("day")}` };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  const denied = requireSecret(req);
  if (denied) return denied;
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* קרון שולח {} */ }
  const force = body.force === true, dry = body.dry === true, resend = body.resend === true;
  const now = israelNow();
  const date = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : now.date;

  if (!force && !dry && now.hour !== SEND_HOUR) return json({ skipped: "not send hour", hour: now.hour });
  if (!dry && !resend) {
    const { data: already } = await sb.from("daily_report_log").select("sent_at,ok").eq("report_date", date).maybeSingle();
    if (already?.ok) return json({ skipped: "already sent", sent_at: already.sent_at });
  }

  const { data, error } = await sb.rpc("daily_report_data", { p_date: date });
  if (error) {
    console.error("[daily-report] data failed", error.message);
    if (!dry) await sb.from("daily_report_log").upsert({ report_date: date, ok: false, error: error.message.slice(0, 400), recipients: TO });
    return json({ error: error.message }, 500);
  }
  const report = renderReport(data as ReportData);
  if (dry) return new Response(report.html, { headers: { "Content-Type": "text/html; charset=utf-8" } });

  if (!RESEND_KEY) return json({ error: "no RESEND_API_KEY" }, 500);
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: ALERT_FROM, to: TO, subject: report.subject, html: report.html }),
  });
  const ok = r.ok;
  const err = ok ? null : `resend ${r.status}: ${(await r.text()).slice(0, 300)}`;
  if (!ok) console.error("[daily-report]", err);
  await sb.from("daily_report_log").upsert({
    report_date: date, sent_at: new Date().toISOString(), recipients: TO, ok, error: err, bytes: report.html.length,
  });
  return json({ ok, date, to: TO, subject: report.subject, flags: report.flags, bytes: report.html.length, error: err }, ok ? 200 : 502);
});
