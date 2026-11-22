// רינדור הדוח השבועי "לקוחות שלא הגיעה אליהם הודעת וואטסאפ" (13/11/2026). קובץ טהור: בלי Deno, בלי רשת,
// נבדק מ-node (test/wa-failure-report.test.mjs). הקלט: wa_failure_report_data() במסד. הפלט: נושא + HTML + טקסט.
// הקהל: עמי, רונן, שלומי והמשרד. לכן עברית של משרד, בלי מונחים טכניים, ופעולה ברורה לכל שורה.

export interface FailedCall { call: string | null; product: string | null; state: string; priority_status: string | null; call_status?: string | null }
export interface FailedCustomer {
  phone: string; name: string | null; kinds: string[]; attempts: number;
  last_at: string; ever_delivered: boolean; calls: FailedCall[];
}
export interface FailureReportData {
  from: string; to: string; customers: FailedCustomer[];
  unreachable_total: number; survey_only: number; technical: number; technical_sample: string | null;
}

// 🔴 עותק של PRIORITY_CALL_CLOSED מ-src/lib/constants.ts (גבול סביבה: הפונקציה רצה ב-Deno ולא רואה את src).
// הבדיקה test/wa-failure-report.test.mjs קוראת את שני הקבצים ומוודאת שהם זהים.
export const PRIORITY_CALL_CLOSED = ['בוצעה', 'סופית', 'מבוטלת', 'טיוטא'] as const;

const KIND_LABEL: Record<string, string> = {
  media: "בקשת תמונה לקריאת שירות",
  visit_reminder: "תזכורת ערב לפני ביקור",
  on_way: "הודעת \"הטכנאי בדרך\"",
  crane: "מדריך בטיחות למנוף",
  document: "העתק טופס חתום",
  manual: "הודעה שנשלחה מהמשרד",
};

export function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function ddmm(dateIso: string): string {
  const [, m, d] = dateIso.split("-");
  return `${d}/${m}`;
}
function dayDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit" });
}
/** +972527130128 → 052-7130128 */
export function localPhone(e164: string): string {
  const digits = e164.replace(/\D/g, "").replace(/^972/, "0");
  return digits.length === 10 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : digits;
}
export function isOpenCall(c: FailedCall): boolean {
  return !(PRIORITY_CALL_CLOSED as readonly string[]).includes(c.priority_status ?? "");
}
/** לקוח שיש לו קריאה פתוחה שמחכה לתמונה: הקריאה תקועה עד שמישהו מתקשר. */
export function isBlocking(c: FailedCustomer): boolean {
  return c.calls.some(isOpenCall);
}
function kindsText(c: FailedCustomer): string {
  return c.kinds.map((k) => KIND_LABEL[k] ?? k).join(", ");
}

export function renderFailureReport(r: FailureReportData): { subject: string; html: string; text: string; blocking: number } {
  const blocking = r.customers.filter(isBlocking);
  const others = r.customers.filter((c) => !isBlocking(c));
  const range = `${ddmm(r.from)} עד ${ddmm(addDays(r.to, -1))}`;
  const subject = r.customers.length === 0
    ? `ר.שעל: כל הודעות הוואטסאפ הגיעו ללקוחות (${range})`
    : `ר.שעל: ${r.customers.length} לקוחות שלא הגיעה אליהם הודעת וואטסאפ` +
      (blocking.length ? `, ${blocking.length} מהם עם קריאה שמחכה לתמונה` : "") + ` (${range})`;

  // שלוש עמודות לכל היותר, כדי שהטבלה תיקרא גם במייל בטלפון. מספר טלפון וקריאה לא נשברים.
  const callCell = (c: FailedCustomer) => c.calls.filter(isOpenCall)
    .map((x) => `<span dir="ltr" style="${NOWRAP}">${esc(x.call ?? "")}</span>${x.product ? `<br><span dir="ltr">${esc(x.product)}</span>` : ""}` +
      (x.call_status ? `<br><span style="${MUTED}">${esc(x.call_status)}</span>` : "")).join("<br><br>");
  const tries = (c: FailedCustomer) => `${c.attempts === 1 ? "ניסיון אחד" : `${c.attempts} ניסיונות`}, אחרון ${esc(dayDate(c.last_at))}` +
    (c.ever_delivered ? "" : ". אף הודעה לא הגיעה אליו");
  const row = (c: FailedCustomer, withCall: boolean) => `<tr>
      <td style="${TD}">${esc(c.name ?? "ללא שם")}<br><span dir="ltr" style="${NOWRAP}">${esc(localPhone(c.phone))}</span></td>
      ${withCall ? `<td style="${TD}">${callCell(c)}</td>` : ""}
      <td style="${TD}">${esc(kindsText(c))}<br><span style="${MUTED}">${tries(c)}</span></td>
    </tr>`;
  const head = (withCall: boolean) => `<tr>
      <th style="${TH}">לקוח</th>${withCall ? `<th style="${TH}">קריאה</th>` : ""}<th style="${TH}">מה לא הגיע</th></tr>`;

  const intro = r.customers.length === 0
    ? `<p style="${P}">בשבוע ${range} כל ההודעות האוטומטיות הגיעו ללקוחות. אין מה לעשות השבוע.</p>`
    : `<p style="${P}">אלה הלקוחות שבשבוע ${range} לא הצלחנו לשלוח אליהם הודעת וואטסאפ. כמעט תמיד הסיבה היא שהמספר שרשום בפריוריטי
       אינו מחובר לוואטסאפ, למשל טלפון כשר. ההודעה לא הגיעה ללקוח, והמערכת לא יכולה לעשות עם זה יותר.
       הפעולה המומלצת: להתקשר ללקוח, ואם יש בן משפחה עם וואטסאפ, להוסיף את המספר שלו כטלפון נוסף בכרטיס הלקוח בפריוריטי.</p>`;

  const blockingHtml = blocking.length ? `
    <h2 style="${H2}">קודם כל: ${blocking.length} קריאות שירות שמחכות לתמונה</h2>
    <p style="${P}">הלקוח לא קיבל את בקשת התמונה, ולכן הקריאה לא תתקדם עד שמישהו יתקשר אליו.</p>
    <table style="${TABLE}">${head(true)}${blocking.map((c) => row(c, true)).join("")}</table>` : "";
  const othersHtml = others.length ? `
    <h2 style="${H2}">${blocking.length ? "שאר הלקוחות" : "הלקוחות"} (${others.length})</h2>
    <p style="${P}">כדאי לעדכן מספר עם וואטסאפ, כדי שבפעם הבאה התזכורות וההודעות יגיעו.</p>
    <table style="${TABLE}">${head(false)}${others.map((c) => row(c, false)).join("")}</table>` : "";
  const foot = [
    r.survey_only === 1 ? "לקוח אחד נוסף לא קיבל רק את סקר שביעות הרצון, ולכן אינו מופיע כאן." :
      r.survey_only ? `${r.survey_only} לקוחות נוספים לא קיבלו רק את סקר שביעות הרצון, ולכן אינם מופיעים כאן.` : "",
    r.technical === 1 ? "הודעה אחת נכשלה מסיבה טכנית אצלנו. עוגן סולושנס מטפלת בה ואין צורך לעשות דבר." :
      r.technical ? `${r.technical} הודעות נכשלו מסיבה טכנית אצלנו. עוגן סולושנס מטפלת בהן ואין צורך לעשות דבר.` : "",
  ].filter(Boolean).map((s) => `<p style="${SMALL}">${esc(s)}</p>`).join("");

  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;color:#1d2433">
<div dir="rtl" style="max-width:760px;margin:0 auto;padding:24px 16px;text-align:right">
  <h1 style="font-size:20px;margin:0 0 12px">לקוחות שלא הגיעה אליהם הודעת וואטסאפ</h1>
  ${intro}${blockingHtml}${othersHtml}${foot}
  <p style="${SMALL}">הדוח נשלח אוטומטית מהמערכת של ר.שעל בכל יום ראשון בבוקר, על השבוע הקודם.</p>
</div></body></html>`;

  const text = [
    subject, "",
    ...blocking.map((c) => `קריאה שמחכה לתמונה: ${c.name ?? ""} ${localPhone(c.phone)} ${c.calls.filter(isOpenCall).map((x) => x.call).join(", ")}`),
    ...others.map((c) => `${c.name ?? ""} ${localPhone(c.phone)}: ${kindsText(c)}`),
  ].join("\n");
  return { subject, html, text, blocking: blocking.length };
}

export function addDays(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** השבוע הקודם בשעון ישראל: ראשון עד ראשון (לא כולל). מקבל את התאריך של היום בישראל. */
export function previousWeek(todayIso: string): { from: string; to: string } {
  const dow = new Date(`${todayIso}T12:00:00Z`).getUTCDay(); // 0 = ראשון
  const thisSunday = addDays(todayIso, -dow);
  return { from: addDays(thisSunday, -7), to: thisSunday };
}

const TABLE = "border-collapse:collapse;width:100%;background:#fff;font-size:14px;margin:8px 0 20px";
const TH = "background:#1f3a5f;color:#fff;padding:8px;text-align:right;font-weight:600";
const TD = "border-bottom:1px solid #e3e7ee;padding:8px;text-align:right;vertical-align:top";
const H2 = "font-size:16px;margin:20px 0 4px";
const P = "font-size:14px;line-height:1.6;margin:0 0 8px";
const NOWRAP = "white-space:nowrap";
const MUTED = "color:#6b7486;font-size:13px";
const SMALL ="font-size:12px;color:#5b6474;margin:6px 0";
