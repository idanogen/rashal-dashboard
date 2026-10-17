import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import type { FormDefinition, FormValues } from './types.ts';
import {
  A4_HEIGHT_PX, A4_WIDTH_PX, LAYOUTS, buildFormHtml,
  type FormMeta, type PhotoImages, type SignatureImages, type SignerNames,
} from './html.ts';

export { buildFormHtml, buildFormFileName } from './html.ts';
export type { FormMeta, PhotoImages, SignatureImages, SignerNames } from './html.ts';

/** מרסטר את הטופס ומחזיר PDF. */
export async function generateFormPdf(
  def: FormDefinition,
  values: FormValues,
  signatures: SignatureImages,
  names: SignerNames,
  meta: FormMeta,
  photos: PhotoImages = {},
): Promise<Blob> {
  const host = document.createElement('div');
  host.setAttribute('dir', 'rtl');
  // מחוץ למסך אך מרונדר. `display:none` היה מונע מדידה ומחזיר קנבס ריק.
  host.style.cssText = `position:fixed;top:0;left:-${A4_WIDTH_PX + 200}px;width:${A4_WIDTH_PX}px;z-index:-1;background:#ffffff`;
  host.innerHTML = buildFormHtml(def, values, signatures, names, meta, photos);
  document.body.appendChild(host);

  try {
    // ⭐ כל המארח ולא רק הילד הראשון: טופס רב-עמודי (מאוחדת) הוא כמה עמודים
    // אחים, ולכידת הראשון בלבד הוציאה PDF של עמוד 1 (נתפס 17/10/2026).
    const canvas = await html2canvas(host, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
    });

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [A4_WIDTH_PX, A4_HEIGHT_PX] });
    const imgData = canvas.toDataURL('image/jpeg', 0.92);

    // גובה התמונה ביחידות הדף, אחרי התאמה לרוחב A4
    const renderedHeight = (canvas.height * A4_WIDTH_PX) / canvas.width;

    // ⭐ טופס שהועתק מהמקור הוא עמוד אחד, כמו המקור. אם תוכן שמולא (שם מכשיר
    // ארוך, הערה) הגביה אותו מעט מעבר ל-A4, מקטינים לעמוד אחד במקום לחתוך
    // שורה באמצע ולשפוך אותה לעמוד שני.
    if (LAYOUTS[def.key] && renderedHeight > A4_HEIGHT_PX && renderedHeight <= A4_HEIGHT_PX * 1.3) {
      const scale = A4_HEIGHT_PX / renderedHeight;
      const w = A4_WIDTH_PX * scale;
      pdf.addImage(imgData, 'JPEG', (A4_WIDTH_PX - w) / 2, 0, w, A4_HEIGHT_PX);
      await appendPhotos(pdf, def, photos);
      return pdf.output('blob');
    }
    let remaining = renderedHeight;
    let offset = 0;

    while (remaining > 0) {
      if (offset > 0) pdf.addPage([A4_WIDTH_PX, A4_HEIGHT_PX], 'portrait');
      // התמונה נדחפת כלפי מעלה, והדף חותך את מה שמעבר לגובה שלו
      pdf.addImage(imgData, 'JPEG', 0, -offset, A4_WIDTH_PX, renderedHeight);
      remaining -= A4_HEIGHT_PX;
      offset += A4_HEIGHT_PX;
    }

    await appendPhotos(pdf, def, photos);
    return pdf.output('blob');
  } finally {
    document.body.removeChild(host);
  }
}


/**
 * ⭐ צילומי הנייר (טופס הפורטל, שטר חוב, ת"ז): עמוד לכל צילום, מותאם לדף,
 * כדי שלפריוריטי יגיע קובץ אחד ולא כמה נספחים מפוזרים.
 */
async function appendPhotos(pdf: jsPDF, def: FormDefinition, photos: PhotoImages): Promise<void> {
  for (const slot of def.photos ?? []) {
    const src = photos[slot.key];
    if (!src) continue;
    const img = await loadImage(src);
    const scale = Math.min((A4_WIDTH_PX - 40) / img.width, (A4_HEIGHT_PX - 70) / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    pdf.addPage([A4_WIDTH_PX, A4_HEIGHT_PX], 'portrait');
    pdf.addImage(src, 'JPEG', (A4_WIDTH_PX - w) / 2, 50, w, h);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('טעינת הצילום נכשלה'));
    img.src = src;
  });
}
