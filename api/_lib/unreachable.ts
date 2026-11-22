import { supabaseAdmin } from './supabase-admin.js';

/**
 * מספר שאינו בוואטסאפ: הפסקה של 30 יום בהודעות האוטומטיות (13/11/2026, הכרעת עידן).
 *
 * הכלל במסד בלבד (`wa_phone_paused`, 20261113_wa_unreachable_pause.sql): מטא החזירה
 * "unable to deliver" ב-30 הימים האחרונים, ואף הודעה לא הגיעה אליו מאז. כאן רק השאלה
 * והרישום. נבדק בשליחה אוטומטית בלבד (heyy-send לקורא מכונתי, תזכורות הערב); המשרד
 * ששולח ידנית יכול לנסות תמיד.
 *
 * ⭐ ההפך מרשימת המושתקים: כשל בבדיקה **מאפשר** את השליחה. מושתק הוא בקשה של הלקוח,
 * ושליחה אליו היא פגיעה. מספר מת הוא רק בזבוז, וכשל כאן לא צריך לעצור הודעות תקינות.
 */
export const PAUSED_ERROR = 'unreachable_paused';
export const PAUSED_DETAIL = 'paused: unable to deliver earlier, the number is not on WhatsApp (30 day pause)';

/** המנועים שפונים ללקוח מעצמם. העתק טופס (form-copy) ודוח הבוקר לצוות אינם כאן בכוונה. */
const AUTOMATIC_PREFIXES = ['media-request-', 'on-way-engine', 'survey-engine'];
export function isAutomaticTrigger(triggeredBy: string | undefined | null): boolean {
  return !!triggeredBy && AUTOMATIC_PREFIXES.some((p) => triggeredBy.startsWith(p));
}

export async function isPhonePaused(e164: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc('wa_phone_paused', { p_phone: e164 });
  if (error) {
    console.error('[unreachable] check failed, sending anyway', error.message);
    return false;
  }
  return data === true;
}

/**
 * שורת יומן לדילוג, כדי שהדוח השבועי ימשיך להראות את הלקוח (הוא עדיין לא קיבל כלום).
 * `status_detail` מתחיל ב-"paused:" ולכן לא מאריך את ההפסקה עצמה.
 */
export async function logPausedSend(row: {
  phoneE164: string; templateId?: string | null; variables?: unknown; reminderKind?: string | null;
  orderId?: string | null; triggeredBy: string;
}): Promise<void> {
  const { error } = await supabaseAdmin.from('whatsapp_outbound').insert({
    phone_e164: row.phoneE164,
    message_kind: 'template',
    template_id: row.templateId ?? null,
    template_params: row.variables ?? null,
    reminder_kind: row.reminderKind ?? null,
    status: 'failed',
    status_detail: PAUSED_DETAIL,
    order_id: row.orderId ?? null,
    triggered_by: row.triggeredBy,
    is_demo: false,
  });
  if (error) console.error('[unreachable] log failed', error.message);
}
