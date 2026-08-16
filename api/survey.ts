import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabase-admin.js';

/**
 * עמוד הסקר של הלקוח, צד השרת.
 *
 * זו נקודת הקצה הציבורית היחידה במערכת: הלקוח מגיע אליה מקישור בוואטסאפ,
 * בלי משתמש ובלי סיסמה. לכן שני עקרונות שאסור לוותר עליהם:
 *
 * 1. הטבלה `customer_surveys` סגורה לחלוטין ל-anon (RLS בלי policy). כל גישה
 *    עוברת כאן, עם הרשאת שרת. אין דרך לשלוף ממנה רשימה מהדפדפן.
 * 2. התשובה ל-GET מחזירה שם פרטי בלבד. לא טלפון, לא כתובת, לא מספר לקוח,
 *    ולא פרטי הזמנה. גם מי שאיכשהו יחזיק טוקן זר לא ילמד ממנו כלום.
 *
 * GET  /api/survey?token=…   → { ok, customerName, alreadyAnswered }
 * POST /api/survey           ← { token, q1, q2, comment }
 */

/** הטוקן נוצר במסד כ-uuid בלי מקפים. כל דבר אחר נפסל לפני שהוא נוגע במסד. */
const TOKEN_RE = /^[0-9a-f]{32}$/;

const MAX_COMMENT = 2000;

/** ציון תקין: מספר שלם בין 1 ל-5, או ריק. שאלה שלא נענתה אינה שגיאה. */
function parseScore(v: unknown): number | null | undefined {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 5) return undefined; // undefined = פסול
  return n;
}

/**
 * השם שמוצג ללקוח: **השם המלא, כמו שהוא**.
 *
 * 🔴 אל תנסו לחלץ מכאן שם פרטי. ניסינו, וזה נכשל על נתונים אמיתיים.
 * בפריוריטי אין שדה שם פרטי בכלל (`priority_customers` מחזיקה רק `cdes`),
 * והשם המלא מגיע בשני הכיוונים גם יחד:
 *
 *   רטיג חווה         משפחה ואז פרטי
 *   אמה חצבי          פרטי ואז משפחה
 *   בן נעים שלמה      משפחה משתי מילים ואז פרטי
 *   ליפשיץ מנחם צבי   משפחה ואז שני שמות פרטיים
 *
 * כל כלל שייבחר יפנה לחלק מהמטופלים בשם המשפחה שלהם. מטופל מבוגר שמקבל
 * "שלום חצבי" מבין שמדובר במשלוח אוטומטי, וזה בדיוק מה שהסקר לא צריך.
 * השם המלא רשמי במקצת, אבל לעולם אינו שגוי.
 *
 * מנוקה מרווחים כפולים, שקיימים במסד ("בן גיגי  מרים").
 * שם ריק אינו שגיאה: העמוד פשוט נפתח בלי פנייה אישית.
 */
function displayName(full: string | null | undefined): string {
  return String(full ?? '').trim().replace(/\s+/g, ' ');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // העמוד מוגש מאותו מקור, אבל כשהסקר יעבור לתת-דומיין של ר.שעל זה כבר לא
  // יהיה נכון. משאירים את הכותרת פתוחה לקריאה בלבד של נקודת הקצה הזו.
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'POST') return handlePost(req, res);
  return res.status(405).json({ ok: false, error: 'method_not_allowed' });
}

async function handleGet(req: VercelRequest, res: VercelResponse) {
  const token = String(req.query.token ?? '');
  if (!TOKEN_RE.test(token)) {
    return res.status(404).json({ ok: false, error: 'not_found' });
  }

  const { data, error } = await supabaseAdmin
    .from('customer_surveys')
    .select('id, customer_name, answered_at, opened_at')
    .eq('token', token)
    .maybeSingle();

  if (error) {
    console.error('[survey] lookup failed', error);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
  if (!data) {
    return res.status(404).json({ ok: false, error: 'not_found' });
  }

  // חותמת פתיחה ראשונה בלבד. היא משמשת למדוד כמה אנשים הקישו ולא ענו,
  // וזה מספר אחר לגמרי מ"כמה לא פתחו בכלל".
  if (!data.opened_at) {
    await supabaseAdmin
      .from('customer_surveys')
      .update({ opened_at: new Date().toISOString() })
      .eq('id', data.id)
      .is('opened_at', null);
  }

  return res.status(200).json({
    ok: true,
    customerName: displayName(data.customer_name),
    alreadyAnswered: Boolean(data.answered_at),
  });
}

async function handlePost(req: VercelRequest, res: VercelResponse) {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const token = String(body.token ?? '');

  if (!TOKEN_RE.test(token)) {
    return res.status(404).json({ ok: false, error: 'not_found' });
  }

  const q1 = parseScore(body.q1);
  const q2 = parseScore(body.q2);
  if (q1 === undefined || q2 === undefined) {
    return res.status(400).json({ ok: false, error: 'bad_score' });
  }

  const rawComment = typeof body.comment === 'string' ? body.comment.trim() : '';
  if (rawComment.length > MAX_COMMENT) {
    return res.status(400).json({ ok: false, error: 'comment_too_long' });
  }
  const comment = rawComment || null;

  // שליחה ריקה לגמרי אינה תשובה. עדיף שהעמוד יבקש לסמן משהו מאשר שנרשום
  // שורה שנענתה בלי תוכן, שתעוות אחר כך את שיעור המענה.
  if (q1 === null && q2 === null && !comment) {
    return res.status(400).json({ ok: false, error: 'empty' });
  }

  const { data: existing, error: findErr } = await supabaseAdmin
    .from('customer_surveys')
    .select('id, answered_at')
    .eq('token', token)
    .maybeSingle();

  if (findErr) {
    console.error('[survey] lookup failed', findErr);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
  if (!existing) {
    return res.status(404).json({ ok: false, error: 'not_found' });
  }

  // 🔴 תשובה קיימת לא נדרסת. הלקוח שמרענן את העמוד, או מקיש שוב על הקישור
  // מההודעה בעוד שבוע, לא מוחק את מה שכבר ענה.
  if (existing.answered_at) {
    return res.status(200).json({ ok: true, alreadyAnswered: true });
  }

  const { error: updErr } = await supabaseAdmin
    .from('customer_surveys')
    .update({
      q1_satisfaction: q1,
      q2_recommend: q2,
      comment,
      answered_at: new Date().toISOString(),
      status: 'answered',
    })
    .eq('id', existing.id)
    .is('answered_at', null); // מרוץ בין שתי לשוניות פתוחות: הראשונה מנצחת

  if (updErr) {
    console.error('[survey] save failed', updErr);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }

  return res.status(200).json({ ok: true, alreadyAnswered: false });
}
