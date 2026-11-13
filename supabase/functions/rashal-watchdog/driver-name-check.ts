// "שם נהג / טכנאי" שלא נכנס לקריאה בפריוריטי (עידן, 13/11/2026).
//
// השיבוץ נשמר אצלנו, אבל הכתיבה ל-DOCUMENTS_Q.TOPP_DRIVERNAME נעצרה (פריוריטי דחתה,
// למשל קריאה נעולה), או ששורה ממתינה יותר מחצי שעה, כלומר הקרון או הפונקציה לא רצים.
// מחליף את הפעמון של "לטיפול" (technician-login, 04/11). פעמון פעם אחת לכל עצירה,
// כמו push-parked. [[log_without_a_bell_is_not_monitoring]]

export const DRIVER_JOB = "driver-name";
const STUCK_MS = 30 * 60_000;

export interface DriverRow {
  priority_call_id: string; driver_name: string; state: string;
  error: string | null; requested_at: string; attempted_at: string | null;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function driverDigest(failed: DriverRow[], stuck: DriverRow[], names: Map<string, string>): { subject: string; inner: string } {
  const n = failed.length + stuck.length;
  const subject = `🟠 שם הטכנאי לא נכנס לפריוריטי ב-${n === 1 ? "קריאה אחת" : `${n} קריאות`}`;
  const who = (r: DriverRow) =>
    `• ${names.get(r.priority_call_id) ? `<b>${esc(names.get(r.priority_call_id)!)}</b> ` : ""}(<bdi>${esc(r.priority_call_id)}</bdi>)` +
    ` · ${esc(r.driver_name)}`;
  const parts: string[] = [];
  if (failed.length) {
    parts.push(`<b style="font-size:16px">השיבוץ נשמר, אבל "שם נהג / טכנאי" לא נכתב לקריאה</b><br><br>` +
      failed.map((r) => `${who(r)}<br>&nbsp;&nbsp;${esc(r.error ?? "")}`).join("<br><br>") +
      `<br><br>את השם אפשר להשלים ידנית בקריאה בפריוריטי. שיבוץ מחדש אצלנו שולח אותו שוב.`);
  }
  if (stuck.length) {
    parts.push(`<b style="font-size:16px">ממתינות לכתיבה יותר מחצי שעה (הקרון או הפונקציה לא רצים)</b><br><br>` +
      stuck.map(who).join("<br>"));
  }
  return { subject, inner: parts.join("<br><br>") };
}

type Row = Record<string, unknown>;
interface Query extends PromiseLike<{ data: Row[] | null; error: { message: string } | null }> {
  select(cols: string): Query; eq(col: string, v: string): Query; in(col: string, v: string[]): Query;
  gt(col: string, v: string): Query; lt(col: string, v: string): Query;
  order(col: string, o: { ascending: boolean }): Query; limit(n: number): Query;
}
interface Deps {
  sb: { from(table: string): Query & { upsert(row: Row): PromiseLike<unknown> } };
  sendEmail: (subject: string, html: string) => Promise<boolean>;
  wrap: (inner: string, color: string) => string;
}

const COLS = "priority_call_id,driver_name,state,error,requested_at,attempted_at";

export async function checkDriverNameWrites(now: Date, prev: Record<string, unknown> | undefined, { sb, sendEmail, wrap }: Deps): Promise<string> {
  const alertedAt = prev?.last_alerted_at ? new Date(prev.last_alerted_at as string).getTime() : 0;
  const since = new Date(Math.max(alertedAt, now.getTime() - 24 * 3600000)).toISOString();
  const f = await sb.from("priority_call_driver_writes").select(COLS)
    .eq("state", "failed").gt("attempted_at", since).order("attempted_at", { ascending: false }).limit(40);
  if (f.error) return `query failed: ${f.error.message}`;
  // שורה תקועה מדווחת פעם ביום, לא בכל ריצה של הוואצ'דוג.
  const stuckDue = now.getTime() - alertedAt > 24 * 3600000;
  const s = await sb.from("priority_call_driver_writes").select(COLS)
    .eq("state", "pending").lt("requested_at", new Date(now.getTime() - STUCK_MS).toISOString())
    .order("requested_at", { ascending: true }).limit(40);
  if (s.error) return `query failed: ${s.error.message}`;
  const failed = (f.data ?? []) as unknown as DriverRow[];
  const stuck = stuckDue ? (s.data ?? []) as unknown as DriverRow[] : [];
  if (!failed.length && !stuck.length) return (s.data ?? []).length ? `stuck ${(s.data ?? []).length} (already alerted)` : "ok";
  const { data: calls } = await sb.from("service_calls").select("priority_call_id,customer_name")
    .in("priority_call_id", [...new Set([...failed, ...stuck].map((r) => r.priority_call_id))]);
  const names = new Map<string, string>();
  for (const c of calls ?? []) if (typeof c.customer_name === "string") names.set(String(c.priority_call_id), c.customer_name);
  const { subject, inner } = driverDigest(failed, stuck, names);
  const ok = await sendEmail(subject, wrap(inner, "#d98324"));
  if (!ok) return "email failed";
  await sb.from("sync_alerts").upsert({
    job: DRIVER_JOB, state: "alerting", last_alerted_at: now.toISOString(),
    detail: [...failed, ...stuck].map((r) => `${r.priority_call_id}: ${r.driver_name} ${r.state}`).join(" · ").slice(0, 400),
    updated_at: now.toISOString(),
  });
  return `ALERT sent (${failed.length} failed, ${stuck.length} stuck)`;
}
