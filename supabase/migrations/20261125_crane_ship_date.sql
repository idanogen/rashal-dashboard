-- מאגר המנופים: שעון שלוש השנים נספר מהמשלוח ללקוח האחרון (עידן בפגישה 25/11/2026).
--
-- "ת. התקנה" שמגיע מהאקסל הוא INSTDATE של כרטיס המכשיר, ולא מתעדכן כשמנוף חוזר מלקוח
-- ונשלח ללקוח חדש. התאריך הנכון יושב בתת-הטופס "לוג תנועות למכשיר"
-- (SERNUMBERS → SERNTRANSENV_SUBFORM), בשורת "משלוחים ללקוח" האחרונה.
-- 🔴 SHIPDATE שעל כרטיס המכשיר עצמו לא מספיק: ריק ב-438 מנופים שיש להם משלוח בלוג (25/11).
-- בדיקה ב-25/11 על 2,000 מנופים: אצל 1,023 התאריך שלנו ישן מהמשלוח האחרון.
--
-- המשיכה: הפונקציה rashal-crane-dates (קרון לילי) → crane_apply_ship_dates.
alter table public.cranes add column if not exists ship_date date;
alter table public.cranes add column if not exists ship_doc text;
alter table public.cranes add column if not exists returned_at date;
alter table public.cranes add column if not exists ship_synced_at timestamptz;

comment on column public.cranes.ship_date is
  'המשלוח ללקוח האחרון מלוג התנועות של המכשיר בפריוריטי. ממנו סופרים שלוש שנים לבדיקה התקופתית.';
comment on column public.cranes.returned_at is
  'החזרה מלקוח האחרונה בלוג. מאוחרת מ-ship_date = המנוף חזר ולא נשלח שוב.';

-- p: [{"sn":"…","ship":"YYYY-MM-DD"|null,"doc":"SH…"|null,"ret":"YYYY-MM-DD"|null}, …]
-- מעדכן רק מנופים קיימים, ורק כשמשהו השתנה (בלי realtime מיותר). מחזיר כמה שורות עודכנו.
create or replace function public.crane_apply_ship_dates(p jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with src as (
    select x->>'sn' sn, (x->>'ship')::date ship, x->>'doc' doc, (x->>'ret')::date ret
      from jsonb_array_elements(p) x
  ), upd as (
    update public.cranes c
       set ship_date = s.ship, ship_doc = s.doc, returned_at = s.ret, ship_synced_at = now()
      from src s
     where c.device_number = s.sn
       and (c.ship_date is distinct from s.ship or c.ship_doc is distinct from s.doc
            or c.returned_at is distinct from s.ret)
    returning 1
  )
  select count(*) into n from upd;
  update public.cranes c set ship_synced_at = now()
    from (select x->>'sn' sn from jsonb_array_elements(p) x) s where c.device_number = s.sn;
  return n;
end $$;
revoke all on function public.crane_apply_ship_dates(jsonb) from public, anon, authenticated;

-- לילי 03:20 שעון ישראל (00:20/01:20 UTC לפי עונה; פעמיים לא מזיק, העדכון אידמפוטנטי).
select cron.unschedule(jobid) from cron.job where jobname = 'rashal-crane-dates';
select cron.schedule('rashal-crane-dates', '20 0 * * *', $cron$
  select net.http_post(
    url := 'https://kukstfxtznymfkirdmty.supabase.co/functions/v1/rashal-crane-dates',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a3N0Znh0em55bWZraXJkbXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNDQ2MjMsImV4cCI6MjA5MTgyMDYyM30.oF-pwjnAki4LiDE8nLa6SIjHHP_tLvsoZwEyxlu2f6E',
      'x-sync-secret', public.sync_secret()),
    body := '{"trigger":"cron"}'::jsonb, timeout_milliseconds := 150000)
$cron$);
