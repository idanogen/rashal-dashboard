-- סנכרון פריוריטי, 07/09/2026: הבחירות של עידן אחרי החקירה.
--   1. הסוד של rashal-sync ב-Vault, כדי ש-pg_cron יצרף אותו לכותרת ואף פקודת
--      תזמון לא תכיל אותו. הפונקציה עצמה זורעת אותו (job "seed-vault").
--   2. sync_freshness(): מה שהכותרת שואלת פעם בדקה: מתי המשיכה האחרונה
--      הצליחה, ומה ה-max(updated_at) של כל טבלה, כדי לרענן רק מה שזז.
--   3. תיקון השעון: STARTDATE/UDATE נשמרו כשעון ישראל מסומן UTC. מזיזים את
--      ההיסטוריה פעם אחת (רק ערכים עם שעה אמיתית, לא תאריכים).
--   4. לוח הזמנים: ליבה כל 5 דקות, 07:00 עד 19:00 שעון ישראל גם בחורף,
--      שישי 07:00 עד 13:00, ריצת ערב, קריאה מלאה יומית של שבועיים, חשבוניות
--      30 יום בשעתית ו-120 בלילית.

-- ── 1. הסוד ב-Vault ─────────────────────────────────────────────────────────
create or replace function public.sync_secret_seed(p_value text)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_id uuid;
begin
  if coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role', '') <> 'service_role' then
    raise exception 'service role only';
  end if;
  if p_value is null or length(p_value) < 16 then
    raise exception 'value too short';
  end if;
  select id into v_id from vault.secrets where name = 'rashal_sync_secret';
  if v_id is null then
    perform vault.create_secret(p_value, 'rashal_sync_secret',
      'x-sync-secret של rashal-sync. נזרע על ידי הפונקציה עצמה (job seed-vault).');
    return 'created';
  end if;
  perform vault.update_secret(v_id, p_value);
  return 'updated';
end $$;
revoke all on function public.sync_secret_seed(text) from public;
revoke all on function public.sync_secret_seed(text) from anon, authenticated;
grant execute on function public.sync_secret_seed(text) to service_role;

-- הקורא: רק בעל המסד (pg_cron רץ כ-postgres). אף תפקיד של PostgREST לא מקבל.
create or replace function public.sync_secret()
returns text
language sql
security definer
stable
set search_path = public, vault
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'rashal_sync_secret' limit 1
$$;
revoke all on function public.sync_secret() from public;
revoke all on function public.sync_secret() from anon, authenticated, service_role;

-- ── 2. טריות לכותרת ───────────────────────────────────────────────────────
create index if not exists orders_updated_at_idx on public.orders (updated_at);
create index if not exists service_calls_updated_at_idx on public.service_calls (updated_at);
create index if not exists pickups_updated_at_idx on public.pickups (updated_at);
create index if not exists calendar_stops_updated_at_idx on public.calendar_stops (updated_at);
create index if not exists routes_updated_at_idx on public.routes (updated_at);

-- המפתחות במפה הם מפתחות ה-query בדשבורד. שינוי שם כאן שובר את הרענון בשקט.
create or replace function public.sync_freshness()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object(
    'pull_at', (select max(started_at) from public.sync_runs where job = 'pull-core' and status = 'success'),
    'pull_status', (select status from public.sync_runs where job = 'pull-core' order by started_at desc limit 1),
    'marks', jsonb_build_object(
      'orders',        (select max(updated_at) from public.orders),
      'serviceCalls',  (select max(updated_at) from public.service_calls),
      'pickups',       (select max(updated_at) from public.pickups),
      'calendarStops', (select max(updated_at) from public.calendar_stops),
      'routes',        (select max(updated_at) from public.routes)
    )
  )
$$;
revoke all on function public.sync_freshness() from public;
revoke all on function public.sync_freshness() from anon;
grant execute on function public.sync_freshness() to authenticated, service_role;

-- ── 3. תיקון השעון בהיסטוריה ───────────────────────────────────────────────
-- ערך שנשמר מפריוריטי הוא בדיוק על דקה (שניות אפס) ואינו חצות. ערך שנוצר
-- אצלנו (now()) נושא מיקרו-שניות ולכן לא נוגעים בו. חצות = תאריך בלבד.
update public.service_calls
   set created_at = (created_at at time zone 'UTC') at time zone 'Asia/Jerusalem'
 where priority_call_id is not null
   and date_trunc('minute', created_at) = created_at
   and (created_at at time zone 'UTC')::time <> '00:00:00';

update public.pickups
   set priority_udate = (priority_udate at time zone 'UTC') at time zone 'Asia/Jerusalem'
 where priority_pickup_id is not null
   and priority_udate is not null
   and date_trunc('minute', priority_udate) = priority_udate
   and (priority_udate at time zone 'UTC')::time <> '00:00:00';

update public.delivery_notes
   set priority_udate = (priority_udate at time zone 'UTC') at time zone 'Asia/Jerusalem'
 where priority_udate is not null
   and date_trunc('minute', priority_udate) = priority_udate
   and (priority_udate at time zone 'UTC')::time <> '00:00:00';

-- ── 4. לוח הזמנים ──────────────────────────────────────────────────────────
-- pg_cron ב-UTC. 4 עד 17 UTC = 07:00 עד 20:59 בקיץ ו-06:00 עד 19:59 בחורף,
-- כלומר 07:00 עד 19:00 שעון ישראל מכוסה בשני העונות. שישי 4 עד 10 UTC.
do $$
declare
  fn_sync text := 'https://kukstfxtznymfkirdmty.supabase.co/functions/v1/rashal-sync';
  anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a3N0Znh0em55bWZraXJkbXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNDQ2MjMsImV4cCI6MjA5MTgyMDYyM30.oF-pwjnAki4LiDE8nLa6SIjHHP_tLvsoZwEyxlu2f6E';
  hdr text;
  cmd text;
  j record;
begin
  -- הכותרת נבנית בזמן הריצה, והסוד נקרא מה-Vault ולא נכתב כאן.
  hdr := format($h$jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s','x-sync-secret', public.sync_secret())$h$, anon);

  perform cron.unschedule(jobname) from cron.job
    where jobname in ('rashal-pull-core-1800il', 'rashal-pull-core-weekend');

  for j in select * from (values
    ('rashal-pull-core',              '*/5 4-17 * * 0-4',  '{"job":"pull-core","trigger":"cron"}', 300000),
    ('rashal-pull-core-friday',       '*/20 4-10 * * 5',   '{"job":"pull-core","trigger":"cron"}', 300000),
    ('rashal-pull-core-evening',      '0 18,19 * * 0-4',   '{"job":"pull-core","trigger":"cron"}', 300000),
    ('rashal-pull-core-saturday',     '0 7 * * 6',         '{"job":"pull-core","trigger":"cron"}', 300000),
    ('rashal-pull-pickups',           '0,30 4-17 * * 0-4', '{"job":"pull-pickups","trigger":"cron"}', 300000),
    ('rashal-pull-pickups-friday',    '0,30 4-10 * * 5',   '{"job":"pull-pickups","trigger":"cron"}', 300000),
    ('rashal-pull-pickup-addresses',  '15,45 4-17 * * 0-4','{"job":"pull-pickup-addresses","trigger":"cron"}', 300000),
    ('rashal-pull-pickup-addresses-friday', '15,45 4-10 * * 5', '{"job":"pull-pickup-addresses","trigger":"cron"}', 300000),
    ('rashal-pull-docs',              '10 4-17 * * 0-4',   '{"job":"pull-docs","invoiceDays":30,"trigger":"cron"}', 300000),
    ('rashal-pull-docs-deep',         '40 3 * * 0-5',      '{"job":"pull-docs","invoiceDays":120,"trigger":"cron"}', 300000),
    ('rashal-refresh-recent',         '20 3 * * 0-5',      '{"job":"refresh-recent","trigger":"cron"}', 300000),
    ('rashal-reconcile-daily',        '0 6 * * 0-4',       '{"job":"reconcile-daily","days":30,"trigger":"cron"}', 280000),
    ('rashal-customers-scan-a',       '0 2 1,15 * *',      '{"job":"backfill","entity":"customers_all","from":"-","to":"-","startPage":0,"maxPages":11,"trigger":"cron"}', 180000),
    ('rashal-customers-scan-b',       '15 2 1,15 * *',     '{"job":"backfill","entity":"customers_all","from":"-","to":"-","startPage":11,"maxPages":40,"trigger":"cron"}', 180000)
  ) as t(name, sched, body, tmo)
  loop
    cmd := format($c$select net.http_post(url:=%L, headers:=%s, body:=%L::jsonb, timeout_milliseconds:=%s)$c$,
                  fn_sync, hdr, j.body, j.tmo);
    perform cron.schedule(j.name, j.sched, cmd);
  end loop;
end $$;
