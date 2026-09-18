import { createHash, randomBytes } from 'node:crypto';
import { supabaseAdmin } from './supabase-admin.js';
import { sendTemplate } from './heyy-v3.js';
import { checkSuppressed } from './suppression.js';
import { normalizePhone } from './phone.js';

/**
 * הנפקת קישור איפוס סיסמה ושליחתו בוואטסאפ.
 *
 * ⭐ **שני מסלולים, מנוע אחד.** המנהל שולח קישור ממסך ניהול המשתמשים
 * (`api/admin-users.ts`), והאדם עצמו מבקש ממסך ההתחברות
 * (`api/password-reset.ts`, פעולה `request`). מה שביניהם שונה הוא רק
 * **מי מזוהה ואיך**; מרגע שיש משתמש וטלפון, הכל זהה, ולכן הוא יושב כאן
 * ולא בשני עותקים. [[screen_and_sender_must_share_one_module]]
 *
 * הערובות שנשמרות כאן, כל אחת נבדקה חי ב-11/09/2026:
 *   · הטלפון נקרא מכרטיס העובד ולעולם לא מגוף הבקשה
 *   · קישור פתוח קודם מת ברגע שנשלח חדש
 *   · האסימון נשמר כ-`sha256` ולא כערך
 *   · שליחה שנכשלה סוגרת את האסימון מיד, כדי שלא תישאר כתובת חיה
 *     שאיש לא קיבל
 */

/** תוקף הקישור. רבע שעה מספיק כדי לפתוח הודעה, וקצר מכדי להישכח פתוח. */
export const RESET_TTL_MINUTES = 15;

/**
 * המפתח במרשם התבניות (`wa_templates`), לא מזהה התבנית עצמו.
 * 🔴 חייב להסכים עם `keyFor()` ב-`_lib/templates-sync.ts`, שגוזר את המפתח
 *    משם התבנית ב-heyy. שם התבנית שם: `rashal_password_reset`.
 */
const RESET_TEMPLATE_KEY = 'rashal_password_reset';

/** אישור שההודעה יצאה למספר הנכון, בלי להציג אותו במלואו. */
export function maskPhone(p: string): string {
  return p.length <= 4 ? p : `${p.slice(0, 5)}****${p.slice(-2)}`;
}

/**
 * 🔴🔴 **התבנית נשלפת ישירות ולא דרך `getTemplate`, בכוונה.**
 * `getTemplate` מסנן `active = true`, ו-`active` פירושו "מוצעת לצוות
 * בחלונית", כלומר החלטת תצוגה ולא החלטת הרשאה. תבנית חדשה נכנסת
 * מהסנכרון **כבויה**, ולכן שימוש בשער ההוא היה שובר את האיפוס בשקט עד
 * שמישהו ידליק מתג שנועד למשהו אחר לגמרי.
 * מה שכן נבדק: שמטא אישרה (`heyy_status = 'active'`).
 */
export async function getResetTemplate(): Promise<{ id: string; status: string | null } | null> {
  const { data } = await supabaseAdmin
    .from('wa_templates')
    .select('heyy_template_id, heyy_status')
    .eq('key', RESET_TEMPLATE_KEY)
    .maybeSingle();
  return data ? { id: data.heyy_template_id as string, status: (data.heyy_status as string) ?? null } : null;
}

export type IssueFailure =
  | 'suppressed'          // האדם ביקש לא לקבל מאיתנו הודעות
  | 'suppression_check'   // לא הצלחנו לבדוק, ולכן לא שלחנו
  | 'template_missing'    // התבנית לא סונכרנה מ-heyy
  | 'template_inactive'   // מטא עוד לא אישרה
  | 'db'                  // כתיבה למסד נכשלה
  | 'send';               // ההודעה לא יצאה

export type IssueResult =
  | { ok: true; sentTo: string; expiresInMinutes: number }
  | { ok: false; code: IssueFailure; status: number; error: string };

export async function issueResetLink(opts: {
  userId: string;
  phoneE164: string;
  name: string;
  /** מי יזם. `null` בשירות עצמי: אין אדם שני בתמונה. */
  createdBy: string | null;
}): Promise<IssueResult> {
  // 1) רשימת המושתקים, כמו כל שולח אחר במערכת.
  // 🔴 עד 18/09/2026 המסלול הזה לא עבר כאן: בדיקת `optout` סורקת שולחים
  //    לפי שמות פונקציה, ו-`sendTemplate` לא היה ברשימה, ולכן השולח הזה
  //    היה בלתי נראה לשער. [[a_guard_that_scans_by_name_misses_a_new_name]]
  // 🔴 רשימת המושתקים מחזיקה את הצורה המקומית, ולכן עוברים דרך
  //    `normalizePhone` המשותף ולא דרך חיתוך מחרוזת מקומי.
  const gate = await checkSuppressed(normalizePhone(opts.phoneE164) ?? opts.phoneE164);
  if (!gate.allowed) {
    return {
      ok: false,
      code: gate.reason === 'suppressed' ? 'suppressed' : 'suppression_check',
      status: gate.reason === 'suppressed' ? 409 : 503,
      error: gate.message,
    };
  }

  // 2) התבנית
  const template = await getResetTemplate();
  if (!template) {
    return {
      ok: false, code: 'template_missing', status: 503,
      error: 'תבנית איפוס הסיסמה עדיין לא מסונכרנת מ-heyy.',
    };
  }
  if (template.status && template.status !== 'active') {
    return {
      ok: false, code: 'template_inactive', status: 503,
      error: `תבנית האיפוס אינה מאושרת (${template.status}).`,
    };
  }

  // 3) 🔴 קישור פתוח קודם מת ברגע שנשלח חדש. אחרת נשארות בשטח כמה
  //    כתובות חיות לאותו חשבון, וכל אחת מהן מספיקה כדי להשתלט עליו.
  await supabaseAdmin
    .from('password_reset_tokens')
    .update({ expires_at: new Date().toISOString() })
    .eq('user_id', opts.userId)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString());

  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60_000).toISOString();

  const { data: row, error: insErr } = await supabaseAdmin
    .from('password_reset_tokens')
    .insert({
      user_id: opts.userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_by: opts.createdBy,
      sent_to_phone: opts.phoneE164,
    })
    .select('id')
    .single();
  if (insErr || !row) {
    return { ok: false, code: 'db', status: 500, error: insErr?.message ?? 'insert failed' };
  }

  const sent = await sendTemplate({
    phoneE164: opts.phoneE164,
    templateId: template.id,
    variables: { name: opts.name, token },
  });

  await supabaseAdmin
    .from('password_reset_tokens')
    .update({ send_ok: sent.ok, send_detail: sent.ok ? null : String(sent.detail ?? '').slice(0, 300) })
    .eq('id', row.id);

  // 🔴 שליחה שנכשלה משאירה אסימון חי שאיש לא קיבל. הוא נסגר מיד,
  //    אחרת הוא ממתין רבע שעה ככתובת תקפה שאין לה בעלים.
  if (!sent.ok) {
    await supabaseAdmin
      .from('password_reset_tokens')
      .update({ expires_at: new Date().toISOString() })
      .eq('id', row.id);
    return {
      ok: false, code: 'send', status: 502,
      error: `ההודעה לא יצאה: ${sent.detail ?? 'שגיאה לא ידועה'}`,
    };
  }

  return { ok: true, sentTo: maskPhone(opts.phoneE164), expiresInMinutes: RESET_TTL_MINUTES };
}
