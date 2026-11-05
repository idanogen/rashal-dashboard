// רינדור דוח המערכת היומי (05/11/2026). קובץ טהור: בלי Deno, בלי רשת, נבדק מ-node (test/daily-report-render.test.mjs).
// הקלט: האובייקט של daily_report_data() במסד. הפלט: HTML למייל + שורת נושא + רשימת הדגלים האדומים.

export interface SyncJob { job: string; last_success: string | null; age_min: number | null; runs_today: number; failed_today: number; rows_today: number; last_error: string | null }
export interface ReportData {
  date: string;
  sync?: SyncJob[];
  alerts?: { job: string; state: string; since: string | null; detail: string | null }[];
  priority?: { status_writes?: Record<string, number>; status_errors?: number; pushed_today?: number; failed_today?: number; parked_total?: number; queue_blocked?: number; queue_pending?: number };
  ops?: { stops?: Record<string, number>; by_driver?: { driver: string; total: number; done: number; not_done: number; open: number }[]; tomorrow?: number; forms_signed?: Record<string, number>; crane_forms?: number; on_way_notified?: number; leftovers?: number };
  wa?: { in?: number; out?: number; out_failed?: number; reminders?: number; media_pending?: number };
  app?: { users_by_version?: { version: string; users: number; names: string }[]; errors?: { name: string; n: number; users: number; sample: string | null }[]; stop_info_open?: number; image_shown?: number; image_load_failed?: number; actions_applied?: number; actions_rejected?: number; stuck?: number };
  dashboard?: { loads?: number; p50_s?: number | null; p95_s?: number | null; max_s?: number | null; slow_over_8s?: number; with_failures?: number; critical?: string | null } | null;
  db?: { db_size?: string; top_mean?: { q: string; calls: number; mean_ms: number; max_ms: number }[]; top_total?: { q: string; calls: number; total_s: number }[] };
}

const JOB_LABEL: Record<string, string> = {
  "pull-core": "משיכת ליבה (הזמנות, קריאות, לקוחות)", "pull-pickups": "משיכת איסופים", "pull-pickup-addresses": "כתובות איסוף",
  "pull-docs": "משיכת תעודות", "push-chat": "דחיפת צ'אט לפריוריטי", "refresh-recent": "רענון קריאות אחרונות",
  "call-status-live": "סטטוס קריאה לפריוריטי", "call-status-dry": "סטטוס קריאה (יבש)", "call-status-users": "משתמשי פריוריטי",
};
const STOP_LABEL: Record<string, string> = { completed: "בוצעו", not_completed: "לא בוצעו", planned: "מתוכננות", in_progress: "בדרך", cancelled: "בוטלו" };
const FORM_LABEL: Record<string, string> = { delivery: "אספקה", return: "החזרה", repair: "תיקון", other: "אחר" };
// ידועים ומוסברים: לא נצבעים אדום, רק נספרים.
const KNOWN_NOISE: Record<string, string> = {
  registerForPush: "אין Firebase, התראות דחיפה מושבתות (ידוע)",
  prefetch: "הורדה מראש של מחר לפני 16:00, השרת מסרב כצפוי (ידוע, #903)",
};

export function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function n(v: unknown): number { return typeof v === "number" ? v : Number(v ?? 0) || 0; }
function hhmm(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("he-IL", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" });
}
function ddmm(dateIso: string): string {
  const [y, m, d] = dateIso.split("-");
  return `${d}/${m}/${y}`;
}

/** הדגלים האדומים: מה שדורש עין מחר בבוקר. הסדר = סדר החומרה. */
export function redFlags(r: ReportData): string[] {
  const flags: string[] = [];
  for (const a of r.alerts ?? []) flags.push(`השומר מתריע: ${JOB_LABEL[a.job] ?? a.job} (${a.state})`);
  for (const j of r.sync ?? []) {
    if (j.job === "pull-core" && j.age_min !== null && j.age_min > 90) flags.push(`משיכת הליבה לא רצה ${Math.round(j.age_min / 60)} שעות`);
    if (j.failed_today > 0) flags.push(`${JOB_LABEL[j.job] ?? j.job}: ${j.failed_today} ריצות נכשלו היום`);
  }
  const p = r.priority ?? {};
  if (n(p.failed_today) > 0) flags.push(`${p.failed_today} דחיפות לפריוריטי נעצרו היום`);
  if (n(p.status_errors) > 0) flags.push(`${p.status_errors} כתיבות סטטוס לפריוריטי עם שגיאה`);
  const w = r.wa ?? {};
  if (n(w.out_failed) > 0) flags.push(`${w.out_failed} הודעות וואטסאפ יוצאות נכשלו`);
  const a = r.app ?? {};
  if (n(a.image_load_failed) > 0) flags.push(`${a.image_load_failed} תמונות לא נטענו בכרטיס הקריאה`);
  if (n(a.actions_rejected) > 0) flags.push(`${a.actions_rejected} פעולות טכנאי נדחו`);
  if (n(a.stuck) > 0) flags.push(`${a.stuck} פעולות תקועות בתור ללא קליטה`);
  for (const e of a.errors ?? []) if (!KNOWN_NOISE[e.name] && e.n >= 3) flags.push(`שגיאה באפליקציה: ${e.name} (${e.n} פעמים, ${e.users} משתמשים)`);
  const d = r.dashboard;
  if (d && n(d.with_failures) > 0) flags.push(`${d.with_failures} טעינות של מסך הסדרן עם שליפה שנכשלה`);
  if (d && d.p95_s !== null && d.p95_s !== undefined && n(d.p95_s) > 15) flags.push(`מסך הסדרן: 5% מהטעינות מעל ${d.p95_s} שניות`);
  const o = r.ops ?? {};
  if (n(o.leftovers) > 0) flags.push(`${o.leftovers} עצירות מימים קודמים עדיין פתוחות`);
  return flags;
}

function section(title: string, body: string): string {
  return `<h3 style="margin:22px 0 8px;font-size:16px;color:#14223a;border-bottom:2px solid #e3e8ef;padding-bottom:4px">${title}</h3>${body}`;
}
function kv(pairs: [string, unknown][]): string {
  return `<table style="border-collapse:collapse;font-size:14px">` +
    pairs.map(([k, v]) => `<tr><td style="padding:2px 0 2px 14px;color:#5d6b82">${esc(k)}</td><td style="padding:2px 0"><b>${esc(v)}</b></td></tr>`).join("") +
    `</table>`;
}
function table(head: string[], rows: unknown[][]): string {
  if (!rows.length) return `<p style="color:#8a96a8;margin:4px 0">אין</p>`;
  const th = head.map((h) => `<th style="text-align:right;padding:4px 8px;background:#eef2f7;font-size:12.5px;color:#5d6b82">${esc(h)}</th>`).join("");
  const tr = rows.map((r) => `<tr>${r.map((c) => `<td style="padding:4px 8px;border-bottom:1px solid #eef2f7;font-size:13.5px">${esc(c)}</td>`).join("")}</tr>`).join("");
  return `<table style="border-collapse:collapse;width:100%"><tr>${th}</tr>${tr}</table>`;
}

export function renderReport(r: ReportData): { subject: string; html: string; flags: string[] } {
  const flags = redFlags(r);
  const stops = r.ops?.stops ?? {};
  const total = Object.values(stops).reduce((s, v) => s + n(v), 0);
  const subject = flags.length
    ? `דוח מערכת ר.שעל ${ddmm(r.date)}: ${flags.length} דגלים`
    : `דוח מערכת ר.שעל ${ddmm(r.date)}: תקין, ${n(stops.completed)} ביקורים בוצעו`;

  const flagsHtml = flags.length
    ? `<div style="border-inline-start:5px solid #c0392b;background:#fff5f3;border-radius:8px;padding:10px 14px"><b>דורש עין</b><ul style="margin:6px 0 0;padding-inline-start:18px">${flags.map((f) => `<li>${esc(f)}</li>`).join("")}</ul></div>`
    : `<div style="border-inline-start:5px solid #1e8e5a;background:#f1faf5;border-radius:8px;padding:10px 14px"><b>אין דגלים אדומים.</b> כל הבדיקות עברו.</div>`;

  const syncRows = (r.sync ?? []).map((j) => [
    JOB_LABEL[j.job] ?? j.job,
    j.last_success ? `${hhmm(j.last_success)} (לפני ${Math.round(n(j.age_min))} דק')` : "אף פעם",
    j.runs_today, j.failed_today, j.rows_today,
  ]);
  const p = r.priority ?? {};
  const sw = p.status_writes ?? {};
  const o = r.ops ?? {};
  const drivers = (o.by_driver ?? []).map((d) => [d.driver, d.total, d.done, d.not_done, d.open]);
  const forms = Object.entries(o.forms_signed ?? {}).map(([k, v]) => `${FORM_LABEL[k] ?? k} ${v}`).join(" · ") || "0";
  const w = r.wa ?? {};
  const a = r.app ?? {};
  const versions = (a.users_by_version ?? []).map((v) => [v.version, v.users, v.names]);
  const errors = (a.errors ?? []).map((e) => [e.name, e.n, e.users, KNOWN_NOISE[e.name] ?? (e.sample ?? "")]);
  const d = r.dashboard;
  const db = r.db ?? {};
  const topMean = (db.top_mean ?? []).map((q) => [q.mean_ms, q.calls, q.q]);
  const topTotal = (db.top_total ?? []).map((q) => [q.total_s, q.calls, q.q]);

  const html =
    `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1a2332;font-size:14px;line-height:1.55;max-width:680px">` +
    `<h2 style="margin:0 0 4px;font-size:20px;color:#14223a">דוח מערכת ר.שעל · ${ddmm(r.date)}</h2>` +
    `<div style="color:#8a96a8;font-size:12px;margin-bottom:14px">נוצר ${hhmm(new Date().toISOString())} · ${esc(total)} עצירות היום, ${esc(n(stops.completed))} בוצעו</div>` +
    flagsHtml +
    section("השטח היום", kv([
      ["עצירות", Object.entries(stops).map(([k, v]) => `${STOP_LABEL[k] ?? k} ${v}`).join(" · ") || "0"],
      ["טפסים שנחתמו", forms], ["טופסי מנוף", n(o.crane_forms)], ['הודעות "בדרך אליך"', n(o.on_way_notified)],
      ["פתוחות מימים קודמים", n(o.leftovers)], ["משובץ למחר", n(o.tomorrow)],
    ]) + table(["עובד", "עצירות", "בוצעו", "לא בוצעו", "פתוחות"], drivers)) +
    section("סנכרון עם פריוריטי", table(["תהליך", "ריצה מוצלחת אחרונה", "ריצות היום", "נכשלו", "שורות"], syncRows) +
      kv([
        ["כתיבת סטטוס קריאה", Object.entries(sw).map(([k, v]) => `${k} ${v}`).join(" · ") || "0"],
        ["שגיאות כתיבת סטטוס", n(p.status_errors)],
        ["דחיפות צ'אט ותמונות", `${n(p.pushed_today)} נדחפו · ${n(p.failed_today)} נעצרו היום · ${n(p.parked_total)} חונות בסך הכל`],
        ["תור הדחיפה", `${n(p.queue_pending)} ממתינות · ${n(p.queue_blocked)} חסומות (קריאה נעולה)`],
      ])) +
    section("וואטסאפ", kv([
      ["נכנסו", n(w.in)], ["יצאו", n(w.out)], ["יצאו ונכשלו", n(w.out_failed)], ["תזכורות אוטומטיות", n(w.reminders)], ["מדיה שעוד לא ירדה", n(w.media_pending)],
    ])) +
    section("אפליקציית הטכנאים", table(["גרסה", "משתמשים", "מי"], versions) +
      kv([
        ["פתיחות כרטיס קריאה", n(a.stop_info_open)], ["תמונות שצוירו", n(a.image_shown)], ["תמונות שלא נטענו", n(a.image_load_failed)],
        ["פעולות שנקלטו", n(a.actions_applied)], ["פעולות שנדחו", n(a.actions_rejected)], ["תקועות ללא קליטה", n(a.stuck)],
      ]) + `<div style="margin-top:8px;font-size:13px;color:#5d6b82">שגיאות היום</div>` + table(["שגיאה", "פעמים", "משתמשים", "הסבר / דוגמה"], errors)) +
    section("הדשבורד (מסך הסדרן)", d && n(d.loads) > 0
      ? kv([["טעינות", n(d.loads)], ["חציון", `${d.p50_s} שניות`], ["95%", `${d.p95_s} שניות`], ["הכי איטי", `${d.max_s} שניות`], ["מעל 8 שניות", n(d.slow_over_8s)], ["עם שליפה שנכשלה", n(d.with_failures)], ["מה קובע את הזמן", d.critical ?? ""]])
      : `<p style="color:#8a96a8;margin:4px 0">לא נמדדו טעינות היום</p>`) +
    section("המסד", kv([["גודל", db.db_size ?? ""]]) +
      `<div style="margin-top:8px;font-size:13px;color:#5d6b82">השאילתות הכי איטיות (ממוצע, מצטבר)</div>` + table(["ממוצע ms", "קריאות", "שאילתה"], topMean) +
      `<div style="margin-top:8px;font-size:13px;color:#5d6b82">הכי הרבה זמן כולל</div>` + table(["שניות", "קריאות", "שאילתה"], topTotal)) +
    `<div style="color:#8a96a8;font-size:12px;margin-top:18px">דוח יומי אוטומטי · rashal-daily-report · עוגן סולושנס</div></div>`;
  return { subject, html, flags };
}
