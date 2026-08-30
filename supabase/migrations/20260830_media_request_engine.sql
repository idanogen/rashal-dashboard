-- ─── מנוע "תמונה לפני טכנאי" · 30/08/2026 ───────────────────────────────
--
-- הבקשה (עמי דרך עידן): קריאת שירות שמגיעה ל"לביצוע" שולחת ללקוח וואטסאפ
-- שמבקש תמונה או סרטון של התקלה. אין תמונה תוך 4 שעות, יוצאת תזכורת אחת.
-- עדיין אין, הקריאה מסומנת "אין מענה" והמוקד מטלפן. תמונה שמתקבלת מדליקה
-- חיווי ירוק על כרטיס הקריאה.
--
-- ההכרעות של עידן (30/08): תזכורת אחרי 4 שעות · שישי ושבת לא עובדים,
-- חלון ראשון-חמישי 08:00-19:00, מה שנכנס אחרי 19:00 יוצא ב-08:00 בבוקר
-- העבודה הבא · תשובת טקסט בלי תמונה עוצרת את התזכורת ("ענה בלי תמונה").
--
-- ⭐ הארכיטקטורה משוכפלת ממנוע הסקרים (20260820_survey_engine.sql), שרץ
-- בייצור: הגדרות בדאטה, תור עם claim, שער חלון אחד לשני המצבים, יומן
-- ריצות שסופר תוכן, ושליחה דרך /api/heyy-send הקיים עם רשימת המושתקים.
--
-- 🔴 נבנה כבוי: enabled=false + dry_run=true. הדלקה היא UPDATE, לא פריסה.
-- 🔴 activated_from הוא החומה מפני מטח למפרע: 69 הקריאות שכבר יושבות
--    ב"לביצוע" ביום ההפעלה לא מקבלות הודעה, כי ההעשרה דורשת עדכון אחריו.

-- ── טבלת הבקשות: שורה אחת לקריאה, לכל החיים ─────────────────────────────
create table if not exists public.media_requests (
  id               uuid primary key default gen_random_uuid(),
  service_call_id  uuid not null unique references public.service_calls(id) on delete cascade,
  priority_call_id text,
  customer_name    text,
  phone_e164       text,
  device_name      text,

  -- מצבי הזרימה:
  --   pending          בתור, ממתין לחלון השליחה
  --   first_sent       ההודעה הראשונה יצאה, ממתין לתמונה
  --   reminder_sent    התזכורת יצאה, ממתין לתמונה
  --   media_received   תמונה/סרטון התקבלו (החיווי הירוק)
  --   replied_no_media הלקוח ענה בטקסט בלי תמונה, אדם נכנס לשיחה
  --   no_response      גם אחרי התזכורת אין כלום, המוקד מטלפן
  --   no_phone         אין נייד על הקריאה; משודרג ל-pending אם נייד מופיע
  --   cancelled        הקריאה עזבה את "לביצוע" או שכבר שובצה
  --   skipped          פג בתור / מושתק
  --   failed           שליחה נכשלה סופית, לבדיקה ידנית
  state            text not null default 'pending' check (state in
    ('pending','first_sent','reminder_sent','media_received','replied_no_media',
     'no_response','no_phone','cancelled','skipped','failed')),

  scheduled_send_at  timestamptz,
  first_sent_at      timestamptz,
  reminder_due_at    timestamptz,
  reminder_sent_at   timestamptz,
  no_response_due_at timestamptz,
  media_received_at  timestamptz,
  replied_at         timestamptz,

  send_claimed_at  timestamptz,
  send_error       text,
  skip_reason      text,
  is_test          boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists media_requests_state_idx on public.media_requests (state);
create index if not exists media_requests_phone_idx on public.media_requests (phone_e164);

drop trigger if exists media_requests_touch on public.media_requests;
create trigger media_requests_touch before update on public.media_requests
  for each row execute function public.set_updated_at();

alter table public.media_requests enable row level security;
drop policy if exists office_read_media_requests on public.media_requests;
-- 🔴 העטיפה (select f()) הופכת את הבדיקה ל-InitPlan אחד במקום קריאה
-- פר שורה. הלקח מ-27/08: 47,268 שליפות פרופיל לספירה אחת.
create policy office_read_media_requests on public.media_requests
  for select to authenticated using ((select public.is_office_staff()));

-- ── ההגדרות: שורה אחת, המתג בדאטה ────────────────────────────────────────
create table if not exists public.media_request_settings (
  id boolean primary key default true check (id),

  enabled  boolean not null default false,
  dry_run  boolean not null default true,
  activated_from timestamptz,

  -- מזהי התבניות ב-heyy. ריקים עד שמטא מאשרת; שליחה בלעדיהם נחסמת בקול.
  template_first_id    text,
  template_reminder_id text,

  work_start time not null default '08:00',
  work_end   time not null default '19:00',

  reminder_delay_hours    int not null default 4,
  no_response_after_hours int not null default 4,
  max_call_age_days       int not null default 14,
  stale_after_hours       int not null default 72,  -- סובל את סוף השבוע (חמישי 19:00 ← ראשון 08:00)
  max_per_day             int not null default 60,

  -- ערך המשתנה "מוצר" כשאין שם מוצר על הקריאה (2% מהקריאות).
  product_fallback text not null default 'המוצר שברשותך',

  updated_at timestamptz not null default now()
);

insert into public.media_request_settings (id) values (true) on conflict (id) do nothing;

alter table public.media_request_settings enable row level security;
drop policy if exists authenticated_read_media_request_settings on public.media_request_settings;
create policy authenticated_read_media_request_settings on public.media_request_settings
  for select to authenticated using (true);

-- ── יומן ריצות: סופר תוכן, לא הצלחות ─────────────────────────────────────
create table if not exists public.media_request_runs (
  id bigserial primary key,
  ran_at   timestamptz not null default now(),
  trigger  text,
  dry_run  boolean not null default false,
  enqueued int not null default 0,
  due      int not null default 0,
  sent     int not null default 0,
  failed   int not null default 0,
  detail   jsonb
);

alter table public.media_request_runs enable row level security;
drop policy if exists authenticated_read_media_request_runs on public.media_request_runs;
create policy authenticated_read_media_request_runs on public.media_request_runs
  for select to authenticated using (true);

-- ── חלון השליחה: ראשון-חמישי 08:00-19:00 שעון ישראל ──────────────────────
create or replace function public.media_window_open()
returns boolean
language plpgsql
stable
set search_path = public
as $fn$
declare cfg public.media_request_settings; loc timestamp;
begin
  select * into cfg from public.media_request_settings where id;
  loc := now() at time zone 'Asia/Jerusalem';
  if extract(dow from loc) in (5, 6) then return false; end if;  -- שישי ושבת לא עובדים
  if loc::time < cfg.work_start or loc::time >= cfg.work_end then return false; end if;
  return true;
end;
$fn$;

-- ── מתי מותר לשלוח, החל מרגע נתון ────────────────────────────────────────
-- בתוך החלון: מיד. אחרי 19:00 או בסופ"ש: 08:00 בבוקר העבודה הבא.
create or replace function public.media_next_send_time(p_from timestamptz)
returns timestamptz
language plpgsql
stable
set search_path = public
as $fn$
declare
  cfg public.media_request_settings;
  loc timestamp;
begin
  select * into cfg from public.media_request_settings where id;
  loc := p_from at time zone 'Asia/Jerusalem';

  if loc::time >= cfg.work_end then
    loc := (loc::date + 1) + cfg.work_start;
  elsif loc::time < cfg.work_start then
    loc := loc::date + cfg.work_start;
  end if;

  -- שישי ← ראשון, שבת ← ראשון.
  if extract(dow from loc) = 5 then
    loc := (loc::date + 2) + cfg.work_start;
  elsif extract(dow from loc) = 6 then
    loc := (loc::date + 1) + cfg.work_start;
  end if;

  return loc at time zone 'Asia/Jerusalem';
end;
$fn$;

-- ── התור: קריאות שהגיעו ל"לביצוע" ────────────────────────────────────────
-- p_commit=false מחזיר את אותה רשימה בלי לכתוב. מצב יבש ושליחה חולקים קוד.
create or replace function public.media_request_enqueue(p_commit boolean default true)
returns table (service_call_id uuid, customer_name text, phone_e164 text,
               device_name text, scheduled_send_at timestamptz)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  cfg public.media_request_settings;
begin
  select * into cfg from public.media_request_settings where id;
  if not found then
    raise exception 'media_request_settings row missing';
  end if;
  if cfg.activated_from is null then
    raise exception 'media_request_settings.activated_from is null - refusing to enqueue history';
  end if;

  -- קריאה שקיבלה נייד אחרי שסומנה no_phone חוזרת לתור, במקום להיעלם בשקט.
  if p_commit then
    update public.media_requests m
       set state = 'pending',
           phone_e164 = '+972' || right(regexp_replace(c.phone, '\D', '', 'g'), 9),
           scheduled_send_at = public.media_next_send_time(now()),
           skip_reason = null
      from public.service_calls c
     where c.id = m.service_call_id
       and m.state = 'no_phone'
       and c.priority_status = 'לביצוע'
       and c.archived_at is null
       and regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') ~ '^0?5[0-9]{8}$';
  end if;

  drop table if exists _mr_cand;
  create temp table _mr_cand on commit drop as
  select
    c.id                                            as c_call_id,
    c.priority_call_id                              as c_priority_call_id,
    c.customer_name                                 as c_customer_name,
    c.device_name                                   as c_device_name,
    regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') ~ '^0?5[0-9]{8}$' as c_has_mobile,
    case when regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') ~ '^0?5[0-9]{8}$'
         then '+972' || right(regexp_replace(c.phone, '\D', '', 'g'), 9) end as c_phone_e164,
    public.media_next_send_time(now())              as c_send_at
  from public.service_calls c
  where c.priority_status = 'לביצוע'
    and c.archived_at is null
    and c.priority_call_id is not null
    -- 🔴 החומה: רק קריאות שהעדכון שלהן חצה את רגע ההפעלה. 69 הקריאות
    -- שכבר יושבות ב"לביצוע" נשארות בחוץ עד שמשהו באמת זז בהן.
    and c.updated_at >= cfg.activated_from
    -- קריאה בת חודשים שרק נערכה אינה "נפתחה לך קריאת שירות".
    and c.created_at >= now() - make_interval(days => cfg.max_call_age_days)
    and not exists (select 1 from public.media_requests m where m.service_call_id = c.id);

  if p_commit then
    insert into public.media_requests
      (service_call_id, priority_call_id, customer_name, phone_e164, device_name,
       state, scheduled_send_at, skip_reason)
    select c_call_id, c_priority_call_id, c_customer_name, c_phone_e164, c_device_name,
           case when c_has_mobile then 'pending' else 'no_phone' end,
           case when c_has_mobile then c_send_at end,
           case when not c_has_mobile then 'אין מספר נייד על הקריאה' end
    from _mr_cand;
  end if;

  return query
    select c_call_id, c_customer_name, c_phone_e164, c_device_name, c_send_at
    from _mr_cand where c_has_mobile
    order by c_send_at;
end;
$fn$;

-- ── תפיסה לשליחה: ראשונות + תזכורות, עם כל תחזוקת הבית ───────────────────
create or replace function public.media_claim_due(p_limit int default 20)
returns table (id uuid, stage text, customer_name text, phone_e164 text, device_name text)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  cfg public.media_request_settings;
  sent_today int;
  room int;
begin
  -- 🔴 s.id ולא id: לפונקציה יש עמודת OUT בשם id, ו-plpgsql מסרב להכריע
  -- בין המשתנה לעמודה. נתפס בריצה החיה הראשונה, אחרי שכל הריצות היבשות
  -- עברו כי הן לא מגיעות ל-claim.
  select * into cfg from public.media_request_settings s where s.id;

  -- קריאה שעזבה את "לביצוע", אורכבה, או שכבר שובץ לה טכנאי ביומן,
  -- לא מקבלת יותר כלום. ההודעה נועדה לפני שיבוץ, לא אחריו.
  update public.media_requests m
     set state = 'cancelled',
         skip_reason = 'הקריאה כבר לא ממתינה לביצוע'
   where m.state in ('pending','first_sent','reminder_sent')
     and exists (
       select 1 from public.service_calls c
        where c.id = m.service_call_id
          and (c.priority_status is distinct from 'לביצוע' or c.archived_at is not null)
     );

  update public.media_requests m
     set state = 'cancelled',
         skip_reason = 'שובץ טכנאי לפני שהתקבלה תמונה'
   where m.state in ('pending','first_sent','reminder_sent')
     and exists (
       select 1 from public.calendar_stops s
        where s.service_call_id = m.service_call_id
          and s.status in ('planned','in_progress')
     );

  -- תור שנתקע הרבה מעבר לסביר (72 שעות מכסות גם את סוף השבוע).
  update public.media_requests
     set state = 'skipped', skip_reason = 'פג תוקף בתור'
   where state = 'pending'
     and scheduled_send_at < now() - make_interval(hours => cfg.stale_after_hours);

  -- גם התזכורת לא עזרה: מסמנים למוקד. זה דגל, לא הודעה, ולכן בלי חלון.
  update public.media_requests
     set state = 'no_response'
   where state = 'reminder_sent'
     and no_response_due_at is not null
     and no_response_due_at <= now();

  if not public.media_window_open() then return; end if;

  select count(*) into sent_today
    from public.media_requests
   where first_sent_at >= date_trunc('day', now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem'
      or reminder_sent_at >= date_trunc('day', now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem';

  room := least(p_limit, greatest(cfg.max_per_day - sent_today, 0));
  if room = 0 then return; end if;

  return query
  update public.media_requests m
     set send_claimed_at = now()
   where m.id in (
     select x.id from (
       select r.id, r.scheduled_send_at as due_at from public.media_requests r
        where r.state = 'pending' and r.scheduled_send_at <= now()
       union all
       select r.id, r.reminder_due_at from public.media_requests r
        where r.state = 'first_sent' and r.reminder_due_at is not null and r.reminder_due_at <= now()
     ) x
     join public.media_requests l on l.id = x.id
     where l.send_claimed_at is null or l.send_claimed_at < now() - interval '10 minutes'
     order by x.due_at
     limit room
     for update of l skip locked
   )
  returning m.id,
            case when m.state = 'pending' then 'first' else 'reminder' end,
            m.customer_name, m.phone_e164, m.device_name;
end;
$fn$;

-- ── תשובת הלקוח מהוובהוק ─────────────────────────────────────────────────
-- תמונה/סרטון: הבקשה נסגרת כ"תמונה התקבלה", גם אם עוד לא שלחנו (הלקוח
-- הקדים אותנו, המטרה הושגה). טקסט בלי תמונה: רק אחרי שההודעה שלנו יצאה,
-- והמשמעות היא שאדם נכנס לשיחה והתזכורת נעצרת.
create or replace function public.wa_apply_media_reply(p_phone text, p_has_media boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  hit uuid;
begin
  if p_has_media then
    update public.media_requests
       set state = 'media_received', media_received_at = now()
     where id = (
       select m.id from public.media_requests m
        where m.phone_e164 = p_phone
          and m.state in ('pending','first_sent','reminder_sent')
        order by m.created_at desc limit 1
     )
    returning id into hit;
  else
    update public.media_requests
       set state = 'replied_no_media', replied_at = now()
     where id = (
       select m.id from public.media_requests m
        where m.phone_e164 = p_phone
          and m.state in ('first_sent','reminder_sent')
        order by m.created_at desc limit 1
     )
    returning id into hit;
  end if;
  return hit;
end;
$fn$;

-- ── הרשאות: מנוע בלבד. אף אחת אינה נקראת מהדפדפן ─────────────────────────
revoke all on function public.media_request_enqueue(boolean) from public, anon, authenticated;
revoke all on function public.media_claim_due(int) from public, anon, authenticated;
revoke all on function public.wa_apply_media_reply(text, boolean) from public, anon, authenticated;
revoke all on function public.media_window_open() from public, anon;
revoke all on function public.media_next_send_time(timestamptz) from public, anon;
grant execute on function public.media_window_open() to authenticated, service_role;
grant execute on function public.media_next_send_time(timestamptz) to authenticated, service_role;
grant execute on function public.media_request_enqueue(boolean) to service_role;
grant execute on function public.media_claim_due(int) to service_role;
grant execute on function public.wa_apply_media_reply(text, boolean) to service_role;

-- ── התזמון (מופעל בנפרד, מתועד כאן) ──────────────────────────────────────
-- pg_cron רץ ב-UTC. 4-16 UTC מכסה 08:00-19:00 שעון ישראל בקיץ ובחורף,
-- והשער ב-SQL הוא שחוסם בדיוק. ראשון עד חמישי בלבד.
--
-- select cron.schedule('rashal-media-requests', '*/15 4-16 * * 0-4', $cron$
--   select net.http_post(
--     url:='https://kukstfxtznymfkirdmty.supabase.co/functions/v1/rashal-media-request',
--     headers:='{"Content-Type":"application/json","Authorization":"Bearer <anon>"}'::jsonb,
--     body:='{"trigger":"cron"}'::jsonb, timeout_milliseconds:=300000)
-- $cron$);
--
-- כיבוי מיידי בלי פריסה:
--   update public.media_request_settings set enabled = false where id;
