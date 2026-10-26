import { INK, PEN, cell, esc, page, stamp, thickenSignature } from './common.ts';

/**
 * תבנית ה-PDF של אישור קבלת ההדרכה על מנוף חשמלי.
 *
 * ⭐⭐ גרסה 2 (26/10/2026): העתק של טופס הנייר של ר.שעל, באותו סדר ובאותו
 * נוסח: כותרת מכתב, תאריך, סעיפים 1 עד 3 כטקסט, וטבלאות 4, 5 ו-6. מתחת
 * לכותרת שורת זיהוי קטנה (לקוח ומנוף), שאינה בטופס המקורי ולכן אפורה.
 * 25/10 נולד ה-PDF כדי שהטופס ייכנס לכרטיס הלקוח בפריוריטי (עמי).
 *
 * ⭐ הנוסח, הכותרת והסעיפים מגיעים כקלט ולא בייבוא מ-`crane-training.ts`:
 * הקובץ הזה מועתק לאפליקציה ב-`sync-forms.mjs`, ושם `crane-training.ts`
 * יושב בתיקייה אחרת. ייבוא יחסי מחוץ לתיקיית הטפסים היה נשבר בהעתקה.
 */

interface Clause {
  mark: string;
  text: string;
  bold?: string;
  sub?: Clause[];
}

export interface CraneTrainingPdfInput {
  title: string;
  sections: { no: number; title: string; clauses: Clause[] }[];
  satisfaction: string;
  customerName: string;
  customerNumber?: string | null;
  craneModel?: string | null;
  craneSerial?: string | null;
  recipientName: string;
  recipientIdNumber: string;
  recipientRelation: string;
  sling: { manufacturer: string; productionDate: string; serial: string };
  signature: string | null;
  meta: { signedAt: Date; driverName: string; location?: { lat: number; lng: number } | null };
}

/** טקסט סעיף, עם הקטע המודגש כמו בטופס. */
function clauseText(c: Clause): string {
  const safe = esc(c.text);
  if (!c.bold || !c.text.includes(c.bold)) return safe;
  return safe.replace(esc(c.bold), `<b>${esc(c.bold)}</b>`);
}

function clauses(list: Clause[], indent: number): string {
  return list
    .map((c) => `<div style="display:flex;gap:8px;padding:2px 0;padding-inline-start:${indent}px;font-size:13px;line-height:1.55">
      <span style="flex:none;min-width:16px">${esc(c.mark)}.</span>
      <span>${clauseText(c)}</span>
    </div>${c.sub ? clauses(c.sub, indent + 26) : ''}`)
    .join('');
}

function heading(no: number, title: string): string {
  return `<div style="font-size:14px;font-weight:700;margin:14px 0 4px">${no}. ` +
    `<span style="text-decoration:underline">${esc(title)} :</span></div>`;
}

export function craneTrainingLayout(i: CraneTrainingPdfInput): string {
  const d = i.meta.signedAt;
  const two = (n: number) => String(n).padStart(2, '0');
  const date = `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}`;
  const ident = [
    i.customerName && `לקוח: ${i.customerName}`,
    i.customerNumber && `מס' לקוח ${i.customerNumber}`,
    i.craneModel && `מנוף ${i.craneModel}`,
    i.craneSerial && `מס' סידורי ${i.craneSerial}`,
  ].filter(Boolean).join(' · ');
  const sig = i.signature
    ? `<img src="${thickenSignature(i.signature)}" style="max-height:52px;max-width:100%;object-fit:contain" />`
    : '';
  const table = (heads: string[], cells: string) =>
    `<table style="width:100%;border-collapse:collapse;table-layout:fixed;margin-top:4px">
      <tr>${heads.map((h) => `<th style="border:1px solid ${INK};background:#f1f1f1;font-size:12px;padding:4px">${h}</th>`).join('')}</tr>
      <tr>${cells}</tr>
    </table>`;
  const v = (s: string) => cell('', s, { h: 44 });
  const lastNo = i.sections.length + 1;

  return page(`
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid ${INK};padding-bottom:8px">
      <div style="font-size:11px;line-height:1.45">
        <div style="font-size:19px;font-weight:800">ר.שעל <span style="font-size:13px;font-weight:600">שרותי עזר לנכים</span></div>
        <div>אזור התעשייה החדש, רח' משה שרת 15, ראשון לציון</div>
        <div>טל. 03-9611891 · פקס 03-9618837 · עוסק מורשה 512582965</div>
      </div>
      <div style="font-size:12px;padding-top:4px">בס"ד</div>
    </div>

    <div style="display:flex;justify-content:flex-end;margin-top:10px;font-size:13px">
      תאריך: <span style="color:${PEN};font-weight:600;margin-inline-start:6px">${date}</span>
    </div>
    <div style="text-align:center;font-size:17px;font-weight:800;text-decoration:underline;margin-top:6px">${esc(i.title)}</div>
    ${ident ? `<div style="text-align:center;font-size:10.5px;color:#777;margin-top:4px">${esc(ident)}</div>` : ''}

    ${i.sections.map((s) => heading(s.no, s.title) + clauses(s.clauses, 18)).join('')}
    <div style="font-size:14px;font-weight:700;margin:14px 0 4px">${lastNo}. ` +
      `<span style="font-weight:400;font-size:13px">${esc(i.satisfaction)}</span></div>

    ${heading(lastNo + 1, 'פרטי מקבל ההדרכה')}
    ${table(['שם ומשפחה', 'תעודת זהות', 'יחס קרבה לזכאי', 'חתימה'],
      v(i.recipientName) + v(i.recipientIdNumber) + v(i.recipientRelation) +
      `<td style="border:1px solid ${INK};height:56px;text-align:center;vertical-align:middle">${sig}</td>`)}

    ${heading(lastNo + 2, 'פרטי מבצע ההדרכה')}
    ${table(['שם ומשפחה'], v(i.meta.driverName))}

    ${heading(lastNo + 3, 'פרטי הערסל שסופק')}
    ${table(['יצרן הערסל', 'תאריך ייצור', 'מס"ד'], v(i.sling.manufacturer) + v(i.sling.productionDate) + v(i.sling.serial))}

    ${stamp(i.meta)}
  `);
}
