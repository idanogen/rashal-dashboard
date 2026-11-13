-- "שם נהג / טכנאי" בקריאת שירות (DOCUMENTS_Q.TOPP_DRIVERNAME): מי משובץ לקריאה,
-- נכתב ברגע השיבוץ וגם כשמחליפים טכנאי (עידן, 13/11/2026).
--
-- השדה הוא טקסט חופשי ברוחב 15 שהמיישם הוסיף, והוא מחליף את "לטיפול"
-- (TECHNICIANLOGIN, 20261104_priority_technician_login.sql) שקיבל רק משתמש פעיל ודחה
-- את רוב הטכנאים. מהיום `rashal-call-status` לא כותב ל"לטיפול" בכלל.
-- ✅ אומת חי 13/11 על SC2603599: "מוהנד" (בלי משתמש בפריוריטי) נכתב ונקרא חזרה,
--    בלי לגעת בסטטוס או ב-STATUSDATE.
--
-- ⭐ הטבלה היא מצב רצוי, שורה אחת לקריאה: הטריגר מעדכן את השם ומחזיר ל-pending,
--    כך שהחלפת טכנאי לפני שהכתיבה יצאה כותבת רק את השם האחרון.
-- ⭐ הטריגר הוא המתג: בלי שורה ממתינה הקרון לא קורא לפונקציה.
-- 🔴 ביטול שיבוץ או הסרת הטכנאי לא מוחקים את השם בפריוריטי: נשאר השם האחרון.
-- 🔴 סקריפט המוני שמשנה `driver` בעצירות שירות = כתיבה המונית לקריאות בפריוריטי.
-- 🔴 דחייה של פריוריטי (4xx) נעצרת כ-failed עם הנוסח, והוואצ'דוג מתריע (driver-name).

create table if not exists public.priority_call_driver_writes (
  priority_call_id text primary key check (priority_call_id ~ '^SC[0-9]+$'),
  service_call_id uuid references public.service_calls(id) on delete set null,
  calendar_stop_id uuid references public.calendar_stops(id) on delete set null,
  driver_name text not null,
  state text not null default 'pending' check (state in ('pending', 'done', 'failed')),
  requested_at timestamptz not null default now(),
  attempted_at timestamptz,
  attempts integer not null default 0,
  http_status integer,
  written_name text,
  error text
);
comment on table public.priority_call_driver_writes is
  'מצב רצוי של "שם נהג / טכנאי" (DOCUMENTS_Q.TOPP_DRIVERNAME) לכל קריאת שירות. נכתב מהטריגר על calendar_stops, נשלח ב-rashal-call-status (driver-live).';

create index if not exists priority_call_driver_writes_pending_idx
  on public.priority_call_driver_writes (requested_at) where state = 'pending';

alter table public.priority_call_driver_writes enable row level security;
drop policy if exists priority_call_driver_writes_read_office on public.priority_call_driver_writes;
create policy priority_call_driver_writes_read_office on public.priority_call_driver_writes
  for select to authenticated using ((select public.is_office_staff()));

create or replace function public.enqueue_call_driver_from_stop()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_docno text;
  v_name text := btrim(coalesce(new.driver::text, ''));
begin
  begin
    if new.service_call_id is null or v_name = '' or new.status = 'cancelled' then
      return new;
    end if;
    if tg_op = 'UPDATE'
       and new.driver is not distinct from old.driver
       and new.service_call_id is not distinct from old.service_call_id then
      return new;
    end if;

    select sc.priority_call_id into v_docno
      from public.service_calls sc where sc.id = new.service_call_id;
    if v_docno is null or v_docno !~ '^SC[0-9]+$' then
      return new;
    end if;

    insert into public.priority_call_driver_writes
      (priority_call_id, service_call_id, calendar_stop_id, driver_name)
    values (v_docno, new.service_call_id, new.id, v_name)
    on conflict (priority_call_id)
    do update set driver_name = excluded.driver_name,
                  service_call_id = excluded.service_call_id,
                  calendar_stop_id = excluded.calendar_stop_id,
                  state = 'pending', requested_at = now(),
                  attempts = 0, http_status = null, error = null;
  exception when others then
    -- 🔴 לעולם לא מפילים את השיבוץ בגלל התור.
    raise warning 'enqueue_call_driver_from_stop: %', sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.enqueue_call_driver_from_stop() from public, anon, authenticated;

drop trigger if exists trg_enqueue_call_driver on public.calendar_stops;
create trigger trg_enqueue_call_driver
  after insert or update of driver, service_call_id on public.calendar_stops
  for each row execute function public.enqueue_call_driver_from_stop();

-- ── הקרון: כל 5 דקות (בהיסט של 2 דקות מכתיבת הסטטוסים), רק כשיש שורה ממתינה ──
do $$
declare
  fn text := 'https://kukstfxtznymfkirdmty.supabase.co/functions/v1/rashal-call-status';
  anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a3N0Znh0em55bWZraXJkbXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNDQ2MjMsImV4cCI6MjA5MTgyMDYyM30.oF-pwjnAki4LiDE8nLa6SIjHHP_tLvsoZwEyxlu2f6E';
begin
  perform cron.schedule('rashal-call-driver-name', '2-59/5 * * * *', format(
    $c$select net.http_post(url:=%L, headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s','x-sync-secret', public.sync_secret()), body:='{"mode":"driver-live","max":40}'::jsonb, timeout_milliseconds:=150000) where exists (select 1 from public.priority_call_driver_writes where state = 'pending')$c$,
    fn, anon));
end $$;
