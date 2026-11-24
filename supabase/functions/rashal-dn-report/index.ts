// rashal-dn-report: מייל שבועי "תעודות שסופקו ועדיין לא נסגרו" (24/11/2026, עידן).
// יום חמישי 07:30 שעון ישראל. הקרון `rashal-dn-report` קורא ב-04:30 וב-05:30 UTC; הפונקציה
// שולחת רק כשבישראל 07:00-07:59 של יום חמישי, ופעם אחת ליום (תפיסה ב-dn_delivered_report_log).
// הנתונים: dn_delivered_report_data(min_days). ההגדרות: dn_delivered_report_settings (enabled,
// recipients, min_days, show_amounts, send_empty). הרינדור: render.ts (נבדק ב-node).
// גוף: { dry: true } מחזיר HTML בלי לשלוח · { force: true } בלי שער זמן · { to: [...] } נמענים לבדיקה.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireSecret } from "../_shared/require-secret.ts";
import { renderDnReport, type DnRow } from "./render.ts";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const MAIL_FROM = Deno.env.get("FIELD_CHANGE_FROM") ?? Deno.env.get("FORM_COPY_FROM") ?? "";

function israelNow() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem", hour12: false, weekday: "short",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { hour: Number(get("hour")) % 24, weekday: get("weekday"), date: `${get("year")}-${get("month")}-${get("day")}` };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function emails(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const list = v.map((r) => (typeof r === "string" ? r : (r as { email?: string })?.email ?? "").trim().toLowerCase());
  return [...new Set(list.filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))];
}

Deno.serve(async (req: Request) => {
  const denied = requireSecret(req);
  if (denied) return denied;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const dry = body.dry === true, force = body.force === true;
  const now = israelNow();
  if (!dry && !force && (now.weekday !== "Thu" || now.hour !== 7)) {
    return json({ skipped: "not send time", ...now });
  }
  const { data: s } = await sb.from("dn_delivered_report_settings")
    .select("enabled, recipients, min_days, show_amounts, send_empty").eq("id", true).maybeSingle();
  const override = emails(body.to);
  const isTest = override.length > 0;
  if (!dry && !isTest && s?.enabled !== true) return json({ skipped: "disabled" });
  const minDays = Number(s?.min_days ?? 7);

  const { data, error } = await sb.rpc("dn_delivered_report_data", { p_days: minDays });
  if (error) return json({ error: error.message }, 500);
  const report = renderDnReport((data ?? []) as DnRow[], { date: now.date, minDays, showAmounts: s?.show_amounts !== false });
  if (dry) return new Response(report.html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  if (!report.count && s?.send_empty === false && !isTest) return json({ skipped: "empty", ...now });

  const to = isTest ? override : emails(s?.recipients);
  if (!RESEND_KEY || !MAIL_FROM) return json({ error: "no RESEND_API_KEY / sender" }, 500);
  if (!to.length) return json({ error: "no recipients" }, 500);
  if (!isTest) {
    const { error: claimErr } = await sb.from("dn_delivered_report_log").insert({ report_date: now.date, recipients: to });
    if (claimErr) return json({ skipped: "already claimed", date: now.date });
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: MAIL_FROM, to, subject: report.subject, html: report.html, text: report.text }),
  });
  const ok = r.ok;
  const err = ok ? null : `resend ${r.status}: ${(await r.text()).slice(0, 300)}`;
  if (!isTest) {
    // כשלון משחרר את התפיסה, כדי שהקרון של השעה הבאה ינסה שוב.
    if (ok) await sb.from("dn_delivered_report_log").update({ sent_at: new Date().toISOString(), ok, notes: report.count }).eq("report_date", now.date);
    else await sb.from("dn_delivered_report_log").delete().eq("report_date", now.date);
    await sb.from("dn_delivered_report_settings").update({
      last_result: { at: new Date().toISOString(), to, ok, notes: report.count, error: err },
    }).eq("id", true);
  }
  return json({ ok, to, subject: report.subject, notes: report.count, test: isTest, error: err }, ok ? 200 : 502);
});
