// rashal-morning-report — דוח האספקות למנהלים ודוח התזכורות. רץ מ-pg_cron
// (job `rashal-morning-report`, כל 10 דקות בחלון בוקר ובחלון ערב, ימים א-ו).
//
// החלטות עידן (09/09/2026): הודעה בימי עבודה עם קישור למסך, "סופק" = רק
// עצירות שנסגרו "בוצע", הנמענים עמי, רונן ושלומי.
// 11/11/2026 (שלומי, עידן "מחליף"): דוח האספקות עובר ל-19:00 על היום עצמו, כדי להגיב
// כבר בתכנון של מחר. המתג `report_slot`; דוח התזכורות נשאר בבוקר. ההכרעה ב-plan.ts.
//
// ⚠ המתג יושב במסד (`morning_report_settings.enabled` / `dry_run` / `report_slot`), לא כאן.
//   הנמענים והתבניות גם שם. כיבוי או חזרה לבוקר הם UPDATE אחד.
//
// ⭐ המספרים באים מאותה פונקציה בדיוק שהמסך קורא (`morning_report`),
//   ולכן ההודעה והמסך לא יכולים לסתור זה את זה.
//
// גוף הבקשה (ריצה ידנית): { dry, force, date: 'YYYY-MM-DD', part: 'delivery' | 'reminders' }.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireSecret } from "../_shared/require-secret.ts";
import { dayLabel, deliveryRate, deliveryVariables, planRun, type Slot, type Totals } from "./plan.ts";

const SEND_URL = "https://rashal-dashboard.vercel.app/api/heyy-send";
const SEND_SECRET = Deno.env.get("RASHAL_SEND_SECRET") ?? "";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface Recipient { name: string; phone_e164: string }

interface Settings {
  enabled: boolean;
  dry_run: boolean;
  send_hour: number;
  /** תבנית הבוקר (rashal_morning_report). */
  template_id: string | null;
  /** 11/11/2026: 'evening' = דוח היום ב-send_hour בתבנית evening_template_id. */
  report_slot: Slot;
  evening_template_id: string | null;
  recipients: Recipient[];
  last_sent_date: string | null;
  /** 04/11/2026: תבנית דוח התזכורות (rashal_reminder_report). ריק = רק המסך. */
  reminder_report_template_id: string | null;
  /**
   * נמעני דוח התזכורות בלבד (עידן: אבירם מקבל רק אותו, לא את דוח האספקות).
   * `days`: נמען זמני, רק ל-N הימים הראשונים שבהם הדוח יוצא (עידן, 04/11: "בשלושה הימים
   * הראשונים לקבל בעצמי, לראות איך הוא יוצא"). נספר לפי הימים שכבר נשלחו, לא לפי תאריך.
   */
  reminder_report_recipients: (Recipient & { days?: number })[] | null;
  /** תאריכי דוחות התזכורות שכבר יצאו באמת (לא יבש): מונע כפל, וסופר ימים לנמען זמני. */
  reminder_report_sent_dates: string[] | null;
}

interface Report { date: string; dow: number; totals: Totals & { drivers: number } }

type Part = Record<string, unknown> & { skipped?: string };

function israelNow(): { hour: number; date: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { hour: Number(get("hour")) % 24, date: `${get("year")}-${get("month")}-${get("day")}` };
}

async function sendTemplate(r: Recipient, templateId: string, variables: { name: string; value: string }[], tag: string) {
  try {
    const res = await fetch(SEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-send-secret": SEND_SECRET },
      body: JSON.stringify({ kind: "template", phoneE164: r.phone_e164, templateId, variables, triggeredBy: tag }),
    });
    const body = await res.json().catch(() => ({}));
    return { name: r.name, ok: res.ok && body?.ok !== false, status: res.status, detail: body?.error ?? body?.statusDetail ?? null };
  } catch (e) {
    return { name: r.name, ok: false, error: String(e).slice(0, 200) };
  }
}

Deno.serve(async (req: Request) => {
  const denied = requireSecret(req);
  if (denied) return denied;
  let trigger = "manual";
  let forceDry: boolean | null = null;
  let dateArg: string | null = null;
  let force = false;
  let part: string | null = null;
  try {
    const b = await req.json();
    force = b?.force === true;
    if (b?.trigger) trigger = String(b.trigger);
    if (typeof b?.dry === "boolean") forceDry = b.dry;
    if (typeof b?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date)) dateArg = b.date;
    if (typeof b?.part === "string") part = b.part;
  } catch { /* ברירות מחדל */ }

  const { data: cfg, error: cfgErr } = await sb
    .from("morning_report_settings").select("*").eq("id", true).single<Settings>();
  if (cfgErr || !cfg) return json({ ok: false, error: `settings unavailable: ${cfgErr?.message}` }, 500);

  const now = israelNow();
  const dry = forceDry ?? cfg.dry_run;
  const slot: Slot = cfg.report_slot === "evening" ? "evening" : "morning";

  if (!cfg.enabled && trigger === "cron") {
    return json({ ok: true, skipped: "disabled" });
  }
  const plan = planRun({ slot, hour: now.hour, trigger, sendHour: cfg.send_hour, part });
  if (!plan.delivery && !plan.reminders) return json({ ok: true, skipped: plan.reason ?? "nothing to do" });

  const delivery: Part = plan.delivery ? await runDelivery(cfg, slot, dateArg ?? (slot === "evening" ? now.date : null), dry, force)
    : { skipped: "not in this run" };
  const reminders: Part = plan.reminders ? await runReminders(cfg, dateArg ?? now.date, dry, force)
    : { skipped: "not in this run" };

  const results = (delivery.results ?? []) as { ok?: boolean }[];
  const sentAny = results.some((r) => r.ok === true);
  if (!delivery.skipped || !reminders.skipped) {
    await sb.from("morning_report_settings").update({
      last_run_at: new Date().toISOString(),
      ...(sentAny ? { last_sent_date: delivery.date } : {}),
      last_result: { trigger, dry, slot, date: delivery.date ?? null, totals: delivery.totals ?? null, results, delivery, reminders },
    }).eq("id", true);
  }
  const failed = delivery.error ?? reminders.error;
  return json({ ok: !failed, trigger, dry, slot, delivery, reminders }, failed ? 500 : 200);
});

async function runDelivery(cfg: Settings, slot: Slot, date: string | null, dry: boolean, force: boolean): Promise<Part> {
  const { data: rep, error: repErr } = await sb.rpc("morning_report", { p_date: date });
  if (repErr || !rep) return { error: `report failed: ${repErr?.message}` };
  const report = rep as Report;
  const t = report.totals;

  // ערב בלי עצירות (שישי בלי עבודה, חג): אין על מה לדווח. בבוקר התאריך הוא יום העבודה האחרון.
  if (slot === "evening" && t.planned === 0 && !force) return { date: report.date, skipped: "no stops on this day" };
  // פעם אחת ליום דוח. ריצה ידנית על אותו תאריך גם היא לא שולחת פעמיים,
  // אלא אם ביקשו בפירוש (`force`).
  if (cfg.last_sent_date === report.date && !dry && !force) {
    return { date: report.date, skipped: `already sent for ${report.date}` };
  }
  const templateId = slot === "evening" ? cfg.evening_template_id : cfg.template_id;
  if (!templateId) return { date: report.date, error: `no template for slot ${slot} in settings` };
  if (!cfg.recipients?.length) return { date: report.date, error: "no recipients in settings" };

  const variables = deliveryVariables(slot, report.date, report.dow, t);
  const results: Record<string, unknown>[] = [];
  for (const r of cfg.recipients) {
    results.push(dry ? { name: r.name, dry: true } : await sendTemplate(r, templateId, variables, `morning-report:${report.date}`));
  }
  return { date: report.date, totals: t, rate: deliveryRate(t), variables, results };
}

// ── 04/11/2026 (עידן): דוח התזכורות, "מי מהם הגיב לי" ──
// `date` הוא יום הביקורים: התזכורות יצאו אמש, reminder_replies(date) אוסף את התשובות עד 07:00.
async function runReminders(cfg: Settings, date: string, dry: boolean, force: boolean): Promise<Part> {
  if (!cfg.reminder_report_template_id) return { skipped: "no reminder template" };
  const sentDates = (cfg.reminder_report_sent_dates ?? []).filter((x) => x !== date);
  if ((cfg.reminder_report_sent_dates ?? []).includes(date) && !dry && !force) {
    return { date, skipped: `already sent for ${date}` };
  }
  const { data: rr, error } = await sb.rpc("reminder_replies", { p_date: date });
  if (error) return { date, error: `reminder_replies failed: ${error.message}` };
  const r = rr as { sent: number; replied: number; no_reply: number; rows: { customer_name: string | null; reply_text: string | null }[] } | null;
  if (!r || Number(r.sent) === 0) return { date, sent: 0, skipped: "no reminders sent" };

  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  const vars = [
    { name: "report_day", value: dayLabel(date, dow) },
    { name: "sent", value: String(r.sent) },
    { name: "replied", value: String(r.replied) },
    { name: "replies", value: repliesSummary(r.rows.filter((x) => x.reply_text)) },
    { name: "no_reply", value: String(r.no_reply) },
    { name: "report_date", value: date },
  ];
  const results: Record<string, unknown>[] = [];
  for (const rcp of cfg.reminder_report_recipients ?? []) {
    if (rcp.days != null && sentDates.length >= rcp.days) {
      results.push({ name: rcp.name, skipped: `נמען זמני, ${rcp.days} ימים נגמרו` });
      continue;
    }
    results.push(dry ? { name: rcp.name, dry: true }
      : await sendTemplate(rcp, cfg.reminder_report_template_id, vars, `reminder-report:${date}`));
  }
  if (!dry && results.some((x) => x.ok === true)) {
    await sb.from("morning_report_settings")
      .update({ reminder_report_sent_dates: [...sentDates, date] }).eq("id", true);
  }
  return { date, sent: r.sent, replied: r.replied, no_reply: r.no_reply, results };
}

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
