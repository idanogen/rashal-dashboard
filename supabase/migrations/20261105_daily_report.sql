-- ─── דוח מערכת יומי לעידן, 19:00 שעון ישראל ──────────────────────────────
--
-- עידן, 05/11/2026: "אני רוצה שיהיה לנו בדיקה על המערכת חזקה, לוגים בכל מקום
-- שצריך, ואני רוצה דוח יומי על המערכת בכל יום בשעה 19:00 למייל שלי".
--
-- השומר (rashal-watchdog) מתריע על חריגים בלבד. הדוח הזה הוא התמונה החיובית:
-- מה רץ, מה נעשה בשטח, מה המכשירים דיווחו, מה המסד עשה, ומה נשאר תקוע.
-- הנתונים נאספים בפונקציה אחת במסד (daily_report_data), הרינדור והשליחה
-- ב-Edge Function rashal-daily-report (Resend, כמו השומר).
--
-- שעון: הקרון רץ ב-16:00 וב-17:00 UTC (19:00 ישראל בקיץ ובחורף), הפונקציה
-- בודקת שהשעה בישראל היא 19 ושהדוח של היום עוד לא נשלח (daily_report_log).

create table if not exists public.daily_report_log (
  report_date date primary key,
  sent_at timestamptz not null default now(),
  recipients text[] not null default '{}',
  ok boolean not null default true,
  error text,
  bytes integer
);
alter table public.daily_report_log enable row level security;
-- אין מדיניות: service_role בלבד (הדוח נשלח מהשרת, המסך לא קורא את זה).

-- סטטיסטיקת המסד: pg_stat_statements דורש הרשאת קריאה, לכן security definer
-- (הבעלים הוא postgres דרך המיגרציה). מצטבר מאז האיפוס האחרון, לא "היום".
-- 🔴 התצוגה יושבת בסכמה extensions, לא ב-public: בלי הקידומת המיגרציה נופלת (05/11).
create or replace function public.daily_report_db_stats()
returns jsonb
language sql
stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'db_size', pg_size_pretty(pg_database_size(current_database())),
    'top_mean', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'q', left(regexp_replace(query, '\s+', ' ', 'g'), 110),
               'calls', calls, 'mean_ms', round(mean_exec_time::numeric), 'max_ms', round(max_exec_time::numeric)
             ) order by mean_exec_time desc), '[]'::jsonb)
        from (select * from extensions.pg_stat_statements where calls >= 5 and query not ilike '%pg_stat_statements%'
               order by mean_exec_time desc limit 5) t),
    'top_total', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'q', left(regexp_replace(query, '\s+', ' ', 'g'), 110),
               'calls', calls, 'total_s', round((total_exec_time / 1000)::numeric)
             ) order by total_exec_time desc), '[]'::jsonb)
        from (select * from extensions.pg_stat_statements where query not ilike '%pg_stat_statements%'
               order by total_exec_time desc limit 5) t)
  );
$$;
revoke all on function public.daily_report_db_stats() from public, anon, authenticated;
grant execute on function public.daily_report_db_stats() to service_role;

-- כל הנתונים של יום אחד (שעון ישראל) באובייקט אחד.
create or replace function public.daily_report_data(p_date date default null)
returns jsonb
language plpgsql
stable security definer
set search_path = public
as $$
declare
  d date := coalesce(p_date, (now() at time zone 'Asia/Jerusalem')::date);
  t0 timestamptz := (d::text || ' 00:00')::timestamp at time zone 'Asia/Jerusalem';
  t1 timestamptz := ((d + 1)::text || ' 00:00')::timestamp at time zone 'Asia/Jerusalem';
  r jsonb := '{}'::jsonb;
begin
  r := r || jsonb_build_object('date', d::text, 'generated_at', now());

  -- 1. סנכרון: לכל job הריצה המוצלחת האחרונה, ריצות היום, כשלים היום.
  r := r || jsonb_build_object('sync', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'job', j.job,
      'last_success', j.last_success,
      'age_min', case when j.last_success is null then null else round(extract(epoch from (now() - j.last_success)) / 60) end,
      'runs_today', j.runs_today, 'failed_today', j.failed_today, 'rows_today', j.rows_today,
      'last_error', j.last_error
    ) order by j.job), '[]'::jsonb)
    from (
      select job,
             max(started_at) filter (where status = 'success') as last_success,
             count(*) filter (where started_at >= t0 and started_at < t1) as runs_today,
             count(*) filter (where started_at >= t0 and started_at < t1 and status <> 'success') as failed_today,
             coalesce(sum(rows_upserted) filter (where started_at >= t0 and started_at < t1), 0) as rows_today,
             (array_agg(error_summary order by started_at desc) filter (where status <> 'success' and started_at >= t0))[1] as last_error
        from sync_runs where started_at >= now() - interval '14 days'
       group by job
    ) j));

  -- התראות פתוחות אצל השומר.
  r := r || jsonb_build_object('alerts', (
    select coalesce(jsonb_agg(jsonb_build_object('job', job, 'state', state, 'since', last_alerted_at, 'detail', left(detail, 160))), '[]'::jsonb)
      from sync_alerts where state <> 'ok'));

  -- 2. כתיבה לפריוריטי.
  r := r || jsonb_build_object('priority', jsonb_build_object(
    'status_writes', (select coalesce(jsonb_object_agg(state, n), '{}'::jsonb) from (
        select state, count(*) n from priority_call_status_writes where created_at >= t0 and created_at < t1 group by state) s),
    'status_errors', (select count(*) from priority_call_status_writes where created_at >= t0 and created_at < t1 and error is not null),
    'pushed_today', (select count(*) from priority_call_push_log where pushed_at >= t0 and pushed_at < t1),
    'failed_today', (select count(*) from priority_call_push_log where failed_at >= t0 and failed_at < t1),
    'parked_total', (select count(*) from priority_call_push_log where failed_at is not null and pushed_at is null),
    'queue_blocked', (select count(*) from priority_call_push_queue where blocked_reason is not null and pushed_at is null),
    'queue_pending', (select count(*) from priority_call_push_queue where pushed_at is null and failed_at is null and blocked_reason is null)
  ));

  -- 3. השטח היום.
  r := r || jsonb_build_object('ops', jsonb_build_object(
    'stops', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (
        select status, count(*) n from calendar_stops where delivery_date = d group by status) s),
    'by_driver', (select coalesce(jsonb_agg(jsonb_build_object('driver', driver, 'total', total, 'done', done, 'not_done', not_done, 'open', open) order by driver), '[]'::jsonb)
      from (select driver, count(*) total,
                   count(*) filter (where status = 'completed') done,
                   count(*) filter (where status = 'not_completed') not_done,
                   count(*) filter (where status in ('planned','in_progress')) open
              from calendar_stops where delivery_date = d group by driver) x),
    'tomorrow', (select count(*) from calendar_stops where delivery_date = d + 1 and status <> 'cancelled'),
    'forms_signed', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (
        select coalesce(form_kind, 'other') k, count(*) n from signed_forms where created_at >= t0 and created_at < t1 group by 1) s),
    'crane_forms', (select count(*) from crane_forms where created_at >= t0 and created_at < t1),
    'on_way_notified', (select count(*) from calendar_stops where on_way_notified_at >= t0 and on_way_notified_at < t1),
    'leftovers', (select count(*) from calendar_stops where delivery_date < d and status in ('planned','in_progress'))
  ));

  -- 4. וואטסאפ.
  r := r || jsonb_build_object('wa', jsonb_build_object(
    'in', (select count(*) from wa_messages where direction = 'in' and created_at >= t0 and created_at < t1),
    'out', (select count(*) from wa_messages where direction = 'out' and created_at >= t0 and created_at < t1),
    'out_failed', (select count(*) from wa_messages where direction = 'out' and created_at >= t0 and created_at < t1 and status in ('failed','error')),
    'reminders', (select count(*) from whatsapp_reminder_log where sent_at >= t0 and sent_at < t1),
    'media_pending', (select count(*) from wa_messages where media_state = 'pending' and created_at >= now() - interval '2 days')
  ));

  -- 5. האפליקציה: מי עבד, באיזו גרסה, מה נשבר.
  r := r || jsonb_build_object('app', jsonb_build_object(
    'users_by_version', (select coalesce(jsonb_agg(jsonb_build_object('version', app_version, 'users', users, 'names', names) order by users desc), '[]'::jsonb)
      from (select app_version, count(distinct user_name) users, string_agg(distinct user_name, ', ') names
              from (select distinct on (user_name) user_name, app_version from app_events
                     where occurred_at >= t0 and occurred_at < t1 and app = 'driver' order by user_name, occurred_at desc) u
             group by app_version) v),
    'errors', (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'n', n, 'users', users, 'sample', sample) order by n desc), '[]'::jsonb)
      from (select name, count(*) n, count(distinct user_name) users, left(max(detail->>'message'), 140) sample
              from app_events where occurred_at >= t0 and occurred_at < t1 and kind = 'error' and app = 'driver'
             group by name order by n desc limit 8) e),
    'stop_info_open', (select count(*) from app_events where occurred_at >= t0 and occurred_at < t1 and name = 'stop_info_open'),
    'image_shown', (select count(*) from app_events where occurred_at >= t0 and occurred_at < t1 and name = 'image_shown'),
    'image_load_failed', (select count(*) from app_events where occurred_at >= t0 and occurred_at < t1 and name = 'image_load'),
    'actions_applied', (select count(*) from stop_actions where received_at >= t0 and received_at < t1 and result = 'applied'),
    'actions_rejected', (select count(*) from stop_actions where received_at >= t0 and received_at < t1 and result = 'rejected'),
    'stuck', (select count(*) from app_events where occurred_at >= t0 and occurred_at < t1 and kind = 'stuck')
  ));

  -- 6. הדשבורד: זמני טעינה של מסך הסדרן.
  r := r || jsonb_build_object('dashboard', (
    select jsonb_build_object(
      'loads', count(*),
      'p50_s', round((percentile_cont(0.5) within group (order by total_ms) / 1000)::numeric, 1),
      'p95_s', round((percentile_cont(0.95) within group (order by total_ms) / 1000)::numeric, 1),
      'max_s', round((max(total_ms) / 1000)::numeric, 1),
      'slow_over_8s', count(*) filter (where total_ms > 8000),
      'with_failures', count(*) filter (where failures is not null and array_length(failures, 1) > 0),
      'critical', (select critical_fetch from screen_load_log where created_at >= t0 and created_at < t1 group by critical_fetch order by count(*) desc limit 1)
    ) from screen_load_log where created_at >= t0 and created_at < t1));

  -- 7. המסד.
  r := r || jsonb_build_object('db', public.daily_report_db_stats());
  return r;
end;
$$;
revoke all on function public.daily_report_data(date) from public, anon, authenticated;
grant execute on function public.daily_report_data(date) to service_role;

-- הקרון: 16:00 ו-17:00 UTC, הפונקציה מכריעה לפי שעון ישראל ולפי daily_report_log.
do $$
declare
  fn text := 'https://kukstfxtznymfkirdmty.supabase.co/functions/v1/rashal-daily-report';
  anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a3N0Znh0em55bWZraXJkbXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNDQ2MjMsImV4cCI6MjA5MTgyMDYyM30.oF-pwjnAki4LiDE8nLa6SIjHHP_tLvsoZwEyxlu2f6E';
  cmd text;
begin
  cmd := format($c$select net.http_post(url:=%L, headers:=(%L::jsonb || jsonb_build_object('x-sync-secret', public.sync_secret())), body:='{}'::jsonb, timeout_milliseconds:=120000)$c$,
                fn, format('{"Content-Type":"application/json","Authorization":"Bearer %s"}', anon));
  perform cron.schedule('rashal-daily-report', '0 16,17 * * *', cmd);
end $$;
