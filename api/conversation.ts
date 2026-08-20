import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser } from './_lib/require-user.js';
import { loadThread } from './_lib/thread.js';

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
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const user = await requireUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'unauthorized' });

  const phone = typeof req.query.phone === 'string' ? req.query.phone : null;
  const customer = typeof req.query.customer === 'string' ? req.query.customer : null;

  if (!phone && !customer) {
    return res.status(400).json({ ok: false, error: 'need phone or customer' });
  }

  try {
    const thread = await loadThread({ phone, customer });
    return res.status(200).json({ ok: true, ...thread });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'invalid phone') return res.status(400).json({ ok: false, error: msg });
    console.error('[conversation] failed', msg);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
}
