import type { SupabaseClient } from '@supabase/supabase-js';
import { formsClient } from './client.ts';
import type { FormDefinition, FormValues } from './types.ts';
import { generateFormPdf, buildFormFileName } from './render.ts';
import type { FormMeta, PhotoImages, SignatureImages, SignerNames } from './render.ts';

/**
 * שמירת טופס חתום: PDF לדלי הפרטי, ואז `submit_signed_form` במסד שרושם את
 * השורה ואת האירוע שהצינור לפריוריטי מושך (כרטיס הלקוח, CUSTEXTFILE_SUBFORM).
 *
 * 🔴 **נתיב הקובץ באנגלית בלבד** (`<stop_id>/<uuid>.pdf`): Supabase Storage
 * דוחה מפתח בעברית (נתפס בענף ההדגמה, 11/08). השם העברי נשמר בתיאור
 * הקובץ (`fileDes`) ושם הוא מה שמופיע בפריוריטי.
 * 🔴 **הנתיב חייב להתחיל במזהה העצירה**: מדיניות האחסון והפונקציה במסד
 * שתיהן דוחות כל נתיב אחר, כדי שנהג לא יוכל לצרף קובץ לעצירה של מישהו אחר.
 */

export interface SaveSignedFormInput {
  definition: FormDefinition;
  values: FormValues;
  signatures: SignatureImages;
  signerNames: SignerNames;
  photos: PhotoImages;
  meta: FormMeta;
  stopId: string;
  healthFund?: string | null;
}

export interface SaveSignedFormResult {
  id: string;
  pdfBlob: Blob;
  fileName: string;
}

export async function saveSignedForm(
  input: SaveSignedFormInput,
  client: SupabaseClient = formsClient(),
): Promise<SaveSignedFormResult> {
  const { definition, values, signatures, signerNames, photos, meta } = input;

  const pdfBlob = await generateFormPdf(definition, values, signatures, signerNames, meta, photos);
  const fileName = buildFormFileName(definition, meta);
  const path = `${input.stopId}/${crypto.randomUUID()}.pdf`;

  const { error: uploadError } = await client.storage
    .from('signed-forms')
    .upload(path, pdfBlob, { contentType: 'application/pdf', upsert: false });
  if (uploadError) throw new Error(`העלאת הטופס נכשלה: ${uploadError.message}`);

  const { data, error } = await client.rpc('submit_signed_form', {
    p_stop_id: input.stopId,
    p_form_key: definition.key,
    p_form_kind: definition.kind,
    p_health_fund: input.healthFund ?? null,
    // ⭐ הערכים כפי שנחתמו, וגם חתימת הערב (אין לה עמודה). הצילומים לא נכנסים
    // לכאן: הם כבר בתוך ה-PDF, ושורה של כמה מגה בטבלה הייתה מאטה כל שליפה.
    p_payload: { ...values, ...(signatures.guarantor ? { _guarantorSignature: signatures.guarantor } : {}),
      ...(signerNames.guarantor ? { _guarantorName: signerNames.guarantor } : {}) },
    p_customer_signature: signatures.customer ?? null,
    p_driver_signature: signatures.driver ?? null,
    p_signer_name: signerNames.customer ?? signerNames.driver ?? null,
    p_lat: meta.location?.lat ?? null,
    p_lng: meta.location?.lng ?? null,
    p_pdf_path: path,
    p_file_des: fileName.replace(/\.pdf$/i, ''),
  });
  if (error) throw new Error(`שמירת הטופס נכשלה: ${error.message}`);

  return { id: data as string, pdfBlob, fileName };
}
