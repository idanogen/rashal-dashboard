-- ─── אפליקציה בלי קליטה: דיווח מכשיר ומחר מהערב (28/10/2026, שלבים 1-4) ───
--
-- (א) כל מכשיר מדווח בכל סנכרון שורה קטנה: מתי סנכרן, כמה ממתין בתור, כמה
--     נדחה, איזו גרסה רצה. המשרד רואה "דיווח לאחרונה 09:31 · 2 ממתינות", וכך
--     נהג שלא דיווח שעתיים הוא בלי קליטה ולא נעלם. הוואצ'דוג מתריע על פעולה
--     שממתינה מעל שעתיים אצל מכשיר שכן סנכרן בינתיים (זו תקלה, לא קליטה).
-- (ב) "מחר מהערב": `driver_stop_visible` (ב-`20260909_drivers_today_only.sql`,
--     קובץ אחד לפונקציה) חושפת לנהג גם את מחר מ-16:00 שעון ישראל, כדי שהמחסן
--     יתמלא לפני שיוצאים לאזור בלי קליטה. המסך עצמו ממשיך להציג רק את היום.

create table if not exists public.driver_sync_reports (
  profile_id uuid primary key,
  driver_name text,
  device text,
  app_label text,
  last_sync_at timestamptz not null default now(),
  pending integer not null default 0,
  rejected integer not null default 0,
  oldest_pending_at timestamptz,
  online boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.driver_sync_reports enable row level security;
drop policy if exists driver_sync_reports_read on public.driver_sync_reports;
create policy driver_sync_reports_read on public.driver_sync_reports
  for select to authenticated using ((select public.is_office_staff()) or profile_id = auth.uid());

create or replace function public.driver_sync_report(
  p_device text, p_app_label text, p_pending integer, p_rejected integer, p_oldest_pending_at timestamptz, p_online boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;
  insert into public.driver_sync_reports (profile_id, driver_name, device, app_label, last_sync_at, pending, rejected, oldest_pending_at, online, updated_at)
  values (auth.uid(), public.current_user_driver(), p_device, p_app_label, now(), coalesce(p_pending, 0), coalesce(p_rejected, 0), p_oldest_pending_at, coalesce(p_online, true), now())
  on conflict (profile_id) do update set
    driver_name = excluded.driver_name, device = excluded.device, app_label = excluded.app_label,
    last_sync_at = now(), pending = excluded.pending, rejected = excluded.rejected,
    oldest_pending_at = excluded.oldest_pending_at, online = excluded.online, updated_at = now();
end;
$$;
revoke all on function public.driver_sync_report(text, text, integer, integer, timestamptz, boolean) from public, anon;
grant execute on function public.driver_sync_report(text, text, integer, integer, timestamptz, boolean) to authenticated;
