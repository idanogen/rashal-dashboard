-- קריאה צרה למרכז השירות בדנה (19/11/2026): מצב כל התראה ב-sync_alerts, כדי שהקרון הלילי
-- של דנה יפתח כרטיס על התראה שתקועה במצב alerting יותר מ-48 שעות (מנגנון שכבר מתריע לא מתריע שוב).
-- הגישה בטוקן: כאן נשמר רק ה-sha256 שלו, הטוקן עצמו בטבלת svc_alert_sources בדנה.
create table if not exists public.svc_reader_tokens (
  token_sha256 text primary key,
  label text,
  created_at timestamptz not null default now()
);
alter table public.svc_reader_tokens enable row level security;

-- since: מתי ההתראה נכנסה למצב הנוכחי. updated_at לא זז כל עוד המצב לא משתנה,
-- ו-last_alerted_at מכסה שורות שבהן updated_at נכתב לפני ההתראה.
create or replace function public.svc_alert_states(p_token text)
returns table (key text, state text, since timestamptz, detail text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_token is null or not exists (
    select 1 from public.svc_reader_tokens t
    where t.token_sha256 = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
  ) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  return query
    select a.job, a.state, least(a.updated_at, coalesce(a.last_alerted_at, a.updated_at)), left(a.detail, 300)
    from public.sync_alerts a;
end;
$$;

revoke all on function public.svc_alert_states(text) from public;
grant execute on function public.svc_alert_states(text) to anon, authenticated;
