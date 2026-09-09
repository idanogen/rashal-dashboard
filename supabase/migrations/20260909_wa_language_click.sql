-- לחיצת שפה אינה הודעה (עידן, 09/09/2026: "כאשר בן אדם בוחר שפה ולפי זה
-- מקבל מאיתנו הודעת המשך אין צורך להציג את השפה שהוא בחר, זה מבלבל").
-- עד היום הלחיצה על הכפתור ("English") נכנסה כהודעת לקוח: בועה בשרשור,
-- תקציר השיחה ברשימה, ומונה "אדם כתב" שהוציא את השיחה מהאוטומטיות.
--
-- 🔴 הסיווג נעשה במסד, במקום אחד (wa_auto_kind דרך wa_messages_classified),
-- ושני המסכים (התיבה והחלונית בפריוריטי) יורשים אותו. הרשימה זהה
-- ל-LANG_WORDS ב-api/_lib/wa-lang-core.ts.
--
-- ⭐ הפונקציה והתצוגה הוגדרו עד היום רק במסד (06/09) בלי קובץ מיגרציה;
-- מעכשיו הבית שלהן כאן.

create or replace function public.wa_is_language_click(p_body text)
returns boolean
language sql immutable
as $$
  select lower(regexp_replace(btrim(coalesce(p_body, '')), '[.!?،؟\s]+$', '')) in
    ('english', 'en', 'العربية', 'عربي', 'عربية', 'ar', 'русский', 'по-русски', 'ru',
     'ไทย', 'ภาษาไทย', 'th', 'עברית', 'hebrew', 'he');
$$;

create or replace function public.wa_auto_kind(p_direction text, p_author text, p_triggered_by text, p_reminder_kind text, p_body text)
returns text
language sql immutable
as $$
  select case
    when p_direction = 'in' and public.wa_is_language_click(p_body) then 'language'
    when p_direction = 'in' then null
    when p_triggered_by like 'priority-panel:%' then null
    when p_triggered_by like 'survey-engine%' then 'survey'
    when p_triggered_by like 'media-request-first%' then 'photo_request'
    when p_triggered_by like 'media-request-reminder%' then 'photo_reminder'
    when p_triggered_by like 'on-way-engine%' then 'on_way'
    when p_reminder_kind in ('schedule_coordination', 'schedule_request', 'delivery_reminder') then 'coordination'
    when p_triggered_by is not null or p_reminder_kind is not null then 'other'
    when p_author = 'cron' then 'other'
    else null
  end;
$$;

create or replace view public.wa_messages_classified as
 select m.id, m.conversation_id, m.heyy_message_id, m.vendor_message_id, m.direction, m.body,
        m.attachments, m.status, m.template_id, m.entity_type, m.entity_key, m.author, m.sent_at,
        m.created_at, m.media_state, m.media_tries,
        public.wa_auto_kind(m.direction, m.author, o.triggered_by, o.reminder_kind::text, m.body) as auto_kind
   from public.wa_messages m
   left join public.whatsapp_outbound o on o.wa_message_id = m.heyy_message_id;

drop function if exists public.wa_auto_kind(text, text, text, text);

-- השיחות שכבר יש בהן לחיצת שפה: התקציר והמונה מחושבים מחדש.
select public.wa_refresh_human_summary(conversation_id)
  from (select distinct conversation_id from public.wa_messages where direction = 'in' and public.wa_is_language_click(body)) c;
