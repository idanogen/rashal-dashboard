// הדוחות גם במייל (שלומי, 18/11/2026): "לשלוח רק למיילים tikon, logistics, info, כל השאר
// להשאיר בוואטסאפ". אותם מספרים כמו בהודעת הוואטסאפ, אותו קישור לדוח המלא.
// קובץ בלי ייבוא, כדי שייבדק ביחידה (test/morning-report-mail.test.mjs).

export interface Mail { subject: string; html: string; text: string }

const BASE = "https://rashal-dashboard.vercel.app";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function wrap(title: string, rows: [string, string][], note: string | null, link: string): string {
  const tr = rows.map(([k, v]) =>
    `<tr><td style="padding:6px 0;color:#5b6576">${esc(k)}</td><td style="padding:6px 0 6px 12px;font-weight:700;text-align:left"><bdi>${esc(v)}</bdi></td></tr>`
  ).join("");
  return `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1a2332;font-size:15px;line-height:1.6;text-align:right">` +
    `<div style="max-width:560px;border:1px solid #e3e7ee;border-radius:10px;padding:18px 20px">` +
    `<div style="font-size:17px;font-weight:700;margin-bottom:10px">${esc(title)}</div>` +
    `<table style="border-collapse:collapse;width:100%">${tr}</table>` +
    (note ? `<p style="margin:14px 0 0;color:#3b4556">${esc(note)}</p>` : "") +
    `<p style="margin:16px 0 0"><a href="${link}" style="background:#1f6f43;color:#fff;text-decoration:none;padding:8px 14px;border-radius:6px;display:inline-block">לדוח המלא</a></p>` +
    `</div><div style="color:#8a96a8;font-size:12px;margin-top:10px">נשלח אוטומטית ממערכת ר.שעל</div></div>`;
}

export function deliveryMail(
  slot: "morning" | "evening", dayLabel: string, date: string,
  t: { planned: number; delivered: number; not_delivered: number; follow_up?: number; open: number }, rate: string,
): Mail {
  const title = `דוח אספקות ר.שעל, ${dayLabel}`;
  const rows: [string, string][] = [
    ["שובצו לנהגים ולטכנאים", String(t.planned)],
    ["סופקו ונסגרו כבוצע", String(t.delivered)],
    ["לא סופקו עם סיבה מהשטח", String(t.not_delivered)],
    ...((t.follow_up ?? 0) > 0 ? [["להמשך טיפול אחרי ביקור", String(t.follow_up)] as [string, string]] : []),
    ["עדיין פתוחות בלי דיווח", String(t.open)],
    ["אחוז אספקה מתוך מה שדווח", rate],
  ];
  const note = slot === "evening"
    ? "מה לא סופק, אצל מי ומה הסיבה מפורט בדוח המלא, כדי שאפשר יהיה להתייחס לזה כבר בתכנון של מחר."
    : "הפירוט לפי נהג וטכנאי והסיבות מפורטים בדוח המלא.";
  const link = `${BASE}/morning/${date}`;
  return {
    subject: title,
    html: wrap(title, rows, note, link),
    text: `${title}\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n${note}\nלדוח המלא: ${link}`,
  };
}

export function remindersMail(dayLabel: string, date: string, sent: number, replied: number, noReply: number, replies: string): Mail {
  const title = `דוח תזכורות ללקוחות, ${dayLabel}`;
  const rows: [string, string][] = [["נשלחו אמש", String(sent)], ["ענו", String(replied)], ["לא ענו", String(noReply)]];
  const note = replied > 0 ? `מה ענו: ${replies}` : null;
  const link = `${BASE}/morning/${date}`;
  return {
    subject: title,
    html: wrap(title, rows, note, link),
    text: `${title}\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}${note ? `\n${note}` : ""}\nלדוח המלא: ${link}`,
  };
}
