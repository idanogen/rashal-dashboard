-- תזכורת הערב ללקוחות של מחר ודוח הבוקר על התשובות (עידן, 04/11/2026).
--
-- "עדכון בלבד, בלי בקשת אישור": ב-19:00 יוצאת תזכורת (api/cron-daily-reminders),
-- וכל מה שהלקוח עונה עד הבוקר נאסף כאן לפי הטלפון, ונשלח ב-07:00 לשלומי, רונן,
-- עמי ואבירם עם דוח הבוקר (rashal-morning-report, תבנית rashal_reminder_report).
--
-- ⭐ התשובה מזוהה לפי הטלפון של השיחה ב-wa_conversations ולפי הזמן: הודעה נכנסת
--    אחרי שעת שליחת התזכורת ולפני 07:00 של יום הביקור. בלי כפתורים, כל טקסט נחשב.

-- 🔴 הסוג whatsapp_reminder_kind לא הכיר 'visit_reminder' (הקרון כתב אותו ונפל היה נופל בשקט).
-- הוחל בנפרד לפני הפונקציה, כי ערך חדש של enum לא שמיש באותה עסקה.
alter type public.whatsapp_reminder_kind add value if not exists 'visit_reminder';

alter table public.morning_report_settings
  add column if not exists reminder_report_template_id text;
comment on column public.morning_report_settings.reminder_report_template_id is
  'תבנית heyy לדוח התזכורות (rashal_reminder_report). ריק = הדוח לא נשלח, רק המסך.';

-- אבירם נמען רביעי לדוח הבוקר (הכרעת עידן 04/11).
update public.morning_report_settings
   set recipients = recipients || '[{"name":"אבירם","phone_e164":"+972585393000"}]'::jsonb
 where id = true
   and not exists (select 1 from jsonb_array_elements(recipients) r where r->>'phone_e164' = '+972585393000');

create or replace function public.reminder_replies(p_date date default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with d as (
  select coalesce(p_date, (now() at time zone 'Asia/Jerusalem')::date) as day
),
sent as (
  select l.stop_id, l.phone_e164, l.sent_at, s.customer_name, s.driver, s.source_type,
         s.time_window_start, s.time_window_end
    from public.whatsapp_reminder_log l
    join public.calendar_stops s on s.id = l.stop_id
    join d on true
   where l.reminder_kind = 'visit_reminder'
     and s.delivery_date = d.day
),
replies as (
  select st.stop_id,
         (array_agg(m.body order by m.created_at))[1] as reply_text,
         min(m.created_at) as reply_at,
         count(*) as reply_count
    from sent st
    join public.wa_conversations c on c.phone_e164 = st.phone_e164
    join public.wa_messages m on m.conversation_id = c.id
    join d on true
   where m.direction = 'in'
     and m.created_at > st.sent_at
     and m.created_at < ((d.day::timestamp + interval '7 hours') at time zone 'Asia/Jerusalem')
   group by st.stop_id
)
select jsonb_build_object(
  'date', (select day from d),
  'sent', (select count(*) from sent),
  'replied', (select count(*) from replies),
  'no_reply', (select count(*) from sent) - (select count(*) from replies),
  'rows', coalesce((
    select jsonb_agg(jsonb_build_object(
      'stop_id', st.stop_id, 'customer_name', st.customer_name, 'driver', st.driver,
      'source_type', st.source_type, 'sent_at', st.sent_at,
      'hours', case when st.time_window_start is not null then left(st.time_window_start::text, 5) || '-' || left(st.time_window_end::text, 5) end,
      'reply_text', r.reply_text, 'reply_at', r.reply_at, 'reply_count', coalesce(r.reply_count, 0)
    ) order by (r.reply_at is null), r.reply_at, st.customer_name)
    from sent st left join replies r on r.stop_id = st.stop_id
  ), '[]'::jsonb)
);
$$;
revoke all on function public.reminder_replies(date) from public, anon;
grant execute on function public.reminder_replies(date) to authenticated, service_role;
