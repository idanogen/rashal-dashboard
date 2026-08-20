import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser } from './_lib/require-user.js';
import { supabaseAdmin } from './_lib/supabase-admin.js';
import { heyySendTemplate, heyySendText, isHeyyDemo } from './_lib/heyy-server.js';
import { toE164, normalizePhone } from './_lib/phone.js';
import { windowState } from './_lib/thread.js';

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
  templateId?: string;
  variables?: Array<{ name: string; value: string }>;
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
  if (kind === 'template' && !body.templateId) {
    return res.status(400).json({ ok: false, error: 'no_template', message: 'לא נבחרה תבנית.' });
  }

  // ── אכיפת החלון ─────────────────────────────────────────
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

  const result =
    kind === 'text'
      ? await heyySendText(e164, body.bodyText!.trim())
      : await heyySendTemplate(e164, body.templateId!, body.variables ?? []);

  // תיעוד גם על כישלון. שליחה שנפלה בלי שורה היא שליחה שאי אפשר לחקור.
  const { data: outboundRow, error: outErr } = await supabaseAdmin
    .from('whatsapp_outbound')
    .insert({
      wa_message_id: result.waMessageId || null,
      vendor_message_id: result.vendorMessageId || null,
      phone_e164: e164,
      message_kind: kind,
      template_id: kind === 'template' ? body.templateId : null,
      body_text: kind === 'text' ? body.bodyText!.trim() : null,
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
