import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser } from './_lib/require-user.js';
import { supabaseAdmin } from './_lib/supabase-admin.js';
import { loadThread, windowState } from './_lib/thread.js';
import { listActiveTemplates } from './_lib/templates-store.js';
import { toPanelTemplates, type PanelTemplate } from './_lib/panel-templates.js';
import { toItem, sortItems, matchesQuery, type ConversationRow } from './_lib/inbox.js';

/**
 * השיחה המלאה מול לקוח אחד, לצריכה מהדשבורד.
 *
 *   GET /api/conversation?phone=0523694547
 *   GET /api/conversation?customer=101143
 *
 * החלונית בפריוריטי לא קוראת לכאן אלא ל-`api/priority-context`, שמזהה
 * קודם על מי עומדים ורק אז טוען את אותו שרשור בדיוק (`_lib/thread.ts`).
 *
 * 🔴 **דורש משתמש מחובר.** נלמד מ-`api/heyy-send`, שנפרס בלי אימות בכלל.
 * כאן החשיפה חמורה אף יותר, כי מדובר בתוכן שיחות של מטופלים.
 *
 * ── ובלי פרמטרים: **רשימת התיבה** ────────────────────────────────────
 *
 *   GET /api/conversation?tab=waiting|all&q=<חיפוש>
 *
 * 🔴 **הרשימה יושבת כאן ולא בקובץ נפרד, וזו לא בחירת עיצוב אלא אילוץ
 * שנמדד.** הפרויקט על תוכנית Hobby של Vercel, שתקרתה **12 פונקציות
 * לפריסה**. הקובץ ה-13 בנה בהצלחה ואז נפל ב-`Deploying outputs`, כלומר
 * הכשל נראה כמו תקלת פריסה אקראית ולא כמו חריגה ממכסה.
 *
 * ⭐ ההצמדה גם נכונה בפני עצמה: הרשימה והשרשור הם אותה ישות בשתי רזולוציות,
 * ושניהם נשענים על אותו `_lib/thread.ts` לכלל 24 השעות.
 */

/** 🔴 PostgREST מחזיר לכל היותר 1,000 שורות לבקשה, גם בלי `limit`. */
const HARD_CAP = 1000;

const LIST_COLUMNS =
  'id, phone_local, phone_e164, contact_name, customer_number, customer_name, ' +
  'last_inbound_at, last_message_at, last_message_preview, last_message_direction, ' +
  'unanswered_since, message_count';

async function listInbox(req: VercelRequest, res: VercelResponse) {
  const tab = req.query.tab === 'all' ? 'all' : 'waiting';
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const limit = Math.min(Math.max(Number(req.query.limit ?? 100) || 100, 1), 200);

  // 🔴 `.range()` בלי `.order()` מחזיר שורות בסדר שרירותי.
  const { data, error } = await supabaseAdmin
    .from('wa_conversations')
    .select(LIST_COLUMNS)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .range(0, HARD_CAP - 1);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as ConversationRow[];
  const now = Date.now();
  // ⭐ כלל 24 השעות מחושב מהמקום היחיד שמחזיק אותו.
  const all = rows.map((r) => toItem(r, windowState(r.last_inbound_at), now));

  // ⭐ הספירות נגזרות מאותה רשימה ולא משאילתה שנייה, שיכולה לרוץ על מצב
  // אחר בשבריר שנייה. מונה שמשקר גרוע ממונה שחסר.
  const waitingAll = all.filter((i) => i.unansweredSince);
  const pool = tab === 'waiting' ? waitingAll : all;
  const filtered = q ? pool.filter((i) => matchesQuery(i, q)) : pool;

  return res.status(200).json({
    ok: true,
    tab,
    counts: { waiting: waitingAll.length, all: all.length },
    matched: filtered.length,
    truncated: rows.length >= HARD_CAP,
    items: sortItems(filtered, tab).slice(0, limit),
  });
}
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const user = await requireUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'unauthorized' });

  const phone = typeof req.query.phone === 'string' ? req.query.phone : null;
  const customer = typeof req.query.customer === 'string' ? req.query.customer : null;

  try {
    // בלי מזהה לקוח, הבקשה היא לרשימה ולא לשרשור בודד.
    if (!phone && !customer) return await listInbox(req, res);

    const thread = await loadThread({ phone, customer });

    // ⭐⭐ **מה אפשר לשלוח מכאן, ולא רק מה נאמר.** עד 24/08/2026 השרשור
    // חזר בלי תבניות, ולכן החלונית שנפתחת מהתיבה אמרה "החלון סגור, תבנית
    // נשלחת מהלקוח שעל המסך בפריוריטי" וזה כל מה שהיה. כלומר מבוי סתום,
    // בזמן ששתי תבניות מאושרות היו זמינות לשליחה מיד. [[form_removal_does_not_close_intake]]
    //
    // 🔴 **`allowDocument: false`, כי כאן אין שורה בפריוריטי.** תעודה או
    // חשבונית מופקות מהסשן של המסך, ולכן הן אינן מוצעות כאן. שאר התבניות
    // כן. הכלל עצמו יושב ב-`toPanelTemplates` ונאמר פעם אחת.
    let templates: PanelTemplate[] = [];
    try {
      templates = toPanelTemplates(await listActiveTemplates(), { allowDocument: false });
    } catch (e) {
      // 🔴 כשל בטעינת המחסנית אינו מפיל את השרשור. הוא שווה משהו גם בלי
      // תבניות, ואומר "אין תבנית זמינה" במקום להיראות שבור.
      console.error('[conversation] templates failed', e instanceof Error ? e.message : e);
    }

    return res.status(200).json({ ok: true, ...thread, templates });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'invalid phone') return res.status(400).json({ ok: false, error: msg });
    console.error('[conversation] failed', msg);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
}
