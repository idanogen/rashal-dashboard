import { supabaseAdmin } from './supabase-admin.js';
import { uploadFileBytes } from './heyy-v3.js';
import { isSignedFormPdfPath } from './signed-form-path.js';

/**
 * העתק של טופס חתום ללקוח בוואטסאפ (27/10/2026, הבקשה של עמי).
 *
 * הלקוח מבקש העתק, הנהג בוחר מספר באפליקציה, והפונקציה `rashal-form-copy`
 * קוראת ל-`api/heyy-send` עם נתיב ה-PDF בדלי `signed-forms`. כאן הבייטים
 * נמשכים מהאחסון, עולים ל-heyy, ומוחזרים כקובץ מצורף לתבנית.
 *
 * 🔴 הנתיב מגיע מקורא מכונתי בלבד (`x-send-secret`), ועדיין נבדק כאן מול
 * צורת נתיב של טופס חתום: אחרת הסוד הופך לגישה לכל קובץ בדלי.
 * ⭐ מזהה הקובץ בתוך התבנית נלקח מ-`wa_templates` לפי מזהה התבנית ב-heyy,
 * ולא מהקורא: תבנית בלי כותרת מסמך לא מקבלת קובץ, והשליחה נכשלת גלויה.
 */
export async function signedFormAttachment(
  documentPath: string,
  heyyTemplateId: string,
  fileName: string,
): Promise<Array<{ id: string; fileId: string }>> {
  if (!isSignedFormPdfPath(documentPath)) throw new Error('document path is not a signed form pdf');

  const { data: tpl, error: tplErr } = await supabaseAdmin
    .from('wa_templates')
    .select('attachment_id, has_document_header')
    .eq('heyy_template_id', heyyTemplateId)
    .maybeSingle();
  if (tplErr) throw new Error(`template lookup failed: ${tplErr.message}`);
  if (!tpl?.has_document_header || !tpl.attachment_id) throw new Error('template has no document header');

  const { data: blob, error } = await supabaseAdmin.storage.from('signed-forms').download(documentPath);
  if (error || !blob) throw new Error(`pdf download failed: ${error?.message ?? 'empty'}`);

  const up = await uploadFileBytes(Buffer.from(await blob.arrayBuffer()), fileName, 'document');
  return [{ id: tpl.attachment_id as string, fileId: up.fileId }];
}
