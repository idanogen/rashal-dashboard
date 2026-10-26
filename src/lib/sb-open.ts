import { supabase } from './supabase';
import { parseSbUrl } from './signed-docs';

/**
 * פתיחת קובץ מדלי פרטי בלשונית חדשה, מכתובת `sb://bucket/path` או מדלי+נתיב.
 *
 * 🔴 החלון נפתח לפני הקריאה למסד, אחרת הדפדפן חוסם אותו כחלון קופץ: אחרי
 * await הלחיצה כבר לא נחשבת "של המשתמש" (אותו כלל כמו `openStopDoc`).
 * ההרשאה נאכפת במדיניות האחסון של הדלי (טפסים חתומים: צוות המשרד בלבד).
 */
export async function openPrivateFile(bucket: string, path: string): Promise<void> {
  const win = window.open('', '_blank');
  try {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 600);
    if (error || !data?.signedUrl) throw new Error(error?.message ?? 'לא ניתן לפתוח את הקובץ');
    if (win) win.location.href = data.signedUrl;
    else window.open(data.signedUrl, '_blank');
  } catch (e) {
    win?.close();
    throw e;
  }
}

/** `sb://...` נפתח בחתימה; כתובת רגילה נפתחת כמו שהיא. מחזיר false כשאין מה לפתוח. */
export async function openFileUrl(url: string | null | undefined): Promise<boolean> {
  const sb = parseSbUrl(url);
  if (sb) {
    await openPrivateFile(sb.bucket, sb.path);
    return true;
  }
  if (url && /^https?:\/\//i.test(url)) {
    window.open(url, '_blank', 'noopener');
    return true;
  }
  return false;
}
