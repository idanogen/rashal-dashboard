-- דוח בוקר טוב למנהלים (החלטות עידן, 09/09/2026): מסך "דוח בוקר" בתפריט
-- ההנהלה עם כרטיס בדשבורד, הודעת וואטסאפ בשבע בבוקר בימי עבודה עם
-- קישור למסך, ו"סופק" = רק עצירות שנסגרו "בוצע". הנמענים עמי, רונן ושלומי.
-- המוקאפ: meetings/rashal/2026-09-09-דוח-בוקר-טוב-מנהלים-מוקאפ.html
--
-- ⭐ הכל נגזר מהעצירות שכבר ביומן, בלי שום נתון חדש. הכלל שנקבע במסך
-- "ביצועי הצוות" חל גם כאן: עצירה שנשארה פתוחה אינה כישלון, היא לא
-- דווחה, ולכן היא עמודה משלה ומחוץ לאחוז האספקה.
--
-- 🔴 `security invoker`: ה-RLS של העצירות חל מעצמו (משרד רואה הכל,
-- נהג היה רואה רק את שלו, אבל המסך ממילא סגור לו ב-screen-access).

-- "אתמול" של הדוח: יום העבודה האחרון שהיו בו עצירות לפני היום. ביום ראשון
-- זה שישי (אם עבדו) או חמישי, ואחרי חג היום שלפני החג.
create or replace function public.morning_report_default_date()
returns date
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select max(delivery_date) from public.calendar_stops
      where delivery_date < public.israel_today() and status <> 'cancelled'),
    public.israel_today() - 1);
$$;

create or replace function public.morning_report(p_date date default null)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with d as (
  select coalesce(p_date, public.morning_report_default_date()) as day
),
day_stops as (
  select cs.*
    from public.calendar_stops cs, d
   where cs.delivery_date = d.day and cs.status <> 'cancelled'
),
by_driver as (
  select coalesce(nullif(s.driver, ''), 'לא משובץ') as name,
         max(a.kind) as kind,
         count(*) as planned,
         count(*) filter (where s.status = 'completed') as delivered,
         count(*) filter (where s.status = 'not_completed') as not_delivered,
         count(*) filter (where s.status in ('planned', 'in_progress')) as open_count
    from day_stops s
    left join public.assignees a on a.name = s.driver
   group by 1
),
not_done as (
  select s.id, s.customer_name, s.city, s.driver, s.source_type,
         s.resolution_kind, s.resolution_reason, s.resolution_note, s.sequence
    from day_stops s
   where s.status = 'not_completed'
),
open_list as (
  select s.id, s.customer_name, s.city, s.driver, s.source_type, s.status,
         (s.arrived_at is not null) as arrived, s.sequence
    from day_stops s
   where s.status in ('planned', 'in_progress')
),
trend_days as (
  select g::date as day
    from d, generate_series(d.day - 27, d.day, interval '1 day') g
   where extract(dow from g) between 0 and 5
   order by g desc
   limit 14
),
trend as (
  select t.day,
         count(cs.id) filter (where cs.status <> 'cancelled') as planned,
         count(cs.id) filter (where cs.status = 'completed') as delivered,
         count(cs.id) filter (where cs.status = 'not_completed') as not_delivered,
         count(cs.id) filter (where cs.status in ('planned', 'in_progress')) as open_count
    from trend_days t
    left join public.calendar_stops cs on cs.delivery_date = t.day
   group by t.day
),
months as (
  select date_trunc('month', cs.delivery_date)::date as month,
         count(distinct cs.delivery_date) as workdays,
         count(*) filter (where cs.status <> 'cancelled') as planned,
         count(*) filter (where cs.status = 'completed') as delivered,
         count(*) filter (where cs.status = 'not_completed') as not_delivered,
         count(*) filter (where cs.status in ('planned', 'in_progress')) as open_count
    from public.calendar_stops cs, d
   where cs.delivery_date >= (date_trunc('month', d.day) - interval '2 months')::date
     and cs.delivery_date <= d.day
   group by 1
)
select jsonb_build_object(
  'date', (select day from d),
  'dow', (select extract(dow from day)::int from d),
  'totals', (select jsonb_build_object(
      'planned', coalesce(sum(planned), 0),
      'delivered', coalesce(sum(delivered), 0),
      'not_delivered', coalesce(sum(not_delivered), 0),
      'open', coalesce(sum(open_count), 0),
      'drivers', count(*) filter (where name <> 'לא משובץ'))
    from by_driver),
  'by_driver', (select coalesce(jsonb_agg(jsonb_build_object(
      'name', name, 'kind', kind, 'planned', planned, 'delivered', delivered,
      'not_delivered', not_delivered, 'open', open_count)
      order by planned desc, name), '[]'::jsonb) from by_driver),
  'not_delivered', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'customer', customer_name, 'city', city, 'driver', driver, 'source', source_type,
      'kind', resolution_kind, 'reason', resolution_reason, 'note', resolution_note)
      order by driver, sequence), '[]'::jsonb) from not_done),
  'open', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'customer', customer_name, 'city', city, 'driver', driver, 'source', source_type,
      'status', status, 'arrived', arrived)
      order by driver, sequence), '[]'::jsonb) from open_list),
  'trend', (select coalesce(jsonb_agg(jsonb_build_object(
      'date', day, 'planned', planned, 'delivered', delivered,
      'not_delivered', not_delivered, 'open', open_count)
      order by day), '[]'::jsonb) from trend),
  'months', (select coalesce(jsonb_agg(jsonb_build_object(
      'month', month, 'workdays', workdays, 'planned', planned, 'delivered', delivered,
      'not_delivered', not_delivered, 'open', open_count)
      order by month desc), '[]'::jsonb) from months)
);
$$;

revoke all on function public.morning_report(date) from public, anon;
grant execute on function public.morning_report(date) to authenticated, service_role;
revoke all on function public.morning_report_default_date() from public, anon;
grant execute on function public.morning_report_default_date() to authenticated, service_role;

-- ── ההודעה של שבע בבוקר: הגדרות ──────────────────────────────────────
-- המתג במסד, כמו שאר המנועים (כיבוי = UPDATE אחד). הנמענים כאן, לא בקוד.
create table if not exists public.morning_report_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  dry_run boolean not null default false,
  -- שעון ישראל. הקרון רץ בחלון רחב והפונקציה בודקת את השעה.
  send_hour integer not null default 7,
  template_id text,
  -- [{"name": "...", "phone_e164": "+972..."}]
  recipients jsonb not null default '[]'::jsonb,
  last_run_at timestamptz,
  last_sent_date date,
  last_result jsonb
);
insert into public.morning_report_settings (id) values (true) on conflict (id) do nothing;

alter table public.morning_report_settings enable row level security;
drop policy if exists morning_report_settings_read on public.morning_report_settings;
create policy morning_report_settings_read on public.morning_report_settings
  for select to authenticated using ((select public.is_admin_or_dispatcher()));

-- ── הקרון: כל 10 דקות בחלון 04:00-05:59 UTC בימים א-ו ────────────────
-- 04 UTC = 07:00 בקיץ, 05 UTC = 07:00 בחורף. הפונקציה שולחת רק כשהשעה
-- בישראל היא שעת השליחה ומעלה, ופעם אחת ליום (last_sent_date).
do $$
declare
  fn text := 'https://kukstfxtznymfkirdmty.supabase.co/functions/v1/rashal-morning-report';
  anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a3N0Znh0em55bWZraXJkbXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNDQ2MjMsImV4cCI6MjA5MTgyMDYyM30.oF-pwjnAki4LiDE8nLa6SIjHHP_tLvsoZwEyxlu2f6E';
  cmd text;
begin
  cmd := format($c$select net.http_post(url:=%L, headers:=%L::jsonb, body:='{"trigger":"cron"}'::jsonb, timeout_milliseconds:=60000)$c$,
                fn, format('{"Content-Type":"application/json","Authorization":"Bearer %s"}', anon));
  perform cron.schedule('rashal-morning-report', '*/10 4-5 * * 0-5', cmd);
end $$;
