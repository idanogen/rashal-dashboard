-- מנוע שליחת הסקרים · 20/08/2026 · שלב 3 בתוכנית מ-16/08
--
-- עד היום הטבלה `customer_surveys` התמלאה ידנית. כאן נכנס מה שממלא אותה לבד:
-- עצירה שנסגרה כ"סופק" נכנסת לתור, ההגנות מחליטות מתי ההודעה יוצאת, ועבודה
-- מתוזמנת שולחת. אין צינור חדש: השליחה עוברת ב-/api/heyy-send הקיים.
--
-- 🔴 שתי הנחות של התוכנית המקורית נשברו מול הנתונים האמיתיים, ולכן ההגנות כאן
--    אינן זהות למסמך:
--    1. `arrived_at` ריק בכל העצירות שנסגרו לאחרונה, ולכן אי אפשר להשוות
--       `completed_at` מול `arrived_at` כדי לזהות סגירה בדיעבד. התחליף:
--       השוואת יום הסגירה מול `delivery_date`.
--    2. `customer_number` ריק ברוב העצירות, ולכן מכסת "פעם ב-30 יום ללקוח"
--       נשענת על הטלפון המנורמל ולא על מספר הלקוח.

-- ── שורות הבדיקה ─────────────────────────────────────────────────────────
-- שמונה השורות שקיימות היום הן בדיקות של עידן ושל שלומי. הן לא נמחקות (אפשר
-- יהיה להוכיח מהן שהצינור עבד), אבל הן חייבות לצאת מהמדידה ברגע שהמנוע נדלק.
alter table public.customer_surveys
  add column if not exists is_test boolean not null default false;

comment on column public.customer_surveys.is_test is
  'שורת בדיקה. לא נספרת בממוצעים במסך ההנהלה. ברירת המחדל false, כדי שסינון לא יפיל שורות עם NULL.';

-- חלון קבוע ולא now(), כדי שהרצה חוזרת של המיגרציה לא תסמן שורות אמיתיות כבדיקה.
update public.customer_surveys set is_test = true where created_at < '2026-08-20T10:30:00Z';

-- מי ששלח את ההודעה תפס אותה קודם. בלי זה שתי ריצות חופפות ישלחו פעמיים.
alter table public.customer_surveys
  add column if not exists send_claimed_at timestamptz;

-- גיבוי אחרון מפני כפילות: סקר אחד לכל עצירה.
create unique index if not exists customer_surveys_stop_unique
  on public.customer_surveys (stop_id) where stop_id is not null;

-- ── ההגדרות ──────────────────────────────────────────────────────────────
-- שורה אחת. מתג ההדלקה, מצב יבש, וכל הפרמטרים של ההגנות יושבים בדאטה ולא
-- בקוד, כדי שכיבוי יהיה עדכון אחד ולא פריסה.
create table if not exists public.survey_settings (
  id boolean primary key default true check (id),

  enabled  boolean not null default false,  -- המתג הראשי
  dry_run  boolean not null default true,   -- מחשב הכל, לא שולח כלום

  -- 🔴 החומה מפני הצפה למפרע: עצירה שנסגרה לפני הרגע הזה לעולם לא תיכנס לתור.
  -- בלעדיה הדלקה אחת היתה שולחת מאתיים הודעות על ביקורים בני שבועות.
  activated_from timestamptz,

  template_id text not null default '0b64ed7a-b6b6-48ea-9c3f-fd31e0d5b1a7',

  source_types     text[] not null default array['delivery','service','task'],
  driver_allowlist text[],                        -- NULL = כל הנהגים

  send_delay_minutes int  not null default 60,    -- שעה אחרי הסגירה
  quiet_from         time not null default '19:00',
  quiet_to           time not null default '09:00',
  morning_slot       time not null default '10:00',
  friday_cutoff      time not null default '13:00',

  per_customer_days int not null default 30,
  max_age_days      int not null default 3,       -- ביקור ישן מזה לא נסקר
  lookback_hours    int not null default 48,
  max_per_day       int not null default 40,      -- תקרת נפח יומית
  stale_after_hours int not null default 12,      -- תור שלא נשלח בזמן פג

  updated_at timestamptz not null default now()
);

insert into public.survey_settings (id) values (true) on conflict (id) do nothing;

alter table public.survey_settings enable row level security;
drop policy if exists authenticated_read_survey_settings on public.survey_settings;
create policy authenticated_read_survey_settings on public.survey_settings
  for select to authenticated using (true);

-- ── יומן הריצות ──────────────────────────────────────────────────────────
-- הלקח מ-09/08 ומ-11/08: ריצה ירוקה לא אומרת שנכתבה שורה. היומן סופר תוכן.
create table if not exists public.survey_engine_runs (
  id bigserial primary key,
  ran_at   timestamptz not null default now(),
  trigger  text,
  dry_run  boolean not null default false,
  enqueued int not null default 0,
  due      int not null default 0,
  sent     int not null default 0,
  failed   int not null default 0,
  expired  int not null default 0,
  detail   jsonb
);

alter table public.survey_engine_runs enable row level security;
drop policy if exists authenticated_read_survey_engine_runs on public.survey_engine_runs;
create policy authenticated_read_survey_engine_runs on public.survey_engine_runs
  for select to authenticated using (true);

-- ── מתי ההודעה יוצאת ─────────────────────────────────────────────────────
create or replace function public.survey_send_time(p_completed timestamptz, p_retro boolean)
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
declare
  cfg public.survey_settings;
  loc timestamp;
begin
  select * into cfg from public.survey_settings where id;
  loc := (p_completed at time zone 'Asia/Jerusalem') + make_interval(mins => cfg.send_delay_minutes);

  -- סגירה בדיעבד: הנהג סגר ביום אחר. אין טעם לשלוח שעה אחרי הלחיצה.
  if p_retro then
    loc := loc::date + cfg.morning_slot;
  end if;

  -- שעות שקטות. סגירה ב-20:15 לא מייצרת הודעה ב-21:15 לאדם מבוגר.
  if loc::time >= cfg.quiet_from then
    loc := (loc::date + 1) + cfg.morning_slot;
  elsif loc::time < cfg.quiet_to then
    loc := loc::date + cfg.morning_slot;
  end if;

  -- שישי אחר הצהריים ושבת נדחים לראשון. הצוות עובד ראשון עד חמישי.
  if extract(dow from loc) = 5 and loc::time >= cfg.friday_cutoff then
    loc := (loc::date + 2) + cfg.morning_slot;
  elsif extract(dow from loc) = 6 then
    loc := (loc::date + 1) + cfg.morning_slot;
  end if;

  return loc at time zone 'Asia/Jerusalem';
end;
$$;

-- ── התור ─────────────────────────────────────────────────────────────────
-- p_commit=false מחזיר בדיוק את אותה רשימה בלי לכתוב כלום. זה מצב היובש,
-- והוא חולק את הקוד עם השליחה האמיתית כדי שלא יתפצלו לשתי אמיתות.
create or replace function public.survey_enqueue(p_commit boolean default true)
returns table (
  stop_id           uuid,
  customer_name     text,
  phone_e164        text,
  driver            text,
  source_type       text,
  completed_at      timestamptz,
  scheduled_send_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  cfg public.survey_settings;
begin
  select * into cfg from public.survey_settings where id;
  if not found then
    raise exception 'survey_settings row missing';
  end if;
  -- בלי חומה אין תור. שגיאה עדיפה על ריצה שתשלח היסטוריה.
  if cfg.activated_from is null then
    raise exception 'survey_settings.activated_from is null - refusing to enqueue history';
  end if;

  -- כינויי c_ בכוונה: שמות עמודות ה-OUT של הפונקציה זהים לשמות בטבלה,
  -- ובלי הכינוי כל אזכור לא מוסמך היה דו-משמעי.
  drop table if exists _cand;
  create temp table _cand on commit drop as
  with base as (
    select
      s.id              as c_stop_id,
      s.customer_name   as c_customer_name,
      s.customer_number as c_customer_number,
      s.order_id        as c_order_id,
      s.driver::text    as c_driver,
      s.source_type     as c_source_type,
      s.completed_at    as c_completed_at,
      '+972' || right(regexp_replace(coalesce(s.phone, ''), '\D', '', 'g'), 9) as c_phone_e164,
      ((s.completed_at at time zone 'Asia/Jerusalem')::date > s.delivery_date) as c_retroactive
    from public.calendar_stops s
    where s.status = 'completed'
      and s.completed_at is not null
      and s.completed_at >= greatest(cfg.activated_from, now() - make_interval(hours => cfg.lookback_hours))
      and s.source_type = any (cfg.source_types)
      and (cfg.driver_allowlist is null or s.driver::text = any (cfg.driver_allowlist))
      -- וואטסאפ הולך לנייד בלבד. קו נייח שלם (08-9432384) אינו כישלון, הוא פשוט לא נמען.
      and regexp_replace(coalesce(s.phone, ''), '\D', '', 'g') ~ '^0?5[0-9]{8}$'
      and s.delivery_date >= current_date - cfg.max_age_days
      and not exists (select 1 from public.customer_surveys cs where cs.stop_id = s.id)
  )
  -- מכסת פעם ב-30 יום ללקוח. ה-distinct on מכסה גם שתי עצירות לאותו טלפון
  -- בתוך אותה אצווה, שאף אחת מהן עוד לא במסד ולכן ה-not exists לא רואה.
  select distinct on (b.c_phone_e164)
         b.*, public.survey_send_time(b.c_completed_at, b.c_retroactive) as c_send_at
  from base b
  where not exists (
    select 1 from public.customer_surveys cs
    where cs.phone_e164 = b.c_phone_e164
      and cs.is_test = false
      and cs.created_at >= now() - make_interval(days => cfg.per_customer_days)
  )
  order by b.c_phone_e164, b.c_completed_at desc;

  if p_commit then
    insert into public.customer_surveys
      (stop_id, order_id, customer_number, customer_name, phone_e164, driver,
       health_fund, delivered_at, scheduled_send_at, status)
    select c.c_stop_id, c.c_order_id, c.c_customer_number, c.c_customer_name, c.c_phone_e164, c.c_driver,
           o.health_fund, c.c_completed_at, c.c_send_at, 'pending'
    from _cand c
    left join public.orders o on o.id = c.c_order_id;
  end if;

  return query
    select c.c_stop_id, c.c_customer_name, c.c_phone_e164, c.c_driver, c.c_source_type,
           c.c_completed_at, c.c_send_at
    from _cand c
    order by c.c_send_at;
end;
$fn$;

-- ── שער חלון השליחה ──────────────────────────────────────────────────────
-- פונקציה אחת ששני המצבים קוראים לה. אחרת הדוח היבש היה מבטיח "יוצא עכשיו"
-- בשעה שהשליחה האמיתית חוסמת, וזו בדיוק אי-האמת שהמנוע הזה נועד למנוע.
create or replace function public.survey_window_open()
returns boolean
language plpgsql
stable
set search_path = public
as $fn$
declare cfg public.survey_settings; loc timestamp;
begin
  select * into cfg from public.survey_settings where id;
  loc := now() at time zone 'Asia/Jerusalem';
  if loc::time < cfg.quiet_to or loc::time >= cfg.quiet_from then return false; end if;
  if extract(dow from loc) = 6 then return false; end if;
  if extract(dow from loc) = 5 and loc::time >= cfg.friday_cutoff then return false; end if;
  return true;
end;
$fn$;

-- ── תפיסת התור לשליחה ────────────────────────────────────────────────────
-- 🔴 חלון השליחה נאכף **כאן** ולא רק ב-scheduled_send_at. שורה שנדחתה לבוקר
-- ונשארה תקועה הופכת ל"מגיע לה עכשיו" גם ב-23:00, ובלי השער הזה היא היתה
-- יוצאת בדיוק בשעה שההגנה נועדה למנוע.
create or replace function public.survey_claim_due(p_limit int default 20)
returns table (id uuid, token text, customer_name text, phone_e164 text)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  cfg  public.survey_settings;
  sent_today int;
  room int;
begin
  select * into cfg from public.survey_settings where id;

  if not public.survey_window_open() then return; end if;

  -- תור שפג: לא שולחים סקר על ביקור ששכחנו יום שלם
  update public.customer_surveys
     set status = 'skipped', skip_reason = 'פג תוקף בתור'
   where status = 'pending'
     and scheduled_send_at < now() - make_interval(hours => cfg.stale_after_hours);

  select count(*) into sent_today
    from public.customer_surveys
   where sent_at >= date_trunc('day', now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem';

  room := least(p_limit, greatest(cfg.max_per_day - sent_today, 0));
  if room = 0 then return; end if;

  return query
  update public.customer_surveys s
     set send_claimed_at = now()
   where s.id in (
     select c.id from public.customer_surveys c
      where c.status = 'pending'
        and c.scheduled_send_at <= now()
        and (c.send_claimed_at is null or c.send_claimed_at < now() - interval '10 minutes')
      order by c.scheduled_send_at
      limit room
      for update skip locked
   )
  returning s.id, s.token, s.customer_name, s.phone_e164;
end;
$fn$;

-- ── בריאות המנוע ─────────────────────────────────────────────────────────
-- לא "האם הריצה הצליחה" אלא "האם יצא מה שהיה אמור לצאת".
create or replace view public.survey_engine_health as
with closed as (
  select count(*) as eligible_24h
  from public.calendar_stops s, public.survey_settings cfg
  where s.status = 'completed'
    and s.completed_at >= greatest(cfg.activated_from, now() - interval '24 hours')
    and s.source_type = any (cfg.source_types)
    and regexp_replace(coalesce(s.phone, ''), '\D', '', 'g') ~ '^0?5[0-9]{8}$'
),
made as (
  select
    count(*) filter (where created_at >= now() - interval '24 hours') as created_24h,
    count(*) filter (where sent_at    >= now() - interval '24 hours') as sent_24h,
    count(*) filter (where status = 'pending')                        as in_queue,
    count(*) filter (where status = 'failed')                         as failed_total
  from public.customer_surveys where is_test = false
)
select c.eligible_24h, m.created_24h, m.sent_24h, m.in_queue, m.failed_total,
       (select max(ran_at) from public.survey_engine_runs) as last_run_at
from closed c, made m;

grant select on public.survey_engine_health to authenticated;

-- ── התזמון ───────────────────────────────────────────────────────────────
-- pg_cron רץ ב-UTC. 06:00 עד 16:45 UTC = 09:00 עד 19:45 שעון ישראל, וראשון
-- עד חמישי. השער ב-SQL חוסם ממילא אחרי 19:00, ולכן הסתירה היחידה האפשרית
-- היא ריצה מיותרת ולא הודעה בשעה אסורה.
--
-- select cron.schedule('rashal-surveys', '*/15 6-16 * * 0-4', $cron$
--   select net.http_post(
--     url:='https://kukstfxtznymfkirdmty.supabase.co/functions/v1/rashal-surveys',
--     headers:='{"Content-Type":"application/json","Authorization":"Bearer <anon>"}'::jsonb,
--     body:='{"trigger":"cron"}'::jsonb, timeout_milliseconds:=300000)
-- $cron$);
--
-- כיבוי מיידי, בלי פריסה:
--   update public.survey_settings set enabled = false where id;
