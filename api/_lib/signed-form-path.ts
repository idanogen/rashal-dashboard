/**
 * נתיב PDF של טופס חתום בדלי `signed-forms`: `<stop_id>/<uuid>.pdf`, כמו
 * ש-`saveSignedFormNative` ו-`src/lib/forms/save.ts` כותבים. קובץ טהור לבדיקה.
 */
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const SIGNED_FORM_PDF = new RegExp(`^${UUID}/${UUID}\\.pdf$`, 'i');

export function isSignedFormPdfPath(path: unknown): path is string {
  return typeof path === 'string' && SIGNED_FORM_PDF.test(path);
}
