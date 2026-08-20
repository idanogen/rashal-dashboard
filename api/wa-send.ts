import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser } from './_lib/require-user.js';
import { supabaseAdmin } from './_lib/supabase-admin.js';
import { heyySendTemplate, heyySendText, isHeyyDemo } from './_lib/heyy-server.js';
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
  // ── התבנית, ואימות מלא שלה בשרת ─────────────────────────
  let template: WaTemplate | null = null;
  let variables: Array<{ name: string; value: string }> = [];

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

    // 🔴 תבנית עם קובץ בכותרת דורשת כתובת למסמך בכל שליחה, ומסלול הפקת
    // המסמך מפריוריטי עוד לא נבנה אצל ר.שעל. עדיף לומר את זה מפורשות
    // מאשר לשלוח תבנית שתגיע ללקוח בלי הקובץ שהיא מבטיחה.
    if (template.hasDocumentHeader) {
      return res.status(400).json({
        ok: false,
        error: 'document_not_wired',
        message: 'שליחת מסמך עוד לא מחוברת. המסמך עצמו עדיין לא מופק מפריוריטי.',
      });
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

  const result =
    kind === 'text'
      ? await heyySendText(e164, body.bodyText!.trim())
      : await heyySendTemplate(e164, template!.heyyTemplateId, variables);

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
