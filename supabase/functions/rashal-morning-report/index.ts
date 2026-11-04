// rashal-morning-report — הודעת "דוח בוקר" למנהלים. רץ מ-pg_cron
// (job `rashal-morning-report`, כל 10 דקות בחלון 07:00-08:59 שעון ישראל,
// ימים א-ו) ושולח פעם אחת ביום, בשבע בבוקר, לנמענים שבהגדרות.
//
// החלטות עידן (09/09/2026): הודעה בימי עבודה עם קישור למסך, "סופק" = רק
// עצירות שנסגרו "בוצע", הנמענים עמי, רונן ושלומי.
//
// ⚠ המתג יושב במסד (`morning_report_settings.enabled` / `dry_run`), לא כאן.
//   הנמענים והתבנית גם שם. כיבוי הוא UPDATE אחד.
//
// ⭐ המספרים באים מאותה פונקציה בדיוק שהמסך קורא (`morning_report`),
//   ולכן ההודעה והמסך לא יכולים לסתור זה את זה.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireSecret } from "../_shared/require-secret.ts";

const SEND_URL = "https://rashal-dashboard.vercel.app/api/heyy-send";
const SEND_SECRET = Deno.env.get("RASHAL_SEND_SECRET") ?? "";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

interface Settings {
  enabled: boolean;
  dry_run: boolean;
  send_hour: number;
  template_id: string | null;
  recipients: { name: string; phone_e164: string }[];
  last_sent_date: string | null;
  /** 04/11/2026: תבנית דוח התזכורות (rashal_reminder_report). ריק = רק המסך. */
  reminder_report_template_id: string | null;
  /** נמעני דוח התזכורות בלבד (עידן: אבירם מקבל רק אותו, לא את דוח הבוקר). */
  reminder_report_recipients: { name: string; phone_e164: string }[] | null;
}

interface Report {
  date: string;
  dow: number;
  totals: { planned: number; delivered: number; not_delivered: number; follow_up?: number; open: number; drivers: number };
}

function israelNow(): { hour: number; date: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { hour: Number(get("hour")) % 24, date: `${get("year")}-${get("month")}-${get("day")}` };
}

Deno.serve(async (req: Request) => {
  const denied = requireSecret(req);
  if (denied) return denied;
  let trigger = "manual";
  let forceDry: boolean | null = null;
  let dateArg: string | null = null;
  let force = false;
  try {
    const b = await req.json();
    force = b?.force === true;
    if (b?.trigger) trigger = String(b.trigger);
    if (typeof b?.dry === "boolean") forceDry = b.dry;
    if (typeof b?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date)) dateArg = b.date;
  } catch { /* ברירות מחדל */ }

  const { data: cfg, error: cfgErr } = await sb
    .from("morning_report_settings").select("*").eq("id", true).single<Settings>();
  if (cfgErr || !cfg) return json({ ok: false, error: `settings unavailable: ${cfgErr?.message}` }, 500);

  const now = israelNow();
  const dry = forceDry ?? cfg.dry_run;

  if (!cfg.enabled && trigger === "cron") {
    return json({ ok: true, skipped: "disabled" });
  }
  // הקרון רץ בחלון רחב (כי UTC מול שעון ישראל זז בין קיץ לחורף), והשעה
  // נבדקת כאן. ריצה ידנית לא מחכה לשבע.
  if (trigger === "cron" && now.hour < cfg.send_hour) {
    return json({ ok: true, skipped: `before ${cfg.send_hour}:00 Israel (now ${now.hour})` });
  }

  const { data: rep, error: repErr } = await sb.rpc("morning_report", { p_date: dateArg });
  if (repErr || !rep) return json({ ok: false, error: `report failed: ${repErr?.message}` }, 500);
  const report = rep as Report;

  // פעם אחת ליום דוח. ריצה ידנית על אותו תאריך גם היא לא שולחת פעמיים,
  // אלא אם ביקשו בפירוש (`force`).
  if (cfg.last_sent_date === report.date && !dry && !force) {
    return json({ ok: true, skipped: `already sent for ${report.date}` });
  }
  if (!cfg.template_id) return json({ ok: false, error: "no template_id in settings" }, 500);
  if (!cfg.recipients?.length) return json({ ok: false, error: "no recipients in settings" }, 500);

  const t = report.totals;
  const reported = t.delivered + t.not_delivered;
  const rate = reported > 0 ? `${Math.round((t.delivered / reported) * 100)}%` : "אין דיווח";
  const [y, m, d] = report.date.split("-");
  // 🔴 15/09/2026 (עידן): "המשך טיפול" נספר בנפרד ולא כ"לא סופק", הטכנאי היה
  // אצל הלקוח. התבנית המאושרת אומרת "לא סופקו עם סיבה מהשטח {{not_delivered}}
  // עצירות", ולכן בלי תבנית חדשה המונה נכנס לאותו משתנה כהמשך של המשפט:
  // "7 עצירות, להמשך טיפול אחרי ביקור 1" + " עצירות" שבתבנית. בלי המשך טיפול
  // הערך הוא המספר בלבד, וההודעה זהה למה שיצא עד היום.
  const followUp = t.follow_up ?? 0;
  const notDeliveredValue = followUp > 0
    ? `${t.not_delivered} עצירות, להמשך טיפול אחרי ביקור ${followUp}`
    : String(t.not_delivered);
  const variables = [
    { name: "report_day", value: `יום ${DAY_NAMES[report.dow] ?? ""} ${d}/${m}` },
    { name: "planned", value: String(t.planned) },
    { name: "delivered", value: String(t.delivered) },
    { name: "not_delivered", value: notDeliveredValue },
    { name: "open_count", value: String(t.open) },
    { name: "rate", value: rate },
    // סיומת כפתור ה-URL: /morning/<תאריך>
    { name: "report_date", value: `${y}-${m}-${d}` },
  ];

  const results: Record<string, unknown>[] = [];
  for (const r of cfg.recipients) {
    if (dry) { results.push({ name: r.name, dry: true }); continue; }
    try {
      const res = await fetch(SEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-send-secret": SEND_SECRET },
        body: JSON.stringify({
          kind: "template",
          phoneE164: r.phone_e164,
          templateId: cfg.template_id,
          variables,
          triggeredBy: `morning-report:${report.date}`,
        }),
      });
      const body = await res.json().catch(() => ({}));
      results.push({ name: r.name, ok: res.ok && body?.ok !== false, status: res.status, detail: body?.error ?? body?.statusDetail ?? null });
    } catch (e) {
      results.push({ name: r.name, ok: false, error: String(e).slice(0, 200) });
    }
  }

  // ── 04/11/2026 (עידן): דוח התזכורות של אמש, הודעה שנייה לאותם נמענים ──
  // "מי מהם הגיב לי": reminder_replies(date) אוסף את התשובות מהערב עד 07:00.
  let reminders: Record<string, unknown> | null = null;
  if (cfg.reminder_report_template_id) {
    const { data: rr } = await sb.rpc("reminder_replies", { p_date: report.date });
    const r = rr as { sent: number; replied: number; no_reply: number; rows: { customer_name: string | null; reply_text: string | null }[] } | null;
    if (r && Number(r.sent) > 0) {
      const dow = DAY_NAMES[report.dow] ?? "";
      const vars = [
        { name: "report_day", value: `יום ${dow} ${d}/${m}` },
        { name: "sent", value: String(r.sent) },
        { name: "replied", value: String(r.replied) },
        { name: "replies", value: repliesSummary(r.rows.filter((x) => x.reply_text)) },
        { name: "no_reply", value: String(r.no_reply) },
        { name: "report_date", value: `${y}-${m}-${d}` },
      ];
      const sent: Record<string, unknown>[] = [];
      for (const rcp of cfg.reminder_report_recipients ?? []) {
        if (dry) { sent.push({ name: rcp.name, dry: true }); continue; }
        try {
          const res = await fetch(SEND_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-send-secret": SEND_SECRET },
            body: JSON.stringify({
              kind: "template", phoneE164: rcp.phone_e164, templateId: cfg.reminder_report_template_id,
              variables: vars, triggeredBy: `reminder-report:${report.date}`,
            }),
          });
          const body = await res.json().catch(() => ({}));
          sent.push({ name: rcp.name, ok: res.ok && body?.ok !== false, status: res.status, detail: body?.error ?? null });
        } catch (e) {
          sent.push({ name: rcp.name, ok: false, error: String(e).slice(0, 200) });
        }
      }
      reminders = { sent: r.sent, replied: r.replied, no_reply: r.no_reply, results: sent };
    } else {
      reminders = { sent: 0 };
    }
  }

  const sentAny = results.some((r) => r.ok === true);
  await sb.from("morning_report_settings").update({
    last_run_at: new Date().toISOString(),
    ...(sentAny ? { last_sent_date: report.date } : {}),
    last_result: { trigger, dry, date: report.date, totals: t, results, reminders },
  }).eq("id", true);

  return json({ ok: true, trigger, dry, date: report.date, totals: t, rate, results, reminders });
});


/** זהה ל-`api/_lib/reminder-text.ts` (Deno לא מייבא משם); test/reminder-text.test.mjs משווה. */
function repliesSummary(rows: { customer_name: string | null; reply_text: string | null }[], max = 600): string {
  if (!rows.length) return 'אין תשובות';
  const parts = rows.map((r) => {
    const text = (r.reply_text ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
    return `${(r.customer_name ?? 'לקוח').trim()}: "${text}"`;
  });
  let out = '';
  for (const p of parts) {
    if ((out + (out ? ', ' : '') + p).length > max) { out += ` ועוד ${parts.length - parts.indexOf(p)}`; break; }
    out += (out ? ', ' : '') + p;
  }
  return out;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
