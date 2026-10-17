import type { FormValues } from '../types.ts';

/**
 * אבני בניין לתבניות ה-PDF של הטפסים: העתק של הטופס המקורי של הקופה, לא
 * עיצוב שלנו (עידן, 16/10/2026: "העתק הכי קרוב שאפשר לטפסים שעמי שלח").
 *
 * 🔴 צבעים ב-hex בלבד ובלי מחלקות Tailwind: המרסטר (html2canvas) לא מכיר
 * את oklch של Tailwind v4. הכל inline.
 * ⭐ הערך שמולא כתוב בכחול כהה, כמו עט על טופס מודפס, כדי שיהיה ברור מה
 * הודפס מראש ומה מולא.
 */

export const A4_W = 794;
export const A4_H = 1123;
export const INK = '#111111';
export const PEN = '#0b2a6b';
export const FONT = "Arial,'Heebo','Arial Hebrew',sans-serif";

export interface LayoutInput {
  values: FormValues;
  signatures: { customer?: string | null; driver?: string | null; guarantor?: string | null };
  names: { customer?: string; driver?: string; guarantor?: string };
  meta: { signedAt: Date; driverName: string; location?: { lat: number; lng: number } | null };
}

export function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** ערך שדה כטקסט. תאריך ISO מוצג dd/mm/yyyy. */
export function val(values: FormValues, key: string): string {
  const v = values[key];
  if (typeof v === 'boolean') return v ? '✓' : '';
  const s = String(v ?? '').trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}

/** תא בטבלה: תווית קטנה בפינה העליונה, הערך בעט מתחתיה. */
export function cell(label: string, value: string, opts: { w?: string; h?: number; extra?: string } = {}): string {
  return `<td style="border:1px solid ${INK};vertical-align:top;padding:2px 5px 4px;height:${opts.h ?? 38}px;${opts.w ? `width:${opts.w};` : ''}">
    <div style="font-size:9.5px;color:${INK};line-height:1.2">${label}</div>
    <div style="font-size:13px;color:${PEN};font-weight:600;line-height:1.35;margin-top:3px;word-break:break-word">${esc(value) || '&nbsp;'}</div>
    ${opts.extra ?? ''}
  </td>`;
}

/** תיבת סימון מודפסת, מסומנת ב-X בעט כשנבחרה. */
export function box(checked: boolean, label: string): string {
  return `<span style="display:inline-flex;align-items:center;gap:4px;white-space:nowrap;margin-inline-start:12px">
    <span style="display:inline-flex;align-items:center;justify-content:center;width:12px;height:12px;border:1px solid ${INK};font-size:11px;line-height:1;color:${PEN};font-weight:700">${checked ? '✕' : ''}</span>
    <span style="font-size:11.5px">${label}</span>
  </span>`;
}

/** קו מילוי עם תווית לפניו, כמו "שם נותן השירות: ________". */
export function line(label: string, value: string, minWidth = 150): string {
  return `<span style="display:inline-flex;align-items:flex-end;gap:5px;white-space:nowrap">
    <span style="font-size:11.5px">${label}</span>
    <span style="display:inline-block;min-width:${minWidth}px;border-bottom:1px dotted ${INK};font-size:13px;color:${PEN};font-weight:600;padding:0 4px;line-height:1.3">${esc(value) || '&nbsp;'}</span>
  </span>`;
}

/** חתימה על קו: התמונה יושבת על הקו, כמו חתימה בעט. */
export function signatureLine(label: string, img: string | null | undefined, width = 170): string {
  return `<span style="display:inline-flex;align-items:flex-end;gap:5px;white-space:nowrap">
    <span style="font-size:11.5px">${label}</span>
    <span style="display:inline-flex;align-items:flex-end;justify-content:center;width:${width}px;height:40px;border-bottom:1px dotted ${INK}">
      ${img ? `<img src="${img}" style="max-height:44px;max-width:${width}px;object-fit:contain;margin-bottom:-6px" />` : ''}
    </span>
  </span>`;
}

/** שורת אימות קטנה בתחתית: מתי, מי, איפה. היא לא בטופס המקורי ולכן קטנה ואפורה. */
export function stamp(meta: LayoutInput['meta']): string {
  const at = meta.signedAt.toLocaleString('he-IL', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const loc = meta.location ? ` · מיקום ${meta.location.lat.toFixed(5)}, ${meta.location.lng.toFixed(5)}` : '';
  return `<div style="font-size:8px;color:#8a8a8a;margin-top:6px">נחתם דיגיטלית ${esc(at)} · ${esc(meta.driverName)}${loc}</div>`;
}

/**
 * עמוד A4 בגובה קבוע בדיוק, לטופס רב-עמודי: המרסטר חותך את התמונה כל
 * `A4_H` פיקסלים, ולכן כל עמוד חייב להיות בדיוק בגובה הזה.
 */
export function fixedPage(inner: string): string {
  return `<div dir="rtl" style="width:${A4_W}px;height:${A4_H}px;overflow:hidden;box-sizing:border-box;padding:28px 40px 0;background:#ffffff;font-family:${FONT};color:${INK};position:relative">${inner}</div>`;
}

/** עטיפת עמוד A4 מימין לשמאל. */
export function page(inner: string): string {
  return `<div dir="rtl" style="width:${A4_W}px;min-height:${A4_H}px;box-sizing:border-box;padding:30px 40px 24px;background:#ffffff;font-family:${FONT};color:${INK};position:relative">${inner}</div>`;
}
