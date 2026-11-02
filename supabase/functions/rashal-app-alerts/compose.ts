// rashal-app-alerts, הניסוח הטהור (02/11/2026, שלב 3 בתוכנית הלוגים). בלי ייבוא,
// נבדק ב-`test/app-alerts.test.mjs`.

export interface ProblemRow {
  received_at: string;
  occurred_at: string;
  user_name: string | null;
  screen: string | null;
  app_version: string | null;
  customer_name: string | null;
  topic: string | null;
  text: string | null;
}

export interface SummaryUser {
  name: string; app: string; version: string | null; problems: number; crashes: number; rejected: number;
  forms_failed: number; forms_blocked: number; forms_cancelled: number; forms_opened: number; forms_saved: number;
  forms_sent: number; image_errors: number; errors: number;
}
export interface Summary {
  day: string; events: number; users: SummaryUser[];
  top_errors: { name: string; n: number; users: number }[];
  form_blocks: { form_key: string; reason: string; n: number; users: string | null }[];
  problems: { user_name: string | null; topic: string | null; text: string | null; customer_name: string | null }[];
  silent: { name: string; stops: number }[];
}

const LOGS_URL = "https://rashal-dashboard.vercel.app/admin/app-logs";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("he-IL", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" });

/** יום בישראל (YYYY-MM-DD) ושעה בישראל. */
export function israelParts(now: Date): { day: string; hour: number; dow: number } {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false, weekday: "short",
  }).formatToParts(now);
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { day: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) % 24, dow };
}

/** היום שהסיכום מתאר: אתמול, וביום ראשון יום שישי (בשבת אין עבודה). */
export function summaryDay(today: string, dow: number): string {
  const d = new Date(today + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - (dow === 0 ? 2 : 1));
  return d.toISOString().slice(0, 10);
}

/** סיכום הבוקר נשלח בימים א-ו מ-7:00, פעם אחת ליום. */
export function morningDue(now: Date, lastSentDay: string | null): boolean {
  const { day, hour, dow } = israelParts(now);
  return dow !== 6 && hour >= 7 && lastSentDay !== day;
}

export function problemsEmail(rows: ProblemRow[]): { subject: string; html: string } {
  const who = [...new Set(rows.map((r) => r.user_name ?? "לא מזוהה"))].join(", ");
  const subject = rows.length === 1
    ? `⚠️ רשעל: "יש בעיה" מ${who} (${rows[0].topic ?? "בלי נושא"})`
    : `⚠️ רשעל: ${rows.length} דיווחי "יש בעיה" (${who})`;
  const items = rows.map((r) =>
    `<li style="margin-bottom:10px"><b>${esc(r.user_name ?? "לא מזוהה")}</b> · ${hhmm(r.occurred_at)} · ` +
    `<b style="color:#c2410c">${esc(r.topic ?? "")}</b>` +
    (r.customer_name ? ` · אצל ${esc(r.customer_name)}` : "") +
    (r.text ? `<br>${esc(r.text)}` : "") +
    `<br><span style="color:#8a96a8;font-size:12px">מסך <bdi>${esc(r.screen ?? "?")}</bdi> · גרסה <bdi>${esc(r.app_version ?? "?")}</bdi>` +
    (r.received_at !== r.occurred_at && Date.parse(r.received_at) - Date.parse(r.occurred_at) > 5 * 60_000
      ? ` · נשלח מהטלפון ב-${hhmm(r.received_at)} (לא הייתה קליטה)` : "") +
    `</span></li>`).join("");
  const html = `<b style="font-size:16px">דיווח מהשטח</b><br><br><ul style="margin:0;padding-inline-start:18px">${items}</ul>` +
    `<br>מה קרה לפני הלחיצה באותו טלפון: <a href="${LOGS_URL}">מי נתקע היום</a>.`;
  return { subject, html };
}

/** שורות הסיכום: רק מי שקרה אצלו משהו, ורק מה שקרה. */
function userLine(u: SummaryUser): string | null {
  const bits: string[] = [];
  if (u.problems) bits.push(`${u.problems} דיווחי בעיה`);
  if (u.crashes) bits.push(`${u.crashes} קריסות`);
  if (u.rejected) bits.push(`${u.rejected} פעולות נדחו`);
  if (u.forms_failed) bits.push(`${u.forms_failed} טפסים לא נשמרו`);
  if (u.forms_blocked) bits.push(`${u.forms_blocked} חסימות בטופס`);
  if (u.forms_cancelled) bits.push(`${u.forms_cancelled} טפסים בוטלו באמצע`);
  if (u.image_errors) bits.push(`${u.image_errors} תמונות לא נטענו`);
  return bits.length ? `<li><b>${esc(u.name)}</b> · ${bits.join(" · ")}</li>` : null;
}

export function morningEmail(s: Summary, dayLabel: string): { subject: string; html: string } {
  const field = s.users.filter((u) => u.app === "driver");
  const office = s.users.filter((u) => u.app === "dashboard");
  const trouble = s.users.map(userLine).filter(Boolean) as string[];
  const formsSaved = field.reduce((a, u) => a + u.forms_saved, 0);
  const formsSent = field.reduce((a, u) => a + u.forms_sent, 0);
  const subject = `רשעל ${dayLabel}: ${field.length} בשטח, ${office.length} במשרד` +
    (s.problems.length ? `, ${s.problems.length} דיווחי בעיה` : "") +
    (trouble.length ? `, ${trouble.length} נתקעו` : ", בלי תקיעות");
  const parts: string[] = [
    `<b style="font-size:16px">סיכום ${esc(dayLabel)} מהלוגים</b><br>`,
    `בשטח באפליקציה: ${field.map((u) => esc(u.name)).join(", ") || "אף אחד"}.<br>`,
    `במשרד בדשבורד: ${office.map((u) => esc(u.name)).join(", ") || "אף אחד"}.<br>`,
    `טפסים מהאפליקציה: נשמרו ${formsSaved}, הגיעו לשרת ${formsSent}.<br><br>`,
  ];
  if (trouble.length) parts.push(`<b>מי נתקע</b><ul style="margin:4px 0;padding-inline-start:18px">${trouble.join("")}</ul><br>`);
  if (s.problems.length) {
    parts.push(`<b>דיווחי יש בעיה</b><ul style="margin:4px 0;padding-inline-start:18px">` +
      s.problems.map((p) => `<li><b>${esc(p.user_name ?? "")}</b> · ${esc(p.topic ?? "")}` +
        (p.customer_name ? ` · ${esc(p.customer_name)}` : "") + (p.text ? ` · ${esc(p.text)}` : "") + `</li>`).join("") + `</ul><br>`);
  }
  if (s.form_blocks.length) {
    parts.push(`<b>איפה נחסמו בטפסים</b><ul style="margin:4px 0;padding-inline-start:18px">` +
      s.form_blocks.map((b) => `<li><bdi>${esc(b.form_key)}</bdi> · ${esc(b.reason)} · ${b.n} · ${esc(b.users ?? "")}</li>`).join("") +
      `</ul><br>`);
  }
  if (s.silent.length) {
    parts.push(`<b>היו להם עצירות ולא נראו באפליקציה:</b> ` +
      s.silent.map((x) => `${esc(x.name)} (${x.stops})`).join(", ") + `<br><br>`);
  }
  if (s.top_errors.length) {
    parts.push(`<b>שגיאות נפוצות:</b> ` + s.top_errors.slice(0, 5).map((e) => `<bdi>${esc(e.name)}</bdi> ×${e.n}`).join(", ") + `<br><br>`);
  }
  parts.push(`הפירוט המלא: <a href="${LOGS_URL}/${s.day}">מי נתקע ב-${esc(dayLabel)}</a>.`);
  return { subject, html: parts.join("") };
}
