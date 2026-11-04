// "לטיפול" שלא נרשם בפריוריטי (עידן, 04/11/2026: "חייבים לכתוב בלי טעות").
//
// הסטטוס נכתב, אבל השם של מי שטיפל דולג או נדחה: טכנאי בלי שם משתמש במסך הצוות
// (מוהנד, מוחמד: הוכרע דילוג עם התרעה), שם שלא קיים בפריוריטי, או דחייה ב-PATCH.
// פעמון פעם אחת לכל שורה, כמו push-parked. [[log_without_a_bell_is_not_monitoring]]

export const TECH_JOB = "technician-login";

export interface TechRow {
  id: number; priority_call_id: string; technician: string | null; target_status: string;
  technician_login: string | null; technician_result: string | null; technician_error: string | null; attempted_at: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function technicianDigest(rows: TechRow[], names: Map<string, string>): { subject: string; inner: string } {
  const missing = [...new Set(rows.filter((r) => /אין שם משתמש/.test(r.technician_error ?? "")).map((r) => r.technician ?? "?"))];
  const subject = missing.length && missing.length === new Set(rows.map((r) => r.technician)).size
    ? `🟠 "לטיפול" לא נרשם בפריוריטי: ל${missing.join(", ")} אין שם משתמש`
    : `🟠 "לטיפול" לא נרשם בפריוריטי ב-${rows.length === 1 ? "קריאה אחת" : `${rows.length} קריאות`}`;
  const line = (r: TechRow) =>
    `• ${names.get(r.priority_call_id) ? `<b>${esc(names.get(r.priority_call_id)!)}</b> ` : ""}(<bdi>${esc(r.priority_call_id)}</bdi>)` +
    ` · ${esc(r.technician ?? "טכנאי לא ידוע")} · הסטטוס "${esc(r.target_status)}" נכתב` +
    `<br>&nbsp;&nbsp;${esc(r.technician_error ?? r.technician_result ?? "")}`;
  const inner = `<b style="font-size:16px">הסטטוס נכתב לפריוריטי, אבל "לטיפול" (מי טיפל) לא</b><br><br>` +
    rows.map(line).join("<br><br>") +
    `<br><br>שם משתמש חסר מוסיפים במסך הצוות, בעמודה "משתמש פריוריטי", בדיוק כמו שהוא כתוב בפריוריטי. ` +
    `את הקריאות שכאן אפשר להשלים ידנית בפריוריטי.`;
  return { subject, inner };
}

type Row = Record<string, unknown>;
interface Query extends PromiseLike<{ data: Row[] | null; error: { message: string } | null }> {
  select(cols: string): Query; eq(col: string, v: string): Query; in(col: string, v: string[]): Query;
  gt(col: string, v: string): Query; order(col: string, o: { ascending: boolean }): Query; limit(n: number): Query;
}
interface Deps {
  sb: { from(table: string): Query & { upsert(row: Row): PromiseLike<unknown> } };
  sendEmail: (subject: string, html: string) => Promise<boolean>;
  wrap: (inner: string, color: string) => string;
}

export async function checkTechnicianLogin(now: Date, prev: Record<string, unknown> | undefined, { sb, sendEmail, wrap }: Deps): Promise<string> {
  const alertedAt = prev?.last_alerted_at ? new Date(prev.last_alerted_at as string).getTime() : 0;
  const since = new Date(Math.max(alertedAt, now.getTime() - 24 * 3600000)).toISOString();
  const { data, error } = await sb.from("priority_call_status_writes")
    .select("id,priority_call_id,technician,target_status,technician_login,technician_result,technician_error,attempted_at")
    .eq("source", "stop").eq("state", "done").in("technician_result", ["skipped", "failed"])
    .gt("attempted_at", since).order("attempted_at", { ascending: false }).limit(40);
  if (error) return `query failed: ${error.message}`;
  // "לא נכתב בסטטוס הזה" אינו תקלה: הסטטוס לא היה סיום ביקור.
  const rows = ((data ?? []) as unknown as TechRow[]).filter((r) => !/לא נכתב בסטטוס/.test(r.technician_error ?? ""));
  if (!rows.length) return "ok";
  const { data: calls } = await sb.from("service_calls").select("priority_call_id,customer_name")
    .in("priority_call_id", [...new Set(rows.map((r) => r.priority_call_id))]);
  const names = new Map<string, string>();
  for (const c of calls ?? []) if (typeof c.customer_name === "string") names.set(String(c.priority_call_id), c.customer_name);
  const { subject, inner } = technicianDigest(rows, names);
  const ok = await sendEmail(subject, wrap(inner, "#d98324"));
  if (!ok) return "email failed";
  await sb.from("sync_alerts").upsert({
    job: TECH_JOB, state: "alerting", last_alerted_at: now.toISOString(),
    detail: rows.map((r) => `${r.priority_call_id}: ${r.technician ?? "?"} ${r.technician_result}`).join(" · ").slice(0, 400),
    updated_at: now.toISOString(),
  });
  return `ALERT sent (${rows.length})`;
}
