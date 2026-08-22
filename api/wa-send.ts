import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser } from './_lib/require-user.js';
import { supabaseAdmin } from './_lib/supabase-admin.js';
import { heyySendText, isHeyyDemo } from './_lib/heyy-server.js';
import { sendTemplate as sendTemplateV3, uploadFileBytes } from './_lib/heyy-v3.js';
import { toE164, normalizePhone } from './_lib/phone.js';
import { windowState } from './_lib/thread.js';
import {
  getTemplate,
  buildVariables,
  renderPreview,
  type WaTemplate,
} from './_lib/templates-store.js';

/**
 * מסלול השליחה של החלונית בפריוריטי.
 *
 *   POST /api/wa-send
 *   { phone, kind: 'text'|'template', bodyText?, templateId?, variables?,
 *     customerNumber?, entityType?, entityKey? }
 *
 * 🔴 **חלון 24 השעות נאכף כאן, בשרת, ולא בחלונית.**
 * החלונית אמנם מאפירה את שדה הטקסט כשהחלון סגור, אבל זו נוחות ולא הגנה:
 * לשונית שנפתחה לפני שעתיים מחזיקה מצב חלון ישן, ומי שכותב בה שולח
 * לחלל. מטא תבלע טקסט חופשי מחוץ לחלון, **ו-heyy תחזיר הצלחה על זה**.
 * זו בדיוק אותה מלכודת שכבר שילמנו עליה: תשובת 200 שאינה אימות.
 * לכן הבדיקה חוזרת כאן, על `last_inbound_at` העדכני מהמסד, בשנייה שבה
 * ההודעה באמת יוצאת.
 *
 * ⭐ שים לב שאין כאן כתיבה ל-`wa_messages`. הוובהוק הוא הכותב היחיד
 * לשכבת השיחות, כולל להודעות יוצאות. ראה את ההסבר ב-`_lib/wa-thread.ts`.
 */

interface SendBody {
  phone?: string;
  kind?: 'text' | 'template';
  bodyText?: string;
  /**
   * 🔴 מפתח מהמרשם, ולא מזהה תבנית. מזהה שמגיע מהדפדפן פירושו שכל מי
   * שמחזיק טוקן יכול לשלוח כל תבנית שקיימת בחשבון של הלקוח, כולל תבניות
   * שיווק שעולות יותר וכפופות להסכמת הנמען.
   */
  templateKey?: string;
  /** ערכי המשתנים לפי שם. השרת בונה מהם את המערך בסדר הנכון. */
  values?: Record<string, unknown>;
  customerNumber?: string;
  entityType?: string;
  entityKey?: string;
  /**
   * 🔴 **הבייטים של ה-PDF, ב-base64, כפי שהתוסף משך אותם מפריוריטי.**
   * הכתובת לבדה לא מספיקה: היא דורשת את הסשן של הדפדפן, ומהשרת שלנו
   * היא מחזירה 200 עם דף ההתחברות. ההסבר המלא ב-`_lib/heyy-v3.ts`.
   */
  documentBase64?: string;
  /** הכתובת שממנה נמשך הקובץ. לתיעוד ולאימות מקור בלבד, לא למשיכה. */
  documentUrl?: string;
  /** שם הקובץ שהלקוח יראה בוואטסאפ. */
  documentName?: string;
}

/**
 * 🔴 **מקור המסמך מגיע מהדפדפן, ולכן הוא לא נאמן.**
 * מאז שהבייטים עצמם מגיעים מהדפדפן, הגבלת המארח כבר אינה ההגנה
 * המרכזית והיא נשארה כראיה למקור. **ההגנה שבאמת עוצרת היא בדיקת
 * הבייטים** (`%PDF-`) ותקרת הגודל, שתיהן ב-`uploadFileBytes`.
 * מי שמחזיק טוקן הוא עובד מאומת של הלקוח, וזו הכרעה מודעת.
 */
const DOC_HOSTS = (process.env.PRIORITY_DOC_HOSTS ?? 'p.priority-connect.online')
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

function documentUrlError(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return 'כתובת המסמך אינה תקינה.';
  }
  if (url.protocol !== 'https:') return 'כתובת המסמך חייבת להיות https.';
  if (!DOC_HOSTS.includes(url.hostname.toLowerCase())) {
    return 'כתובת המסמך אינה מהפריוריטי של ר.שעל.';
  }
  return null;
}

/**
 * שם הקובץ שהלקוח רואה. מנוקה מכל מה שאינו שם: נתיבים, מרכאות ושורות
 * חדשות נכנסים לכותרת של בקשת ההעלאה, ואין סיבה לתת להם להגיע לשם.
 */
function safeFileName(raw: unknown): string {
  const base = String(raw ?? '')
    .replace(/[\\/\r\n"']/g, '')
    .trim()
    .slice(0, 80);
  if (!base) return 'מסמך.pdf';
  return /\.pdf$/i.test(base) ? base : `${base}.pdf`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const user = await requireUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'unauthorized' });

  const body = (req.body ?? {}) as SendBody;
  const kind = body.kind === 'template' ? 'template' : 'text';

  const e164 = toE164(body.phone);
  const local = normalizePhone(body.phone);
  if (!e164 || !local) {
    return res.status(400).json({ ok: false, error: 'invalid_phone', message: 'המספר לא תקין.' });
  }

  if (kind === 'text' && !body.bodyText?.trim()) {
    return res.status(400).json({ ok: false, error: 'empty_body', message: 'אין מה לשלוח.' });
  }

  // ── אכיפת החלון ─────────────────────────────────────────
  //
  // 🔴 הבדיקה הזאת נכתבה ב-`ea5a5a3`, **ונפלה בשקט** בשכתוב של מחסנית
  // התבניות (`202b3cc`). היא לא הוחלפה במשהו אחר: מ-202b3cc ועד כאן
  // טקסט חופשי יצא ללקוח גם כשהחלון סגור, ו-heyy החזירה 200 על זה.
  // ההערה למעלה המשיכה לתאר הגנה שלא הייתה בקוד, וזה הסוג הגרוע ביותר
  // של תיעוד. מוחזרת כפי שהייתה, ועכשיו יש עליה בדיקה.
  if (kind === 'text') {
    const { data: conv, error } = await supabaseAdmin
      .from('wa_conversations')
      .select('last_inbound_at')
      .eq('phone_local', local)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[wa-send] window lookup failed', error.message);
      return res.status(500).json({ ok: false, error: 'server_error' });
    }

    const win = windowState(conv?.last_inbound_at ?? null);
    if (!win.open) {
      return res.status(409).json({
        ok: false,
        error: 'window_closed',
        window: win,
        message: conv
          ? 'החלון סגור. עברו 24 שעות מההודעה האחרונה של הלקוח, ולכן אפשר לשלוח רק תבנית מאושרת.'
          : 'הלקוח עוד לא כתב לנו מעולם, ולכן ההודעה הראשונה חייבת להיות תבנית מאושרת.',
      });
    }
  }

  // ── התבנית, ואימות מלא שלה בשרת ─────────────────────────
  let template: WaTemplate | null = null;
  let variables: Record<string, string> = {};
  let documentUrl: string | null = null;
  let documentBytes: Buffer | null = null;

  if (kind === 'template') {
    // 🔴 המפתח מתורגם לתבנית **בשרת, מול הטבלה**. מזהה שמגיע מהדפדפן
    // פירושו שכל מי שמחזיק טוקן יכול לשלוח כל תבנית שקיימת בחשבון של
    // הלקוח, כולל תבניות שכובו וכולל תבניות שיווק.
    try {
      template = await getTemplate(String(body.templateKey ?? ''));
    } catch (e) {
      console.error('[wa-send] template lookup failed', e);
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
    if (!template) {
      return res.status(400).json({
        ok: false,
        error: 'no_template',
        message: 'התבנית לא נמצאה או שכובתה.',
      });
    }

    // 🔴 תבנית שהמדיה בה משתנה פר נמען (המסמך מפריוריטי) דורשת קובץ חדש
    // בכל שליחה. הקובץ ששמור בתבנית הוא **תעודת הדוגמה שהוגשה למטא**,
    // ושליחתה ללקוח אמיתי היא תקלה חמורה, ולכן כאן לא נופלים אחורה אליו.
    // ⭐ מדיה **קבועה** (סרטון הדרכה) נשלחת כמו שהיא: הקובץ כבר ב-heyy.
    if (template.mediaPerMessage) {
      const b64 = String(body.documentBase64 ?? '').trim();
      if (!b64) {
        return res.status(400).json({
          ok: false,
          error: 'document_required',
          message: 'התבנית הזאת שולחת מסמך, ולא הגיעו הבייטים של הקובץ.',
        });
      }
      // כתובת נבדקת כשהיא נשלחת, כראיה שהקובץ אכן הגיע מהפריוריטי שלהם.
      const rawUrl = String(body.documentUrl ?? '').trim();
      if (rawUrl) {
        const bad = documentUrlError(rawUrl);
        if (bad) {
          return res.status(400).json({ ok: false, error: 'document_url_rejected', message: bad });
        }
        documentUrl = rawUrl;
      }
      if (!template.attachmentId) {
        return res.status(400).json({
          ok: false,
          error: 'template_missing_attachment',
          message: 'לתבנית אין מזהה קובץ מ-heyy. הרץ סנכרון תבניות במסך הניהול.',
        });
      }
      // 🔴 גוף הבקשה ב-Vercel חסום ב-4.5MB, ו-base64 מנפח בשליש.
      // עדיף להיעצר כאן עם הסבר מאשר לקבל שגיאת פלטפורמה סתומה.
      documentBytes = Buffer.from(b64, 'base64');
      if (!documentBytes.length) {
        return res.status(400).json({
          ok: false,
          error: 'document_unreadable',
          message: 'הקובץ שהגיע מהדפדפן ריק.',
        });
      }
      if (documentBytes.length > 3 * 1024 * 1024) {
        return res.status(413).json({
          ok: false,
          error: 'document_too_large',
          message: 'המסמך גדול מ-3MB ולכן לא ניתן לשלוח אותו כך.',
        });
      }
    }

    const built = buildVariables(template, body.values ?? {});
    if (built.missing.length) {
      return res.status(400).json({
        ok: false,
        error: 'missing_values',
        missing: built.missing,
        message: 'חסרים שדות בתבנית: ' + built.missing.join(', '),
      });
    }
    variables = built.variables;
  }

  // ── המסמך: פריוריטי מפיקה בדפדפן, **והדפדפן גם מוסר את הבייטים** ────
  //
  // 🔴🔴 עד 22/08/2026 השרת משך את הקובץ מהכתובת בעצמו, וזה לא עבד ולא
  // יכול היה לעבוד: הכתובת של פריוריטי דורשת את הסשן, ובלעדיו היא
  // מחזירה **200 עם דף ההתחברות** ולא שגיאה. ההסבר המלא ב-`heyy-v3.ts`.
  //
  // ⭐ שני מזהים שונים, וחסר אחד מהם והמדיה פשוט לא מצורפת:
  // `id` הוא הקובץ המצורף **בתוך הגדרת התבנית**, ו-`fileId` הוא הקובץ
  // שהועלה בפועל בשליחה הזאת.
  let attachments: Array<{ id: string; fileId: string }> | undefined;
  if (template) {
    if (documentBytes) {
      try {
        const up = await uploadFileBytes(documentBytes, safeFileName(body.documentName), 'document');
        attachments = [{ id: template.attachmentId!, fileId: up.fileId }];
      } catch (e) {
        // 🔴 תבנית שמבטיחה מסמך לא יוצאת בלעדיו. עדיף כישלון גלוי
        // מאשר הודעה שכתוב בה "מצורפת" ואין בה כלום.
        const detail = e instanceof Error ? e.message : String(e);
        const notPdf = detail.startsWith('not a pdf');
        // ⭐ הכתובת נרשמת ליד הכשל. היא לא משמשת למשיכה, אבל בלעדיה אין
        // דרך לדעת בדיעבד על איזה מסמך מדובר.
        console.error('[wa-send] document upload failed', {
          detail,
          bytes: documentBytes.length,
          from: documentUrl ?? '(לא נשלחה כתובת)',
        });
        return res.status(502).json({
          ok: false,
          error: notPdf ? 'document_not_pdf' : 'document_upload_failed',
          detail,
          // ⭐ הסיבה של הספק נאמרת על המסך ולא רק בלוג. בסבב הראשון
          // ההודעה אמרה רק "ההעלאה נכשלה", וכל אבחון דרש שליפת לוגים.
          message: notPdf
            ? `מה שהתקבל מפריוריטי אינו PDF, ולכן שום הודעה לא נשלחה. (${detail.slice(0, 200)})`
            : `ההעלאה ל-heyy נכשלה. שום הודעה לא נשלחה. (${detail.slice(0, 200)})`,
        });
      }
    } else if (
      template.attachmentId &&
      template.attachmentFileId &&
      template.attachmentKind !== 'button' &&
      !template.mediaPerMessage
    ) {
      attachments = [{ id: template.attachmentId, fileId: template.attachmentFileId }];
    }
  }

  // 🔴 שני מסלולים ושתי גרסאות API. טקסט חופשי נשאר על v2.0 שעובד,
  // ותבנית עוברת ב-v3 כי רק שם אפשר לצרף מדיה.
  const result =
    kind === 'text'
      ? await heyySendText(e164, body.bodyText!.trim())
      : await (async () => {
          const t = template!;
          const r = await sendTemplateV3({
            phoneE164: e164,
            templateId: t.heyyTemplateId,
            variables,
            attachments,
          });
          return {
            ok: r.ok,
            waMessageId: r.messageId,
            vendorMessageId: r.vendorMessageId,
            status: r.status,
            statusDetail: r.detail,
          };
        })();

  // תיעוד גם על כישלון. שליחה שנפלה בלי שורה היא שליחה שאי אפשר לחקור.
  const { data: outboundRow, error: outErr } = await supabaseAdmin
    .from('whatsapp_outbound')
    .insert({
      wa_message_id: result.waMessageId || null,
      vendor_message_id: result.vendorMessageId || null,
      phone_e164: e164,
      message_kind: kind,
      template_id: template ? template.heyyTemplateId : null,
      // ⭐ גם לתבנית נשמר הטקסט המלא שהלקוח קרא, ולא רק מזהה. בלעדיו
      // השרשור בדיעבד מציג "תבנית מאושרת" בלי שום מושג מה נאמר בה.
      body_text:
        kind === 'text'
          ? body.bodyText!.trim()
          : renderPreview(template!, body.values ?? {}),
      status: result.status,
      status_detail: result.statusDetail,
      // ⭐ מי שלח, ומאיזה מסמך. זה מה שהופך את השרשור לקריא בדיעבד.
      triggered_by: `priority-panel:${user.email ?? user.id}`,
      is_demo: isHeyyDemo,
    })
    .select('id')
    .single();

  if (outErr) {
    console.error('[wa-send] outbound insert failed', outErr.message);
  }

  return res.status(result.ok ? 200 : 502).json({
    ok: result.ok,
    waMessageId: result.waMessageId || null,
    status: result.status,
    statusDetail: result.statusDetail,
    outboundId: outboundRow?.id ?? null,
    isDemo: isHeyyDemo,
    message: result.ok
      ? null
      : 'heyy לא קיבלו את ההודעה: ' + (result.statusDetail ?? 'סיבה לא ידועה'),
  });
}
