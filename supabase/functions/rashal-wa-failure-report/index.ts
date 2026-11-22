// rashal-wa-failure-report — דוח שבועי למשרד: לקוחות שלא הגיעה אליהם הודעת וואטסאפ (13/11/2026, הכרעת עידן).
// הקרון קורא ביום ראשון ב-05:00 וב-06:00 UTC; הפונקציה שולחת רק כשבישראל השעה 8, ורק פעם לשבוע:
// השורה ב-wa_failure_report_log נתפסת לפני השליחה (insert שנכשל על מפתח קיים = מישהו אחר כבר שולח).
// הנתונים: wa_failure_report_data() במסד. הנמענים: wa_failure_report_settings.recipients. הרינדור: render.ts.
// גוף הבקשה: { dry: true } מחזיר את ה-HTML בלי לשלוח, { force: true } בלי שער שעה,
//             { resend: true } שולח שוב שבוע שכבר נשלח, { to: ["a@b"] } נמענים חלופיים (לבדיקה), { from: 'YYYY-MM-DD' } שבוע אחר.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireSecret } from "../_shared/require-secret.ts";
import { addDays, previousWeek, renderFailureReport, type FailureReportData } from "./render.ts";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const MAIL_FROM = Deno.env.get("FIELD_CHANGE_FROM") ?? Deno.env.get("FORM_COPY_FROM") ?? '"ר.שעל ציוד רפואי" <system@ogensolutions.biz>';
const SEND_HOUR = 8;

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

function emails(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.map((r) => (typeof r === "string" ? r : (r as { email?: string })?.email ?? "").trim().toLowerCase())
    .filter((e) => /^[^@\s]+@[^@\s]+$/.test(e)))];
}

Deno.serve(async (req: Request) => {
  const denied = requireSecret(req);
  if (denied) return denied;
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* קרון שולח {} */ }
  const dry = body.dry === true, force = body.force === true, resend = body.resend === true;
  const now = israelNow();
  if (!dry && !force && now.hour !== SEND_HOUR) return json({ skipped: "not send hour", hour: now.hour });

  const week = typeof body.from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.from)
    ? { from: body.from, to: addDays(body.from, 7) }
    : previousWeek(now.date);

  const { data: settings } = await sb.from("wa_failure_report_settings").select("enabled, recipients").eq("id", true).maybeSingle();
  if (!dry && settings?.enabled === false) return json({ skipped: "disabled" });
  const override = emails(body.to);
  const to = override.length ? override : emails(settings?.recipients);

  const { data, error } = await sb.rpc("wa_failure_report_data", { p_from: week.from, p_to: week.to });
  if (error) {
    console.error("[wa-failure-report] data failed", error.message);
    return json({ error: error.message }, 500);
  }
  const report = renderFailureReport(data as FailureReportData);
  if (dry) return new Response(report.html, { headers: { "Content-Type": "text/html; charset=utf-8" } });

  if (!RESEND_KEY) return json({ error: "no RESEND_API_KEY" }, 500);
  if (!to.length) return json({ error: "no recipients" }, 500);

  // תפיסה אטומית של השבוע. שליחה לנמענים חלופיים (בדיקה) לא נרשמת ולא חוסמת את השליחה האמיתית.
  const isTest = override.length > 0;
  if (!isTest) {
    if (resend) await sb.from("wa_failure_report_log").delete().eq("week_start", week.from);
    const { error: claimErr } = await sb.from("wa_failure_report_log").insert({ week_start: week.from, recipients: to });
    if (claimErr) return json({ skipped: "already claimed", week: week.from, detail: claimErr.message });
  }

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: MAIL_FROM, to, subject: report.subject, html: report.html, text: report.text }),
  });
  const ok = r.ok;
  const err = ok ? null : `resend ${r.status}: ${(await r.text()).slice(0, 300)}`;
  if (!ok) console.error("[wa-failure-report]", err);
  const customers = (data as FailureReportData).customers.length;
  if (!isTest) {
    // כשלון משחרר את התפיסה, כדי שהקרון של השעה הבאה או resend ינסו שוב.
    if (ok) {
      await sb.from("wa_failure_report_log").update({ sent_at: new Date().toISOString(), ok, customers }).eq("week_start", week.from);
    } else {
      await sb.from("wa_failure_report_log").delete().eq("week_start", week.from);
    }
    await sb.from("wa_failure_report_settings").update({
      last_result: { at: new Date().toISOString(), week: week.from, to, ok, customers, blocking: report.blocking, error: err },
    }).eq("id", true);
  }
  return json({ ok, week, to, subject: report.subject, customers, blocking: report.blocking, test: isTest, error: err }, ok ? 200 : 502);
});
