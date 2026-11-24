// רינדור המייל השבועי "תעודות שסופקו ועדיין לא נסגרו" (24/11/2026, עידן).
// המוקאפ שאושר: ~/Idan-HQ/meetings/rashal/2026-11-24-מוקאפ-מייל-תעודות-סופק.html
// 🔴 קובץ טהור בלי ייבוא, נבדק ב-node (`test/dn-report-render.test.mjs`). HTML של מייל:
//    טבלאות וסגנון מוטמע בלבד, כי Gmail ו-Outlook מתעלמים מ-<style> ומ-flex.

export interface DnRow {
  docno: string;
  customer_name: string | null;
  city: string | null;
  fund: string | null;
  order_no: string | null;
  delivered_at: string | null;
  driver: string | null;
  days: number;
  total: number | null;
}

export interface DnReportOptions {
  /** תאריך הדוח בשעון ישראל, YYYY-MM-DD */
  date: string;
  minDays: number;
  showAmounts: boolean;
}

const NAVY = "#14223a";
const GOLD = "#b8893b";

const esc = (s: string | null | undefined) =>
  (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const money = (n: number) => "₪" + Math.round(n).toLocaleString("en-US");

/** שם קופה קצר: "מכבי שירותי בריאות" → מכבי, "כללית הנדסה רפואית בעמ" → כללית. */
export function fundLabel(f: string | null | undefined): string {
  const v = (f ?? "").trim();
  if (!v) return "ללא קופה";
  for (const k of ["מכבי", "כללית", "לאומית", "מאוחדת"]) if (v.includes(k)) return k;
  return v;
}

const ddmm = (iso: string | null) => {
  if (!iso) return "";
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit" }).formatToParts(new Date(iso));
  return `${p.find((x) => x.type === "day")?.value}/${p.find((x) => x.type === "month")?.value}`;
};

function ageStyle(d: number): string {
  if (d >= 21) return "background:#fdecec;color:#a11d1d";
  if (d >= 14) return "background:#fff4e0;color:#8a5300";
  return "background:#eef2f7;color:#334155";
}

export function renderDnReport(rowsIn: DnRow[], o: DnReportOptions) {
  const rows = [...rowsIn].sort((a, b) => b.days - a.days);
  const total = rows.reduce((s, r) => s + Number(r.total ?? 0), 0);
  const [y, m, d] = o.date.split("-");
  const dateLabel = `${d}/${m}/${y}`;
  const subject = rows.length
    ? `ר.שעל · ${rows.length} תעודות בסטטוס סופק מעל ${o.minDays} ימים`
    : `ר.שעל · אין תעודות בסטטוס סופק מעל ${o.minDays} ימים`;

  const funds = new Map<string, { n: number; sum: number }>();
  for (const r of rows) {
    const f = funds.get(fundLabel(r.fund)) ?? { n: 0, sum: 0 };
    f.n++; f.sum += Number(r.total ?? 0);
    funds.set(fundLabel(r.fund), f);
  }
  const buckets: [string, number, string][] = [
    ["3 שבועות ומעלה", rows.filter((r) => r.days >= 21).length, "#a11d1d"],
    ["שבועיים עד 3", rows.filter((r) => r.days >= 14 && r.days < 21).length, "#8a5300"],
    ["שבוע עד שבועיים", rows.filter((r) => r.days < 14).length, "#334155"],
  ];

  const cell = "padding:9px 6px;border-bottom:1px solid #e5e9f0";
  const th = "padding:8px 6px;font-size:12px;color:#475569;font-weight:normal";
  const amountTh = o.showAmounts ? `<th style="${th};text-align:left">סכום</th>` : "";
  const trs = rows.map((r, i) => {
    const amount = o.showAmounts
      ? `<td style="${cell};font-size:13px;color:#0f172a;text-align:left" dir="ltr">${money(Number(r.total ?? 0))}</td>` : "";
    return `<tr style="background:${i % 2 ? "#f8fafc" : "#ffffff"}">` +
      `<td style="${cell};font-family:Menlo,Consolas,monospace;font-size:13px;color:#1d4ed8" dir="ltr">${esc(r.docno)}</td>` +
      `<td style="${cell};font-size:14px;color:#0f172a"><b>${esc(r.customer_name)}</b><br>` +
      `<span style="font-size:12px;color:#64748b">${esc([r.city, fundLabel(r.fund)].filter(Boolean).join(" · "))}</span></td>` +
      `<td style="${cell};font-size:13px;color:#334155">${ddmm(r.delivered_at)}<br>` +
      `<span style="font-size:12px;color:#64748b">${esc(r.driver)}</span></td>` +
      `<td style="${cell};text-align:center"><span style="display:inline-block;padding:3px 9px;border-radius:10px;` +
      `font-size:13px;font-weight:bold;${ageStyle(r.days)}">${r.days} ימים</span></td>${amount}</tr>`;
  }).join("");

  const bucketCells = buckets.map(([t, n, c], j) =>
    `<td style="padding:10px 12px;background:#f8fafc;border-radius:8px;text-align:center;width:33%">` +
    `<div style="font-size:22px;font-weight:bold;color:${c}">${n}</div><div style="font-size:12px;color:#64748b">${t}</div></td>` +
    (j < 2 ? '<td style="width:8px"></td>' : "")).join("");

  const fundRows = [...funds.entries()].sort((a, b) => b[1].sum - a[1].sum || b[1].n - a[1].n).map(([k, v]) =>
    `<tr><td style="padding:6px 0;font-size:14px;color:#1e293b">${esc(k)}</td>` +
    `<td style="padding:6px 0;font-size:14px;color:#1e293b;text-align:center">${v.n}</td>` +
    (o.showAmounts ? `<td style="padding:6px 0;font-size:14px;color:#1e293b;text-align:left" dir="ltr">${money(v.sum)}</td>` : "") +
    `</tr>`).join("");

  const section = (title: string) =>
    `<div style="font-size:15px;font-weight:bold;color:${NAVY};border-bottom:2px solid ${GOLD};padding-bottom:6px">${title}</div>`;

  const totalCell = o.showAmounts
    ? `<td style="vertical-align:top;text-align:left"><div style="font-size:28px;font-weight:bold;color:${NAVY};line-height:1.2" ` +
      `dir="ltr">${money(total)}</div><div style="font-size:14px;color:#475569;margin-top:4px">סה"כ לפני מע"מ</div></td>`
    : "";

  const body = rows.length ? `
<tr><td style="padding:22px 26px 6px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
  <td style="vertical-align:top"><div style="font-size:40px;font-weight:bold;color:${NAVY};line-height:1">${rows.length}</div>
  <div style="font-size:14px;color:#475569;margin-top:4px">תעודות ממתינות לסגירה</div></td>${totalCell}
</tr></table></td></tr>
<tr><td style="padding:14px 26px 4px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${bucketCells}</tr></table></td></tr>
<tr><td style="padding:18px 26px 4px">${section("לפי קופה")}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr><td style="font-size:12px;color:#64748b;padding:6px 0 4px">קופה</td><td style="font-size:12px;color:#64748b;text-align:center">תעודות</td>
  ${o.showAmounts ? '<td style="font-size:12px;color:#64748b;text-align:left">סכום</td>' : ""}</tr>${fundRows}</table>
</td></tr>
<tr><td style="padding:18px 26px 4px">${section("כל התעודות, הוותיקה ראשונה")}</td></tr>
<tr><td style="padding:0 8px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
  <tr style="background:#f1f5f9"><th style="${th};text-align:right">תעודה</th><th style="${th};text-align:right">לקוח</th>
  <th style="${th};text-align:right">סופק</th><th style="${th};text-align:center">ממתינה</th>${amountTh}</tr>${trs}</table></td></tr>`
    : `<tr><td style="padding:28px 26px;font-size:16px;color:#166534">אין השבוע תעודות שנמצאות בסטטוס "סופק" יותר מ-${o.minDays} ימים.</td></tr>`;

  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>תעודות שסופקו ועדיין לא נסגרו</title></head>
<body style="margin:0;padding:0;background:#e9edf2;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e9edf2"><tr><td align="center" style="padding:16px 4px">
<table role="presentation" width="680" cellpadding="0" cellspacing="0" style="max-width:680px;width:100%;background:#ffffff;border-radius:10px" dir="rtl">
<tr><td style="background:${NAVY};padding:22px 26px;border-radius:10px 10px 0 0">
  <div style="font-size:12px;color:${GOLD};letter-spacing:1px">ר.שעל · דוח שבועי · יום חמישי ${dateLabel}</div>
  <div style="font-size:22px;font-weight:bold;color:#ffffff;margin-top:6px">תעודות שסופקו ועדיין לא נסגרו</div>
  <div style="font-size:14px;color:#cbd5e1;margin-top:6px">תעודות משלוח בסטטוס "סופק" יותר מ-${o.minDays} ימים</div>
</td></tr>${body}
<tr><td style="padding:16px 26px 24px;font-size:12px;line-height:1.6;color:#64748b;border-top:1px solid #e5e9f0">
  "סופק" נקבע אוטומטית כשהנהג סימן "בוצע" על האספקה באפליקציה. הימים נספרים מאותו רגע.
  תעודה יוצאת מהרשימה כשמשנים לה סטטוס בפריוריטי (סופית, מבוטלת וכו').<br>
  נשלח כל יום חמישי ב-07:30 · מערכת התפעול של ר.שעל
</td></tr></table></td></tr></table></body></html>`;

  const text = rows.length
    ? `${rows.length} תעודות בסטטוס סופק מעל ${o.minDays} ימים:\n` +
      rows.map((r) => `${r.docno} · ${r.customer_name ?? ""} · ${r.days} ימים`).join("\n")
    : `אין תעודות בסטטוס סופק מעל ${o.minDays} ימים.`;
  return { subject, html, text, count: rows.length, total };
}
