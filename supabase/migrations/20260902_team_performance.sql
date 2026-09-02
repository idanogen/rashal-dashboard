-- ראה migration שהוחל ב-Supabase: team_performance (02/09/2026)
-- מדדי הצוות, בקריאה אחת.
--
-- ⭐ **הכל נגזר מהעצירות עצמן ולא מיומן הפעילות.** ביומן שם העובד הוא
-- טקסט חופשי שנרשם ברגע האירוע, ולכן "דוד" ו"דוד חסידים" מופיעים שם
-- כשני אנשים (231 מול 7). על העצירה יושב השם הנוכחי, והוא מתעדכן עם
-- שינוי שם, ולכן ההיסטוריה נשארת שלמה. [[hardcoded_id_dies_when_records_merge]]
--
-- 🔴 **המדד הראשי אינו "אחוז שבוצע" מתוך הכל.** עצירה שנשארה פתוחה
-- מיום שעבר אינה "לא בוצעה", היא **לא נסגרה**, ואלה שתי שאלות שונות
-- לגמרי: אחת על העבודה, אחת על הדיווח. לכן מוחזרות שתי עמודות נפרדות,
-- `open_from_past` לצד `not_completed`, והמסך מציג את שתיהן.
--
-- 🔴 `security invoker`, ולכן ה-RLS של העצירות חל כאן מעצמו.

create or replace function public.team_performance(p_days integer default 90)
returns jsonb
language sql
stable
security invoker
set search_path to 'public'
as $$
with win as (
  select (current_date - greatest(p_days, 1))::date as d_from, current_date as d_to
),
s as (
  select cs.*, w.d_from, w.d_to
    from public.calendar_stops cs, win w
   where cs.delivery_date between w.d_from and w.d_to
     and coalesce(cs.driver, '') <> ''
),
people as (
  select
    s.driver as name,
    max(a.kind) as kind,
    count(*) as stops,
    count(*) filter (where s.arrived_at is not null) as arrived,
    count(*) filter (where s.status = 'completed') as completed,
    count(*) filter (where s.status = 'not_completed') as not_completed,
    count(*) filter (where s.status in ('planned','in_progress') and s.delivery_date < current_date) as open_from_past,
    count(distinct s.delivery_date) filter (where s.status in ('completed','not_completed')) as active_days,
    count(*) filter (where s.status = 'completed' and s.completed_at::date = s.delivery_date) as closed_same_day
  from s left join public.assignees a on a.name = s.driver
  group by s.driver
),
reasons as (
  select coalesce(s.resolution_reason, 'לא מסווג') as reason, count(*) as n
    from s where s.status = 'not_completed'
   group by 1
)
select jsonb_build_object(
  'window_days', greatest(p_days, 1),
  'from', (select d_from from win),
  'to', (select d_to from win),
  'people', coalesce((
    select jsonb_agg(jsonb_build_object(
      'name', name, 'kind', kind, 'stops', stops, 'arrived', arrived,
      'completed', completed, 'notCompleted', not_completed,
      'openFromPast', open_from_past, 'activeDays', active_days,
      'closedSameDay', closed_same_day
    ) order by completed desc, stops desc) from people), '[]'::jsonb),
  'reasons', coalesce((
    select jsonb_agg(jsonb_build_object('reason', reason, 'n', n) order by n desc)
      from reasons), '[]'::jsonb),
  'totals', (
    select jsonb_build_object(
      'stops', count(*),
      'completed', count(*) filter (where status='completed'),
      'notCompleted', count(*) filter (where status='not_completed'),
      'openFromPast', count(*) filter (where status in ('planned','in_progress') and delivery_date < current_date),
      'closedSameDay', count(*) filter (where status='completed' and completed_at::date = delivery_date),
      'withArrival', count(*) filter (where arrived_at is not null)
    ) from s
  )
);
$$;

grant execute on function public.team_performance(integer) to authenticated;

comment on function public.team_performance(integer) is
  'מדדי צוות בקריאה אחת: תפוקה, סגירה, פתוחות מימים שעברו וסיבות "לא בוצע". נולד 02/09/2026.';
