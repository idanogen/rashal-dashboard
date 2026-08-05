// rashal-watchdog — שומר על בריאות הסנכרון (MAKE-MIGRATION-PLAN §4.3). רץ כל שעה מ-pg_cron.
// לכל job בודק מתי הריצה המוצלחת האחרונה. אם בתוך חלון הפעילות עבר הסף → מייל לעידן.
// מונע ספאם: מתריע פעם אחת לכשל ושוב רק אחרי 6 שעות; שולח גם הודעת התאוששות כשחוזר לעבוד.
// תקופת חסד: לא מתריע ב-thresholdMin הדקות הראשונות אחרי שחלון הפעילות נפתח (אחרת false-positive
// בוקר כשההצלחה האחרונה מאמש בערב — נמצא 05/08).
// שעון UTC (זהה ל-pg_cron). קיץ ישראל = UTC+3.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

  return new Response(JSON.stringify({ checked_at: now.toISOString(), report }), { headers: { "Content-Type": "application/json" } });
});
