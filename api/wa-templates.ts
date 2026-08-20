import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from './_lib/supabase-admin.js';
import { variablesOf } from './_lib/templates-store.js';

/**
 * ניהול מחסנית התבניות.
 *
 *   GET  /api/wa-templates            כל התבניות, כולל כבויות
 *   POST /api/wa-templates            { action: 'save' | 'toggle', ... }
 *
 * ⭐ למה זו נקודת קצה ולא כתיבה ישירה מהדפדפן: **תבנית היא הרשאה לשלוח
 * בשם החברה.** RLS על `wa_templates` מרשה קריאה למשתמש מחובר וכתיבה
 * ל-service_role בלבד, וכאן נבדק שהכותב הוא מנהל.
 *
 * 🔴 **המשתנים לא נשלחים ולא נשמרים.** הם נגזרים מהנוסח, כאן ובקריאה,
 * ולכן אי אפשר שיתפצלו ממנו. שדה שמתאר את מה שכבר כתוב בשדה אחר הוא
 * שדה שיסטה ממנו.
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

/** מזהה תבנית ב-heyy הוא UUID. שדה חופשי כאן שולח הודעות לשום מקום. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
      templates: (data ?? []).map((t) => ({ ...t, variables: variablesOf(t.body_preview as string) })),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const action = String(body.action ?? '');

  if (action === 'toggle') {
    const key = String(body.key ?? '');
    const active = Boolean(body.active);
    const { error } = await supabaseAdmin.from('wa_templates').update({ active }).eq('key', key);
    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true });
  }

  if (action !== 'save') {
    return res.status(400).json({ ok: false, error: 'unknown action' });
  }

  const key = String(body.key ?? '').trim();
  const heyyId = String(body.heyy_template_id ?? '').trim();
  const name = String(body.name ?? '').trim();
  const label = String(body.label ?? '').trim();
  const preview = String(body.body_preview ?? '').trim();
  const category = body.category === 'marketing' ? 'marketing' : 'utility';

  if (!KEY.test(key)) {
    return res.status(400).json({ ok: false, error: 'המפתח חייב להיות אותיות אנגליות קטנות, ספרות וקו תחתון, ולהתחיל באות.' });
  }
  // 🔴 מזהה שגוי לא נכשל ברעש: heyy תדחה את השליחה ואיש לא יבין למה.
  if (!UUID.test(heyyId)) {
    return res.status(400).json({ ok: false, error: 'מזהה התבנית ב-heyy חייב להיות UUID. שולפים אותו מכתובת ה-URL של דף התבנית.' });
  }
  if (!label || !name || !preview) {
    return res.status(400).json({ ok: false, error: 'חסר שם, תווית או נוסח.' });
  }
  // 🔴 העורך של heyy אוכף אותו כלל, ותבנית בלי משתנים כאן פשוט לא תדע
  // למי היא פונה. עדיף להיעצר בהזנה מאשר לגלות בשליחה הראשונה.
  const vars = variablesOf(preview);
  for (const v of vars) {
    if (!KEY.test(v)) {
      return res.status(400).json({ ok: false, error: `שם משתנה פסול: ${v}` });
    }
  }

  const { error } = await supabaseAdmin.from('wa_templates').upsert(
    {
      key,
      heyy_template_id: heyyId,
      name,
      label,
      category,
      body_preview: preview,
      has_document_header: Boolean(body.has_document_header),
      sort_order: Number(body.sort_order ?? 100),
      notes: body.notes ? String(body.notes) : null,
      active: body.active === undefined ? true : Boolean(body.active),
    },
    { onConflict: 'key' },
  );

  if (error) return res.status(500).json({ ok: false, error: error.message });
  return res.status(200).json({ ok: true, variables: vars });
}
