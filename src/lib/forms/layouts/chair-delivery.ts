import { INK, PEN, esc, fixedPage, stamp, thickenSignature } from './common.ts';

/**
 * תבנית ה-PDF של "הוראות הפעלה, בטיחות, תחזוקה ואחריות לכיסא גלגלים ממונע"
 * (עמי 23/11/2026). שלושה עמודים, שבורים באותם מקומות כמו טופס הנייר.
 *
 * ⭐ הנוסח מגיע כקלט ולא בייבוא מ-`chair-delivery.ts`: הקובץ הזה מועתק לאפליקציה
 * ב-`sync-forms.mjs` לתיקייה אחרת, וייבוא יחסי מחוץ לתיקיית הטפסים היה נשבר.
 */

interface Clause {
  text: string;
  bold?: string;
  underline?: boolean;
}

export interface ChairDeliveryPdfInput {
  title: string;
  support: string;
  sections: { no: string; title: string; sub?: boolean; page: number; clauses: Clause[] }[];
  declarationTitle: string;
  declaration: string;
  driverSigLabel: string;
  userSigLabel: string;
  customerName: string;
  customerNumber?: string | null;
  docNumber?: string | null;
  values: {
    manufacturer: string; model: string; serial: string;
    userName: string; userIdNumber: string; onBehalfOf: string;
    userSignature: string | null; driverSignature: string | null;
  };
  meta: { signedAt: Date; driverName: string; location?: { lat: number; lng: number } | null };
}

function clauseHtml(c: Clause): string {
  const safe = esc(c.text);
  let body = safe;
  if (c.bold && c.text.includes(c.bold)) body = safe.replace(esc(c.bold), `<b>${esc(c.bold)}</b>`);
  if (c.underline) body = `<span style="text-decoration:underline">${body}</span>`;
  return `<div style="display:flex;gap:7px;padding:1.5px 0;font-size:12px;line-height:1.5">
    <span style="flex:none">•</span><span>${body}</span></div>`;
}

function sectionHtml(s: ChairDeliveryPdfInput['sections'][number]): string {
  const head = s.sub
    ? `<div style="font-size:12.5px;font-weight:700;margin:8px 0 3px">${esc(s.no)} ${esc(s.title)}</div>`
    : `<div style="font-size:14px;font-weight:700;margin:12px 0 4px;padding-bottom:3px;border-bottom:1px solid #999">` +
      `${esc(s.no)}. ${esc(s.title)}</div>`;
  return head + `<div style="padding-inline-start:14px">${s.clauses.map(clauseHtml).join('')}</div>`;
}

/** שדה עם קו, כמו "תוצרת: ______" בטופס. */
function blank(label: string, value: string, width: number): string {
  return `<span style="display:inline-flex;align-items:flex-end;gap:5px;white-space:nowrap">
    <span style="font-size:12px;font-weight:700">${label}</span>
    <span style="display:inline-block;min-width:${width}px;border-bottom:1px solid ${INK};font-size:13px;color:${PEN};` +
    `font-weight:600;padding:0 4px;line-height:1.3">${esc(value) || '&nbsp;'}</span></span>`;
}

function sig(img: string | null, label: string): string {
  return `<div style="width:300px;text-align:center">
    <div style="height:62px;display:flex;align-items:flex-end;justify-content:center;border-bottom:1px solid ${INK}">
      ${img ? `<img src="${thickenSignature(img)}" style="max-height:60px;max-width:280px;object-fit:contain" />` : ''}
    </div>
    <div style="font-size:11.5px;font-weight:700;margin-top:4px">${esc(label)}</div>
  </div>`;
}

export function chairDeliveryLayout(i: ChairDeliveryPdfInput): string {
  const v = i.values;
  const ident = [
    i.customerName && `לקוח: ${i.customerName}`,
    i.customerNumber && `מס' לקוח ${i.customerNumber}`,
    i.docNumber && `הזמנה ${i.docNumber}`,
  ].filter(Boolean).join(' · ');
  const header = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div style="text-align:center;font-size:11px;line-height:1.3">
        <div style="font-size:18px;font-weight:800">ר.שעל</div><div>שרותי עזר לנכים בע"מ</div>
      </div>
      <div style="font-size:10.5px;color:#777">${esc(ident)}</div>
    </div>
    <div style="text-align:center;font-size:17px;font-weight:800;text-decoration:underline;margin-top:6px">${esc(i.title)}</div>
    <div style="text-align:center;font-size:11.5px;margin-top:3px">${esc(i.support)}</div>
    <div style="display:flex;justify-content:space-between;gap:10px;margin-top:14px">
      ${blank('תוצרת:', v.manufacturer, 150)}${blank('דגם:', v.model, 190)}${blank("מס' סידורי:", v.serial, 130)}
    </div>`;
  const pageNo = (n: number) => `<div style="position:absolute;bottom:18px;left:0;right:0;text-align:center;font-size:10px">${n}</div>`;
  const body = (n: number) => i.sections.filter((s) => s.page === n).map(sectionHtml).join('');

  const declaration = `
    <div style="font-size:14px;font-weight:700;margin:14px 0 8px;padding-bottom:3px;border-bottom:1px solid #999">` +
      `${esc(i.declarationTitle)}</div>
    <div style="display:flex;gap:18px;flex-wrap:wrap;margin:10px 0">
      ${blank('אני', v.userName, 150)}${blank('ת.ז.', v.userIdNumber, 110)}${blank('בשם', v.onBehalfOf, 140)}
    </div>
    <div style="font-size:12.5px;line-height:1.55">${esc(i.declaration)}</div>
    <div style="display:flex;justify-content:space-between;margin-top:26px">
      ${sig(v.driverSignature, `${i.driverSigLabel}${i.meta.driverName ? ` (${i.meta.driverName})` : ''}`)}
      ${sig(v.userSignature, i.userSigLabel)}
    </div>
    ${stamp(i.meta)}`;

  return fixedPage(header + body(1) + pageNo(1))
    + fixedPage(body(2) + pageNo(2))
    + fixedPage(body(3) + declaration + pageNo(3));
}
