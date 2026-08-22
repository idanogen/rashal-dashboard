import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser } from './_lib/require-user.js';
import { supabaseAdmin } from './_lib/supabase-admin.js';
import { windowState } from './_lib/thread.js';
import { toItem, sortItems, matchesQuery, type ConversationRow } from './_lib/inbox.js';

/**
 * רשימת השיחות של התיבה.
 *
 *   GET /api/wa-inbox?tab=waiting|all&q=<חיפוש>&limit=100
 *
 * ⭐ **שתי הלשוניות נשענות על אותה שאילתה בדיוק**, ונבדלות רק במסנן
 * ובמיון. שתי שאילתות נפרדות היו מתפצלות בשקט, ואז לשונית אחת מציגה
 * שיחה שהשנייה לא מכירה.
 *
 * ⭐ **וכל עובד מחובר רואה את כל השיחות** (החלטת עידן, 22/08/2026).
 * זה המצב היום וזה מתאים לצוות משרד קטן. הפרדה לפי תפקיד נשקלה ונדחתה
 * לשלב מאוחר יותר, ורשומה ב-STATUS כדי שלא תיקרא בעתיד כפספוס.
 */

/**
 * 🔴 PostgREST מחזיר לכל היותר 1,000 שורות לבקשה, גם בלי `limit`.
 * הקאפ הזה כבר עלה לנו פעם: משיכה שנראתה מלאה החזירה חלק.
 */
const HARD_CAP = 1000;

const COLUMNS =
  'id, phone_local, phone_e164, contact_name, customer_number, customer_name, ' +
  'last_inbound_at, last_message_at, last_message_preview, last_message_direction, ' +
  'unanswered_since, message_count';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const user = await requireUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'unauthorized' });

  const tab = req.query.tab === 'all' ? 'all' : 'waiting';
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const limit = Math.min(Math.max(Number(req.query.limit ?? 100) || 100, 1), 200);

  try {
    // 🔴 `.range()` בלי `.order()` מחזיר שורות בסדר שרירותי, ואז "עמוד
    // שני" יכול להחזיר שוב שורות מהראשון. המיון הסופי נעשה בקוד, אבל
    // המיון כאן הוא מה שמבטיח שהחלון יציב.
    const base = supabaseAdmin
      .from('wa_conversations')
      .select(COLUMNS)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .range(0, HARD_CAP - 1);

    const { data, error } = await base;
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as unknown as ConversationRow[];
    const now = Date.now();
    // ⭐ כלל 24 השעות מחושב כאן, מהמקום היחיד שמחזיק אותו.
    const all = rows.map((r) => toItem(r, windowState(r.last_inbound_at), now));

    // ⭐ הספירות נגזרות מאותה רשימה ולא משאילתה שנייה. שאילתה נפרדת
    // לספירה יכולה לרוץ על מצב אחר בשבריר שנייה, ואז המונה על הלשונית
    // לא תואם את מה שהיא מציגה. מונה שמשקר הוא גרוע ממונה שחסר.
    const waitingAll = all.filter((i) => i.unansweredSince);

    const pool = tab === 'waiting' ? waitingAll : all;
    const filtered = q ? pool.filter((i) => matchesQuery(i, q)) : pool;
    const items = sortItems(filtered, tab).slice(0, limit);

    return res.status(200).json({
      ok: true,
      tab,
      counts: { waiting: waitingAll.length, all: all.length },
      matched: filtered.length,
      truncated: rows.length >= HARD_CAP,
      items,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[wa-inbox] failed', msg);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
}
