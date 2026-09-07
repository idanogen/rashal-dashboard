-- היסטוריה אחת (07/09/2026, הבחירות של עידן): שדות "מי סגר / מתי סיים / מתי חולק"
-- מפריוריטי, ושתי פונקציות לסדרן: חיפוש היסטוריה ו"ביקור אחרון" לכרטיסים.
-- (customer_card עצמה עודכנה בקובץ שלה, 20260825_customer_stock.sql, כי פונקציה
-- מוגדרת בקובץ אחד בלבד.)
alter table public.service_calls add column if not exists closed_by text;
alter table public.service_calls add column if not exists closed_on date;
alter table public.delivery_notes add column if not exists distributed_on date;

-- ⭐ חיפוש היסטוריה: כל הלקוחות המוכרים שמתאימים לחיפוש, מכל השנים, עם
-- האירוע האחרון שלהם. עוטף את customer_search (שכבר יודע מספר/טלפון/שם/מסמך
-- וביקור אחרון מהיומן) ומצרף את המסמך האחרון מפריוריטי.
create or replace function public.history_search(p_query text, p_limit integer default 8)
returns table(
  customer_number text, customer_name text, phone text, city text,
  match_kind text, score integer,
  last_visit_date date, last_visit_driver text, last_visit_outcome text,
  last_order_date date, last_order_status text, last_order_ref text,
  last_call_date date, last_call_status text, last_call_ref text, last_call_by text, last_call_type text,
  last_note_date date,
  open_orders integer, open_calls integer, deliveries integer
)
language sql stable security definer set search_path = public as $$
  select cs.customer_number, cs.customer_name, cs.phone, cs.city, cs.match_kind, cs.score,
         cs.last_visit_date, cs.last_visit_driver, cs.last_visit_outcome,
         lo.d, lo.st, lo.ref,
         lc.d, lc.st, lc.ref, lc.by, lc.ct,
         ln.d,
         coalesce(oo.n, 0)::int, coalesce(oc.n, 0)::int, coalesce(dn.n, 0)::int
    from public.customer_search(p_query, least(greatest(coalesce(p_limit, 8), 1), 20)) cs
    left join lateral (
      select o.created_at::date d, o.order_status::text st, o.priority_order_id ref
        from public.orders o
       where o.customer_number = cs.customer_number and o.duplicate_of is null
         and coalesce(o.archived_reason,'') <> 'webhook-legacy-20260805'
       order by o.created_at desc limit 1) lo on cs.customer_number is not null
    left join lateral (
      select coalesce(c.closed_on, c.created_at::date) d, c.service_call_status::text st,
             c.priority_call_id ref, c.closed_by by, c.call_type ct
        from public.service_calls c
       where c.customer_number = cs.customer_number and c.duplicate_of is null
         and coalesce(c.archived_reason,'') <> 'webhook-legacy-20260805'
       order by c.created_at desc limit 1) lc on cs.customer_number is not null
    left join lateral (
      select coalesce(n.distributed_on, n.doc_date) d
        from public.delivery_notes n
       where n.customer_number = cs.customer_number
       order by n.doc_date desc limit 1) ln on cs.customer_number is not null
    left join lateral (
      select count(*) n from public.orders o
       where o.customer_number = cs.customer_number and o.archived_at is null and o.duplicate_of is null
         and o.order_status::text in ('ממתין לתאום','תואמה אספקה','אין במלאי','ממתין לליקוט')) oo on cs.customer_number is not null
    left join lateral (
      select count(*) n from public.service_calls c
       where c.customer_number = cs.customer_number and c.archived_at is null and c.duplicate_of is null
         and c.service_call_status::text in ('קריאה חדשה','תואם ביקור')) oc on cs.customer_number is not null
    left join lateral (
      select count(*) n from public.delivery_notes n
       where n.customer_number = cs.customer_number and coalesce(n.status,'') <> 'מבוטלת') dn on cs.customer_number is not null
$$;
revoke all on function public.history_search(text, integer) from public;
revoke all on function public.history_search(text, integer) from anon;
grant execute on function public.history_search(text, integer) to authenticated, service_role;

-- ⭐ "ביקור אחרון" על הכרטיס: לכל רשומה בסדרן, מה היה אצל הלקוח לפני.
-- הקלט: מערך של {k, n, name, phone} (k = מפתח שהמסך מזהה בו את הפריט).
-- ההתאמה: לפי מספר לקוח כשיש, אחרת לפי שם וטלפון. מחזיר רק מי שיש לו משהו.
create or replace function public.customer_last_touch(p_keys jsonb)
returns table(
  k text, visits integer, last_visit_date date, last_visit_driver text, last_visit_outcome text,
  deliveries integer, last_delivery_date date, calls_done integer, last_call_date date, last_call_by text
)
language sql stable security definer set search_path = public as $$
  with keys as (
    select e->>'k' as k, nullif(e->>'n','') as n, nullif(e->>'name','') as name,
           public.wa_normalize_phone(e->>'phone') as ph
      from jsonb_array_elements(coalesce(p_keys, '[]'::jsonb)) e
     limit 2000
  ),
  v as (
    select ky.k, count(*) visits,
           (array_agg(s.delivery_date order by s.delivery_date desc, s.completed_at desc nulls last))[1] d,
           (array_agg(s.driver order by s.delivery_date desc, s.completed_at desc nulls last))[1] dr,
           (array_agg(s.status order by s.delivery_date desc, s.completed_at desc nulls last))[1] st
      from keys ky
      join public.calendar_stops s
        on s.status in ('completed','not_completed') and s.delivery_date <= current_date
       and ((ky.n is not null and s.customer_number = ky.n)
         or (ky.n is null and ky.name is not null and s.customer_name = ky.name
             and (ky.ph is null or public.wa_normalize_phone(s.phone) = ky.ph)))
     group by ky.k
  ),
  dn as (
    select ky.k, count(*) deliveries, max(coalesce(n.distributed_on, n.doc_date)) d
      from keys ky join public.delivery_notes n on ky.n is not null and n.customer_number = ky.n
     where coalesce(n.status,'') <> 'מבוטלת'
     group by ky.k
  ),
  cl as (
    select ky.k, count(*) calls_done,
           max(coalesce(c.closed_on, c.created_at::date)) d,
           (array_agg(c.closed_by order by c.created_at desc))[1] by
      from keys ky join public.service_calls c on ky.n is not null and c.customer_number = ky.n
     where c.priority_status in ('בוצעה','סופית','טופל טכנאי') and c.duplicate_of is null
     group by ky.k
  )
  select ky.k, coalesce(v.visits,0)::int, v.d, v.dr, v.st,
         coalesce(dn.deliveries,0)::int, dn.d, coalesce(cl.calls_done,0)::int, cl.d, cl.by
    from keys ky
    left join v on v.k = ky.k
    left join dn on dn.k = ky.k
    left join cl on cl.k = ky.k
   where v.k is not null or dn.k is not null or cl.k is not null
$$;
revoke all on function public.customer_last_touch(jsonb) from public;
revoke all on function public.customer_last_touch(jsonb) from anon;
grant execute on function public.customer_last_touch(jsonb) to authenticated, service_role;

create index if not exists calendar_stops_name_phone_closed_idx
  on public.calendar_stops (customer_name, delivery_date desc) where status in ('completed','not_completed');
create index if not exists service_calls_customer_done_idx
  on public.service_calls (customer_number, created_at desc) where priority_status in ('בוצעה','סופית','טופל טכנאי');
