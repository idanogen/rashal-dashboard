import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import type { FormDefinition, FormValues } from './types';

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

const A4_WIDTH_PX = 794;   // 210mm ב-96dpi
const A4_HEIGHT_PX = 1123; // 297mm

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
}

export interface SignerNames {
  customer?: string;
  driver?: string;
}

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
): string {
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
         <div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:6px">הצהרת הלקוח</div>
         ${def.declarations
           .map(
             (d, i) =>
               `<div style="display:flex;gap:6px;margin-bottom:4px;font-size:10.5px;color:#334155;line-height:1.55">
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

      <div style="display:flex;gap:22px;margin-top:14px;position:relative">${signatureBlocks}</div>

      <div style="margin-top:18px;padding-top:9px;border-top:1px solid #e2e8f0;font-size:8.5px;color:#94a3b8;line-height:1.6">
        <div>נחתם דיגיטלית ${esc(stamp)} · נהג: ${esc(meta.driverName)}${locationLine}</div>
        ${meta.orderNumber ? `<div>${def.kind === 'repair' ? 'מספר קריאה' : 'מספר הזמנה'}: ${esc(meta.orderNumber)}</div>` : ''}
        ${def.footerNote ? `<div style="margin-top:3px">${esc(def.footerNote)}</div>` : ''}
      </div>
    </div>`;
}

/** מרסטר את הטופס ומחזיר PDF. */
export async function generateFormPdf(
  def: FormDefinition,
  values: FormValues,
  signatures: SignatureImages,
  names: SignerNames,
  meta: FormMeta,
): Promise<Blob> {
  const host = document.createElement('div');
  host.setAttribute('dir', 'rtl');
  // מחוץ למסך אך מרונדר. `display:none` היה מונע מדידה ומחזיר קנבס ריק.
  host.style.cssText = `position:fixed;top:0;left:-${A4_WIDTH_PX + 200}px;width:${A4_WIDTH_PX}px;z-index:-1;background:#ffffff`;
  host.innerHTML = buildFormHtml(def, values, signatures, names, meta);
  document.body.appendChild(host);

  try {
    const canvas = await html2canvas(host.firstElementChild as HTMLElement, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
    });

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [A4_WIDTH_PX, A4_HEIGHT_PX] });
    const imgData = canvas.toDataURL('image/jpeg', 0.92);

    // גובה התמונה ביחידות הדף, אחרי התאמה לרוחב A4
    const renderedHeight = (canvas.height * A4_WIDTH_PX) / canvas.width;
    let remaining = renderedHeight;
    let offset = 0;

    while (remaining > 0) {
      if (offset > 0) pdf.addPage([A4_WIDTH_PX, A4_HEIGHT_PX], 'portrait');
      // התמונה נדחפת כלפי מעלה, והדף חותך את מה שמעבר לגובה שלו
      pdf.addImage(imgData, 'JPEG', 0, -offset, A4_WIDTH_PX, renderedHeight);
      remaining -= A4_HEIGHT_PX;
      offset += A4_HEIGHT_PX;
    }

    return pdf.output('blob');
  } finally {
    document.body.removeChild(host);
  }
}

/**
 * מפתח האובייקט ב-Storage.
 *
 * 🔴 Supabase Storage דוחה מפתח שאינו ASCII ("Invalid key"), ולכן הוא חייב
 * להיות נקי מעברית ומרווחים. שם התצוגה בעברית נשמר בנפרד ומוצג למשתמש;
 * הנתיב עצמו הוא מזהה טכני ואף אחד לא קורא אותו.
 */
export function buildStorageKey(def: FormDefinition, formId: string, meta: FormMeta): string {
  const d = meta.signedAt;
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `${formId}/${def.key}-${date}.pdf`;
}

/** שם ידידותי בעברית — לתצוגה ולהורדה, לא לנתיב. */
export function buildFormFileName(def: FormDefinition, meta: FormMeta): string {
  const d = meta.signedAt;
  const date = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  const parts = [def.fundLabel, def.kind === 'delivery' ? 'אספקה' : def.kind === 'return' ? 'החזרה' : 'תיקון'];
  if (meta.orderNumber) parts.push(meta.orderNumber);
  parts.push(meta.customerName, date);
  return `${parts.join(' - ').replace(/[/\\?%*:|"<>]/g, '')}.pdf`;
}
