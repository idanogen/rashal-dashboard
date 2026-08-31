-- ─── מנוע התראות הנהגים (אפליקציית rashal-driver) · 31/08/2026 ───────────
--
-- אותו דפוס בדיוק כמו מנוע "בדרך אליך": טריגר במסד קולט את הרגע, רושם
-- לתור, ומקפיץ פונקציית Edge דרך pg_net. קרון מטאטא כל 5 דקות מרים מה
-- שנפל. הפונקציה (rashal-driver-notify) ממתינה 30 שניות ואז מרוקנת את
-- התור, כדי ששיבוץ מרובה של הסדרן יהפוך להתראה מסכמת אחת ולא לעשר.
--
-- מה מדווח לנהג: עצירה חדשה להיום/מחר/מחרתיים · עצירה שהוזזה/הוסרה ·
-- הודעה חדשה בצ'אט של עצירה פעילה שלו · תמונה שהגיעה מהלקוח.
-- הודעות של הנהג עצמו לא מדווחות לו (זיהוי דרך driver_devices).

-- ── טבלת המכשירים: לאן שולחים ───────────────────────────────────────────
create table if not exists public.driver_devices (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  driver_name text not null references public.assignees(name) on update cascade,
  expo_push_token text not null unique,
  platform text,
  updated_at timestamptz not null default now()
);
create index if not exists driver_devices_driver_idx on public.driver_devices (driver_name);
alter table public.driver_devices enable row level security;
drop policy if exists driver_devices_own on public.driver_devices;
create policy driver_devices_own on public.driver_devices
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- ── מתג כיבוי בלי פריסה ─────────────────────────────────────────────────
create table if not exists public.driver_push_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.driver_push_settings (id) values (true) on conflict (id) do nothing;
alter table public.driver_push_settings enable row level security;
drop policy if exists driver_push_settings_read on public.driver_push_settings;
create policy driver_push_settings_read on public.driver_push_settings
  for select to authenticated using (true);

-- ── התור ────────────────────────────────────────────────────────────────
create table if not exists public.driver_notify_queue (
  id bigserial primary key,
  driver_name text not null,
  kind text not null check (kind in ('new_stop','schedule_change','removed','chat','photo')),
  title text not null,
  body text,
  stop_id uuid,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  result text
);
create index if not exists driver_notify_queue_open_idx
  on public.driver_notify_queue (created_at) where sent_at is null;
alter table public.driver_notify_queue enable row level security;
drop policy if exists driver_notify_queue_read on public.driver_notify_queue;
create policy driver_notify_queue_read on public.driver_notify_queue
  for select to authenticated using ((select public.is_office_staff()));

-- ── ההקפצה: אש-ושכח אל הפונקציה. הקרון הוא רשת הביטחון ─────────────────
create or replace function public.driver_push_kick()
returns void
language plpgsql security definer set search_path = public
as $fn$
begin
  perform net.http_post(
    url := 'https://kukstfxtznymfkirdmty.supabase.co/functions/v1/rashal-driver-notify',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a3N0Znh0em55bWZraXJkbXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNDQ2MjMsImV4cCI6MjA5MTgyMDYyM30.oF-pwjnAki4LiDE8nLa6SIjHHP_tLvsoZwEyxlu2f6E"}'::jsonb,
    body := '{"trigger":"db"}'::jsonb,
    timeout_milliseconds := 5000);
exception when others then
  null;
end;
$fn$;

-- ── טריגר היומן ─────────────────────────────────────────────────────────
-- 🔴 הטריגר לעולם לא מפיל את הכתיבה של הסדרן. הכל עטוף בבליעת שגיאות.
create or replace function public.driver_push_capture_stop()
returns trigger
language plpgsql security definer set search_path = public
as $fn$
declare
  today date := (now() at time zone 'Asia/Jerusalem')::date;
  horizon date := (now() at time zone 'Asia/Jerusalem')::date + 2;
begin
  begin
    if tg_op = 'INSERT' then
      if new.driver is not null and new.status = 'planned'
         and new.delivery_date between today and horizon then
        insert into public.driver_notify_queue (driver_name, kind, title, body, stop_id)
        values (new.driver::text, 'new_stop', 'נוספה עצירה לסידור שלך',
                new.customer_name || coalesce(' · ' || new.city, '')
                  || ' · ' || to_char(new.delivery_date, 'DD/MM'),
                new.id);
        perform public.driver_push_kick();
      end if;

    elsif tg_op = 'UPDATE' then
      if new.driver is distinct from old.driver then
        -- החלפת נהג: הישן מקבל "הוסרה", החדש מקבל "נוספה".
        if old.driver is not null and old.status in ('planned','in_progress')
           and old.delivery_date between today and horizon then
          insert into public.driver_notify_queue (driver_name, kind, title, body, stop_id)
          values (old.driver::text, 'removed', 'עצירה הוסרה מהסידור שלך',
                  old.customer_name || coalesce(' · ' || old.city, ''), new.id);
        end if;
        if new.driver is not null and new.status in ('planned','in_progress')
           and new.delivery_date between today and horizon then
          insert into public.driver_notify_queue (driver_name, kind, title, body, stop_id)
          values (new.driver::text, 'new_stop', 'נוספה עצירה לסידור שלך',
                  new.customer_name || coalesce(' · ' || new.city, '')
                    || ' · ' || to_char(new.delivery_date, 'DD/MM'),
                  new.id);
        end if;
        perform public.driver_push_kick();

      elsif new.delivery_date is distinct from old.delivery_date
            and new.driver is not null
            and new.status in ('planned','in_progress')
            and (new.delivery_date between today and horizon
                 or old.delivery_date between today and horizon) then
        insert into public.driver_notify_queue (driver_name, kind, title, body, stop_id)
        values (new.driver::text, 'schedule_change', 'שינוי בסידור שלך',
                new.customer_name || ' עבר ל-' || to_char(new.delivery_date, 'DD/MM'),
                new.id);
        perform public.driver_push_kick();

      elsif new.status = 'cancelled' and old.status in ('planned','in_progress')
            and new.driver is not null
            and new.delivery_date between today and horizon then
        insert into public.driver_notify_queue (driver_name, kind, title, body, stop_id)
        values (new.driver::text, 'removed', 'עצירה בוטלה',
                new.customer_name || coalesce(' · ' || new.city, ''), new.id);
        perform public.driver_push_kick();
      end if;
    end if;
  exception when others then
    null; -- בליעה מכוונת: ההתראה לעולם לא מפילה את השיבוץ.
  end;
  return new;
end;
$fn$;

drop trigger if exists driver_push_capture_stop_tg on public.calendar_stops;
create trigger driver_push_capture_stop_tg
  after insert or update on public.calendar_stops
  for each row execute function public.driver_push_capture_stop();

-- ── טריגר הצ'אט: הודעה או תמונה על עצירה פעילה של נהג ──────────────────
create or replace function public.driver_push_capture_chat()
returns trigger
language plpgsql security definer set search_path = public
as $fn$
declare
  stop record;
  today date := (now() at time zone 'Asia/Jerusalem')::date;
begin
  begin
    if new.type not in ('comment', 'file_upload') then
      return new;
    end if;

    -- העצירה הפעילה שהאירוע עוגן אליה. עוגן ישן מדי לא מדווח: הודעה על
    -- ביקור מלפני שבועיים אינה עדכון שטח.
    select s.id, s.driver, s.customer_name
      into stop
      from public.calendar_stops s
     where ((new.order_id is not null and s.order_id = new.order_id)
         or (new.service_call_id is not null and s.service_call_id = new.service_call_id)
         or (new.calendar_stop_id is not null and s.id = new.calendar_stop_id))
       and s.driver is not null
       and s.status in ('planned', 'in_progress')
       and s.delivery_date >= today - 7
     order by s.delivery_date desc
     limit 1;

    if stop.id is null then
      return new;
    end if;

    -- הודעה של הנהג עצמו לא חוזרת אליו כהתראה.
    if new.user_id is not null and exists (
      select 1 from public.driver_devices dd
       where dd.driver_name = stop.driver::text
         and dd.profile_id::text = new.user_id
    ) then
      return new;
    end if;

    insert into public.driver_notify_queue (driver_name, kind, title, body, stop_id)
    values (
      stop.driver::text,
      case when new.type = 'file_upload' then 'photo' else 'chat' end,
      case when new.type = 'file_upload'
           then 'התקבלה תמונה · ' || stop.customer_name
           else 'הודעה חדשה · ' || stop.customer_name end,
      case when new.type = 'file_upload'
           then coalesce(new.user_name, '')
           else coalesce(new.user_name, '') || ': ' || left(coalesce(new.content, ''), 120) end,
      stop.id);
    perform public.driver_push_kick();
  exception when others then
    null;
  end;
  return new;
end;
$fn$;

drop trigger if exists driver_push_capture_chat_tg on public.timeline_events;
create trigger driver_push_capture_chat_tg
  after insert on public.timeline_events
  for each row execute function public.driver_push_capture_chat();

-- ── רשת הביטחון: מטאטא כל 5 דקות בשעות העבודה ──────────────────────────
-- cron.schedule עם אותו שם מעדכן ג'וב קיים, לא מכפיל.
select cron.schedule(
  'rashal-driver-notify-sweep',
  '*/5 4-17 * * 0-5',
  $cron$
  select net.http_post(
    url := 'https://kukstfxtznymfkirdmty.supabase.co/functions/v1/rashal-driver-notify',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a3N0Znh0em55bWZraXJkbXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNDQ2MjMsImV4cCI6MjA5MTgyMDYyM30.oF-pwjnAki4LiDE8nLa6SIjHHP_tLvsoZwEyxlu2f6E"}'::jsonb,
    body := '{"trigger":"cron"}'::jsonb,
    timeout_milliseconds := 8000)
  $cron$
);
