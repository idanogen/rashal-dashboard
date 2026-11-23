-- ─── היסטוריית מכשיר לפי מספר סידורי (עידן, 23/11/2026) ─────────────────────
--
-- שלומי בפגישה 17/11: "אני מטפל במוצר, לא בבן אדם". עידן 23/11: "צריך גם הסטוריה
-- למוצר, כי למוצר יש אורך חיים משלו, הוא יכול להיות אצל כמה לקוחות".
-- משלים את customer_media_history (ציר הלקוח) בציר המכשיר.
--
-- כל הקריאות על אותו מספר סידורי, מהחדשה לישנה, אצל כל לקוח שהמכשיר עבר דרכו:
-- תקלה, ביקורים (מי, מתי, מה נסגר ומה נכתב), הערות הצ'אט ותמונות מהשטח.
-- 23/11: ל-80% מהקריאות יש מספר סידורי, 3,545 מכשירים עם יותר מקריאה אחת,
-- 206 מכשירים עברו בין לקוחות.
--
-- ⭐ נתונים בלבד, בלי קבצים: התמונות חוזרות כנתיב בדלי הציבורי timeline-files,
-- והלקוח טוען מוקטנת (אותו מנגנון כמו גלריית הלקוח).
-- הרשאה: משרד ונהגים, כמו customer_media_history (הכרעת עידן 18/11: כולם רואים הכל).

create or replace function public.device_history_key(p_serial text)
returns text
language sql
immutable
as $$
  -- רווחים ומקפים לא מבדילים בין מכשירים; מספר קצר מ-4 הוא ערך ממלא ("0", "-", "אין").
  select case when length(k) >= 4 then k end
    from (select upper(regexp_replace(coalesce(p_serial, ''), '[\s-]', '', 'g')) as k) x
$$;

create or replace function public.device_history(
  p_stop_id uuid default null,
  p_service_call_id uuid default null,
  p_serial text default null,
  p_limit int default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_key text := public.device_history_key(p_serial);
  v_call uuid := p_service_call_id;
  v_lim int := least(greatest(coalesce(p_limit, 30), 1), 60);
  v_desc text;
  v_calls jsonb;
  v_total int;
  v_customers int;
  v_ids uuid[];
begin
  if (public.is_office_staff() is true or public.current_user_role() = 'driver') is not true then
    raise exception 'אין הרשאה' using errcode = '42501';
  end if;

  if v_call is null and p_stop_id is not null then
    select service_call_id into v_call from calendar_stops where id = p_stop_id;
  end if;
  if v_key is null and v_call is not null then
    select public.device_history_key(device_serial) into v_key from service_calls where id = v_call;
  end if;
  if v_key is null then
    return jsonb_build_object('serial', null, 'calls', '[]'::jsonb, 'total', 0, 'customers', 0);
  end if;

  select coalesce(array_agg(id), '{}') into v_ids from service_calls
   where public.device_history_key(device_serial) = v_key and duplicate_of is null;

  select count(*), count(distinct coalesce(nullif(btrim(customer_number), ''), customer_name)),
         (array_agg(device_desc order by created_at desc) filter (where nullif(btrim(device_desc), '') is not null))[1]
    into v_total, v_customers, v_desc
    from service_calls where id = any(v_ids);

  select coalesce(jsonb_agg(c order by c->>'created' desc), '[]'::jsonb) into v_calls
    from (
      select jsonb_build_object(
        'id', sc.id,
        'docno', sc.priority_call_id,
        'created', sc.created_at,
        'current', sc.id = v_call,
        'customer_name', sc.customer_name,
        'customer_number', sc.customer_number,
        'city', sc.city,
        'fault', left(coalesce(nullif(btrim(sc.fault_text), ''), nullif(btrim(sc.fault_desc), '')), 400),
        'status', sc.service_call_status::text,
        'priority_status', sc.priority_status,
        'visits', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'date', cs.delivery_date, 'driver', cs.driver, 'status', cs.status,
                   'kind', cs.resolution_kind, 'note', left(cs.resolution_note, 400))
                   order by cs.delivery_date desc nulls last)
            from calendar_stops cs where cs.service_call_id = sc.id), '[]'::jsonb),
        'notes', coalesce((
          select jsonb_agg(n order by n->>'at' desc) from (
            select jsonb_build_object('at', t.created_at, 'by', t.user_name, 'text', left(t.content, 400)) n
              from timeline_events t
             where t.type = 'comment' and nullif(btrim(t.content), '') is not null
               and (t.service_call_id = sc.id
                    or t.calendar_stop_id in (select id from calendar_stops where service_call_id = sc.id))
             order by t.created_at desc limit 10) x), '[]'::jsonb),
        'media', coalesce((
          select jsonb_agg(m order by m->>'at' desc) from (
            select jsonb_build_object(
                     'src', 'tech', 'bucket', 'timeline-files',
                     'path', split_part(u.url, '/public/timeline-files/', 2),
                     'type', case when u.url ~* '\.(mp4|mov|3gp|webm)$' then 'video' else 'image' end,
                     'at', t.created_at, 'by', t.user_name, 'ref', sc.priority_call_id) m
              from timeline_events t
              cross join lateral jsonb_array_elements_text(coalesce(t.metadata->'imageUrls', '[]'::jsonb)) as u(url)
             where t.type = 'file_upload'
               and (t.service_call_id = sc.id
                    or t.calendar_stop_id in (select id from calendar_stops where service_call_id = sc.id))
               and u.url like '%/public/timeline-files/%'
             order by t.created_at desc limit 12) y), '[]'::jsonb)
      ) c
        from service_calls sc
       where sc.id = any(v_ids)
       order by sc.created_at desc
       limit v_lim
    ) z;

  return jsonb_build_object('serial', v_key, 'device_desc', v_desc, 'calls', v_calls,
                            'total', v_total, 'customers', v_customers);
end;
$$;

revoke all on function public.device_history(uuid, uuid, text, int) from public, anon;
grant execute on function public.device_history(uuid, uuid, text, int) to authenticated;

create index if not exists service_calls_device_key_idx
  on public.service_calls (public.device_history_key(device_serial));
