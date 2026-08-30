-- ─── מנוע "הנהג בדרך אליך" · 30/08/2026 ─────────────────────────────────
--
-- ההכרעות של עידן (30/08): הנוסח בלי זמן הגעה משוער · "לא בוצע" נחשב
-- סיום · כל סוגי העצירות. התבנית: rashal_on_the_way (שלום {{name}},
-- {{worker}} של ר.שעל סיים את הביקור הקודם ונמצא כעת בדרך אליך).
--
-- ⭐ **השינוי הגדול מגרסת 11/08 (הענף שלא מוזג): השליחה בשרת.** טריגר על
-- סגירת עצירה במסד קולט את הרגע, pg_net מקפיץ את הפונקציה מיד, וקרון
-- מטאטא כל 5 דקות מרים מה שנפל. הנהג יכול לסגור ולהיכנס לאוטו בלי קליטה.
--
-- ההגנות:
-- · הודעה אחת לכל עצירה, לנצח (on_way_notices, מפתח ראשי stop_id).
-- · רק כשהעצירה שנסגרה והבאה בתור הן של **היום** (הלקח מ-295 השאריות:
--   סגירת שאריות ישנות מהמשרד אסור שתירה הודעות "אני בדרך").
-- · אירוע מתיישן אחרי 20 דקות: "בדרך אליך" נכון עכשיו או בכלל לא.
-- · חלון תיאום שמתחיל בעוד יותר מ-lead_minutes = מוקדם מדי, לא שולחים
--   (ולא מסמנים: סגירה מאוחרת יותר תעריך מחדש).
-- · מחוץ לשעות (אחרי 19:00, שישי-שבת) לא שולחים ולא דוחים למחר: הודעת
--   "בדרך אליך" שמגיעה בבוקר היא שקר.

create table if not exists public.on_way_settings (
  id boolean primary key default true check (id),
  enabled  boolean not null default false,
  dry_run  boolean not null default true,
  template_id text default 'fa600630-d9e6-49cc-bb92-4e6dc66f8d3e',
  lead_minutes int not null default 90,
  stale_minutes int not null default 20,
  work_start time not null default '08:00',
  work_end   time not null default '19:00',
  updated_at timestamptz not null default now()
);
insert into public.on_way_settings (id) values (true) on conflict (id) do nothing;
alter table public.on_way_settings enable row level security;
drop policy if exists authenticated_read_on_way_settings on public.on_way_settings;
create policy authenticated_read_on_way_settings on public.on_way_settings
  for select to authenticated using (true);

-- כל סגירה של עצירת-היום, מהטריגר. העיבוד אחר כך.
create table if not exists public.on_way_events (
  id bigserial primary key,
  resolved_stop_id uuid not null,
  driver text not null,
  delivery_date date not null,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  result text,
  next_stop_id uuid
);
create index if not exists on_way_events_open_idx on public.on_way_events (created_at) where processed_at is null;
alter table public.on_way_events enable row level security;
drop policy if exists authenticated_read_on_way_events on public.on_way_events;
create policy authenticated_read_on_way_events on public.on_way_events
  for select to authenticated using ((select public.is_office_staff()));

-- הודעה אחת לכל עצירה: המפתח הראשי הוא ההגנה.
create table if not exists public.on_way_notices (
  stop_id uuid primary key references public.calendar_stops(id) on delete cascade,
  sent_at timestamptz not null default now(),
  phone_e164 text,
  customer_name text,
  driver text,
  triggered_by_stop uuid,
  is_test boolean not null default false
);
alter table public.on_way_notices enable row level security;
drop policy if exists authenticated_read_on_way_notices on public.on_way_notices;
create policy authenticated_read_on_way_notices on public.on_way_notices
  for select to authenticated using ((select public.is_office_staff()));

create table if not exists public.on_way_runs (
  id bigserial primary key,
  ran_at timestamptz not null default now(),
  trigger text,
  dry_run boolean not null default false,
  events int not null default 0,
  sent int not null default 0,
  failed int not null default 0,
  detail jsonb
);
alter table public.on_way_runs enable row level security;
drop policy if exists authenticated_read_on_way_runs on public.on_way_runs;
create policy authenticated_read_on_way_runs on public.on_way_runs
  for select to authenticated using (true);

-- ── חלון השליחה ─────────────────────────────────────────────────────────
create or replace function public.on_way_window_open()
returns boolean
language plpgsql stable set search_path = public
as $fn$
declare cfg public.on_way_settings; loc timestamp;
begin
  select * into cfg from public.on_way_settings s where s.id;
  loc := now() at time zone 'Asia/Jerusalem';
  if extract(dow from loc) in (5, 6) then return false; end if;
  if loc::time < cfg.work_start or loc::time >= cfg.work_end then return false; end if;
  return true;
end;
$fn$;

-- ── הטריגר: סגירת עצירה של היום נרשמת ומקפיצה את המנוע ──────────────────
-- 🔴🔴 **הטריגר לעולם לא מפיל את הסגירה עצמה.** "סופק" של נהג חשוב
-- מההודעה, ולכן כל הגוף עטוף בבליעת שגיאות.
create or replace function public.on_way_capture()
returns trigger
language plpgsql security definer set search_path = public
as $fn$
begin
  begin
    if new.status in ('completed', 'not_completed')
       and old.status not in ('completed', 'not_completed')
       and new.delivery_date = (now() at time zone 'Asia/Jerusalem')::date then
      insert into public.on_way_events (resolved_stop_id, driver, delivery_date)
      values (new.id, new.driver::text, new.delivery_date);

      -- הקפצה מיידית, אש-ושכח. הקרון של כל 5 דקות הוא רשת הביטחון.
      perform net.http_post(
        url := 'https://kukstfxtznymfkirdmty.supabase.co/functions/v1/rashal-on-way',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a3N0Znh0em55bWZraXJkbXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNDQ2MjMsImV4cCI6MjA5MTgyMDYyM30.oF-pwjnAki4LiDE8nLa6SIjHHP_tLvsoZwEyxlu2f6E"}'::jsonb,
        body := '{"trigger":"stop-resolved"}'::jsonb,
        timeout_milliseconds := 5000);
    end if;
  exception when others then
    null; -- בליעה מכוונת: ראה הכותרת.
  end;
  return new;
end;
$fn$;

drop trigger if exists on_way_capture_tg on public.calendar_stops;
create trigger on_way_capture_tg
  after update on public.calendar_stops
  for each row execute function public.on_way_capture();

-- ── העיבוד: מהאירוע אל המועמד לשליחה ────────────────────────────────────
-- p_dry=true מחשב ומסמן 'dry' בלי שהפונקציה בענן תשלח דבר.
create or replace function public.on_way_claim(p_dry boolean default false, p_limit int default 20)
returns table (event_id bigint, next_stop_id uuid, customer_name text,
               phone_e164 text, worker text, resolved_stop_id uuid)
language plpgsql security definer set search_path = public
as $fn$
declare
  cfg public.on_way_settings;
  ev record;
  nxt record;
  verdict text;
begin
  select * into cfg from public.on_way_settings s where s.id;

  -- אירוע ישן מ-stale_minutes כבר אינו "בדרך אליך".
  update public.on_way_events e
     set processed_at = now(), result = 'stale'
   where e.processed_at is null
     and e.created_at < now() - make_interval(mins => cfg.stale_minutes);

  for ev in
    select * from public.on_way_events e
     where e.processed_at is null
     order by e.created_at
     limit p_limit
     for update skip locked
  loop
    -- העצירה הבאה של אותו נהג היום, לפי הסדר הקנוני של המסכים:
    -- שעת תיאום קודמת, ואז מספר סידורי.
    -- 🔴 time_window_start הוא טקסט חופשי 'HH:MM'. מיון טקסטואלי היה שם
    -- את 9:00 אחרי 10:00, ולכן הפענוח לזמן, וערך שבור נופל לסוף במקום
    -- להפיל את הפונקציה.
    select s.*,
           nullif(substring(coalesce(s.time_window_start, '') from '^\d{1,2}:\d{2}'), '')::time as win_start
      into nxt
      from public.calendar_stops s
     where s.driver::text = ev.driver
       and s.delivery_date = ev.delivery_date
       and s.status = 'planned'
     order by (nullif(substring(coalesce(s.time_window_start, '') from '^\d{1,2}:\d{2}'), '') is null),
              nullif(substring(coalesce(s.time_window_start, '') from '^\d{1,2}:\d{2}'), '')::time,
              s.sequence
     limit 1;

    if nxt.id is null then
      verdict := 'last_stop';
    elsif exists (select 1 from public.on_way_notices n where n.stop_id = nxt.id) then
      verdict := 'already_notified';
    elsif regexp_replace(coalesce(nxt.phone, ''), '\D', '', 'g') !~ '^0?5[0-9]{8}$' then
      verdict := 'no_mobile';
    elsif not public.on_way_window_open() then
      verdict := 'after_hours';
    elsif nxt.win_start is not null
      and (ev.delivery_date + nxt.win_start) at time zone 'Asia/Jerusalem'
          > now() + make_interval(mins => cfg.lead_minutes) then
      -- מוקדם מדי לומר "בדרך". לא מסמנים את העצירה: סגירה מאוחרת
      -- יותר תעריך אותה מחדש כשהחלון יתקרב.
      verdict := 'too_early';
    else
      verdict := case when p_dry then 'dry' else 'claimed' end;
    end if;

    update public.on_way_events e
       set processed_at = now(),
           result = verdict,
           next_stop_id = nxt.id
     where e.id = ev.id;

    if verdict in ('claimed', 'dry') then
      event_id := ev.id;
      next_stop_id := nxt.id;
      customer_name := nxt.customer_name;
      phone_e164 := '+972' || right(regexp_replace(nxt.phone, '\D', '', 'g'), 9);
      -- קריאת שירות = טכנאי, כל השאר = נהג. הלקוח שופט לפי סוג הביקור.
      worker := case when nxt.source_type = 'service' then 'טכנאי' else 'נהג' end;
      resolved_stop_id := ev.resolved_stop_id;
      return next;
    end if;
  end loop;
end;
$fn$;

-- שליחה הצליחה: ההודעה נרשמת, פעם אחת לכל עצירה.
create or replace function public.on_way_mark_sent(
  p_event bigint, p_stop uuid, p_phone text, p_name text, p_resolved uuid)
returns void
language plpgsql security definer set search_path = public
as $fn$
begin
  insert into public.on_way_notices (stop_id, phone_e164, customer_name, driver, triggered_by_stop)
  select p_stop, p_phone, p_name, s.driver::text, p_resolved
    from public.calendar_stops s where s.id = p_stop
  on conflict (stop_id) do nothing;
  update public.on_way_events e set result = 'sent' where e.id = p_event;
end;
$fn$;

revoke all on function public.on_way_claim(boolean, int) from public, anon, authenticated;
revoke all on function public.on_way_mark_sent(bigint, uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.on_way_window_open() from public, anon;
grant execute on function public.on_way_window_open() to authenticated, service_role;
grant execute on function public.on_way_claim(boolean, int) to service_role;
grant execute on function public.on_way_mark_sent(bigint, uuid, text, text, uuid) to service_role;

-- ── התזמון (מופעל בנפרד): קרון מטאטא כל 5 דקות, ראשון-חמישי ──────────────
-- select cron.schedule('rashal-on-way', '*/5 4-16 * * 0-4', $cron$ ... net.http_post ... $cron$);
-- כיבוי מיידי בלי פריסה: update public.on_way_settings set enabled=false where id;
