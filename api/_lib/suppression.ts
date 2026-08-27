import { supabaseAdmin } from './supabase-admin.js';

/**
 * רשימת המושתקים: בדיקה אחת שכל שולח חייב לעבור דרכה.
 *
 * 🔴🔴 **הוצאה לכאן ב-27/08/2026 כי נוסף שולח שני.** עד אז הבדיקה ישבה
 * בתוך `wa-send` בלבד, ובדיוק כך נולד הפער הקודם: `api/heyy-send` שלח
 * בלי לבדוק, ותיאום יצא ללקוח שביקש להפסיק. שולח שלישי שייכתב מחר
 * יעבור כאן ולא ישכפל את התנאי.
 * [[screen_and_sender_must_share_one_module]]
 *
 * 🔴 **כשל בבדיקה עוצר את השליחה ואינו מדלג עליה.** שער שנפתח כשהוא
 * שבור אינו שער. [[fetch_helper_swallows_non_json]]
 */
export type SuppressionVerdict =
  | { allowed: true }
  | { allowed: false; reason: 'suppressed' | 'check_failed'; message: string };

export async function checkSuppressed(phoneLocal: string): Promise<SuppressionVerdict> {
  const { data, error } = await supabaseAdmin
    .from('wa_suppressed')
    .select('phone_local')
    .eq('phone_local', phoneLocal)
    .maybeSingle();

  if (error) {
    console.error('[suppression] check failed', error.message);
    return {
      allowed: false,
      reason: 'check_failed',
      message: 'לא הצלחתי לבדוק את רשימת המושתקים, ולכן לא שלחתי.',
    };
  }
  if (data) {
    return {
      allowed: false,
      reason: 'suppressed',
      message: 'הלקוח הזה ביקש שלא נפנה אליו בוואטסאפ.',
    };
  }
  return { allowed: true };
}
