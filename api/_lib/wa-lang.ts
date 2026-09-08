import { supabaseAdmin } from './supabase-admin.js';
import { heyySendText, isHeyyDemo } from './heyy-server.js';
import { paramsToValues, renderTranslated, type Lang } from './wa-lang-core.js';

export { LANGS, isLang, detectLanguageReply, renderTranslated, type Lang } from './wa-lang-core.js';

/**
 * ההודעות האוטומטיות בארבע שפות (עידן, 08/09/2026).
 *
 * הזרימה: הודעה יוצאת בעברית עם ארבעה כפתורי שפה → הלקוח לוחץ → הלחיצה
 * מגיעה לוובהוק כטקסט שהוא שם השפה → כאן שומרים את השפה על הטלפון ועל
 * הלקוח, ושולחים מיד את אותה הודעה בשפה שנבחרה כטקסט חופשי (הלחיצה
 * פתחה חלון 24 שעות). הנוסחים בטבלת `wa_texts`, המשתנים של ההודעה
 * המקורית בשורת `whatsapp_outbound` שלה.
 *
 * 🔴 לחיצת שפה אינה "תשובה": היא לא סוגרת תיאום, לא עוצרת תזכורת
 * לתמונה ולא נחשבת מענה אנושי. הוובהוק בודק אותה לפני כל השאר.
 */

type OutboundRow = {
  id: string;
  template_id: string | null;
  template_params: unknown;
  created_at: string;
};

const SURVEY_BASE = process.env.SURVEY_BASE_URL ?? 'https://rashal-dashboard.vercel.app/s/';

/**
 * לקוח לחץ על כפתור שפה. שומר את השפה, ושולח את ההודעה האחרונה שלנו
 * אליו בשפה שנבחרה. מחזיר הערה לוג בעברית.
 */
export async function handleLanguageChoice(phoneE164: string, lang: Lang): Promise<{ ok: boolean; note: string }> {
  const { data: customer, error: setErr } = await supabaseAdmin.rpc('wa_set_language', {
    p_phone: phoneE164, p_lang: lang, p_source: 'button',
  });
  if (setErr) return { ok: false, note: `בחירת שפה ${lang}: שמירה נכשלה: ${setErr.message}` };
  const saved = `השפה ${lang} נשמרה${customer ? ` על לקוח ${customer}` : ''}`;
  if (lang === 'he') return { ok: true, note: saved };

  // ההודעה האחרונה שלנו אליו, מתבנית, בשבוע האחרון.
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data: last } = await supabaseAdmin
    .from('whatsapp_outbound')
    .select('id, template_id, template_params, created_at')
    .eq('phone_e164', phoneE164)
    .eq('message_kind', 'template')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<OutboundRow>();
  if (!last?.template_id) return { ok: true, note: `${saved}. אין הודעת תבנית אחרונה לתרגם` };

  const { data: keyData } = await supabaseAdmin.rpc('wa_template_key', { p_template_id: last.template_id });
  let key = typeof keyData === 'string' ? keyData : null;
  if (!key) return { ok: true, note: `${saved}. התבנית ${last.template_id} לא מוכרת, אין תרגום` };

  const values = paramsToValues(last.template_params);
  if (key === 'on_the_way' && !values.worker_phone) key = 'on_the_way_v1';
  if (key === 'survey_invite') {
    const token = values.token ?? '';
    values.link = token ? `${SURVEY_BASE}${token}?lang=${lang}` : '';
  }

  const { data: rows } = await supabaseAdmin
    .from('wa_texts')
    .select('key, body')
    .eq('lang', lang)
    .or(`key.eq.${key},key.like.v:%`);
  const dict: Record<string, string> = {};
  let body: string | null = null;
  for (const r of rows ?? []) {
    if (r.key === key) body = r.body;
    else dict[r.key] = r.body;
  }
  if (!body) return { ok: true, note: `${saved}. אין נוסח ${lang} למפתח ${key}` };

  const text = renderTranslated(body, values, dict, lang);
  const result = await heyySendText(phoneE164, text);
  await supabaseAdmin.from('whatsapp_outbound').insert({
    wa_message_id: result.waMessageId || null,
    vendor_message_id: result.vendorMessageId || null,
    phone_e164: phoneE164,
    message_kind: 'text',
    body_text: text,
    status: result.status,
    status_detail: result.statusDetail,
    triggered_by: `language-reply:${lang}:${key}`,
    is_demo: isHeyyDemo,
  });
  return {
    ok: result.ok,
    note: result.ok ? `${saved}. נשלח ${key} ב-${lang}` : `${saved}. השליחה ב-${lang} נכשלה: ${result.statusDetail ?? ''}`,
  };
}
