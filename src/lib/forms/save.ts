import { supabase } from '@/lib/supabase';
import type { FormDefinition, FormValues } from './types';
import { generateFormPdf, buildFormFileName } from './render';
import type { FormMeta, SignatureImages, SignerNames } from './render';

/**
 * שמירת טופס חתום.
 *
 * שלושה יעדים, לפי מה שעידן ביקש: אצלנו במערכת, ובפריוריטי.
 *   1. ה-PDF ל-bucket `signed-forms`
 *   2. שורה ב-`signed_forms` עם הערכים כפי שנחתמו
 *   3. אירוע ב-`timeline_events` — וזה מה שמעביר את הקובץ לפריוריטי
 *
 * 🔑 למה דרך timeline_events: `api/priority-push.ts` כבר מייצר POST מוכן
 * לתת-טופס הנספחים של כרטיס הלקוח (`CUSTEXTFILE_SUBFORM`) עם data-URI, וזה
 * הצינור שכבר הוכח בפרודקשן (96 קבצים נדחפו). רכיבה עליו חוסכת אינטגרציה
 * חדשה לגמרי, ומשמעותה שהטופס נכנס לפריוריטי מהיום הראשון.
 */

export interface SaveSignedFormInput {
  definition: FormDefinition;
  values: FormValues;
  signatures: SignatureImages;
  signerNames: SignerNames;
  meta: FormMeta;
  stopId: string;
  orderId?: string | null;
  serviceCallId?: string | null;
  customerNumber?: string | null;
  healthFund?: string | null;
}

export interface SaveSignedFormResult {
  id: string;
  pdfUrl: string;
  pdfBlob: Blob;
  pushedToPriority: boolean;
}

export async function saveSignedForm(input: SaveSignedFormInput): Promise<SaveSignedFormResult> {
  const { definition, values, signatures, signerNames, meta } = input;

  const pdfBlob = await generateFormPdf(definition, values, signatures, signerNames, meta);
  const fileName = buildFormFileName(definition, meta);

  const formId = crypto.randomUUID();
  const path = `${formId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('signed-forms')
    .upload(path, pdfBlob, { contentType: 'application/pdf', upsert: false });
  if (uploadError) throw new Error(`העלאת הטופס נכשלה: ${uploadError.message}`);

  const { data: urlData } = supabase.storage.from('signed-forms').getPublicUrl(path);
  const pdfUrl = urlData.publicUrl;

  const { error: rowError } = await supabase.from('signed_forms').insert({
    id: formId,
    stop_id: input.stopId,
    order_id: input.orderId ?? null,
    service_call_id: input.serviceCallId ?? null,
    form_key: definition.key,
    form_kind: definition.kind,
    health_fund: input.healthFund ?? null,
    customer_number: input.customerNumber ?? null,
    payload: values,
    customer_signature: signatures.customer ?? null,
    driver_signature: signatures.driver ?? null,
    signer_name: signerNames.customer ?? signerNames.driver ?? null,
    signed_at: meta.signedAt.toISOString(),
    signed_by: meta.driverName,
    signed_lat: meta.location?.lat ?? null,
    signed_lng: meta.location?.lng ?? null,
    pdf_path: path,
    pdf_url: pdfUrl,
  });
  if (rowError) throw new Error(`שמירת הטופס נכשלה: ${rowError.message}`);

  const pushedToPriority = await queueForPriority(input, formId, pdfUrl, fileName);

  return { id: formId, pdfUrl, pdfBlob, pushedToPriority };
}

/**
 * רישום האירוע שהצינור הקיים ימשוך ממנו.
 *
 * 🔴 מלכודת מכוונת: השדה נקרא `imageUrls` והוא נושא כאן PDF. השם לא מדויק,
 * אבל הוא מה שהתרחיש ב-Make ו-`api/priority-push.ts` כבר קוראים. שינוי שם
 * היה מחייב לגעת גם בצד של הלקוח ב-Make, ולכן נשמרה התאימות במכוון.
 * `toDataUri` שם גוזר את הסיומת מ-content-type, כך שקובץ PDF יגיע לפריוריטי
 * כ-`data:application/pdf;base64,...` וייקלט כקובץ אמיתי.
 *
 * הצירוף הוא לכרטיס הלקוח ולא להזמנה עצמה: זה מה שמאומת בפריוריטי של רשעל.
 * שם הקובץ נושא את מספר ההזמנה, ולכן הוא נשאר מאותר.
 */
async function queueForPriority(
  input: SaveSignedFormInput,
  formId: string,
  pdfUrl: string,
  fileName: string,
): Promise<boolean> {
  // בלי מספר לקוח אין לאן לצרף בפריוריטי. הטופס עדיין נשמר אצלנו.
  if (!input.customerNumber) return false;
  // האירוע נתלה על ההזמנה או על הקריאה, כי שם priority-push מחפש את הלקוח.
  if (!input.orderId && !input.serviceCallId) return false;

  const eventId = crypto.randomUUID();
  const { error } = await supabase.from('timeline_events').insert({
    id: eventId,
    order_id: input.orderId ?? null,
    service_call_id: input.serviceCallId ?? null,
    type: 'file_upload',
    user_id: 'driver-app',
    user_name: input.meta.driverName,
    content: `טופס ${input.definition.fundLabel} נחתם על ידי הלקוח`,
    files: [fileName],
    metadata: { imageUrls: [pdfUrl], signedFormId: formId, formKey: input.definition.key },
  });

  if (error) {
    // הטופס כבר שמור אצלנו. כישלון כאן הוא כישלון של הדחיפה בלבד.
    console.error('[saveSignedForm] priority queue failed:', error.message);
    return false;
  }

  await supabase.from('signed_forms').update({ priority_event_id: eventId }).eq('id', formId);
  return true;
}
