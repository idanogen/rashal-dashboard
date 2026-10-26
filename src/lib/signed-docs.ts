import { FORM_KIND_LABEL, getFormByKey } from './forms/registry.ts';

/**
 * טפסים חתומים: שמות בעברית, סדר, וכתובות `sb://` של קבצים בדליים פרטיים.
 *
 * 26/10/2026, עידן בסיור ההבנה: התגית "✍️ נחתם ×2" פתחה רק את המסמך
 * האחרון, בצ'אט העצירה הקבצים הופיעו בלי קישור, ובחלונית העצירה בווב לא
 * היו טפסים בכלל. שלושת המקומות מציגים מעכשיו את אותה רשימה, מכאן.
 *
 * `sb://<bucket>/<path>` הוא הצורה שבה `submit_signed_form` ו-`attach_crane_form_pdf`
 * רושמים קובץ מדלי פרטי ב-`timeline_events.metadata.fileUrls`; `api/priority-push`
 * קורא אותה בשרת, והדפדפן צריך כתובת חתומה. הפענוח כאן, הפתיחה ב-`sb-open.ts`.
 *
 * בלי ייבוא של supabase, ולכן נבדק ביחידה.
 */

export interface SbFile {
  bucket: string;
  path: string;
}

export function parseSbUrl(url: string | null | undefined): SbFile | null {
  const m = /^sb:\/\/([a-z0-9-]+)\/(.+)$/i.exec((url ?? '').trim());
  if (!m || !m[2]) return null;
  return { bucket: m[1], path: m[2] };
}

export interface SignedDoc {
  pdfPath: string;
  formKey: string;
  signedAt: string;
}

/** השם שהמשרד מכיר: "טופס מכבי אספקה", "תעודת משלוח חתומה", "אישור הדרכה למנוף". */
export function signedFormLabel(formKey: string): string {
  if (formKey === 'delivery_note') return 'תעודת משלוח חתומה';
  if (formKey === 'crane-training') return 'אישור הדרכה למנוף';
  if (formKey === 'crane-inspection') return 'רשימת בדיקה למנוף';
  const def = getFormByKey(formKey);
  if (def) return `טופס ${def.fundLabel} ${FORM_KIND_LABEL[def.kind]}`;
  return formKey;
}

/** "25/10 09:44" בשעון ישראל, לשורת מסמך. */
export function signedAtLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return `${get('day')}/${get('month')} ${get('hour')}:${get('minute')}`;
}

export interface SignedDocRow extends SignedDoc {
  label: string;
  when: string;
}

/** שורה לכל מסמך, החדש ראשון: זה מה שהמשרד מחפש אחרי הביקור. */
export function signedDocRows(signed: SignedDoc[]): SignedDocRow[] {
  return [...signed]
    .sort((a, b) => b.signedAt.localeCompare(a.signedAt))
    .map((s) => ({ ...s, label: signedFormLabel(s.formKey), when: signedAtLabel(s.signedAt) }));
}
