import { INK, PEN, box, esc, line, page, signatureLine, stamp } from './common.ts';

/**
 * תבנית ה-PDF של רשימת בדיקה לטכנאי (10/11/2026, כיסא ממונע).
 *
 * שלומי, 03/11/2026: "הרשימה הזאת תצורף לכל קריאת שירות". לכן הרשימה לא
 * נשמרת רק כשורה ב-`crane_forms`: היא הופכת ל-PDF שנכנס לקריאה בפריוריטי
 * (`attach_crane_form_pdf`), באותו מבנה כמו טופס הנייר: כותרת, תאריך, מספר
 * סידורי ולקוח, הפרקים עם תיבות הסימון, סיכום, הערות וחתימות.
 *
 * ⭐ הרשימה עצמה מגיעה כקלט ולא בייבוא: הקובץ מועתק לאפליקציה
 * (`sync-forms.mjs`), ושם קבצי הרשימות יושבים בתיקייה אחרת.
 */

export interface ChecklistPdfInput {
  title: string;
  subtitle: string;
  sections: { title: string; items: { id: string; text: string; critical?: boolean }[] }[];
  answers: Record<string, boolean>;
  /** הסיכום: כל האפשרויות לפי הסדר בטופס, והמפתח שנבחר. */
  verdicts: { key: string; label: string }[];
  verdict: string | null;
  notes: string;
  customerName: string;
  customerNumber?: string | null;
  deviceModel?: string | null;
  deviceSerial?: string | null;
  docNumber?: string | null;
  recipientName: string;
  signature: string | null;
  meta: { signedAt: Date; driverName: string; location?: { lat: number; lng: number } | null };
}

const two = (n: number) => String(n).padStart(2, '0');

function row(item: { text: string; critical?: boolean }, checked: boolean): string {
  const mark = `<span style="flex:none;display:inline-flex;align-items:center;justify-content:center;width:13px;height:13px;` +
    `margin-top:3px;border:1px solid ${INK};font-size:11px;line-height:1;color:${PEN};font-weight:700">${checked ? '✕' : ''}</span>`;
  const style = item.critical ? 'color:#b91c1c;font-weight:700' : '';
  return `<div style="display:flex;gap:8px;padding:4px 0;font-size:13px;line-height:1.5">${mark}` +
    `<span style="${style}">${esc(item.text)}</span></div>`;
}

function heading(title: string): string {
  return `<div style="font-size:13.5px;font-weight:700;color:#1f3a68;border-bottom:1.5px solid #1f3a68;` +
    `margin:14px 0 4px;padding-bottom:3px">${esc(title)}</div>`;
}

export function checklistLayout(i: ChecklistPdfInput): string {
  const d = i.meta.signedAt;
  const date = `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}`;
  const customer = [i.customerName, i.customerNumber ? `מס' לקוח ${i.customerNumber}` : ''].filter(Boolean).join(' · ');
  const device = [i.deviceSerial, i.deviceModel].filter(Boolean).join(' · ');
  const gap = '<div style="height:9px"></div>';

  return page(`
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid ${INK};padding-bottom:8px">
      <div style="font-size:11px;line-height:1.45">
        <div style="font-size:19px;font-weight:800">ר.שעל <span style="font-size:13px;font-weight:600">שרותי עזר לנכים</span></div>
        <div>אזור התעשייה החדש, רח' משה שרת 15, ראשון לציון</div>
      </div>
      ${i.docNumber ? `<div style="font-size:12px;padding-top:4px">קריאה ${esc(i.docNumber)}</div>` : ''}
    </div>

    <div style="text-align:center;font-size:17px;font-weight:800;text-decoration:underline;margin-top:12px">${esc(i.title)}</div>
    <div style="text-align:center;font-size:11px;margin-top:3px">"${esc(i.subtitle)}"</div>

    <div style="margin-top:14px">${line('תאריך:', date, 110)}</div>${gap}
    <div>${line("מס' סידורי:", device, 260)}</div>${gap}
    <div>${line('לקוח / מיקום:', customer, 320)}</div>

    ${i.sections.map((s) => heading(s.title) + s.items.map((it) => row(it, !!i.answers[it.id])).join('')).join('')}

    ${heading('סיכום')}
    <div style="padding:6px 0;font-weight:700">${i.verdicts.map((v) => box(i.verdict === v.key, esc(v.label))).join('')}</div>

    <div style="margin-top:12px;font-size:11.5px">הערות:</div>
    <div style="min-height:34px;border-bottom:1px dotted ${INK};font-size:13px;color:${PEN};font-weight:600;` +
      `line-height:1.5;white-space:pre-wrap;padding:2px 4px">${esc(i.notes) || '&nbsp;'}</div>

    <div style="margin-top:18px">${line('שם הטכנאי המבצע:', i.meta.driverName, 220)}</div>
    <div style="margin-top:16px;display:flex;flex-wrap:wrap;gap:14px 22px;align-items:flex-end">
      ${line('שם מקבל/ת השרות ו/או ההדרכה (משתמש/מטפל/ת):', i.recipientName, 170)}
      ${signatureLine('חתימה:', i.signature, 190)}
    </div>

    ${stamp(i.meta)}
  `);
}

/** שם הקובץ כפי שיופיע בפריוריטי: בעברית, בלי תווים אסורים. */
export function checklistFileDes(label: string, customerName: string, serial: string | null | undefined, signedAt: Date): string {
  const date = `${two(signedAt.getDate())}-${two(signedAt.getMonth() + 1)}-${signedAt.getFullYear()}`;
  return [label, serial, customerName, date].filter(Boolean).join(' - ').replace(/[/\\?%*:|"<>]/g, '');
}
