import { supabaseAdmin } from './supabase-admin.js';
import { listTemplates, type HeyyAttachment } from './heyy-v3.js';

/**
 * מסנכרן את מחסנית התבניות מ-heyy.
 *
 * ⭐ **heyy היא מקור האמת לכל מה שמטא קבעה**: הנוסח, המשתנים, הקטגוריה
 * והסטטוס. מה שנשאר שלנו הוא ההחלטות: התווית שהעובד רואה, אם התבנית
 * מוצעת לצוות, הסדר, וההערה.
 *
 * 🔴 **הסנכרון לא כובה ולא מוחק.** תבנית שנעלמה מ-heyy מסומנת
 * `heyy_status = 'missing'` ונשארת, כדי שהשרשור הישן שמפנה אליה יישאר
 * קריא. מחיקה שקטה של תבנית היא מחיקה שקטה של ההיסטוריה שלה.
 *
 * 🔴 **ותבנית חדשה נכנסת כבויה.** היא נוצרה ב-heyy למטרה כלשהי, ולא
 * בהכרח כדי שכל הצוות ישלח אותה ידנית מהחלונית. מנהל מדליק במסך.
 */

/** מפתח פנימי יציב מתוך שם התבנית ב-heyy. */
function keyFor(name: string): string {
  const k = String(name)
    .toLowerCase()
    .replace(/^ogen_/, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return /^[a-z]/.test(k) ? k : `t_${k || 'template'}`;
}

/** הקובץ המצורף המשמעותי: מדיה קודמת לכפתור. */
function pickAttachment(list: HeyyAttachment[]): HeyyAttachment | null {
  return list.find((a) => a.type !== 'button') ?? list.find((a) => a.type === 'button') ?? null;
}

export interface SyncResult {
  added: string[];
  updated: string[];
  missing: string[];
}

export async function syncTemplates(): Promise<SyncResult> {
  const remote = await listTemplates();

  const { data: existing, error } = await supabaseAdmin
    .from('wa_templates')
    .select('key, heyy_template_id, label, media_per_message');
  if (error) throw new Error(error.message);

  const byId = new Map((existing ?? []).map((r) => [r.heyy_template_id as string, r]));
  const seen = new Set<string>();
  const added: string[] = [];
  const updated: string[] = [];

  for (const t of remote) {
    seen.add(t.id);
    const prev = byId.get(t.id);
    const att = pickAttachment(t.attachments);

    const row = {
      key: prev?.key ?? keyFor(t.name),
      heyy_template_id: t.id,
      name: t.name,
      // התווית נקבעת פעם אחת ואז שייכת למנהל. שם התבנית הוא רק ברירת מחדל.
      label: prev?.label ?? t.name,
      category: t.category === 'marketing' ? 'marketing' : 'utility',
      body_preview: t.body,
      variables: t.variables,
      attachment_kind: att?.type ?? null,
      attachment_id: att?.id ?? null,
      attachment_file_id: att?.fileId ?? null,
      has_document_header: Boolean(att && att.type !== 'button'),
      heyy_status: t.status,
      synced_at: new Date().toISOString(),
      // 🔴 החלטה שלנו ולא של heyy, ולכן הסנכרון לא נוגע בה. הסנכרון לא
      // יכול לדעת שהקובץ ששמור בתבנית הוא תעודת דוגמה ולא מסמך של לקוח.
      media_per_message: prev ? (prev.media_per_message as boolean) : false,
      ...(prev ? {} : { active: false, sort_order: 100 }),
    };

    const { error: upErr } = await supabaseAdmin
      .from('wa_templates')
      .upsert(row, { onConflict: 'heyy_template_id' });
    if (upErr) throw new Error(upErr.message);

    (prev ? updated : added).push(t.name);
  }

  // מה שכבר לא קיים ב-heyy: מסומן, לא נמחק.
  const missing = (existing ?? [])
    .filter((r) => !seen.has(r.heyy_template_id as string))
    .map((r) => r.key as string);

  if (missing.length) {
    await supabaseAdmin
      .from('wa_templates')
      .update({ heyy_status: 'missing', active: false, synced_at: new Date().toISOString() })
      .in('key', missing);
  }

  return { added, updated, missing };
}
