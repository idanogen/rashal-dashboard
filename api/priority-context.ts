import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser } from './_lib/require-user.js';
import { supabaseAdmin } from './_lib/supabase-admin.js';
import { loadThread } from './_lib/thread.js';
import { normalizePhone } from './_lib/phone.js';
import { listActiveTemplates } from './_lib/templates-store.js';
import { normalizeLearnedProc, procsToMap } from './_lib/print-procs.js';
import { toPanelTemplates, type PanelTemplate } from './_lib/panel-templates.js';
import { pickDocument } from './_lib/doc-prefill.js';

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

/**
 * ⭐ **מסך שאין לנו עליו מדידה נרשם, ולא נשכח.**
 *
 * הדוקטרינה של המוצר היא שהתוסף לומד ולא ממופה ידנית: פרוצדורת ההדפסה
 * נלמדת מהדפסה אחת, וזהות הלקוח נגזרת מהצלבה מול המחסן. הדבר היחיד
 * שנשאר קשיח הוא הכיתוב פר מסך, ולכן זו הנקודה שבה לקוח חדש או מסך
 * חדש נופלים בשקט אצל העובד ("למה הכפתור אפור").
 *
 * הרישום הזה סוגר את הפער: ברגע שמישהו עומד על מסך שלא מיפינו, השם
 * הפנימי שלו ומספרי המסמכים שנראו בשורה נשמרים, ואפשר להשלים את המפה
 * בלי לבקש מאף אחד לפתוח קונסולה.
 *
 * 🔴 לא חוסם ולא מאט: כשל ברישום נבלע, והתשובה לחלונית יוצאת בכל מקרה.
 * 🔴 ופעם אחת לכל מסך בכל מופע, כי פריוריטי יורה את אותה שורה שוב ושוב.
 */
const notedScreens = new Set<string>();

async function noteScreenToMap(rawForm: unknown, candidates: string[]): Promise<void> {
  const form = String(rawForm ?? '').trim().toUpperCase();
  if (!form || notedScreens.has(form)) return;
  notedScreens.add(form);
  try {
    await supabaseAdmin.from('sync_debug').insert({
      label: 'wa-panel/screen-to-map',
      status_code: form,
      body: JSON.stringify({
        form,
        // רק מה שנראה כמספר מסמך. שם לקוח וטלפון לא נדרשים כדי להשלים מפה.
        shaped: candidates.filter((c) => /^[A-Z]{2}\d{5,9}$/.test(c)).slice(0, 10),
      }),
    });
    console.warn('[priority-context] מסך בלי קידומות שנמדדו:', form);
  } catch (e) {
    console.warn('[priority-context] רישום המסך נכשל', e);
  }
}

/**
 * שומר פרוצדורת הדפסה שהתוסף למד.
 *
 * 🔴 **התוסף שולח רק מה שהוכיח את עצמו.** `printer.js` צורב פרוצדורה
 * למועמדת רק אחרי שאותה הרצה באמת החזירה קובץ, ולכן מה שמגיע לכאן כבר
 * עבר סינון אחד. האימות כאן הוא השני, והוא זה שמגן על שאר העובדים.
 */
async function recordLearnedProc(raw: unknown, email: string | null) {
  const r = normalizeLearnedProc(raw);
  if (!r.ok || !r.value) {
    console.warn('[priority-context] פרוצדורת הדפסה נדחתה:', r.reason);
    return;
  }
  const v = r.value;
  try {
    const { error } = await supabaseAdmin.from('priority_print_procs').upsert(
      {
        form: v.form,
        ename: v.ename,
        table_name: v.table,
        avoidmessages: v.avoidmessages,
        print_args: v.printArgs,
        learned_by: email,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'form' },
    );
    if (error) console.error('[priority-context] שמירת פרוצדורה נכשלה', error.message);
  } catch (e) {
    console.error('[priority-context] שמירת פרוצדורה נפלה', e);
  }
}

/** כל מה שנלמד עד היום, לכל המסכים. התוסף ממזג את זה למה שיש לו. */
async function loadProcs() {
  try {
    const { data, error } = await supabaseAdmin
      .from('priority_print_procs')
      .select('form, ename, table_name, avoidmessages, print_args');
    if (error) {
      console.error('[priority-context] טעינת פרוצדורות נכשלה', error.message);
      return {};
    }
    return procsToMap(data);
  } catch {
    // 🔴 כשל כאן אינו מפיל את הזיהוי. התוסף ימשיך עם מה שלמד מקומית.
    return {};
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const user = await requireUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'unauthorized' });

  const body = (req.body ?? {}) as { form?: string; candidates?: unknown; learnedProc?: unknown };

  // ── מה שהתוסף למד על מסך ההדפסה ────────────────────────
  //
  // ⭐⭐ **נלמד פעם אחת, לכל החברה.** עד 24/08/2026 זה נשמר ב-
  // `chrome.storage`, כלומר פר דפדפן: כל עובד חדש התחיל מאפס, והכפתור
  // היה אפור בפעם הראשונה בכל סוג מסמך. זה ידע של החברה ולא של המשתמש.
  //
  // 🔴 נשמר **לפני** כל יציאה מוקדמת, בדיוק כמו רישום המסך: מסך שהזיהוי
  // נכשל בו הוא עדיין מסך שלמדנו להדפיס.
  if (body.learnedProc !== undefined) void recordLearnedProc(body.learnedProc, user.email ?? null);

  const candidates = cleanCandidates(body.candidates);
  if (!candidates.length) {
    return res.status(400).json({ ok: false, error: 'no candidates' });
  }

  // 🔴 **לפני כל יציאה מוקדמת, ובכוונה.**
  // גרסה ראשונה חישבה את זה רק אחרי שנמצא לקוח, וזה בדיוק הפוך: מסך
  // חדש שאיננו מכירים הוא גם המסך שסביר שהזיהוי ייכשל בו, ואז לא היינו
  // לומדים עליו כלום. עכשיו עצם העמידה על המסך מספיקה.
  const doc = pickDocument(body.form, candidates);
  if (doc.needs_measure) void noteScreenToMap(body.form, candidates);

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
    return res.status(200).json({
      ok: true, form: body.form ?? null, customer: null, matches: [],
      // ⭐ גם כשלא זוהה לקוח. מה שנלמד על המסך אינו תלוי בזיהוי.
      procs: await loadProcs(),
    });
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
  // ⭐ **`allowDocument: true`, כי כאן יש שורה בפריוריטי.** מדיה פר-נמען
  // אינה חסומה: התוסף מפיק את המסמך מהסשן ומעביר את כתובתו. 🔴 אבל היא
  // דורשת מסך שנלמד, ולכן החלונית מכריעה אם אפשר לשלוח כאן ועכשיו, והשרת
  // דוחה שליחה בלי מסמך. הכלל עצמו יושב ב-`toPanelTemplates`, פעם אחת.
  let templates: PanelTemplate[] = [];
  try {
    templates = toPanelTemplates(await listActiveTemplates(), { allowDocument: true });
  } catch (e) {
    // 🔴 כשל בטעינת המחסנית לא מפיל את הזיהוי. החלונית עדיין שווה משהו
    // בלי תבניות, והיא תאמר "אין תבנית זמינה" במקום להיראות שבורה.
    console.error('[priority-context] templates failed', e);
  }

  return res.status(200).json({
    ok: true,
    form: body.form ?? null,
    customer: best,
    procs: await loadProcs(),
    templates,
    prefill: {
      customer_name: best.customerName ?? '',
      // ⭐ מה שידוע מהמסך לא מוקלד ביד, וזה כולל את סוג המסמך ומספרו.
      // שניהם נשארים שדות שאפשר לערוך, והתצוגה המקדימה מראה בדיוק מה ייצא.
      subject: doc.subject,
      doc_type: doc.doc_type,
      doc_number: doc.doc_number,
    },
    // מוחזר רק כשבאמת יש יותר מאחד, כדי שהחלונית תוכל לשאול במקום לנחש.
    matches: matches.length > 1 ? matches : [],
    ...thread,
  });
}
