import { supabaseAdmin } from './supabase-admin.js';
import type { WaUi } from './ui-source.js';

/**
 * שורה אחת ב-`wa_ui_usage_log`. ראה `20261018_wa_ui_usage.sql`.
 *
 * 🔴 נכשל בשקט: מדידה שלא נרשמה אינה סיבה להפיל את הפעולה של העובד.
 * ⭐ ממתינים לה ולא משגרים ברקע, כי Vercel עוצר את הפונקציה כשהתשובה יצאה.
 */
export async function recordWaUsage(
  user: { id: string; email: string | null },
  ui: WaUi,
  event: 'open' | 'read' | 'context',
): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('wa_ui_usage_log').insert({
      user_id: user.id,
      email: user.email ? user.email.toLowerCase() : null,
      ui,
      event,
    });
    if (error) console.error('[ui-usage] insert failed', error.message);
  } catch (e) {
    console.error('[ui-usage] insert threw', e instanceof Error ? e.message : e);
  }
}
