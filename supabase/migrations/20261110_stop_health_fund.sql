-- ════════════════════════════════════════════════════════════════════════
-- הקופה על כרטיס הביקור באפליקציית הנהגים (שלומי 07/11/2026, עידן 10/11/2026)
--
-- שלומי: "יש דרך להוסיף לכאן אינדיקציה לשייכות לקופה?" (צילום כרטיס ביקור).
-- הקופה כבר נקבעה לכל עצירה בתוך `stop_form_context` (ממנה נבחר טופס הקופה),
-- אבל רק כשפותחים את הטופס. כאן הכלל יוצא לפונקציה אחת, והרשימה מקבלת אותו.
--
-- ⭐ מקור אחד לכלל: `stop_health_fund(stop)`. `stop_form_context`
-- (20261016_signed_forms.sql) קוראת לה במקום להחזיק עותק.
-- הכלל: `health_fund` של הקריאה או ההזמנה (= CTYPENAME בפריוריטי), ואם ריק
-- `customer_type` של כרטיס הלקוח. 🔴 לא `priority_customers.health_fund`
-- (שם יושב המשלם, לא הקופה של המטופל).
-- נמדד 10/11 על שבוע: קריאות שירות 102 מתוך 103 עם קופה, אספקות 63 מתוך 67.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.stop_health_fund(p_stop public.calendar_stops)
returns text
language sql stable security definer
set search_path = public
as $$
  -- אותה קדימות כמו שהייתה ב-`stop_form_context`: קריאה, אחרת הזמנה, אחרת איסוף.
  with src as (
    select 1 as ord, sc.health_fund as fund, sc.customer_number as cust
      from public.service_calls sc
     where sc.id = p_stop.service_call_id
    union all
    select 2, o.health_fund, o.customer_number
      from public.orders o
     where p_stop.service_call_id is null and o.id = p_stop.order_id
    union all
    select 3, null::text, p.customer_number
      from public.pickups p
     where p_stop.service_call_id is null and p_stop.order_id is null and p.id = p_stop.pickup_id
    union all
    select 4, null::text, null::text   -- עצירה בלי מסמך: רק מספר הלקוח שעל העצירה
    order by ord
    limit 1
  )
  select coalesce(
           nullif(trim(src.fund), ''),
           (select nullif(trim(pc.customer_type), '')
              from public.priority_customers pc
             where pc.custname = coalesce(nullif(trim(p_stop.customer_number), ''), nullif(trim(src.cust), ''))
             limit 1)
         )
    from src;
$$;

-- לרשימת העצירות באפליקציה ובדשבורד: רק עצירות שיש להן קופה.
-- הרשאה כמו הרשימה עצמה: משרד רואה הכל, נהג את שלו (כולל מחר מ-16:00).
create or replace function public.stops_health_fund(p_stop_ids uuid[])
returns table (stop_id uuid, health_fund text)
language sql stable security definer
set search_path = public
as $$
  select f.id, f.fund
    from (
      select cs.id, public.stop_health_fund(cs) as fund
        from public.calendar_stops cs
       where cs.id = any(p_stop_ids)
         and coalesce(cardinality(p_stop_ids), 0) <= 300
         and ((select public.is_office_staff()) is true
              or public.driver_stop_visible(cs.driver, cs.delivery_date) is true)
    ) f
   where f.fund is not null;
$$;

revoke all on function public.stop_health_fund(public.calendar_stops) from public, anon, authenticated;
revoke all on function public.stops_health_fund(uuid[]) from public, anon;
grant execute on function public.stops_health_fund(uuid[]) to authenticated;
