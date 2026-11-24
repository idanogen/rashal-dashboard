-- תעודת משלוח עוברת ל"סופק" כשהנהג סוגר אספקה, ודוח שבועי על מה שתקוע שם (24/11/2026).
--
-- עידן: "הוספתי בתעודות משלוח סטטוס חדש בשם סופק, אני רוצה שכל משלוח יעבור לסטטוס הזה",
-- ו"מייל מעוצב פעם בשבוע ביום חמישי ב-7:30 לרונן, לשלומי ואליי, עם כל התעודות שנמצאות
-- בסטטוס הזה מעל 7 ימים". אומת חי על SH2604717 (SO2604018): PATCH STATDES מטיוטא לסופק.
--
-- הזרם: עצירת אספקה שבוצעה (מרצפת הזמן ואילך, 3 דקות חסד) → התעודה היחידה של ההזמנה →
-- הקרון `rashal-dn-status` כל 5 דקות → הפונקציה rashal-dn-status (mode live) כותבת לפריוריטי,
-- מעדכנת את העותק שלנו, ורושמת ביומן. המתג הוא רצפת הזמן `priority_dn_status_floor()`.
-- 🔴 כתיבה רק בהתאמה חד משמעית (תעודה אחת לא מבוטלת להזמנה). שגויה = תעודה שלא סופקה מסומנת
--    כסופקה. 0 תעודות = ממתין (התעודה עוד לא נפתחה או סונכרנה), יותר מאחת = נעצר ביומן.

-- ── מתי התעודה הגיעה לסטטוס הנוכחי ──────────────────────────────
-- UDATE של פריוריטי זז בכל עריכה, ולכן הוא לא אומר "כמה זמן בסופק". הסנכרון לא משנה עמודה
-- זו; הטריגר מחתים אותה כשהסטטוס משתנה, והכותב שלנו קובע אותה לרגע האספקה.
alter table public.delivery_notes add column if not exists status_since timestamptz;

create or replace function public.delivery_notes_status_since()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.status_since := coalesce(new.status_since, now());
  elsif new.status is distinct from old.status and new.status_since is not distinct from old.status_since then
    new.status_since := now();
  end if;
  return new;
end $$;

drop trigger if exists trg_delivery_notes_status_since on public.delivery_notes;
create trigger trg_delivery_notes_status_since
  before insert or update of status on public.delivery_notes
  for each row execute function public.delivery_notes_status_since();

-- ── יומן הכתיבה: שורה לכל עצירה ──────────────────────────────────
create table if not exists public.priority_dn_status_log (
  stop_id     uuid primary key references public.calendar_stops(id) on delete cascade,
  docno       text,
  outcome     text not null check (outcome in ('done', 'failed', 'skipped')),
  from_status text,
  http        integer,
  message     text,
  matches     integer,
  created_at  timestamptz not null default now()
);
alter table public.priority_dn_status_log enable row level security;
drop policy if exists priority_dn_status_log_office on public.priority_dn_status_log;
create policy priority_dn_status_log_office on public.priority_dn_status_log
  for select to authenticated using ((select public.is_office_staff()));

-- המתג. אספקות לפני הרגע הזה לא נכתבות אוטומטית (השלמת העבר רק בהכרעת עידן).
create or replace function public.priority_dn_status_floor()
returns timestamptz language sql immutable as $$ select timestamptz '2026-11-24 18:45:00+02' $$;

-- מה ממתין לכתיבה. `matches` מאפשר לכותב לעצור כפילות ביומן במקום לנחש.
create or replace function public.priority_dn_status_candidates(p_limit integer default 40)
returns table (stop_id uuid, docno text, note_status text, matches integer, completed_at timestamptz)
language sql stable security definer set search_path = public as $$
  select cs.id,
         case when m.n = 1 then m.ids[1] end,
         case when m.n = 1 then m.statuses[1] end,
         m.n::int,
         cs.completed_at
    from public.calendar_stops cs
    join public.orders o on o.id = cs.order_id and o.priority_order_id is not null
    cross join lateral (
      select count(*) as n,
             array_agg(d.priority_doc_id order by d.doc_date desc) as ids,
             array_agg(coalesce(d.status, '') order by d.doc_date desc) as statuses
        from public.delivery_notes d
       where d.source_order = o.priority_order_id
         and coalesce(d.status, '') <> 'מבוטלת'
         and d.priority_doc_id ~ '^SH[0-9]{1,20}$'
    ) m
   where cs.source_type = 'delivery'
     and cs.status = 'completed'
     and cs.completed_at >= public.priority_dn_status_floor()
     and cs.completed_at < now() - interval '3 minutes'
     and m.n >= 1
     and not exists (select 1 from public.priority_dn_status_log l where l.stop_id = cs.id)
   order by cs.completed_at
   limit p_limit
$$;
revoke all on function public.priority_dn_status_candidates(integer) from public, anon, authenticated;

-- ── הדוח השבועי ──────────────────────────────────────────────────
create table if not exists public.dn_delivered_report_settings (
  id          boolean primary key default true check (id),
  enabled     boolean not null default false,
  recipients  jsonb not null default '[]'::jsonb,
  min_days    integer not null default 7,
  show_amounts boolean not null default true,
  send_empty  boolean not null default true,
  last_result jsonb
);
insert into public.dn_delivered_report_settings (id) values (true) on conflict (id) do nothing;
alter table public.dn_delivered_report_settings enable row level security;

create table if not exists public.dn_delivered_report_log (
  report_date date primary key,
  recipients  jsonb,
  sent_at     timestamptz,
  ok          boolean,
  notes       integer
);
alter table public.dn_delivered_report_log enable row level security;

-- התעודות שבסופק יותר מ-p_days ימים, עם הלקוח, הקופה, מי סיפק ומתי.
create or replace function public.dn_delivered_report_data(p_days integer default 7)
returns table (docno text, customer_name text, city text, fund text, order_no text,
               delivered_at timestamptz, driver text, days integer, total numeric)
language sql stable security definer set search_path = public as $$
  select d.priority_doc_id, d.customer_name, cs.city,
         coalesce(o.payer_fund, o.health_fund),
         d.source_order,
         coalesce(cs.completed_at, d.status_since),
         cs.driver,
         (current_date - (d.status_since at time zone 'Asia/Jerusalem')::date)::int,
         d.total_price
    from public.delivery_notes d
    left join public.orders o on o.priority_order_id = d.source_order and o.duplicate_of is null
    left join lateral (
      select c.city, c.driver, c.completed_at from public.calendar_stops c
       where c.order_id = o.id and c.source_type = 'delivery' and c.status = 'completed'
       order by c.completed_at desc limit 1
    ) cs on true
   where d.status = 'סופק'
     and d.archived_at is null
     and d.status_since <= now() - make_interval(days => p_days)
   order by d.status_since
$$;
revoke all on function public.dn_delivered_report_data(integer) from public, anon, authenticated;

-- ── הקרונים ──────────────────────────────────────────────────────
select cron.unschedule(jobid) from cron.job where jobname in ('rashal-dn-status', 'rashal-dn-report');

select cron.schedule('rashal-dn-status', '1-59/5 * * * *', $cron$
  select net.http_post(
    url := 'https://kukstfxtznymfkirdmty.supabase.co/functions/v1/rashal-dn-status',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a3N0Znh0em55bWZraXJkbXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNDQ2MjMsImV4cCI6MjA5MTgyMDYyM30.oF-pwjnAki4LiDE8nLa6SIjHHP_tLvsoZwEyxlu2f6E',
      'x-sync-secret', public.sync_secret()),
    body := '{"mode":"live","max":40}'::jsonb, timeout_milliseconds := 150000)
  where exists (select 1 from public.priority_dn_status_candidates(1))
$cron$);

-- חמישי 07:30 שעון ישראל: הקרון רץ ב-04:30 וב-05:30 UTC (שעון קיץ וחורף), השער בפונקציה.
select cron.schedule('rashal-dn-report', '30 4,5 * * 4', $cron$
  select net.http_post(
    url := 'https://kukstfxtznymfkirdmty.supabase.co/functions/v1/rashal-dn-report',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a3N0Znh0em55bWZraXJkbXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNDQ2MjMsImV4cCI6MjA5MTgyMDYyM30.oF-pwjnAki4LiDE8nLa6SIjHHP_tLvsoZwEyxlu2f6E',
      'x-sync-secret', public.sync_secret()),
    body := '{"trigger":"cron"}'::jsonb, timeout_milliseconds := 60000)
$cron$);

-- הבדיקה הידנית של 24/11 (SH2604717, לבקשת עידן) נכתבה לפריוריטי לפני שהזרם עלה:
-- העותק שלנו והיומן מיושרים כאן, כדי שהיא תיכנס לדוח מיום האספקה.
update public.delivery_notes set status = 'סופק', status_since = timestamptz '2026-11-23 10:45:22+02'
 where priority_doc_id = 'SH2604717' and status = 'טיוטא';
insert into public.priority_dn_status_log (stop_id, docno, outcome, from_status, http, matches, message)
values ('53671583-eff8-48f2-b96b-e179a37f15b4', 'SH2604717', 'done', 'טיוטא', 200, 1, 'בדיקה ידנית 24/11 לבקשת עידן')
on conflict (stop_id) do nothing;
