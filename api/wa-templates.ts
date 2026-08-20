import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from './_lib/supabase-admin.js';
import { syncTemplates } from './_lib/templates-sync.js';

/**
 * ניהול מחסנית התבניות.
 *
 *   GET  /api/wa-templates     כל התבניות, כולל כבויות
 *   POST { action: 'sync' }    משיכה מ-heyy
 *   POST { action: 'update' }  תווית, סדר והערה
 *   POST { action: 'toggle' }  הצעה לצוות, או הסרה
 *
 * ⭐ **אי אפשר להקליד כאן תבנית.** הנוסח, המשתנים, הקטגוריה והסטטוס
 * מגיעים מ-heyy בלבד, כי שם הם נקבעו ושם מטא אישרה אותם. הקלדה ידנית
 * של נוסח פירושה שני נוסחים שיתפצלו, והלקוח יקבל את זה שאנחנו לא רואים.
 * מה שנשאר למנהל: התווית שהעובד רואה, אם התבנית מוצעת, הסדר, וההערה.
 *
 * 🔴 למה נקודת קצה ולא כתיבה ישירה מהדפדפן: **תבנית היא הרשאה לשלוח
 * בשם החברה.** RLS מרשה קריאה למשתמש מחובר וכתיבה ל-service_role בלבד,
 * וכאן נבדק שהכותב הוא מנהל.
 */

const cleanEnv = (s?: string): string | undefined => s?.replace(/(?:\\n|\s)+$/g, '');
const SUPABASE_URL = cleanEnv(process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL);
const SUPABASE_ANON = cleanEnv(process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY);

async function requireAdmin(req: VercelRequest): Promise<{ ok: boolean; status: number; error?: string }> {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return { ok: false, status: 401, error: 'missing token' };
  if (!SUPABASE_URL || !SUPABASE_ANON) return { ok: false, status: 500, error: 'server misconfigured' };

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return { ok: false, status: 401, error: 'invalid token' };

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role, disabled')
    .eq('id', data.user.id)
    .maybeSingle();

  if (!profile || profile.disabled) return { ok: false, status: 403, error: 'no access' };
  if (profile.role !== 'admin') return { ok: false, status: 403, error: 'caller is not admin' };
  return { ok: true, status: 200 };
}

/** מפתח פנימי: אותיות אנגליות קטנות, ספרות וקו תחתון. */
const KEY = /^[a-z][a-z0-9_]*$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  const guard = await requireAdmin(req);
  if (!guard.ok) return res.status(guard.status).json({ ok: false, error: guard.error });

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('wa_templates')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true });

    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({
      ok: true,
      templates: data ?? [],
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const action = String(body.action ?? '');

  // ⭐ משיכה מ-heyy. זה מה שהופך את המסך מטופס הזנה למראה של המציאות.
  if (action === 'sync') {
    try {
      const r = await syncTemplates();
      return res.status(200).json({ ok: true, ...r });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'sync failed';
      console.error('[wa-templates] sync failed', msg);
      return res.status(502).json({ ok: false, error: 'הסנכרון מ-heyy נכשל: ' + msg });
    }
  }

  if (action === 'toggle') {
    const key = String(body.key ?? '');
    const active = Boolean(body.active);
    const { error } = await supabaseAdmin.from('wa_templates').update({ active }).eq('key', key);
    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true });
  }

  if (action !== 'update') {
    return res.status(400).json({ ok: false, error: 'unknown action' });
  }

  // ── עדכון מה ששייך לנו בלבד ──────────────────────────
  const key = String(body.key ?? '').trim();
  if (!KEY.test(key)) {
    return res.status(400).json({ ok: false, error: 'מפתח לא תקין.' });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.label === 'string' && body.label.trim()) patch.label = body.label.trim();
  if (body.sort_order !== undefined) patch.sort_order = Number(body.sort_order);
  if (body.notes !== undefined) patch.notes = body.notes ? String(body.notes) : null;

  if (!Object.keys(patch).length) {
    return res.status(400).json({ ok: false, error: 'אין מה לעדכן.' });
  }

  const { error } = await supabaseAdmin.from('wa_templates').update(patch).eq('key', key);
  if (error) return res.status(500).json({ ok: false, error: error.message });
  return res.status(200).json({ ok: true });
}
