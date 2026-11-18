-- ─── "שלח תזכורת לתמונה" מכרטיס אדום (עידן, 18/11/2026) ─────────────────────
--
-- עמי ואבירם בפגישה 17/11: לכרטיס אדום (אין תמונה) כפתור ששולח ללקוח תזכורת,
-- ואחריה עוד שתיים, יום אחרי יום ב-10:00, עד שהלקוח שולח תמונה:
--   1. מיד            · תבנית התזכורת הקיימת (cfg.template_reminder_id)
--   2. למחרת 10:00    · אותה תזכורת
--   3. יום אחרי 10:00 · "לצערנו לא נוכל לטפל בבקשה עד לקבלת תמונה" (cfg.template_nudge_final_id,
--                       תבנית חדשה במטא; עד שתאושר הרצף מחכה אחרי הודעה 2)
-- השליחה במנוע הקיים (rashal-media-request, trigger "nudge" כל 2 דקות), באותו חלון
-- (ראשון-חמישי 08:00-19:00): הודעה שנופלת על שישי או שבת זזה לראשון.
--
-- ⭐ עצירה (media_nudge_stop_reason): תמונה/סרטון מהטלפון או מאיש קשר של הלקוח מאז
-- תחילת הרצף, או שהקריאה כבר לא אדומה (סומנה ירוק, שובצה, נסגרה, אורכבה).
--
-- ובנוסף תיקון ברמזור: ירוק גם כשמנוע הבקשות סימן "התקבלה תמונה" (media_requests).
-- עד היום הרמזור חיפש את התמונה רק לפי מספר הלקוח בשיחה, והמנוע לפי הטלפון;
-- 10 כרטיסים של לקוחות ששלחו תמונה נשארו אדומים (18/11).

alter table public.media_request_settings
  add column if not exists template_nudge_final_id text;
comment on column public.media_request_settings.template_nudge_final_id is
  'תבנית ההודעה האחרונה ברצף "שלח תזכורת לתמונה" (rashal_media_final). ריק = הרצף עוצר אחרי הודעה 2.';

create table if not exists public.media_nudges (
  id               uuid primary key default gen_random_uuid(),
  service_call_id  uuid not null references public.service_calls(id) on delete cascade,
  phone_e164       text not null,
  customer_name    text,
  device_name      text,
  -- active = ממתין להודעה הבאה · done = נשלחו שלוש · stopped = נעצר (הסיבה ב-stop_reason) · failed = שליחה נדחתה
  state            text not null default 'active' check (state in ('active', 'done', 'stopped', 'failed')),
  sent_count       smallint not null default 0 check (sent_count between 0 and 3),
  next_due_at      timestamptz,
  claimed_at       timestamptz,
  sent_1_at        timestamptz,
  sent_2_at        timestamptz,
  sent_3_at        timestamptz,
  stop_reason      text,
  send_error       text,
  started_by       uuid,
  started_by_name  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table public.media_nudges is
  'רצף "שלח תזכורת לתמונה" מכרטיס קריאה אדום: עד 3 הודעות, יום אחרי יום, עד שמגיעה תמונה (18/11/2026).';
create unique index if not exists media_nudges_one_active
  on public.media_nudges (service_call_id) where state = 'active';
create index if not exists media_nudges_due_idx
  on public.media_nudges (next_due_at) where state = 'active';

alter table public.media_nudges enable row level security;
drop policy if exists media_nudges_office_read on public.media_nudges;
create policy media_nudges_office_read on public.media_nudges
  for select to authenticated
  using ((select public.is_office_staff()) is true);
-- כתיבה רק דרך media_nudge_start (משרד) והמנוע (service role).

-- ── מתי ההודעה הבאה: מחר ב-10:00 שעון ישראל, שישי ושבת זזים לראשון ──
create or replace function public.media_nudge_next_due(p_from timestamptz)
returns timestamptz
language sql
immutable
as $$
  select (
    case extract(dow from ((p_from at time zone 'Asia/Jerusalem')::date + 1))
      when 5 then (p_from at time zone 'Asia/Jerusalem')::date + 3   -- שישי ← ראשון
      when 6 then (p_from at time zone 'Asia/Jerusalem')::date + 2   -- שבת ← ראשון
      else (p_from at time zone 'Asia/Jerusalem')::date + 1
    end + time '10:00'
  ) at time zone 'Asia/Jerusalem';
$$;

-- ── למה לעצור (null = להמשיך) ──
create or replace function public.media_nudge_stop_reason(p_call uuid, p_phone text, p_since timestamptz)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not exists (
      select 1 from service_calls sc
       where sc.id = p_call and sc.archived_at is null
         and sc.service_call_status::text = 'קריאה חדשה')
      then 'הקריאה כבר לא פתוחה'
    when exists (select 1 from calendar_stops cs where cs.service_call_id = p_call and cs.status in ('planned', 'in_progress'))
      then 'שובץ טכנאי'
    when exists (select 1 from service_call_manual_green g where g.service_call_id = p_call)
      then 'סומן ירוק במשרד'
    when exists (select 1 from media_requests r where r.service_call_id = p_call and r.media_received_at >= p_since)
      or exists (
        select 1
          from wa_conversations c
          join wa_messages m on m.conversation_id = c.id and m.direction = 'in'
                            and coalesce(m.sent_at, m.created_at) >= p_since
         where (c.phone_e164 = p_phone
                or c.customer_number = (select sc.customer_number from service_calls sc where sc.id = p_call))
           and jsonb_typeof(m.attachments) = 'array'
           and exists (select 1 from jsonb_array_elements(m.attachments) a where a->>'type' in ('image', 'video')))
      then 'התקבלה תמונה'
  end;
$$;

-- ── הכפתור: מתחיל רצף לקריאה אחת ──
create or replace function public.media_nudge_start(p_call uuid)
returns public.media_nudges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_call  service_calls;
  v_phone text;
  v_name  text;
  v_row   media_nudges;
  v_why   text;
begin
  if (select public.is_office_staff()) is not true then
    raise exception 'אין הרשאה לשלוח תזכורת';
  end if;
  select * into v_call from service_calls where id = p_call;
  if not found then raise exception 'הקריאה לא נמצאה'; end if;

  -- הטלפון: מה שמנוע הבקשות כבר שלח אליו, אחרת הנייד מהקריאה (אותה נרמול כמו בתור).
  select r.phone_e164 into v_phone from media_requests r
   where r.service_call_id = p_call and r.phone_e164 is not null
   order by r.created_at desc limit 1;
  if v_phone is null and regexp_replace(coalesce(v_call.phone, ''), '\D', '', 'g') ~ '^(972)?0?5\d{8}$' then
    v_phone := '+972' || right(regexp_replace(v_call.phone, '\D', '', 'g'), 9);
  end if;
  if v_phone is null then raise exception 'אין לקריאה מספר נייד, צריך להתקשר'; end if;
  if public.wa_phone_paused(v_phone) then
    raise exception 'המספר לא בוואטסאפ (הודעה קודמת לא נמסרה), צריך להתקשר';
  end if;
  if exists (select 1 from media_nudges n where n.service_call_id = p_call and n.state = 'active') then
    raise exception 'כבר נשלחות תזכורות לקריאה הזאת';
  end if;
  v_why := public.media_nudge_stop_reason(p_call, v_phone, v_call.created_at);
  if v_why is not null then raise exception 'לא נשלח: %', v_why; end if;

  select coalesce(nullif(btrim(p.full_name), ''), p.email) into v_name from profiles p where p.id = auth.uid();
  insert into media_nudges (service_call_id, phone_e164, customer_name, device_name, next_due_at, started_by, started_by_name)
  values (p_call, v_phone, v_call.customer_name,
          (select r.device_name from media_requests r where r.service_call_id = p_call order by r.created_at desc limit 1),
          now(), auth.uid(), v_name)
  returning * into v_row;
  return v_row;
end;
$$;

-- ── המנוע: עוצר מה שצריך, ותופס את מה שהגיע זמנו ──
create or replace function public.media_nudge_claim(p_limit integer default 20)
returns table(id uuid, step integer, customer_name text, phone_e164 text, device_name text, extra_phones text[])
language plpgsql
security definer
set search_path = public
as $$
declare cfg media_request_settings;
begin
  select * into cfg from media_request_settings s where s.id;
  update media_nudges n
     set state = 'stopped', stop_reason = public.media_nudge_stop_reason(n.service_call_id, n.phone_e164, n.created_at),
         next_due_at = null, updated_at = now()
   where n.state = 'active'
     and public.media_nudge_stop_reason(n.service_call_id, n.phone_e164, n.created_at) is not null;
  if not public.media_window_open() then return; end if;
  return query
  with claimed as (
    update media_nudges m set claimed_at = now(), updated_at = now()
     where m.id in (
       select n.id from media_nudges n
        where n.state = 'active' and n.next_due_at <= now()
          and (n.claimed_at is null or n.claimed_at < now() - interval '10 minutes')
          and (n.sent_count < 2 or cfg.template_nudge_final_id is not null)
        order by n.next_due_at limit p_limit
        for update skip locked)
    returning m.id, m.sent_count, m.customer_name, m.phone_e164, m.device_name, m.service_call_id),
  r as (
    select c.*, public.customer_auto_recipients(
             (select sc.customer_number from service_calls sc where sc.id = c.service_call_id), c.phone_e164) as rec
      from claimed c)
  select r.id, r.sent_count + 1, r.customer_name, coalesce(r.rec[1], r.phone_e164), r.device_name,
         coalesce(r.rec[2:], '{}'::text[])
    from r;
end;
$$;

-- ── המנוע מדווח: נשלח / נכשל / לנסות שוב ──
create or replace function public.media_nudge_mark(p_id uuid, p_step integer, p_result text, p_error text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_result = 'sent' then
    update media_nudges set
      sent_count = p_step,
      sent_1_at = case when p_step = 1 then now() else sent_1_at end,
      sent_2_at = case when p_step = 2 then now() else sent_2_at end,
      sent_3_at = case when p_step = 3 then now() else sent_3_at end,
      state = case when p_step >= 3 then 'done' else 'active' end,
      next_due_at = case when p_step >= 3 then null else public.media_nudge_next_due(now()) end,
      claimed_at = null, send_error = null, updated_at = now()
     where id = p_id;
  elsif p_result = 'retry' then
    update media_nudges set claimed_at = null, send_error = left(p_error, 500), updated_at = now() where id = p_id;
  else
    update media_nudges set state = 'failed', next_due_at = null, claimed_at = null,
           send_error = left(p_error, 500), updated_at = now()
     where id = p_id;
  end if;
end;
$$;

revoke all on function public.media_nudge_start(uuid) from public, anon;
grant execute on function public.media_nudge_start(uuid) to authenticated;
revoke all on function public.media_nudge_claim(integer) from public, anon, authenticated;
revoke all on function public.media_nudge_mark(uuid, integer, text, text) from public, anon, authenticated;
revoke all on function public.media_nudge_stop_reason(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.media_nudge_claim(integer) to service_role;
grant execute on function public.media_nudge_mark(uuid, integer, text, text) to service_role;
grant execute on function public.media_nudge_stop_reason(uuid, text, timestamptz) to service_role;

-- ── הרמזור: ירוק גם כשמנוע הבקשות קיבל תמונה ──
create or replace function public.service_call_lights()
 returns table(service_call_id uuid, light text, opened_at timestamp with time zone, images integer, videos integer,
               manual_by text, manual_at timestamp with time zone, manual_reason text, manual_note text,
               touch_driver text, touch_date date, touch_status text, touch_kind text, touch_note text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with oc as (
    select sc.id, sc.created_at, sc.call_type, sc.customer_number
      from public.service_calls sc
     where (select public.is_office_staff()) is true
       and sc.archived_at is null
       and sc.duplicate_of is null
       and sc.service_call_status::text = 'קריאה חדשה'
  ),
  media as (
    select oc.id,
           count(*) filter (where a->>'type' = 'image')::int as images,
           count(*) filter (where a->>'type' = 'video')::int as videos
      from oc
      join public.wa_conversations c on c.customer_number = oc.customer_number
      join public.wa_messages m on m.conversation_id = c.id
                               and m.direction = 'in'
                               and coalesce(m.sent_at, m.created_at) >= oc.created_at
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(m.attachments) = 'array' then m.attachments else '[]'::jsonb end
      ) a
     where nullif(btrim(coalesce(oc.customer_number, '')), '') is not null
       and a ? 'stored_path'
       and a->>'type' in ('image', 'video')
     group by oc.id
  ),
  engine as (
    -- 18/11: מנוע הבקשות מזהה תמונה לפי הטלפון, גם כשאין שיחה עם מספר הלקוח.
    select distinct r.service_call_id as id
      from public.media_requests r join oc on oc.id = r.service_call_id
     where r.media_received_at is not null
  ),
  touch as (
    select distinct on (cs.service_call_id)
           cs.service_call_id, cs.driver, cs.delivery_date, cs.status, cs.resolution_kind,
           coalesce(nullif(btrim(cs.resolution_note), ''), nullif(btrim(cs.notes), '')) as note
      from public.calendar_stops cs
      join oc on oc.id = cs.service_call_id
     where cs.status in ('completed', 'not_completed', 'in_progress')
       and nullif(btrim(coalesce(cs.driver, '')), '') is not null
     order by cs.service_call_id, cs.delivery_date desc, cs.completed_at desc nulls last
  )
  select oc.id,
         case
           when oc.call_type = 'פרונטלית' then 'yellow'
           when t.status = 'not_completed' and t.resolution_kind = 'follow_up' then 'orange'
           when coalesce(md.images, 0) + coalesce(md.videos, 0) > 0 or e.id is not null or g.service_call_id is not null then 'green'
           else 'red'
         end,
         oc.created_at,
         coalesce(md.images, 0),
         coalesce(md.videos, 0),
         g.marked_by_name, g.created_at, g.reason, g.note,
         t.driver, t.delivery_date, t.status, t.resolution_kind, t.note
    from oc
    left join media md on md.id = oc.id
    left join engine e on e.id = oc.id
    left join touch t on t.service_call_id = oc.id
    left join public.service_call_manual_green g on g.service_call_id = oc.id;
$function$;

-- ההרשאות עברו לכאן יחד עם ההגדרה (היו ב-20260915_service_call_lights.sql).
revoke all on function public.service_call_lights() from public, anon;
grant execute on function public.service_call_lights() to authenticated;
