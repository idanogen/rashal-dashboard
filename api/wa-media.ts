import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser } from './_lib/require-user.js';
import { supabaseAdmin } from './_lib/supabase-admin.js';
import { BUCKET, type HeyyAttachment } from './_lib/wa-media.js';

/**
 * פתיחת קובץ ששמור אצלנו, למשתמש מחובר.
 *
 *   GET /api/wa-media?message=<uuid>&i=0
 *
 * 🔴 **הלקוח לא מוסר נתיב, אף פעם.** הוא מוסר מזהה הודעה ואינדקס, והשרת
 * הוא זה שקורא את הנתיב מהשורה. נתיב שמגיע מהדפדפן פירושו שמי שמחזיק
 * טוקן יכול לבקש חתימה על כל אובייקט בדלי, כולל של לקוח אחר. זו אותה
 * משפחה של תקלות שכבר עלתה לנו: ערך מהדפדפן שהתקבל כאמת.
 *
 * ⭐ הדלי פרטי, והכתובת החתומה חיה חמש דקות. מספיק לפתוח, קצר מכדי
 * שהעברה שלה הלאה תהיה שימושית.
 */
const SIGNED_SECONDS = 300;

/** אותה רשימה כמו `is_office_staff()` במסד. */
const OFFICE_ROLES = new Set(['admin', 'team_manager', 'dispatcher', 'viewer', 'management']);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const user = await requireUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'unauthorized' });

  // 🔴 15/09/2026: רק המשרד. עד היום כל מחובר (כולל נהג) קיבל חתימה לכל קובץ
  // לפי מזהה הודעה. נהג רואה קבצים רק בכרטיס הקריאה, בחתימה ישירה מהדלי
  // שעוברת את מדיניות האחסון (`wa_media_object_visible`), ולא דרך כאן.
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role, disabled')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile || profile.disabled || !OFFICE_ROLES.has(String(profile.role))) {
    return res.status(403).json({ ok: false, error: 'forbidden' });
  }

  const messageId = typeof req.query.message === 'string' ? req.query.message.trim() : '';
  const index = Number(req.query.i ?? 0);

  if (!messageId) {
    return res.status(400).json({ ok: false, error: 'need message id' });
  }
  if (!Number.isInteger(index) || index < 0 || index > 49) {
    return res.status(400).json({ ok: false, error: 'bad index' });
  }

  const { data: row, error } = await supabaseAdmin
    .from('wa_messages')
    .select('attachments, media_state')
    .eq('id', messageId)
    .maybeSingle();

  if (error) {
    console.error('[wa-media] lookup failed', error.message);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
  if (!row) return res.status(404).json({ ok: false, error: 'not_found' });

  const atts = (Array.isArray(row.attachments) ? row.attachments : []) as HeyyAttachment[];
  const att = atts[index];

  if (!att) return res.status(404).json({ ok: false, error: 'no_attachment' });

  if (!att.stored_path) {
    // 🔴 נאמר במפורש ולא כ-404 סתמי. ההבדל בין "אין קובץ כזה" לבין
    // "הקובץ היה ולא הספקנו להעתיק אותו" הוא כל ההבדל באבחון.
    return res.status(409).json({
      ok: false,
      error: 'not_stored',
      state: row.media_state,
      message:
        row.media_state === 'failed'
          ? 'הקובץ לא נשמר אצלנו והכתובת אצל הספק כבר פגה.'
          : 'הקובץ עדיין לא הועתק אלינו. נסה שוב עוד רגע.',
    });
  }

  // ?download=1 → הכתובת החתומה נושאת content-disposition של הורדה,
  // והדפדפן שומר את הקובץ למחשב במקום להציג אותו (בקשת עידן, 31/08/2026).
  const wantDownload = req.query.download === '1';
  const { data: signed, error: signErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(
      att.stored_path,
      SIGNED_SECONDS,
      wantDownload ? { download: att.file?.name ?? 'file' } : undefined,
    );

  if (signErr || !signed?.signedUrl) {
    console.error('[wa-media] sign failed', signErr?.message);
    return res.status(500).json({ ok: false, error: 'sign_failed' });
  }

  return res.status(200).json({
    ok: true,
    url: signed.signedUrl,
    name: att.file?.name ?? 'קובץ',
    contentType: att.file?.contentType ?? null,
    expiresInSeconds: SIGNED_SECONDS,
  });
}
