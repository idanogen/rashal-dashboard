// פעולה תקועה בטלפון של נהג (28/10/2026, אפליקציה בלי קליטה, שלב 4).
//
// כל מכשיר מדווח בסנכרון (`driver_sync_reports`): מתי, כמה ממתין בתור, ומה
// הפעולה הישנה ביותר שממתינה. נהג בלי קליטה פשוט לא מדווח, וזה תקין. אבל
// מכשיר שסנכרן בחצי השעה האחרונה ועדיין מחזיק פעולה בת שעתיים זו תקלה
// (שגיאה שחוזרת, קובץ שנמחק), ולכן פעמון, פעם אחת ל-6 שעות לכל נהג.

export const STUCK_JOB = "stuck-actions";

export interface SyncReportRow {
  profile_id: string;
  driver_name: string | null;
  device: string | null;
  app_label: string | null;
  last_sync_at: string;
  pending: number;
  rejected: number;
  oldest_pending_at: string | null;
}

const STUCK_MS = 2 * 3600_000;
const RECENT_SYNC_MS = 30 * 60_000;

export function stuckReports(rows: SyncReportRow[], now: Date): SyncReportRow[] {
  return rows.filter((r) =>
    r.pending > 0 && !!r.oldest_pending_at
    && now.getTime() - new Date(r.oldest_pending_at).getTime() > STUCK_MS
    && now.getTime() - new Date(r.last_sync_at).getTime() < RECENT_SYNC_MS);
}

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("he-IL", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" });
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function stuckHtml(rows: SyncReportRow[], now: Date): string {
  const lines = rows.map((r) => {
    const hours = Math.round((now.getTime() - new Date(r.oldest_pending_at!).getTime()) / 3600_000);
    return `<li><b>${esc(r.driver_name ?? "נהג לא מקושר")}</b> · ${r.pending} ממתינות, הישנה מלפני ${hours} שע׳` +
      ` · גרסה ${esc(r.app_label ?? "?")} · סנכרן לאחרונה ${hhmm(r.last_sync_at)}` +
      (r.rejected > 0 ? ` · ${r.rejected} נדחו` : "") + `</li>`;
  }).join("");
  return `<b style="font-size:16px">פעולה מהשטח תקועה בטלפון</b><br><br>` +
    `המכשיר מסנכרן, אבל פעולה שהטכנאי עשה לפני יותר משעתיים עדיין לא הגיעה לשרת. זו לא קליטה, זו תקלה.<br><br>` +
    `<ul style="margin:0;padding-inline-start:18px">${lines}</ul><br>` +
    `מה לבדוק: ציר הזמן של העצירה (דחייה נרשמת שם), ואצל הטכנאי הפס העליון באפליקציה ולחיצה עליו שולחת שוב.`;
}

interface Row { [k: string]: unknown }
interface Query {
  select(cols: string): Query;
  gt(col: string, v: string): Query;
  order(col: string, o: { ascending: boolean }): Query;
  limit(n: number): PromiseLike<{ data: Row[] | null; error: { message: string } | null }>;
}
interface Deps {
  sb: { from(table: string): Query & { upsert(row: Row): PromiseLike<unknown> } };
  sendEmail: (subject: string, html: string) => Promise<boolean>;
  wrap: (inner: string, color: string) => string;
  realertHours: number;
}

export async function checkStuckActions(
  now: Date,
  prev: Record<string, unknown> | undefined,
  { sb, sendEmail, wrap, realertHours }: Deps,
): Promise<string> {
  const since = new Date(now.getTime() - 24 * 3600_000).toISOString();
  const { data, error } = await sb.from("driver_sync_reports")
    .select("profile_id,driver_name,device,app_label,last_sync_at,pending,rejected,oldest_pending_at")
    .gt("last_sync_at", since)
    .order("last_sync_at", { ascending: false })
    .limit(100);
  if (error) return `query failed: ${error.message}`;
  const stuck = stuckReports((data ?? []) as unknown as SyncReportRow[], now);
  if (!stuck.length) return "ok";

  const lastAlert = prev?.last_alerted_at ? new Date(prev.last_alerted_at as string).getTime() : 0;
  if (now.getTime() - lastAlert < realertHours * 3600_000) return `${stuck.length} stuck (throttled)`;
  const subject = `רשעל: ${stuck.length} ${stuck.length === 1 ? "פעולה תקועה" : "פעולות תקועות"} בטלפון של טכנאי`;
  const ok = await sendEmail(subject, wrap(stuckHtml(stuck, now), "#c0392b"));
  if (ok) {
    await sb.from("sync_alerts").upsert({ job: STUCK_JOB, state: "alerting", last_alerted_at: now.toISOString(), detail: `${stuck.length} stuck` });
  }
  return ok ? `ALERT sent (${stuck.length})` : "email failed";
}
