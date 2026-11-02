-- ─────────────────────────────────────────────────────────────────────────
-- app_day_summary — "מי נתקע היום" (02/11/2026, שלב 3 בתוכנית הלוגים).
-- תמונת יום אחת מתוך app_events: לכל משתמש מתי נכנס, באיזו גרסה, כמה
-- שגיאות, איפה נתקע, מה קרה בטפסים ומה דיווח ב"יש בעיה".
--
-- ⭐ מקור אחד: מסך הלוגים בדשבורד וסיכום הבוקר (rashal-app-alerts) קוראים
-- את אותה פונקציה, ולכן לא יכולים לסתור זה את זה.
-- security invoker: מהדפדפן ה-RLS של app_events (אדמין בלבד) חל גם כאן.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.app_day_summary(p_day date default (now() at time zone 'Asia/Jerusalem')::date)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with ev as (
    select * from public.app_events
     where occurred_at >= (p_day::timestamp at time zone 'Asia/Jerusalem')
       and occurred_at <  ((p_day + 1)::timestamp at time zone 'Asia/Jerusalem')
  ),
  per_user as (
    select
      coalesce(user_name, 'לא מזוהה') as name,
      max(user_role) as role,
      max(app) as app,
      (array_agg(app_version order by occurred_at desc))[1] as version,
      (array_agg(device order by occurred_at desc))[1] as device,
      min(occurred_at) as first_seen,
      max(occurred_at) as last_seen,
      count(*) filter (where kind = 'session') as sessions,
      count(*) filter (where kind = 'screen' and name = 'enter') as screens,
      count(*) filter (where kind = 'error') as errors,
      count(*) filter (where kind = 'error' and name = 'crash') as crashes,
      count(*) filter (where kind = 'stuck' and name = 'queue_rejected') as rejected,
      count(*) filter (where kind = 'action' and name = 'image_load') as image_errors,
      count(*) filter (where kind = 'form' and name = 'sign_open') as forms_opened,
      count(*) filter (where kind = 'form' and name = 'blocked') as forms_blocked,
      count(*) filter (where kind = 'form' and name = 'cancel') as forms_cancelled,
      count(*) filter (where kind = 'form' and name = 'saved') as forms_saved,
      count(*) filter (where kind = 'form' and name = 'save_failed') as forms_failed,
      count(*) filter (where kind = 'form' and name = 'sent') as forms_sent,
      count(*) filter (where kind = 'stuck' and name = 'problem_report') as problems
    from ev
    group by coalesce(user_name, 'לא מזוהה')
  ),
  -- שגיאות לפי שם לכל משתמש: המסך מנכה שגיאות צפויות (KNOWN_ERRORS) לפני הצביעה.
  user_errors as (
    select coalesce(user_name, 'לא מזוהה') as name, jsonb_object_agg(err, n) as error_names
      from (select user_name, name as err, count(*) as n from ev where kind = 'error' group by 1, 2) x
     group by 1
  ),
  top_errors as (
    select name, count(*) as n, count(distinct user_name) as users,
           (array_agg(detail->>'message' order by occurred_at desc))[1] as sample
      from ev where kind = 'error'
     group by name order by count(*) desc limit 10
  ),
  blocks as (
    select coalesce(detail->>'formKey', '?') as form_key, coalesce(detail->>'reason', '?') as reason,
           count(*) as n, string_agg(distinct user_name, ', ') as users
      from ev where kind = 'form' and name = 'blocked'
     group by 1, 2 order by count(*) desc limit 10
  ),
  problems as (
    select e.occurred_at, e.user_name, e.screen, e.stop_id, cs.customer_name,
           e.detail->>'topic' as topic, e.detail->>'text' as text, e.app_version
      from ev e left join public.calendar_stops cs on cs.id = e.stop_id
     where e.kind = 'stuck' and e.name = 'problem_report'
     order by e.occurred_at desc limit 50
  ),
  -- מי שיש לו עצירות ביום הזה ולא נראה באפליקציה בכלל. השם בעצירה הוא
  -- linked_driver, אותו שם ש-log_app_events רושם כ-user_name.
  silent as (
    select cs.driver as name, count(*) as stops
      from public.calendar_stops cs
     where cs.delivery_date = p_day and cs.driver is not null
       and not exists (select 1 from ev where ev.user_name = cs.driver and ev.app = 'driver')
     group by cs.driver order by count(*) desc
  )
  select jsonb_build_object(
    'day', p_day,
    'events', (select count(*) from ev),
    'users', coalesce((select jsonb_agg(to_jsonb(u) || jsonb_build_object('error_names', coalesce(ue.error_names, '{}'::jsonb))
                                        order by u.problems desc, u.errors desc, u.last_seen desc)
                         from per_user u left join user_errors ue on ue.name = u.name), '[]'::jsonb),
    'top_errors', coalesce((select jsonb_agg(to_jsonb(t)) from top_errors t), '[]'::jsonb),
    'form_blocks', coalesce((select jsonb_agg(to_jsonb(b)) from blocks b), '[]'::jsonb),
    'problems', coalesce((select jsonb_agg(to_jsonb(p)) from problems p), '[]'::jsonb),
    'silent', coalesce((select jsonb_agg(to_jsonb(s)) from silent s), '[]'::jsonb)
  );
$$;

revoke all on function public.app_day_summary(date) from public, anon;
grant execute on function public.app_day_summary(date) to authenticated;
