import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser } from './_lib/require-user.js';
import { supabaseAdmin } from './_lib/supabase-admin.js';
import { loadThread } from './_lib/thread.js';
import { normalizePhone } from './_lib/phone.js';
import { listActiveTemplates } from './_lib/templates-store.js';

/**
 * "על מי אני עומד בפריוריטי", ואז כל השיחה איתו. קריאה אחת.
 *
 *   POST /api/priority-context
 *   { form: "CUSTOMERS", candidates: ["101143", "מכון הפיזיותרפיה", "054-...", ...] }
 *
 * 🔴 **המצליבה היא `customer_directory` ולא `priority_customers`.**
 * המראה מפריוריטי מבוססת דלתא וקולטת רק לקוח שנוצר או עודכן מאז שהסנכרון
 * התחיל. נמדד ב-20/08/2026: 2,018 לקוחות במראה מול 4,635 שיש להם עבודה
 * אצלנו, כלומר **63% מהלקוחות היו בלתי נראים לחלונית**. הספר מאחד את
 * המראה עם טבלאות העבודה, כי מי שיש לו הזמנה הוא לקוח גם אם המראה שתקה.
 *
 * ⭐ **זה הלב של המוצר, וזו הסיבה שהתוסף אצל ר.שעל דק.**
 * בתוסף של עוגן הזהר נאלצנו למפות ידנית איזה מספר שדה מחזיק את הטלפון
 * בכל מסך, וזה היה החוסם מספר 1 של המוצר: כל מסך חדש דרש אשף מיפוי.
 * כאן התוסף לא יודע כלום. הוא שולח את **כל** הערכים שראה בשורה, והשרת
 * בודק מי מהם קיים כמספר לקוח במחסן. אין אשף, אין מיפוי, אין ניחוש.
 *
 * 🔴 **וזה מאמת את עצמו בזוג.** מספר לבדו יכול להיתפס בטעות: כמות, מספר
 * שורה או תאריך מספרי יכולים להיראות בדיוק כמו מספר לקוח (1,261 מתוך
 * 1,271 הלקוחות הם ספרות בלבד). לכן התאמה נחשבת ודאית רק כשגם **השם**
 * של אותו לקוח מופיע בין המועמדים. מספר בלי שם מוחזר כ"סביר", והחלונית
 * אומרת את זה למשתמש במקום להעמיד פנים.
 */

/**
 * מה כותבים ב"עדכון בנוגע ל..." לפי המסך שעליו עומדים.
 * 🟡 מילוי מראש בלבד, והמשתמש עורך. מסך שלא ברשימה מקבל ניסוח כללי,
 * ולא ניחוש שנשמע ודאי.
 */
const SUBJECT_BY_FORM: Record<string, string> = {
  CUSTOMERS: 'הפנייה',
  ORDERS: 'ההזמנה',
  DOCUMENTS_D: 'תעודת המשלוח',
  AINVOICES: 'החשבונית',
  PORDERS: 'הזמנת הרכש',
  SERVCALLS: 'קריאת השירות',
};

/**
 * שם המסמך כפי שהלקוח יקרא אותו בתבנית ("מצורפת תעודת משלוח מספר...").
 * 🔴 בנפרד מ-`SUBJECT_BY_FORM`, כי שם הניסוח מיודע ("תעודת המשלוח")
 * וכאן הוא חייב להיות סתמי, אחרת המשפט אצל הלקוח נשבר.
 */
const DOC_TYPE_BY_FORM: Record<string, string> = {
  ORDERS: 'הזמנה',
  DOCUMENTS_D: 'תעודת משלוח',
  AINVOICES: 'חשבונית מס',
  PORDERS: 'הזמנת רכש',
  SERVCALLS: 'קריאת שירות',
};

const MAX_CANDIDATES = 120;
const MAX_LEN = 60;

type Confidence = 'verified' | 'probable' | 'phone';

interface Match {
  customerNumber: string;
  customerName: string | null;
  phone: string | null;
  city: string | null;
  confidence: Confidence;
}

/** ניקוי מועמדים: מה שלא יכול להיות מפתח לקוח לא נשלח למסד. */
function cleanCandidates(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<string>();
  for (const v of raw) {
    if (v == null) continue;
    const s = String(v).trim();
    if (!s || s.length > MAX_LEN) continue;
    out.add(s);
    if (out.size >= MAX_CANDIDATES) break;
  }
  return [...out];
}

/** השוואת שמות סלחנית: רווחים כפולים, גרשיים וסימני פיסוק לא אמורים להכשיל. */
function nameKey(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/["'`׳״]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const user = await requireUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'unauthorized' });

  const body = (req.body ?? {}) as { form?: string; candidates?: unknown };
  const candidates = cleanCandidates(body.candidates);
  if (!candidates.length) {
    return res.status(400).json({ ok: false, error: 'no candidates' });
  }

  // ── שלב א: מי מהמועמדים הוא מספר לקוח קיים ─────────────
  const { data: byNumber, error: numErr } = await supabaseAdmin
    .from('customer_directory')
    .select('customer_number, customer_name, phone, city, source')
    .in('customer_number', candidates)
    .limit(20);

  if (numErr) {
    console.error('[priority-context] custname lookup failed', numErr.message);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }

  const nameKeys = new Set(candidates.map(nameKey));
  const matches: Match[] = (byNumber ?? []).map((c) => ({
    customerNumber: c.customer_number as string,
    customerName: (c.customer_name as string) ?? null,
    phone: (c.phone as string) ?? null,
    city: (c.city as string) ?? null,
    // ⭐ הזוג: מספר שיש לצידו את השם של אותו לקוח על אותו מסך.
    confidence: nameKeys.has(nameKey(c.customer_name as string)) ? 'verified' : 'probable',
  }));

  // ── שלב ב: אם אף מספר לא נתפס, אולי יש טלפון על המסך ────
  // 🔴 גיבוי בלבד, ומסומן ככזה. טלפון אינו מפתח: אותו נייד יכול לשבת
  // על כמה כרטיסי לקוח, ולכן הוא לעולם לא "ודאי".
  if (!matches.length) {
    const phones = [...new Set(candidates.map(normalizePhone).filter(Boolean))] as string[];
    if (phones.length) {
      // 🔴 מצליבים מול `phone_local` המנורמל ולא מול העמודה הגולמית.
      // בפריוריטי אותו מספר מופיע גם כ-`052-5355474` וגם כ-`0525355474`,
      // והשוואה גולמית מפספסת את מי שנכתב עם מקפים.
      const { data: byPhone } = await supabaseAdmin
        .from('customer_directory')
        .select('customer_number, customer_name, phone, city')
        .in('phone_local', phones)
        .limit(20);
      for (const c of byPhone ?? []) {
        matches.push({
          customerNumber: c.customer_number as string,
          customerName: (c.customer_name as string) ?? null,
          phone: (c.phone as string) ?? null,
          city: (c.city as string) ?? null,
          confidence: 'phone',
        });
      }
    }
  }

  if (!matches.length) {
    return res.status(200).json({ ok: true, form: body.form ?? null, customer: null, matches: [] });
  }

  const rank: Record<Confidence, number> = { verified: 0, probable: 1, phone: 2 };
  matches.sort((a, b) => rank[a.confidence] - rank[b.confidence]);
  const best = matches[0];

  // ── שלב ג: השיחה עצמה ───────────────────────────────────
  // לפי מספר הלקוח קודם, ורק אם אין שרשור כזה לפי הטלפון שבכרטיס.
  // 🔴 שני המסלולים נחוצים: שיחה שנפתחה מהודעה נכנסת עדיין לא בהכרח
  // שויכה למספר לקוח, ואז חיפוש לפי מספר בלבד מחזיר "עוד לא דיברתם"
  // על לקוח שיש איתו שרשור מלא.
  let thread = await loadThread({ customer: best.customerNumber });
  if (!thread.conversation && best.phone) {
    try {
      thread = await loadThread({ phone: best.phone });
    } catch {
      /* טלפון לא תקין בכרטיס אינו שגיאה של הקריאה הזאת */
    }
  }

  // ⭐ המחסנית מגיעה מהטבלה, לא מהקוד ולא מהחלונית. מנהל מוסיף תבנית
  // במסך, וכל הצוות מקבל אותה בלי לעדכן גרסה של התוסף.
  // 🔴 לא מסננים לפי קטגוריה: תבנית שיווק היא עדיין תבנית שאפשר לשלוח,
  // והחלונית אומרת שהיא עולה יותר במקום שהמחיר יתגלה בחשבונית.
  let templates: Array<Record<string, unknown>> = [];
  try {
    templates = (await listActiveTemplates()).map((t) => ({
      key: t.key,
      label: t.label,
      variables: t.variables,
      preview: t.bodyPreview,
      category: t.category,
      // ⭐ מדיה **קבועה** (סרטון הדרכה) נשלחת כמו שהיא, כי הקובץ כבר
      // ב-heyy.
      // ⭐ מדיה **פר נמען** כבר לא חסומה: התוסף מפיק את המסמך מפריוריטי
      // ומעביר את כתובתו. 🔴 אבל היא דורשת מסך שנלמד, ולכן החלונית היא
      // שמכריעה אם אפשר לשלוח כאן ועכשיו, והשרת דוחה שליחה בלי מסמך.
      available: true,
      needsDocument: t.mediaPerMessage,
      unavailableReason: null,
    }));
  } catch (e) {
    // 🔴 כשל בטעינת המחסנית לא מפיל את הזיהוי. החלונית עדיין שווה משהו
    // בלי תבניות, והיא תאמר "אין תבנית זמינה" במקום להיראות שבורה.
    console.error('[priority-context] templates failed', e);
  }

  return res.status(200).json({
    ok: true,
    form: body.form ?? null,
    customer: best,
    templates,
    prefill: {
      customer_name: best.customerName ?? '',
      subject: SUBJECT_BY_FORM[String(body.form ?? '').toUpperCase()] ?? 'הפנייה',
      // ⭐ מה שידוע מהמסך לא מוקלד ביד. מספר המסמך עדיין מוקלד, כי הוא
      // לא נגזר מהזיהוי, והתצוגה המקדימה מראה בדיוק מה ייצא.
      doc_type: DOC_TYPE_BY_FORM[String(body.form ?? '').toUpperCase()] ?? '',
    },
    // מוחזר רק כשבאמת יש יותר מאחד, כדי שהחלונית תוכל לשאול במקום לנחש.
    matches: matches.length > 1 ? matches : [],
    ...thread,
  });
}
