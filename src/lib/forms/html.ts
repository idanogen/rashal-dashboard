/**
 * ה-HTML של הטופס החתום: התבנית של כל טופס (העתק של הטופס המקורי) והתבנית
 * הכללית. ⭐ קובץ בלי תלות בדפדפן (בלי html2canvas/jsPDF), כי אותו קוד בדיוק
 * רץ גם באפליקציה של הטכנאי, שם `expo-print` הופך אותו ל-PDF
 * (`rashal-driver/scripts/sync-forms.mjs` מעתיק אותו לשם).
 */
import type { FormDefinition, FormValues } from './types.ts';
import type { LayoutInput } from './layouts/common.ts';
import { mohRepairLayout } from './layouts/moh-repair.ts';
import { mohReturnLayout } from './layouts/moh-return.ts';
import { maccabiDeliveryLayout, maccabiReturnLayout } from './layouts/maccabi.ts';
import { leumitDeliveryLayout, leumitReturnLayout } from './layouts/leumit.ts';
import { meuhedetDeliveryLayout } from './layouts/meuhedet.ts';

/**
 * ⭐ תבנית לכל טופס שהועתק מהמקור (עידן, 16/10/2026: "העתק הכי קרוב שאפשר").
 * טופס שעדיין אין לו תבנית יוצא בתבנית הכללית שלמטה. נבנים אחד אחד.
 */
export const LAYOUTS: Record<string, (input: LayoutInput) => string> = {
  'moh-repair': mohRepairLayout,
  'moh-return': mohReturnLayout,
  'maccabi-delivery': maccabiDeliveryLayout,
  'maccabi-return': maccabiReturnLayout,
  'leumit-delivery': leumitDeliveryLayout,
  'leumit-return': leumitReturnLayout,
  'meuhedet-delivery': meuhedetDeliveryLayout,
};

/**
 * ייצור ה-PDF של הטופס החתום.
 *
 * הטופס מרונדר כ-HTML ואז מרוסטר על ידי הדפדפן עצמו, ורק אחר כך נעטף ב-PDF.
 * זו בחירה מכוונת: כתיבת טקסט עברי ישירות ל-PDF דורשת bidi ידני, ומחרוזת
 * מעורבת (עברית + מספרים + ₪) יוצאת הפוכה. הדפדפן כבר יודע לסדר RTL נכון,
 * אז נותנים לו לעשות את זה.
 *
 * כל הצבעים כאן הם hex מפורש ולא מחלקות Tailwind, כי המרסטר לא מכיר את
 * מרחב הצבע oklch של Tailwind v4.
 */

export const A4_WIDTH_PX = 794;   // 210mm ב-96dpi
export const A4_HEIGHT_PX = 1123; // 297mm

const FONT_STACK = "'Heebo','Assistant','Arial Hebrew','Segoe UI',system-ui,sans-serif";

export interface FormMeta {
  customerName: string;
  orderNumber?: string;
  driverName: string;
  signedAt: Date;
  location?: { lat: number; lng: number } | null;
}

export interface SignatureImages {
  customer?: string | null;
  driver?: string | null;
  guarantor?: string | null;
}

export interface SignerNames {
  customer?: string;
  driver?: string;
  guarantor?: string;
}

/** צילומי הנייר, לפי מפתח ה-`PhotoSlot`. data URL של JPEG. */
export type PhotoImages = Record<string, string | null | undefined>;

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function displayValue(
  def: FormDefinition,
  key: string,
  value: string | boolean | undefined,
): string {
  if (typeof value === 'boolean') return value ? '✓' : '';
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  for (const section of def.sections) {
    const field = section.fields.find((f) => f.key === key);
    if (!field) continue;
    if (field.options) {
      return field.options.find((o) => o.value === raw)?.label ?? raw;
    }
    if (field.type === 'date') {
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? raw : d.toLocaleDateString('he-IL');
    }
    if (field.type === 'money') return `${raw} ₪`;
  }
  return raw;
}

/** מיוצא גם לתצוגה מקדימה על המסך, לא רק לרסטור. */
export function buildFormHtml(
  def: FormDefinition,
  values: FormValues,
  signatures: SignatureImages,
  names: SignerNames,
  meta: FormMeta,
  photos: PhotoImages = {},
): string {
  const layout = LAYOUTS[def.key];
  if (layout) return layout({ values, signatures, names, meta });
  const brand = def.brandColor;
  const stamp = meta.signedAt.toLocaleString('he-IL', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const sections = def.sections
    .map((section, si) => {
      const rows = section.fields
        .map((field) => {
          const shown = displayValue(def, field.key, values[field.key]);
          const span = field.span ?? 1;
          return `
            <div style="grid-column:span ${span};min-width:0">
              <div style="font-size:9.5px;color:#64748b;margin-bottom:2px">${esc(field.label)}</div>
              <div style="font-size:12.5px;color:#0f172a;font-weight:600;border-bottom:1px solid #cbd5e1;padding-bottom:3px;min-height:18px;word-break:break-word">${esc(shown) || '&nbsp;'}</div>
            </div>`;
        })
        .join('');

      return `
        <div style="margin-bottom:14px">
          <div style="display:flex;align-items:center;gap:7px;margin-bottom:8px">
            <span style="display:inline-flex;align-items:center;justify-content:center;width:17px;height:17px;background:${brand};color:#fff;font-size:10.5px;font-weight:700;border-radius:3px">${si + 1}</span>
            <span style="font-size:13px;font-weight:700;color:#0f172a">${esc(section.title)}</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px 14px">${rows}</div>
        </div>`;
    })
    .join('');

  const declarations = def.declarations?.length
    ? `<div style="margin:14px 0;padding:11px 13px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px">
         <div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:6px">${def.declarationStyle === 'plain' ? 'הצהרה והתחייבות' : 'הצהרת הלקוח'}</div>
         ${def.declarations
           .map((d, i) =>
             def.declarationStyle === 'plain'
               ? `<div style="margin-bottom:4px;font-size:10.5px;color:#334155;line-height:1.55">${esc(d)}</div>`
               : `<div style="display:flex;gap:6px;margin-bottom:4px;font-size:10.5px;color:#334155;line-height:1.55">
                  <span style="font-weight:700;color:${brand};flex-shrink:0">${'אבגדהוזחט'[i] ?? i + 1}.</span>
                  <span>${esc(d)}</span>
                </div>`,
           )
           .join('')}
       </div>`
    : '';

  const signatureBlocks = def.signatures
    .map((slot) => {
      const img = signatures[slot.key];
      const name = names[slot.key] ?? '';
      return `
        <div style="flex:1;min-width:0">
          <div style="font-size:9.5px;color:#64748b;margin-bottom:3px">${esc(slot.nameLabel)}</div>
          <div style="font-size:12.5px;font-weight:600;color:#0f172a;border-bottom:1px solid #cbd5e1;padding-bottom:3px;margin-bottom:8px">${esc(name) || '&nbsp;'}</div>
          <div style="font-size:9.5px;color:#64748b;margin-bottom:3px">${esc(slot.label)}</div>
          <div style="height:66px;border:1px solid #cbd5e1;border-radius:5px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden">
            ${img ? `<img src="${img}" style="max-height:62px;max-width:96%;object-fit:contain" />` : '&nbsp;'}
          </div>
        </div>`;
    })
    .join('');

  const demoBanner = def.isDemo
    ? `<div style="margin-bottom:10px;padding:7px 11px;background:#fef3c7;border:1px solid #f59e0b;border-radius:5px;font-size:10.5px;color:#92400e;font-weight:700">
         טופס הדגמה. אינו הטופס הרשמי של ${esc(def.fundLabel)} ואינו מיועד לשימוש מול לקוח.
       </div>`
    : '';

  const photoList = (def.photos ?? []).filter((p) => photos[p.key]);
  const photosNote = photoList.length
    ? `<div style="margin-top:12px;font-size:10.5px;color:#334155">מצורפים בעמודים הבאים: ${photoList.map((p) => esc(p.label)).join(' · ')}</div>`
    : '';

  const locationLine = meta.location
    ? ` · מיקום ${meta.location.lat.toFixed(5)}, ${meta.location.lng.toFixed(5)}`
    : '';

  return `
    <div dir="rtl" style="width:${A4_WIDTH_PX}px;box-sizing:border-box;padding:34px 38px;background:#ffffff;font-family:${FONT_STACK};color:#0f172a;position:relative">
      ${
        def.isDemo
          ? `<div style="position:absolute;top:38%;right:0;left:0;text-align:center;font-size:68px;font-weight:800;color:#f1f5f9;transform:rotate(-22deg);letter-spacing:3px">הדגמה</div>`
          : ''
      }

      <div style="position:relative;display:flex;align-items:flex-start;justify-content:space-between;border-bottom:3px solid ${brand};padding-bottom:11px;margin-bottom:14px">
        <div>
          <div style="font-size:19px;font-weight:800;color:${brand};letter-spacing:-0.3px">${esc(def.fundLabel)}</div>
          ${def.subtitle ? `<div style="font-size:10.5px;color:#64748b;margin-top:1px">${esc(def.subtitle)}</div>` : ''}
        </div>
        <div style="text-align:left">
          <div style="font-size:14.5px;font-weight:700">${esc(def.title)}</div>
          <div style="font-size:10.5px;color:#64748b;margin-top:2px">ספק: ר.שעל ציוד רפואי</div>
        </div>
      </div>

      ${demoBanner}
      <div style="position:relative">${sections}</div>
      ${declarations}

      ${signatureBlocks ? `<div style="display:flex;gap:22px;margin-top:14px;position:relative">${signatureBlocks}</div>` : ''}
      ${photosNote}

      <div style="margin-top:18px;padding-top:9px;border-top:1px solid #e2e8f0;font-size:8.5px;color:#94a3b8;line-height:1.6">
        <div>נחתם דיגיטלית ${esc(stamp)} · נהג: ${esc(meta.driverName)}${locationLine}</div>
        ${meta.orderNumber ? `<div>${def.kind === 'repair' ? 'מספר קריאה' : 'מספר הזמנה'}: ${esc(meta.orderNumber)}</div>` : ''}
        ${def.footerNote ? `<div style="margin-top:3px">${esc(def.footerNote)}</div>` : ''}
      </div>
    </div>`;
}


export function buildFormFileName(def: FormDefinition, meta: FormMeta): string {
  const d = meta.signedAt;
  const date = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  const parts = [def.fundLabel, def.kind === 'delivery' ? 'אספקה' : def.kind === 'return' ? 'החזרה' : 'תיקון'];
  if (meta.orderNumber) parts.push(meta.orderNumber);
  parts.push(meta.customerName, date);
  return `${parts.join(' - ').replace(/[/\\?%*:|"<>]/g, '')}.pdf`;
}
