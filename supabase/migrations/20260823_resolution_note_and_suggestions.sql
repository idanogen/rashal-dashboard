-- 🔴 **תיאור המשימה נמחק כשהנהג סימן "לא בוצע".** `resolveStop` כתב את
-- סיבת אי-הביצוע לתוך אותה עמודה `notes` שבה יושב התיאור שנרשם בהקמה,
-- ודרס אותו. 27 משימות שנפתחו ביוזמה כבר איבדו את התיאור המקורי.
alter table public.calendar_stops
  add column if not exists resolution_note text;

comment on column public.calendar_stops.notes is 'תיאור המשימה, כפי שנרשם בהקמה. לא נדרס לעולם.';
comment on column public.calendar_stops.resolution_note is 'מה שהנהג רשם כשסימן בוצע / לא בוצע.';

-- הצעות השלמה לשדות החופשיים במסך "משימה חדשה".
--
-- ⭐ **מהנתונים שלנו, לא מהדפדפן.** ההשלמה שהייתה פעם היא זיכרון הטפסים
-- של הדפדפן: פר מכשיר, פר פרופיל, ונמחקת עם ניקוי היסטוריה. כאן הרשימה
-- משותפת לכל העובדים ונשענת על אלפי רשומות אמיתיות.
--
-- 🔴 שתי מלכודות שנסגרו כאן:
-- 1. סיבות של נהגים מוחרגות מהצעות ההערות. הן חיו באותה עמודה עד היום,
--    ובלעדי ההחרגה מי שפותח משימה היה מקבל "הלקוח לא היה בבית" כהצעה.
-- 2. `if not <null>` אינו נכון וגם אינו שקר, ולכן אינו מרים חריגה.
--    משתמש מחובר בלי שורת פרופיל היה מקבל את הרשימות. `is not true`.
create or replace function public.field_suggestions()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  result jsonb;
begin
  if public.is_admin_or_dispatcher() is not true then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    'cities', (
      select coalesce(jsonb_agg(v order by n desc, v), '[]'::jsonb) from (
        select v, count(*) as n from (
          select city as v from public.orders         where coalesce(city,'') <> ''
          union all
          select city     from public.service_calls   where coalesce(city,'') <> ''
          union all
          select city     from public.calendar_stops  where coalesce(city,'') <> ''
        ) u group by v
      ) t
    ),
    'customers', (
      select coalesce(jsonb_agg(v order by n desc, v), '[]'::jsonb) from (
        select customer_name as v, count(*) as n
          from public.calendar_stops
         where source_type = 'task' and coalesce(customer_name,'') <> ''
         group by 1
      ) t
    ),
    'addresses', (
      select coalesce(jsonb_agg(v order by n desc, v), '[]'::jsonb) from (
        select address as v, count(*) as n
          from public.calendar_stops
         where source_type = 'task' and coalesce(address,'') <> ''
         group by 1
      ) t
    ),
    'devices', (
      select coalesce(jsonb_agg(v order by n desc, v), '[]'::jsonb) from (
        select device_name as v, count(*) as n
          from public.service_calls
         where coalesce(device_name,'') <> ''
         group by 1
      ) t
    ),
    'notes', (
      select coalesce(jsonb_agg(v order by n desc, v), '[]'::jsonb) from (
        select notes as v, count(*) as n
          from public.calendar_stops
         where source_type = 'task'
           and coalesce(notes,'') <> ''
           and status <> 'not_completed'
         group by 1
      ) t
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.field_suggestions() from public;
grant execute on function public.field_suggestions() to authenticated;
