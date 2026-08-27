import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabase-admin.js';
import { heyySendTemplate, isHeyyDemo } from './_lib/heyy-server.js';
import { getTemplate } from './_lib/templates-store.js';
import { checkSuppressed } from './_lib/suppression.js';
import { normalizePhone, toE164 } from './_lib/phone.js';

/**
 * עבודת הערב: תזכורת ליום המחר, ומדריך הבטיחות אחרי אספקת מנוף.
 *
 * ═══════════════════════════════════════════════════════════════════
 * 🔴🔴 **מה שהיה כאן קודם לא שלח מעולם ולו הודעה אחת, ולא היה יכול.**
 * ═══════════════════════════════════════════════════════════════════
 * העבודה הישנה שאלה `orders.delivery_date = today`. נמדד ב-27/08/2026:
 * **`delivery_date` ריק בכל 47,263 ההזמנות במסד.** השיבוץ עבר מזמן
 * ל-`calendar_stops`, והעמודה הישנה נשארה ולא מולאה. הקרון רץ, החזיר
 * 200, ועיבד אפס שורות. בטבלת היוצאות יש **אפס שורות מסוג
 * `delivery_reminder`** מאז ומעולם. [[filter_on_missing_field_hides_work]]
 * ⭐ ובנוסף הוא הצביע על `DEMO-delivery-reminder`, מזהה תבנית שמעולם
 * לא הוגש למטא, בדיוק כמו `DEMO-schedule-coordination` שנתפס ב-25/08.
 *
 * ═══════════════════════════════════════════════════════════════════
 * 🔴 **ולמה היא רצה בערב ולא בבוקר, וזה נמדד ולא הועדף.**
 * ═══════════════════════════════════════════════════════════════════
 * העבודה הישנה רצה ב-06:00 UTC. אבל אצל ר.שעל **מתי משבצים** קובע מתי
 * אפשר להזכיר. מדידה על 45 יום (587 עצירות):
 *
 * | מתי שובץ | כמה |
 * |---|---|
 * | יום מראש | **400** (68%) |
 * | באותו יום | 143 (24%) |
 * | 3 ימים מראש | 41 |
 *
 * ומתוך 400 השיבוצים ליום מראש, **306 נוצרו בין 16:00 ל-18:00**, בשיא
 * של 176 בשעה 16:00. קרון של הבוקר היה רץ לפני שהסדרן בכלל התחיל,
 * ומוצא יומן ריק. לכן **18:30 שעון ישראל**, אחרי שהוא סיים.
 *
 * ═══════════════════════════════════════════════════════════════════
 * 🔴 **והיא כבויה כברירת מחדל, בכוונה.**
 * ═══════════════════════════════════════════════════════════════════
 * נכון לכתיבת השורות האלה **טרם יצאה ולו הודעת תיאום אמיתית אחת ללקוח
 * של ר.שעל**, וזה ממתין לאישור של עידן. עבודה שמתחילה לשלוח מעצמה
 * לעשרים לקוחות בערב הראשון שהיא נפרסת היא בדיוק מה שאסור.
 * בלי `WA_REMINDERS_ENABLED=1` היא **מחשבת ומדווחת ואינה שולחת**,
 * וזו גם הדרך לראות בדיוק מי היה מקבל מה לפני שמדליקים.
 */

/** ⭐ ההגנה: בלי המשתנה הזה שום דבר לא יוצא, ומה שהיה נשלח מדווח. */
const ARMED = process.env.WA_REMINDERS_ENABLED === '1';

const REMINDER_KEY = 'rashal_visit_reminder';
const CRANE_GUIDE_KEY = 'crane_safety';

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

/** תאריך מקומי בישראל, `YYYY-MM-DD`, עם היסט של מספר ימים. */
function israelDate(offsetDays = 0): string {
  const now = new Date(Date.now() + offsetDays * 86_400_000);
  // ⭐ `sv-SE` נותן בדיוק `YYYY-MM-DD`, ולכן אין כאן חישוב ידני של אזור זמן.
  return now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Jerusalem' });
}

/**
 * "2026-08-28" ⟵ "שישי, 28.8.2026".
 * 🔴 בלי המילה "יום" בהתחלה: הגוף שאושר אומר "ביום {{day}}", וערך
 * שנפתח ב"יום" מייצר "ביום יום שישי" בהודעה שיוצאת ללקוח.
 * הנוסח המלא ב-`src/lib/coordination-message.ts`; כאן עותק כי
 * `api/` אינו יכול לייבא מ-`src/`, ויש על ההתאמה בדיקה.
 */
function hebrewDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? '').trim());
  if (!m) return String(iso ?? '');
  const [, y, mo, d] = m;
  const at = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  if (Number.isNaN(at.getTime())) return iso;
  return `${DAY_NAMES[at.getUTCDay()]}, ${Number(d)}.${Number(mo)}.${y}`;
}

function hoursLabel(start: string | null, end: string | null): string {
  const s = (start ?? '').trim().slice(0, 5);
  const e = (end ?? '').trim().slice(0, 5);
  if (!s || !e) return s || e || '';
  return `${s} עד ${e}`;
}

/** ⭐ אותה רשימה סגורה שבדיאלוג, כדי שהערך שיוצא למטא יהיה זהה. */
const PURPOSE_BY_SOURCE: Record<string, string> = {
  delivery: 'לאספקת הציוד',
  pickup: 'לאיסוף הציוד',
  service: 'לביקור טכנאי',
  task: 'לביקור טכנאי',
  customer: 'לאספקת הציוד',
  inspection: 'לביקור טכנאי',
};

interface StopRow {
  id: string;
  customer_name: string | null;
  phone: string | null;
  delivery_date: string | null;
  time_window_start: string | null;
  time_window_end: string | null;
  source_type: string;
  order_id: string | null;
}

interface Plan {
  stopId: string;
  customer: string;
  phone: string;
  kind: 'reminder' | 'crane_guide';
  preview: string;
  status: 'planned' | 'sent' | 'skipped' | 'failed';
  detail?: string;
}

/** `G` + שלוש ספרות + `E` אופציונלי. זהה ל-`src/lib/crane-identity.ts`. */
const CRANE_MODEL_RE = /^G\d{3}E?$/i;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const tomorrow = israelDate(1);
  const today = israelDate(0);
  const plans: Plan[] = [];

  // ─── א. תזכורת ליום המחר ────────────────────────────────────────────
  const reminderTpl = await getTemplate(REMINDER_KEY).catch(() => null);

  const { data: stops, error } = await supabaseAdmin
    .from('calendar_stops')
    .select(
      'id, customer_name, phone, delivery_date, time_window_start, time_window_end, source_type, order_id'
    )
    .eq('delivery_date', tomorrow)
    .in('status', ['planned', 'in_progress'])
    .not('phone', 'is', null);

  if (error) {
    console.error('[cron] stops fetch failed:', error.message);
    return res.status(500).json({ ok: false, error: error.message });
  }

  for (const stop of (stops as StopRow[] | null) ?? []) {
    const local = normalizePhone(stop.phone);
    const e164 = toE164(stop.phone);
    if (!local || !e164) {
      plans.push({
        stopId: stop.id, customer: stop.customer_name ?? '', phone: stop.phone ?? '',
        kind: 'reminder', preview: '', status: 'skipped', detail: 'טלפון לא תקין',
      });
      continue;
    }

    const values = {
      customer_name: (stop.customer_name ?? '').trim() || 'לקוח יקר',
      purpose: PURPOSE_BY_SOURCE[stop.source_type] ?? 'לביקור טכנאי',
      day: hebrewDay(stop.delivery_date ?? tomorrow),
      hours: hoursLabel(stop.time_window_start, stop.time_window_end),
    };
    const preview = `תזכורת: מחר, יום ${values.day}, נגיע אליכם ${values.purpose}${
      values.hours ? ` בין השעות ${values.hours}` : ''
    }.`;

    const plan: Plan = {
      stopId: stop.id, customer: values.customer_name, phone: local,
      kind: 'reminder', preview, status: 'planned',
    };

    // 🔴 מושתק לפני כל דבר אחר.
    const verdict = await checkSuppressed(local);
    if (!verdict.allowed) {
      plans.push({ ...plan, status: 'skipped', detail: verdict.message });
      continue;
    }

    // ⭐ צינון: תזכורת אחת לעצירה. הקרון מריץ פעם ביום, אבל הפעלה ידנית
    // חוזרת הייתה שולחת שוב, ותזכורת כפולה נקראת כמו תקלה.
    const { data: already } = await supabaseAdmin
      .from('whatsapp_reminder_log')
      .select('id')
      .eq('stop_id', stop.id)
      .eq('reminder_kind', 'visit_reminder')
      .limit(1);
    if (already && already.length > 0) {
      plans.push({ ...plan, status: 'skipped', detail: 'כבר נשלחה תזכורת לעצירה הזאת' });
      continue;
    }

    if (!ARMED) {
      plans.push({ ...plan, status: 'planned', detail: 'המנגנון כבוי (WA_REMINDERS_ENABLED)' });
      continue;
    }
    if (!reminderTpl) {
      // 🔴 בקול, ולא בשקט: תבנית חסרה היא הסיבה שהמנגנון הקודם "עבד" שנה.
      plans.push({ ...plan, status: 'failed', detail: `התבנית ${REMINDER_KEY} אינה רשומה ואינה פעילה` });
      continue;
    }

    const result = await heyySendTemplate(
      e164,
      reminderTpl.heyyTemplateId,
      Object.entries(values).map(([name, value]) => ({ name, value }))
    );
    const { data: out } = await supabaseAdmin
      .from('whatsapp_outbound')
      .insert({
        wa_message_id: result.waMessageId ?? null,
        phone_e164: e164,
        message_kind: 'template',
        template_id: reminderTpl.heyyTemplateId,
        template_params: Object.values(values),
        reminder_kind: 'visit_reminder',
        status: result.status,
        status_detail: result.statusDetail,
        triggered_by: 'cron',
        is_demo: isHeyyDemo,
      })
      .select('id')
      .single();

    if (result.ok) {
      await supabaseAdmin.from('whatsapp_reminder_log').insert({
        stop_id: stop.id,
        reminder_kind: 'visit_reminder',
        phone_e164: e164,
        outbound_id: out?.id,
      });
      plans.push({ ...plan, status: 'sent' });
    } else {
      plans.push({ ...plan, status: 'failed', detail: result.statusDetail });
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  // ─── ב. מדריך הבטיחות אחרי אספקת מנוף ──────────────────────────────
  //
  // ⭐ **התבנית כבר קיימת ומאושרת** (`crane_safety`), עם סרטון ההדרכה
  // מוטמע בה ובלי שום משתנה. שלומי ביקש "מדריך וסרטון אחרי אספקה",
  // וזה בדיוק מה שיש. לכן אין כאן הגשה חדשה למטא, רק הפעלה.
  //
  // 🔴 **ולפי מק״ט השורה ולא לפי המילה "מנוף" בתיאור**: 4,500 שורות
  // ערסל ו-3,000 שורות השתתפות עצמית נושאות את המילה, והתאמה עליה
  // הייתה שולחת מדריך מנוף למי שקיבל ערסל.
  const guideTpl = await getTemplate(CRANE_GUIDE_KEY).catch(() => null);

  const { data: doneToday } = await supabaseAdmin
    .from('calendar_stops')
    .select('id, customer_name, phone, delivery_date, source_type, order_id')
    .eq('delivery_date', today)
    .eq('status', 'completed')
    .eq('source_type', 'delivery')
    .not('phone', 'is', null);

  for (const stop of (doneToday as StopRow[] | null) ?? []) {
    if (!stop.order_id) continue;
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('items')
      .eq('id', stop.order_id)
      .maybeSingle();
    const items = (order?.items ?? []) as Array<{ part?: string | null }>;
    const crane = items.find((i) => CRANE_MODEL_RE.test((i.part ?? '').trim()));
    if (!crane) continue;

    const local = normalizePhone(stop.phone);
    const e164 = toE164(stop.phone);
    if (!local || !e164) continue;

    const plan: Plan = {
      stopId: stop.id,
      customer: stop.customer_name ?? '',
      phone: local,
      kind: 'crane_guide',
      preview: `מדריך בטיחות וסרטון הדרכה למנוף ${crane.part}`,
      status: 'planned',
    };

    const verdict = await checkSuppressed(local);
    if (!verdict.allowed) {
      plans.push({ ...plan, status: 'skipped', detail: verdict.message });
      continue;
    }

    const { data: already } = await supabaseAdmin
      .from('whatsapp_reminder_log')
      .select('id')
      .eq('stop_id', stop.id)
      .eq('reminder_kind', 'crane_guide')
      .limit(1);
    if (already && already.length > 0) {
      plans.push({ ...plan, status: 'skipped', detail: 'המדריך כבר נשלח' });
      continue;
    }

    if (!ARMED) {
      plans.push({ ...plan, status: 'planned', detail: 'המנגנון כבוי (WA_REMINDERS_ENABLED)' });
      continue;
    }
    if (!guideTpl) {
      plans.push({ ...plan, status: 'failed', detail: `התבנית ${CRANE_GUIDE_KEY} אינה פעילה` });
      continue;
    }

    const result = await heyySendTemplate(e164, guideTpl.heyyTemplateId, []);
    const { data: out } = await supabaseAdmin
      .from('whatsapp_outbound')
      .insert({
        wa_message_id: result.waMessageId ?? null,
        phone_e164: e164,
        message_kind: 'template',
        template_id: guideTpl.heyyTemplateId,
        template_params: [],
        reminder_kind: 'crane_guide',
        status: result.status,
        status_detail: result.statusDetail,
        order_id: stop.order_id,
        triggered_by: 'cron',
        is_demo: isHeyyDemo,
      })
      .select('id')
      .single();

    if (result.ok) {
      await supabaseAdmin.from('whatsapp_reminder_log').insert({
        stop_id: stop.id,
        reminder_kind: 'crane_guide',
        phone_e164: e164,
        outbound_id: out?.id,
      });
      plans.push({ ...plan, status: 'sent' });
    } else {
      plans.push({ ...plan, status: 'failed', detail: result.statusDetail });
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  const count = (s: Plan['status']) => plans.filter((p) => p.status === s).length;
  return res.status(200).json({
    ok: true,
    armed: ARMED,
    demo: isHeyyDemo,
    tomorrow,
    today,
    reminderTemplate: reminderTpl?.heyyTemplateId ?? null,
    guideTemplate: guideTpl?.heyyTemplateId ?? null,
    summary: {
      planned: count('planned'),
      sent: count('sent'),
      skipped: count('skipped'),
      failed: count('failed'),
    },
    plans,
  });
}
