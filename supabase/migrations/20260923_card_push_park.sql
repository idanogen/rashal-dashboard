-- אירוע של כרטיס הלקוח שפריוריטי דוחה בשגיאת תוכן נעצר, כמו כתיבות הקריאה מ-18/09.
-- 🔴 הרקע (22-23/09/2026): לקוח שלח בוואטסאפ תמונת webp, פריוריטי ענה 400
-- ("קבצים מסוג webp לא ניתנים להעלאה"), והעצירה חלה רק על `call:`. התמונה
-- נשלחה 91 פעמים ב-23 שעות והחזיקה את `push-chat` באדום. [[retry-forever-turns-the-alarm-into-noise]]
-- הפריט נשאר בדשבורד; הוואצ'דוג (`push-parked`) מתריע עליו פעם אחת.

alter table public.timeline_events
  add column if not exists push_failed_at timestamptz,
  add column if not exists push_fail_reason text;

create index if not exists timeline_events_push_failed_idx
  on public.timeline_events (push_failed_at) where push_failed_at is not null;

create or replace function public.priority_push_candidates(p_limit integer default 60, p_custname text default null)
returns table (
  id text, order_id text, service_call_id text, type text, user_name text, content text,
  metadata jsonb, created_at timestamptz, cust text, ctx text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    te.id::text, te.order_id::text, te.service_call_id::text, te.type::text, te.user_name, te.content, te.metadata, te.created_at,
    coalesce(nullif(trim(o.customer_number), ''), nullif(trim(sc.customer_number), ''),
             nullif(trim(p.customer_number), ''), nullif(trim(cs.customer_number), ''),
             nullif(trim(te.customer_number), '')) as cust,
    case
      when te.order_id is not null then trim('הזמנה ' || coalesce(o.priority_order_id, ''))
      when te.service_call_id is not null then trim('קריאה ' || coalesce(sc.priority_call_id, ''))
      when p.id is not null then trim('איסוף ' || coalesce(p.priority_pickup_id, ''))
      when te.customer_number is not null then 'וואטסאפ'
      else 'משימה'
    end as ctx
  from public.timeline_events te
  left join public.orders o on o.id = te.order_id
  left join public.service_calls sc on sc.id = te.service_call_id
  left join public.calendar_stops cs on cs.id = te.calendar_stop_id
  left join public.pickups p on p.id = cs.pickup_id
  where te.pushed_to_priority_at is null
    and te.push_failed_at is null
    and (te.push_claimed_at is null or te.push_claimed_at < now() - interval '10 minutes')
    and te.type::text in ('comment', 'file_upload')
    and coalesce(nullif(trim(o.customer_number), ''), nullif(trim(sc.customer_number), ''),
                 nullif(trim(p.customer_number), ''), nullif(trim(cs.customer_number), ''),
                 nullif(trim(te.customer_number), '')) is not null
    and (te.type::text <> 'file_upload'
         or jsonb_array_length(coalesce(te.metadata->'imageUrls', '[]'::jsonb)) > 0)
    and (p_custname is null or o.customer_number = p_custname or sc.customer_number = p_custname or te.customer_number = p_custname)
  order by te.created_at asc
  limit greatest(1, least(p_limit, 500));
$$;
revoke all on function public.priority_push_candidates(integer, text) from public, anon, authenticated;
