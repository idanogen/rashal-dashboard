// rashal-watchdog — שומר על בריאות הסנכרון (MAKE-MIGRATION-PLAN §4.3). רץ כל שעה מ-pg_cron.
// לכל job בודק מתי הריצה המוצלחת האחרונה. אם בתוך חלון הפעילות עבר הסף → מייל לעידן.
// מונע ספאם: מתריע פעם אחת לכשל ושוב רק אחרי 6 שעות; שולח גם הודעת התאוששות כשחוזר לעבוד.
// תקופת חסד: לא מתריע ב-thresholdMin הדקות הראשונות אחרי שחלון הפעילות נפתח (אחרת false-positive
// בוקר כשההצלחה האחרונה מאמש בערב — נמצא 05/08).
// שעון UTC (זהה ל-pg_cron). קיץ ישראל = UTC+3.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { assessHeyy, type HeyyHealth } from "./heyy-health.ts";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const ALERT_EMAIL = Deno.env.get("ALERT_EMAIL") ?? "idan@ogensolutions.biz";
const ALERT_FROM = Deno.env.get("ALERT_FROM") ?? "Ogen Sync <onboarding@resend.dev>";
const REALERT_HOURS = 6;

interface Mon { job: string; label: string; thresholdMin: number; activeDowUtc?: number[]; activeHourUtc?: [number, number] }
const MONITORS: Mon[] = [
  { job: "pull-core", label: "משיכת ליבה (הזמנות/קריאות/לקוחות)", thresholdMin: 90, activeDowUtc: [0,1,2,3,4], activeHourUtc: [4,15] },
  { job: "pull-pickups", label: "משיכת איסופים", thresholdMin: 90, activeDowUtc: [0,1,2,3,4], activeHourUtc: [4,15] },
  { job: "pull-pickup-addresses", label: "משיכת כתובות איסוף", thresholdMin: 90, activeDowUtc: [0,1,2,3,4], activeHourUtc: [4,15] },
  { job: "push-chat", label: "דחיפת צ'אט לפריוריטי", thresholdMin: 90 },
];

function isActiveNow(m: Mon, now: Date): boolean {
  if (!m.activeHourUtc) return true;
  const dow = now.getUTCDay(), hr = now.getUTCHours();
  if (m.activeDowUtc && !m.activeDowUtc.includes(dow)) return false;
  return hr >= m.activeHourUtc[0] && hr <= m.activeHourUtc[1];
}
// תקופת חסד: כמה דקות עברו מפתיחת חלון הפעילות היום. null = תמיד פעיל (אין חלון).
function minutesSinceWindowOpen(m: Mon, now: Date): number | null {
  if (!m.activeHourUtc) return null;
  const open = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), m.activeHourUtc[0], 0, 0));
  return (now.getTime() - open.getTime()) / 60000;
}

async function sendEmail(subject: string, html: string) {
  if (!RESEND_KEY) { console.error("no RESEND_API_KEY"); return false; }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: ALERT_FROM, to: [ALERT_EMAIL], subject, html }),
  });
  if (!r.ok) console.error("resend failed:", r.status, (await r.text()).slice(0, 200));
  return r.ok;
}
function wrap(inner: string, color: string): string {
  return `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1a2332;font-size:15px;line-height:1.6">` +
    `<div style="border-inline-start:5px solid ${color};background:#fafbfd;border-radius:10px;padding:14px 18px;max-width:560px">` +
    inner + `</div><div style="color:#8a96a8;font-size:12px;margin-top:12px">סנכרון רשעל · עוגן סולושנס</div></div>`;
}


// ── ערוץ הוואטסאפ ──────────────────────────────────────
//
// 🔴🔴 **heyy משביתה אוטומטית וובהוק שנכשל ברצף**, ומאותו רגע תשובות
// הלקוחות מפסיקות להגיע בלי שום סימן: אין שגיאה, אין שורה ביומן,
// והמסך נראה בדיוק כמו יום שקט. ההפעלה מחדש ידנית בממשק שלהם.
//
// ⭐ לכן זו **בדיקה חיובית**: שואלים את heyy מה מצב הוובהוק, ולא
// מסיקים מהיעדר תנועה. "לא נכנסו הודעות" הוא מצב תקין לגמרי ביום רגיל
// ולעולם לא יכול לשמש כאן כאות.
const HEYY_KEY = Deno.env.get("HEYY_API_KEY") ?? "";
const HEYY_CHANNEL = Deno.env.get("HEYY_CHANNEL_ID") ?? "";
const HEYY_WEBHOOK_URL = Deno.env.get("HEYY_WEBHOOK_URL") ?? "https://rashal-dashboard.vercel.app/api/heyy-webhook";
const HEYY_JOB = "heyy-channel";

async function heyyPost(path: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(`https://api.heyy.io/v3${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${HEYY_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ pagination: { page: 0, limit: 100 } }),
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return await r.json();
  } finally { clearTimeout(timer); }
}

async function probeHeyy(): Promise<HeyyHealth> {
  const common = { expectedWebhookUrl: HEYY_WEBHOOK_URL, expectedChannelId: HEYY_CHANNEL };
  if (!HEYY_KEY || !HEYY_CHANNEL) {
    return assessHeyy({ ...common, webhooks: null, channels: null, probeError: "חסר HEYY_API_KEY או HEYY_CHANNEL_ID" });
  }
  try {
    // שתי קריאות בלבד בשעה. המכסה של heyy היא 100 לדקה, ולכן זה זניח.
    const [webhooks, channels] = await Promise.all([
      heyyPost("/api_webhooks/search"),
      heyyPost("/channels/search"),
    ]);
    return assessHeyy({ ...common, webhooks, channels, probeError: null });
  } catch (e) {
    return assessHeyy({ ...common, webhooks: null, channels: null, probeError: e instanceof Error ? e.message : String(e) });
  }
}

function factsHtml(facts: Record<string, string>): string {
  const LABEL: Record<string, string> = {
    webhook_status: "מצב הוובהוק", webhook_events: "אירועים רשומים", webhook_urls: "כתובות שנמצאו",
    webhooks_registered: "מספר וובהוקים", channel_status: "מצב הערוץ", phone: "מספר",
    quality: "דירוג איכות במטא", daily_limit: "מכסה יומית", verified: "עסק מאומת", probe: "שגיאת קריאה",
  };
  return Object.entries(facts).map(([k, v]) => `<b>${LABEL[k] ?? k}:</b> ${v}<br>`).join("");
}

/**
 * המצב נשמר באותה טבלה כמו שאר השומרים, ולכן גם החנק של 6 שעות
 * והודעת ההתאוששות מגיעים בחינם.
 * 🔴 **"לא הצלחתי לשאול" אינו תקלה ואינו תקין.** תקלת רשת אחת מול heyy
 * לא מעירה את עידן; רק שתי בדיקות רצופות שנכשלו, כלומר שעתיים של עיוורון.
 */
async function checkHeyyChannel(now: Date, prev: Record<string, unknown> | undefined): Promise<string> {
  const health = await probeHeyy();
  const prevState = (prev?.state as string) ?? "ok";
  const alertedAt = prev?.last_alerted_at ? new Date(prev.last_alerted_at as string) : null;
  const hoursSinceAlert = alertedAt ? (now.getTime() - alertedAt.getTime()) / 3600000 : Infinity;

  if (health.verdict === "unknown") {
    if (prevState !== "unknown-repeat" && prevState !== "alerting") {
      await sb.from("sync_alerts").upsert({
        job: HEYY_JOB, state: prevState === "unknown" ? "unknown-repeat" : "unknown",
        detail: health.problems.join(" · ").slice(0, 400), updated_at: now.toISOString(),
      });
      if (prevState !== "unknown") return "probe failed (first, silent)";
    }
    if (hoursSinceAlert < REALERT_HOURS) return "probe failed (throttled)";
    await sendEmail(
      "🟠 אי אפשר לבדוק את ערוץ הוואטסאפ של ר.שעל",
      wrap(`<b>שתי בדיקות רצופות נכשלו.</b><br><br>${factsHtml(health.facts)}<br>` +
        `כלומר איננו יודעים אם הוובהוק פעיל. אם heyy השביתה אותו, תשובות לקוחות אובדות בשקט.`, "#d98324"),
    );
    await sb.from("sync_alerts").upsert({
      job: HEYY_JOB, state: "unknown-repeat", last_alerted_at: now.toISOString(),
      detail: health.problems.join(" · ").slice(0, 400), updated_at: now.toISOString(),
    });
    return "ALERT sent (probe)";
  }

  if (health.verdict === "ok") {
    if (prevState !== "ok") {
      await sendEmail(
        "✅ ערוץ הוואטסאפ של ר.שעל חזר לתקינות",
        wrap(`<b>הוובהוק והערוץ תקינים שוב.</b><br><br>${factsHtml(health.facts)}`, "#1e8e5a"),
      );
      await sb.from("sync_alerts").upsert({
        job: HEYY_JOB, state: "ok", last_recovered_at: now.toISOString(), detail: null, updated_at: now.toISOString(),
      });
      return "RECOVERED";
    }
    return "ok";
  }

  // down / warn
  if (prevState === "alerting" && hoursSinceAlert < REALERT_HOURS) return `${health.verdict} (throttled)`;
  const down = health.verdict === "down";
  await sendEmail(
    down ? "🔴 ערוץ הוואטסאפ של ר.שעל תקול" : "🟠 אזהרה בערוץ הוואטסאפ של ר.שעל",
    wrap(
      `<b style="font-size:16px">${down ? "תשובות לקוחות עלולות לא להגיע" : "שווה לבדוק"}</b><br><br>` +
      health.problems.map((p) => `• ${p}`).join("<br>") + `<br><br>${factsHtml(health.facts)}<br>` +
      `ההפעלה מחדש נעשית ידנית בהגדרות של heyy, בעמוד הוובהוקים.`,
      down ? "#c0392b" : "#d98324",
    ),
  );
  await sb.from("sync_alerts").upsert({
    job: HEYY_JOB, state: "alerting", last_alerted_at: now.toISOString(),
    detail: health.problems.join(" · ").slice(0, 400), updated_at: now.toISOString(),
  });
  return "ALERT sent";
}

Deno.serve(async () => {
  const now = new Date();
  const report: Record<string, string> = {};
  const { data: alertRows } = await sb.from("sync_alerts").select("*");
  const alerts = new Map((alertRows ?? []).map((a: Record<string, unknown>) => [a.job as string, a]));

  for (const m of MONITORS) {
    const { data: last } = await sb.from("sync_runs")
      .select("started_at").eq("job", m.job).eq("status", "success")
      .order("started_at", { ascending: false }).limit(1).maybeSingle();
    const lastSuccess = last?.started_at ? new Date(last.started_at as string) : null;
    const ageMin = lastSuccess ? (now.getTime() - lastSuccess.getTime()) / 60000 : Infinity;
    const active = isActiveNow(m, now);
    const prev = alerts.get(m.job);
    const prevState = (prev?.state as string) ?? "ok";
    const stale = ageMin > m.thresholdMin;

    // תקופת חסד: בתחילת חלון הפעילות, תן ל-job זמן לרוץ לפני שמתריעים (מונע false-positive בוקר).
    const sinceOpen = minutesSinceWindowOpen(m, now);
    const inGrace = sinceOpen !== null && sinceOpen >= 0 && sinceOpen < m.thresholdMin;

    if (active && stale && !inGrace) {
      const alertedAt = prev?.last_alerted_at ? new Date(prev.last_alerted_at as string) : null;
      const hoursSinceAlert = alertedAt ? (now.getTime() - alertedAt.getTime()) / 3600000 : Infinity;
      if (prevState !== "alerting" || hoursSinceAlert >= REALERT_HOURS) {
        const { data: le } = await sb.from("sync_runs").select("error_summary,status")
          .eq("job", m.job).order("started_at", { ascending: false }).limit(1).maybeSingle();
        const lastErr = (le?.error_summary as string) ?? (le ? `ריצה אחרונה: ${le.status}` : "אין שום ריצה");
        const ageTxt = lastSuccess ? `לפני ${Math.round(ageMin)} דק'` : "מעולם לא (אין ריצה מוצלחת)";
        await sendEmail(
          `🔴 סנכרון רשעל תקוע: ${m.label}`,
          wrap(
            `<b style="font-size:16px">הסנכרון לא רץ כצפוי</b><br><br>` +
            `<b>Job:</b> ${m.label} (${m.job})<br>` +
            `<b>ריצה מוצלחת אחרונה:</b> ${ageTxt}<br>` +
            `<b>סף התראה:</b> ${m.thresholdMin} דק'<br>` +
            `<b>שגיאה אחרונה:</b> ${lastErr.slice(0, 300)}<br><br>` +
            `המערכת ממשיכה לנסות בכל ריצה. מייל נוסף רק אם זה לא מסתדר תוך ${REALERT_HOURS} שעות.`,
            "#c0392b",
          ),
        );
        await sb.from("sync_alerts").upsert({
          job: m.job, state: "alerting", last_alerted_at: now.toISOString(),
          detail: lastErr.slice(0, 400), updated_at: now.toISOString(),
        });
        report[m.job] = "ALERT sent";
      } else report[m.job] = "stale (throttled)";
    } else if (!stale && prevState === "alerting") {
      await sendEmail(
        `✅ סנכרון רשעל חזר לעבוד: ${m.label}`,
        wrap(`<b>הסנכרון התאושש.</b><br><br><b>Job:</b> ${m.label} (${m.job})<br>רץ שוב כשורה.`, "#1e8e5a"),
      );
      await sb.from("sync_alerts").upsert({
        job: m.job, state: "ok", last_recovered_at: now.toISOString(), detail: null, updated_at: now.toISOString(),
      });
      report[m.job] = "RECOVERED";
    } else {
      report[m.job] = inGrace ? "grace (window just opened)" : active ? "ok" : "outside active window";
    }
  }

  // 🔴 נפרד מהלולאה: השומרים שלמעלה נמדדים לפי "מתי רץ לאחרונה",
  // וזה נמדד לפי "מה heyy מדווחת עכשיו". שאלה אחרת, מנגנון אחר.
  try {
    report[HEYY_JOB] = await checkHeyyChannel(now, alerts.get(HEYY_JOB));
  } catch (e) {
    report[HEYY_JOB] = `check crashed: ${e instanceof Error ? e.message : String(e)}`;
    console.error("[watchdog] heyy check crashed", e);
  }

  return new Response(JSON.stringify({ checked_at: now.toISOString(), report }), { headers: { "Content-Type": "application/json" } });
});
