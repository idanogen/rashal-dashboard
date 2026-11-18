-- ─── דוח איסופים חודשי לקופה, משני מקורות (עידן, 18/11/2026) ─────────────────
--
-- שלומי (17/11): "זו דוגמא לקובץ שעובר אחת לחודש ב-10 לכל חודש, יש יכולת לייצר
-- כזה דרך המערכת?" (טבלה מרכזת לספק - איסופים מכבי). עידן: מהחודש כל האיסופים
-- נעשים דרך המערכת שלנו, ולכמה חודשים מפיקים את הדוח גם מהמערכת וגם מפריוריטי.
--
--   priority ← תעודות איסוף (RT) בסטטוס "סופית" בטווח, שורה לכל פריט.
--   app      ← עצירות איסוף שנסגרו "בוצע" באפליקציה בטווח, שורה לכל מכשיר
--              בטופס ההחזרה של הקופה (סריאלי, סיבה, מצב). בלי טופס: שורות הפריטים.
--
-- הקופה = סוג הלקוח בפריוריטי (`priority_customers.customer_type`), ומספר הלקוח
-- הוא הת"ז. תאריך הרכישה = ההזמנה האחרונה של הלקוח לפני האיסוף שמכילה את
-- הפריט (בדגימה מול הקובץ של מכבי: זהה בדיוק). ההשוואה בין המקורות נעשית
-- בבונה הקובץ לפי מספר ה-RT.

create or replace function public.pickups_fund_report(p_fund text, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if (public.is_office_staff() is true or (select auth.role()) = 'service_role') is not true then
    raise exception 'אין הרשאה' using errcode = '42501';
  end if;

  with
  fund_pickups as (
    select p.*
      from pickups p
      join priority_customers pc on pc.custname = p.customer_number
     where pc.customer_type = p_fund
       and p.duplicate_of is null
  ),
  pri as (
    select p.priority_pickup_id as rt, p.customer_name as name, p.customer_number as tz,
           p.pickup_date as picked, l->>'part' as part, l->>'desc' as item,
           nullif(l->>'returnReason', '') as reason, p.to_warehouse as warehouse,
           (select max(o.created_at)::date from orders o
             where o.customer_number = p.customer_number
               and o.created_at::date <= p.pickup_date
               and o.items::text like '%' || (l->>'part') || '%') as purchased
      from fund_pickups p
      cross join lateral jsonb_array_elements(coalesce(p.lines, '[]'::jsonb)) as l
     where p.priority_status = 'סופית'
       and p.pickup_date between p_from and p_to
  ),
  done as (
    select distinct on (p.id) p.*, s.id as stop_id, s.delivery_date as done_date, s.driver
      from fund_pickups p
      join calendar_stops s on s.pickup_id = p.id
     where s.status = 'completed'
       and s.delivery_date between p_from and p_to
     order by p.id, s.delivery_date desc
  ),
  forms as (
    select distinct on (d.id) d.id as pickup_id, f.payload
      from done d
      join signed_forms f on f.form_kind = 'return' and (f.pickup_id = d.id or f.stop_id = d.stop_id)
     order by d.id, f.signed_at desc
  ),
  app as (
    -- מכשיר מהטופס (עד 4), ובלי טופס שורות הפריטים של התעודה.
    select d.priority_pickup_id as rt, d.customer_name as name, d.customer_number as tz,
           d.done_date as picked, d.driver,
           coalesce(nullif(fm.payload->>('dev' || i || 'Name'), ''), li.l->>'desc') as item,
           li.l->>'part' as part,
           nullif(fm.payload->>('dev' || i || 'Serial'), '') as serial,
           case when fm.payload is null then null
                when fm.payload->>'returnReason' = 'אחר'
                  then coalesce(nullif(fm.payload->>'returnReasonDetail', ''), 'אחר')
                else nullif(fm.payload->>'returnReason', '') end as reason,
           nullif(fm.payload->>('dev' || i || 'Condition'), '') as condition,
           fm.payload is not null as has_form,
           (select max(o.created_at)::date from orders o
             where o.customer_number = d.customer_number
               and o.created_at::date <= d.done_date
               and li.l->>'part' is not null
               and o.items::text like '%' || (li.l->>'part') || '%') as purchased
      from done d
      left join forms fm on fm.pickup_id = d.id
      cross join lateral generate_series(1, greatest(
        case when fm.payload is null then 0 else
          (select count(*) from generate_series(1, 4) g
            where nullif(fm.payload->>('dev' || g || 'Name'), '') is not null
               or nullif(fm.payload->>('dev' || g || 'Serial'), '') is not null)::int end,
        case when fm.payload is null then jsonb_array_length(coalesce(d.lines, '[]'::jsonb)) else 1 end,
        1)) as i
      left join lateral (select coalesce(d.lines, '[]'::jsonb)->(i - 1) as l) li on true
  )
  select jsonb_build_object(
    'fund', p_fund, 'from', p_from, 'to', p_to,
    'priority', coalesce((select jsonb_agg(to_jsonb(pri) order by picked, name) from pri), '[]'::jsonb),
    'app', coalesce((select jsonb_agg(to_jsonb(app) order by picked, name) from app), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;

revoke all on function public.pickups_fund_report(text, date, date) from public, anon;
grant execute on function public.pickups_fund_report(text, date, date) to authenticated, service_role;
