import { INK, PEN, cell, esc, line, page, signatureLine, stamp } from './common.ts';

/**
 * תבנית ה-PDF של אישור קבלת ההדרכה למנוף (25/10/2026).
 *
 * עמי שאל "איפה אני רואה את הטפסים האלה": עד היום הטופס נשמר רק כשורה
 * בטבלה, בלי PDF ובלי צירוף לפריוריטי. מהיום הוא מקבל PDF כמו טפסי
 * הקופות, ונכנס לכרטיס הלקוח באותו צינור בדיוק.
 *
 * ⭐ הנושאים, הכותרת והשער אינם מיובאים מ-`crane-training.ts` אלא מגיעים
 * כקלט: הקובץ הזה מועתק לאפליקציית הנהג על ידי `sync-forms.mjs`, ושם
 * `crane-training.ts` יושב בתיקייה אחרת. ייבוא יחסי מחוץ לתיקיית הטפסים
 * היה נשבר בהעתקה. הקוראים (הדיאלוג בווב, מסך החתימה באפליקציה) כבר
 * מחזיקים את שניהם.
 */

export interface CraneTrainingPdfInput {
  title: string;
  subtitle: string;
  topics: { id: string; text: string }[];
  answers: Record<string, boolean>;
  customerName: string;
  customerNumber?: string | null;
  craneModel?: string | null;
  craneSerial?: string | null;
  recipientName: string;
  recipientIdNumber?: string;
  recipientRelation?: string;
  notes?: string;
  sling?: { manufacturer?: string; productionDate?: string; serial?: string };
  signature: string | null;
  meta: { signedAt: Date; driverName: string; location?: { lat: number; lng: number } | null };
}

export function craneTrainingLayout(i: CraneTrainingPdfInput): string {
  const d = i.meta.signedAt;
  const two = (n: number) => String(n).padStart(2, '0');
  const date = `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}`;
  const mark = (on: boolean) =>
    `<span style="display:inline-flex;align-items:center;justify-content:center;flex:none;` +
    `width:13px;height:13px;margin-top:2px;border:1px solid ${INK};font-size:11px;` +
    `line-height:1;color:${PEN};font-weight:700">${on ? '✕' : ''}</span>`;
  const topics = i.topics
    .map((t) => `<div style="display:flex;align-items:flex-start;gap:7px;padding:5px 0;border-bottom:1px solid #e3e3e3">
      ${mark(!!i.answers[t.id])}
      <span style="font-size:12px;line-height:1.5">${esc(t.text)}</span>
    </div>`)
    .join('');
  const s = i.sling;
  const sling = s && (s.manufacturer || s.productionDate || s.serial)
    ? `<div style="font-size:13.5px;font-weight:700;margin:18px 0 6px">פרטי הערסל שסופק</div>
       <table style="width:100%;border-collapse:collapse;table-layout:fixed">
         <tr>${cell('יצרן', s.manufacturer ?? '')}${cell('תאריך ייצור', s.productionDate ?? '')}
             ${cell('מספר סידורי', s.serial ?? '')}</tr>
       </table>`
    : '';
  const notes = i.notes?.trim()
    ? `<div style="font-size:12px;margin-top:12px"><b>הערות:</b> ` +
      `<span style="color:${PEN};font-weight:600">${esc(i.notes)}</span></div>`
    : '';
  return page(`
    <div style="text-align:center;border-bottom:2px solid ${INK};padding-bottom:10px;margin-bottom:14px">
      <div style="font-size:17px;font-weight:800;text-decoration:underline">${esc(i.title)}</div>
      <div style="font-size:12px;margin-top:4px">${esc(i.subtitle)}</div>
    </div>

    <table style="width:100%;border-collapse:collapse;table-layout:fixed">
      <tr>${cell('שם הלקוח', i.customerName)}${cell('מספר לקוח', i.customerNumber ?? '')}
          ${cell('תאריך', date)}</tr>
      <tr>${cell('דגם המנוף', i.craneModel ?? '')}${cell('מספר סידורי של המנוף', i.craneSerial ?? '')}
          ${cell('שם המדריך', i.meta.driverName)}</tr>
    </table>

    <div style="font-size:13.5px;font-weight:700;margin:18px 0 4px">נושאי ההדרכה שהועברו</div>
    <div style="border:1px solid ${INK};padding:4px 10px">${topics}</div>
    ${sling}
    ${notes}

    <div style="font-size:12.5px;margin-top:22px;line-height:1.6">
      אני החתום/ה מטה מאשר/ת שקיבלתי הדרכה מלאה על כל הנושאים המסומנים מעלה, וכן מדריך למשתמש.
    </div>
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;margin-top:14px">
      <tr>${cell('שם מקבל/ת ההדרכה', i.recipientName)}${cell('תעודת זהות', i.recipientIdNumber ?? '')}
          ${cell('קרבה למטופל/ת', i.recipientRelation ?? '')}</tr>
    </table>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:28px;font-weight:700">
      ${line('<b style="font-size:14px">שם החותם/ת</b>', i.recipientName, 200)}
      ${signatureLine('<b style="font-size:14px">חתימה</b> <b style="font-size:20px">X</b>', i.signature, 220)}
    </div>
    ${stamp(i.meta)}
  `);
}
