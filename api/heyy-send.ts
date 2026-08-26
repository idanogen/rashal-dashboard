import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabase-admin.js';
import { heyySendTemplate, heyySendText, isHeyyDemo } from './_lib/heyy-server.js';
import { toE164 } from './_lib/phone.js';
import { requireCaller, warnIfSecretMissing } from './_lib/require-caller.js';

/**
 * שליחה מהדשבורד וממנוע הסקרים. עוטף `heyySendText` / `heyySendTemplate`,
 * רושם ל-`whatsapp_outbound`, ובתזכורות גם ל-`whatsapp_reminder_log`.
 *
 * 🔴🔴 **נקודת הקצה הזאת הייתה פתוחה לחלוטין עד 22/08/2026.** בלי אימות,
 * בלי סוד, בלי כלום. מי שהחזיק את הכתובת יכול היה לשלוח וואטסאפ מהמספר
 * הרשמי של ר.שעל, על חשבון ה-heyy של עוגן, לכל מספר שירצה ובכל נוסח.
 * זה היה ידוע ונדחה במכוון שלושה סבבים, וזו בדיוק הסיבה שנבנתה
 * `api/wa-send` נפרדת במקום לתקן כאן.
 *
 * ⭐ עכשיו: או משתמש מחובר, או סוד משותף לקורא מכונתי. ראה `require-caller`.
 */

interface SendBody {
  kind: 'text' | 'template';
  phoneE164: string;
  bodyText?: string;
  templateId?: string;
  /** משתני התבנית **לפי שם**. heyy לא תומך במיקום — ראה ההערה ב-heyy-server.ts. */
  variables?: Array<{ name: string; value: string }>;
  /** @deprecated מערך ערכים לפי מיקום. נשמר לתאימות עם מסכים ישנים; מומר לשמות. */
  parameters?: string[];
  orderId?: string;
  reminderKind?: 'delivery_reminder' | 'schedule_request' | 'team_notification' | 'custom';
  triggeredBy?: string;
}

/**
 * ממיר את הקלט לרשימת משתנים לפי שם. קריאה ישנה שמעבירה מערך לפי מיקום
 * ממופה ל-"1","2","3"..., שזה מה שהעורך של heyy נותן כברירת מחדל כשלא
 * מגדירים שם. עדיין עדיף לשלוח שמות מפורשים.
 */
function normalizeVariables(body: SendBody): Array<{ name: string; value: string }> {
  if (body.variables?.length) return body.variables;
  return (body.parameters ?? []).map((value, i) => ({ name: String(i + 1), value }));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  warnIfSecretMissing('heyy-send');
  const caller = await requireCaller(req);
  if (!caller) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const body = req.body as SendBody;

  if (!body || !body.kind || !body.phoneE164) {
    return res.status(400).json({ ok: false, error: 'missing kind or phoneE164' });
  }

  const e164 = toE164(body.phoneE164);
  if (!e164) {
    return res.status(400).json({ ok: false, error: 'invalid phone' });
  }

  // Cooldown check (only for reminders attached to an order)
  if (body.orderId && body.reminderKind) {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from('whatsapp_reminder_log')
      .select('id, sent_at')
      .eq('order_id', body.orderId)
      .eq('reminder_kind', body.reminderKind)
      .gte('sent_at', cutoff)
      .limit(1);
    if (recent && recent.length > 0) {
      return res.status(429).json({
        ok: false,
        statusDetail: `cooldown: a ${body.reminderKind} was already sent for this order in the last 48h`,
        isDemo: isHeyyDemo,
      });
    }
  }

  // Call heyy
  const result =
    body.kind === 'text'
      ? await heyySendText(e164, body.bodyText ?? '')
      : await heyySendTemplate(e164, body.templateId ?? '', normalizeVariables(body));

  // Log to whatsapp_outbound regardless of success
  const { data: outboundRow, error: outboundErr } = await supabaseAdmin
    .from('whatsapp_outbound')
    .insert({
      // מחרוזת ריקה אינה מזהה. NULL הוא, כי הוא לא מתחזה להתאמה אפשרית.
      wa_message_id: result.waMessageId || null,
      vendor_message_id: result.vendorMessageId || null,
      phone_e164: e164,
      message_kind: body.kind,
      template_id: body.kind === 'template' ? body.templateId : null,
      template_params: body.kind === 'template' ? body.parameters ?? [] : null,
      body_text: body.kind === 'text' ? body.bodyText : null,
      reminder_kind: body.reminderKind ?? null,
      status: result.status,
      status_detail: result.statusDetail,
      order_id: body.orderId ?? null,
      // ⭐ מי שלח באמת, ולא רק מה שהקורא הצהיר. שדה שהדפדפן ממלא לבדו
      // אינו תיעוד, כי אפשר לכתוב בו כל דבר.
      triggered_by: body.triggeredBy ? `${body.triggeredBy} (${caller.label})` : caller.label,
      is_demo: isHeyyDemo,
    })
    .select()
    .single();

  if (outboundErr) {
    console.error('[heyy-send] DB insert failed:', outboundErr.message);
    return res.status(500).json({ ok: false, error: outboundErr.message, isDemo: isHeyyDemo });
  }

  // Write reminder log on success (for cooldown enforcement)
  if (result.ok && body.orderId && body.reminderKind) {
    await supabaseAdmin.from('whatsapp_reminder_log').insert({
      order_id: body.orderId,
      reminder_kind: body.reminderKind,
      phone_e164: e164,
      outbound_id: outboundRow.id,
    });

    // Update orders.last_reminder_at for quick display
    await supabaseAdmin
      .from('orders')
      .update({ last_reminder_at: new Date().toISOString() })
      .eq('id', body.orderId);
  }

  return res.status(result.ok ? 200 : 502).json({
    ok: result.ok,
    waMessageId: result.waMessageId,
    status: result.status,
    statusDetail: result.statusDetail,
    // 🔴 **מכסת קצב אינה דחייה של התוכן.** בלי הסימן הזה הקורא (מנוע
    // הסקרים) מסמן את הפריט `failed` וזורק אותו, וההודעה נעלמת לתמיד
    // דווקא ברגע העמוס. עם הסימן הוא מחזיר אותו לתור.
    retryable: result.retryable === true,
    isDemo: isHeyyDemo,
    outboundId: outboundRow.id,
  });
}
