-- ─── תמונות עבר של לקוח, למשרד ולשטח (עידן, 18/11/2026) ──────────────────────
--
-- "לתת במערכת גישה לתמונות עבר שיש בכרטיסים גם לנהגים בשטח וגם למשרד".
-- הכרעת עידן: כולם רואים הכל, לא רק לקוחות מהסידור של הנהג.
--
-- גלריה אחת מאחדת שני מקורות:
--   tech      ← timeline_events.file_upload (מה שצולם מהאפליקציה/הדשבורד), דלי ציבורי timeline-files
--   customer  ← wa_messages נכנסות עם קובץ (מה שהלקוח שלח בוואטסאפ), דלי פרטי wa-media
--
-- ⭐ "לא כבד": הפונקציה מחזירה רק נתונים (נתיב, תאריך, מי), בעמודים של 24 עם
-- סמן (p_before). הקבצים עצמם נטענים בצד הלקוח כתמונה מוקטנת (render/image),
-- ובגודל מלא רק כשפותחים תמונה אחת.
--
-- הלקוח מזוהה לפי מספר לקוח, ואם אין לפי טלפון מנורמל. עצירה (p_stop_id)
-- מספיקה: הפונקציה גוזרת ממנה את שניהם (מהעצירה, מהקריאה או מההזמנה שלה).

create or replace function public.customer_media_history(
  p_stop_id uuid default null,
  p_service_call_id uuid default null,
  p_customer_number text default null,
  p_before timestamptz default null,
  p_limit int default 24
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_num text := nullif(btrim(coalesce(p_customer_number, '')), '');
  v_phone text;
  v_lim int := least(greatest(coalesce(p_limit, 24), 1), 60);
  v_items jsonb;
  v_total int;
begin
  if (public.is_office_staff() is true or public.current_user_role() = 'driver') is not true then
    raise exception 'אין הרשאה' using errcode = '42501';
  end if;

  if p_stop_id is not null then
    select coalesce(v_num, nullif(btrim(coalesce(cs.customer_number, sc.customer_number, o.customer_number, '')), '')),
           public.wa_normalize_phone(coalesce(cs.phone, sc.phone, o.phone))
      into v_num, v_phone
      from calendar_stops cs
      left join service_calls sc on sc.id = cs.service_call_id
      left join orders o on o.id = cs.order_id
     where cs.id = p_stop_id;
  elsif p_service_call_id is not null then
    select coalesce(v_num, nullif(btrim(coalesce(sc.customer_number, '')), '')), public.wa_normalize_phone(sc.phone)
      into v_num, v_phone
      from service_calls sc where sc.id = p_service_call_id;
  end if;
  v_phone := nullif(v_phone, '');
  -- טלפון לבדו משמש רק כשאין מספר לקוח: טלפון משותף (בית אבות, בן משפחה) מערבב לקוחות.
  if v_num is not null then v_phone := null; end if;
  if v_num is null and v_phone is null then
    return jsonb_build_object('items', '[]'::jsonb, 'total', 0, 'customer_number', null);
  end if;

  with
  calls as (
    select id from service_calls where v_num is not null and customer_number = v_num
  ),
  ords as (
    select id from orders where v_num is not null and customer_number = v_num
  ),
  stops as (
    select cs.id from calendar_stops cs
     where (v_num is not null and cs.customer_number = v_num)
        or (v_num is not null and cs.service_call_id in (select id from calls))
        or (v_num is not null and cs.order_id in (select id from ords))
        or (v_phone is not null and cs.status in ('completed', 'not_completed')
            and public.wa_normalize_phone(cs.phone) = v_phone)
  ),
  tech as (
    select 'tech'::text as src, 'timeline-files'::text as bucket,
           split_part(u.url, '/public/timeline-files/', 2) as path,
           t.created_at as at, t.user_name as by,
           coalesce(sc.priority_call_id, o.priority_order_id) as ref,
           case when u.url ~* '\.(mp4|mov|3gp|webm)$' then 'video' else 'image' end as mtype
      from timeline_events t
      left join calendar_stops cs on cs.id = t.calendar_stop_id
      left join service_calls sc on sc.id = coalesce(t.service_call_id, cs.service_call_id)
      left join orders o on o.id = coalesce(t.order_id, cs.order_id)
      cross join lateral jsonb_array_elements_text(coalesce(t.metadata->'imageUrls', '[]'::jsonb)) as u(url)
     where t.type = 'file_upload'
       and (t.service_call_id in (select id from calls)
            or t.order_id in (select id from ords)
            or t.calendar_stop_id in (select id from stops)
            or (v_num is not null and t.customer_number = v_num))
       and u.url like '%/public/timeline-files/%'
  ),
  convs as (
    select c.id from wa_conversations c
     where (v_num is not null and c.customer_number = v_num)
        or (v_phone is not null and c.phone_local = v_phone)
  ),
  cust as (
    select 'customer'::text, 'wa-media'::text, a.a->>'stored_path',
           coalesce(m.sent_at, m.created_at), 'הלקוח'::text, null::text, a.a->>'type'
      from wa_messages m
      cross join lateral jsonb_array_elements(m.attachments) as a(a)
     where m.conversation_id in (select id from convs)
       and m.direction = 'in'
       and jsonb_typeof(m.attachments) = 'array'
       and a.a ? 'stored_path'
       and a.a->>'type' in ('image', 'video')
  ),
  allm as (
    select distinct on (bucket, path) src, bucket, path, at, by, ref, mtype
      from (select * from tech union all select * from cust) x
     where nullif(path, '') is not null
     order by bucket, path, at
  )
  select (select count(*) from allm),
         coalesce((select jsonb_agg(jsonb_build_object(
                     'src', p.src, 'bucket', p.bucket, 'path', p.path,
                     'type', p.mtype,
                     'at', p.at, 'by', p.by, 'ref', p.ref) order by p.at desc)
                   from (select * from allm where p_before is null or at <= p_before
                          order by at desc limit v_lim) p), '[]'::jsonb)
    into v_total, v_items;

  return jsonb_build_object('items', v_items, 'total', v_total, 'customer_number', v_num);
end;
$$;

revoke all on function public.customer_media_history(uuid, uuid, text, timestamptz, int) from public, anon;
grant execute on function public.customer_media_history(uuid, uuid, text, timestamptz, int) to authenticated;

-- 🔴 מדיניות הדלי wa-media נפתחה לנהגים לכל לקוח באותו יום, בקובץ המקורי שלה:
-- wa_media_object_visible ב-20260915_stop_call_info.sql (פונקציה מוגדרת בקובץ אחד בלבד).
