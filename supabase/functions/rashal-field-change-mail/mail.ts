/**
 * המייל על שינוי טלפון/כתובת מהשטח (28/10/2026). קובץ טהור בלי ייבוא, נבדק
 * ב-`test/field-change-mail.test.mjs`.
 *
 * עידן: על כל שינוי כזה, חד פעמי או קבוע, מייל מעוצב HTML לעמי, שלומי,
 * שורה ואילונה. המייל אומר מי שינה, מה היה ומה עכשיו, אם זה רק לביקור הזה
 * או קבוע, ומה נוסף בפריוריטי (לעולם לא נמחק שם כלום).
 */

export interface FieldChangeRow {
  id: string;
  customer_number: string | null;
  customer_name: string;
  source_type: string;
  delivery_date: string;
  driver: string | null;
  doc_number: string | null;
  changed_by_name: string;
  changed_by_role: 'driver' | 'office' | string;
  scope: 'once' | 'permanent' | string;
  old_address: string | null; new_address: string | null;
  old_city: string | null; new_city: string | null;
  old_phone: string | null; new_phone: string | null;
  other_stops_updated: number | null;
  priority_contact_added: boolean | null;
  priority_event_id: string | null;
  created_at: string;
}

export interface FieldChangeMail {
  subject: string;
  html: string;
  text: string;
}

const SOURCE_LABEL: Record<string, string> = {
  delivery: 'אספקה', service: 'קריאת שירות', pickup: 'איסוף', task: 'משימה', customer: 'לקוח חדש', inspection: 'בדיקה',
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function show(v: string | null | undefined): string {
  const t = (v ?? '').trim();
  return t ? t : 'ריק';
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function fmtTime(iso: string): string {
  // שעון ישראל, בלי תלות באזור הזמן של השרת.
  const fmt = new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit',
  });
  const parts = fmt.formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('day')}/${get('month')} ${get('hour')}:${get('minute')}`;
}

/** השורות שהשתנו, לפי סדר קבוע: כתובת, עיר, טלפון. */
export function changedRows(row: FieldChangeRow): { label: string; before: string; after: string }[] {
  const out: { label: string; before: string; after: string }[] = [];
  if (row.new_address != null) {
    out.push({ label: 'כתובת לניווט', before: show(row.old_address), after: show(row.new_address) });
  }
  if (row.new_city != null) out.push({ label: 'עיר', before: show(row.old_city), after: show(row.new_city) });
  // 28/10 ערב: טלפון = הוספה. "היה" הוא הנוסף הקודם (אם היה); הראשי לא נדרס ולכן לא מופיע כמחוק.
  if (row.new_phone != null) {
    const hadExtra = (row.old_phone ?? '').trim() !== '';
    out.push({ label: 'טלפון נוסף', before: hadExtra ? show(row.old_phone) : 'לא היה', after: show(row.new_phone) });
  }
  return out;
}

/** מה נוסף בפריוריטי, במילים של המשרד. */
export function priorityLines(row: FieldChangeRow): string[] {
  if (row.scope !== 'permanent') return ['בפריוריטי לא השתנה כלום (שינוי חד פעמי, רק לביקור הזה).'];
  if (!row.customer_number) return ['לעצירה אין מספר לקוח, ולכן לא נכתב כלום לפריוריטי. נא לעדכן ביד.'];
  const lines: string[] = [];
  if (row.priority_contact_added) lines.push('הנייד החדש נוסף לכרטיס הלקוח כאיש קשר (הטלפון הראשי בכרטיס לא השתנה).');
  if (row.priority_event_id) lines.push('השינוי נרשם כשורה בדו-שיח הפנימי של כרטיס הלקוח.');
  lines.push('הכתובת והטלפון בכרטיס עצמו לא שונו: לפי הכלל, במערכת רק מוסיפים ולא דורסים. '
    + 'גם אצלנו: הטלפון הראשי נשאר והכתובת המקורית נשמרת. אם זה קבוע, נא לעדכן את הכרטיס בפריוריטי.');
  return lines;
}

const TD = 'padding:10px 12px;border-bottom:1px solid #e6ebf2;';
const TH = 'text-align:start;padding:8px 12px;color:#5d6b82;font-weight:600';

function tableHtml(rows: { label: string; before: string; after: string }[]): string {
  const trs = rows.map((r) =>
    `<tr><td style="${TD}color:#5d6b82;white-space:nowrap">${escapeHtml(r.label)}</td>` +
    `<td style="${TD}color:#8a96a8;text-decoration:line-through">${escapeHtml(r.before)}</td>` +
    `<td style="${TD}color:#14223a;font-weight:700">${escapeHtml(r.after)}</td></tr>`).join('');
  return `<table style="border-collapse:collapse;width:100%;font-size:15px;border:1px solid #e6ebf2;border-radius:8px">` +
    `<thead><tr style="background:#f6f8fb"><th style="${TH}">שדה</th><th style="${TH}">היה</th><th style="${TH}">עכשיו</th></tr></thead>` +
    `<tbody>${trs}</tbody></table>`;
}

function headerHtml(row: FieldChangeRow): string {
  const num = row.customer_number
    ? ` <span style="font-weight:400;color:#c9d2e3;font-size:14px">(${escapeHtml(row.customer_number)})</span>` : '';
  return `<div style="background:#14223a;color:#fff;padding:16px 20px">` +
    `<div style="font-size:12px;letter-spacing:.3px;color:#c9d2e3">ר.שעל · עדכון פרטי לקוח מהשטח</div>` +
    `<div style="font-size:20px;font-weight:700;margin-top:4px">${escapeHtml(row.customer_name)}${num}</div></div>`;
}

export function buildFieldChangeEmail(row: FieldChangeRow, opts: { dashboardUrl: string }): FieldChangeMail {
  const rows = changedRows(row);
  const what = rows.map((r) => r.label).join(' ו');
  const permanent = row.scope === 'permanent';
  const scopeLabel = permanent ? 'קבוע' : 'חד פעמי';
  const who = `${row.changed_by_name} (${row.changed_by_role === 'driver' ? 'מהשטח, באפליקציה' : 'מהמשרד'})`;
  const source = SOURCE_LABEL[row.source_type] ?? row.source_type;
  const doc = row.doc_number ? ` ${row.doc_number}` : '';
  const visit = `${source}${doc} · ${fmtDate(row.delivery_date)}${row.driver ? ` · ${row.driver}` : ''}`;
  const subject = `${scopeLabel} · ${what} של ${row.customer_name} עודכן${rows.length > 1 ? 'ו' : ''} ע"י ${row.changed_by_name}`;

  const scopeColor = permanent ? '#b45309' : '#1d4ed8';
  const scopeBg = permanent ? '#fef3c7' : '#dbeafe';
  const pLines = priorityLines(row).map((l) => `<li style="margin:0 0 4px">${escapeHtml(l)}</li>`).join('');
  const others = (row.other_stops_updated ?? 0) > 0
    ? `<p style="margin:10px 0 0;color:#5d6b82">עודכנו גם ${row.other_stops_updated} ביקורים פתוחים נוספים של הלקוח.</p>` : '';
  const chip = `<span style="display:inline-block;background:${scopeBg};color:${scopeColor};font-weight:700;` +
    `border-radius:999px;padding:3px 12px;font-size:13px">${scopeLabel}${permanent ? ' ללקוח' : ', רק לביקור הזה'}</span>`;
  const priorityBox = `<div style="margin-top:16px;border-inline-start:4px solid ${scopeColor};background:#fafbfd;` +
    `border-radius:8px;padding:10px 14px"><div style="font-weight:700;margin-bottom:4px">בפריוריטי</div>` +
    `<ul style="margin:0;padding-inline-start:18px">${pLines}</ul></div>`;
  const footer = `<div style="background:#f6f8fb;color:#8a96a8;font-size:12px;padding:10px 20px;border-top:1px solid #e3e8f0">` +
    `נשלח אוטומטית ממערכת ר.שעל על כל שינוי טלפון או כתובת. הנמענים מנוהלים במערכת.</div>`;

  const html =
    `<div dir="rtl" style="font-family:Heebo,Arial,sans-serif;color:#1a2332;font-size:15px;line-height:1.6;` +
    `background:#f3f5f9;padding:24px 12px">` +
    `<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e3e8f0">` +
    headerHtml(row) +
    `<div style="padding:18px 20px">${chip}` +
    `<p style="margin:12px 0 4px"><b>מי:</b> ${escapeHtml(who)}</p>` +
    `<p style="margin:0 0 4px"><b>ביקור:</b> ${escapeHtml(visit)}</p>` +
    `<p style="margin:0 0 14px;color:#5d6b82">נרשם ${fmtTime(row.created_at)}</p>` +
    tableHtml(rows) + others + priorityBox +
    `<p style="margin:18px 0 0"><a href="${escapeHtml(opts.dashboardUrl)}" style="color:#1d4ed8">לפתוח את הסדרן</a></p>` +
    `</div>${footer}</div></div>`;

  const text = [
    `${scopeLabel}: ${what} של ${row.customer_name}${row.customer_number ? ` (${row.customer_number})` : ''} עודכן ע"י ${who}.`,
    `ביקור: ${visit}.`,
    ...rows.map((r) => `${r.label}: ${r.before} ← ${r.after}`),
    ...priorityLines(row),
  ].join('\n');

  return { subject, html, text };
}

/** רשימת הנמענים מההגדרות: כתובות תקינות, בלי כפילויות, קטנות. */
export function recipientEmails(recipients: unknown): string[] {
  if (!Array.isArray(recipients)) return [];
  const seen = new Set<string>();
  for (const r of recipients) {
    const e = String((r as { email?: unknown })?.email ?? '').trim().toLowerCase();
    if (/^[^\s@,;<>"']+@[^\s@,;<>"']+\.[^\s@,;<>"'.]{2,}$/.test(e)) seen.add(e);
  }
  return [...seen];
}
