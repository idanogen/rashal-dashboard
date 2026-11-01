-- ─────────────────────────────────────────────────────────────────────────
-- app_events — זרם האירועים של תקופת ההרצה (01/11/2026, תוכנית הלוגים).
-- מי משתמש, באילו מסכים, איזו שגיאה קפצה ואיפה מישהו נתקע, מהאפליקציה
-- ומהדשבורד. בלי מיקום ובלי תוכן הודעות או טפסים. נשמר 90 יום.
-- המסמך: ~/Idan-HQ/meetings/rashal/2026-11-01-תוכנית-לוגים.html
--
-- כתיבה רק דרך log_app_events (המשתמש נקבע מהסשן, לא מהלקוח), קריאה
-- לאדמין בלבד (עידן, בתקופת ההרצה). client_id מהמכשיר מונע כפילות כששליחה
-- חוזרת אחרי ניתוק.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.app_events (
  id           bigint generated always as identity primary key,
  client_id    uuid not null unique,
  occurred_at  timestamptz not null,
  received_at  timestamptz not null default now(),
  user_id      uuid references auth.users(id) on delete set null,
  user_name    text,
  user_role    text,
  app          text not null check (app in ('driver', 'dashboard')),
  app_version  text,
  device       text,
  screen       text,
  kind         text not null check (kind in ('session', 'screen', 'action', 'error', 'stuck', 'form')),
  name         text not null,
  stop_id      uuid,
  detail       jsonb not null default '{}'::jsonb
);

create index if not exists app_events_user_time_idx on public.app_events (user_id, occurred_at desc);
create index if not exists app_events_kind_time_idx on public.app_events (kind, occurred_at desc);
create index if not exists app_events_stop_idx      on public.app_events (stop_id) where stop_id is not null;

alter table public.app_events enable row level security;

drop policy if exists app_events_select_admin on public.app_events;
create policy app_events_select_admin on public.app_events
  for select to authenticated using ((select public.current_user_role()) = 'admin');

-- צרור אירועים מהמכשיר. מחזיר כמה נקלטו. אירוע פגום מדולג ולא מפיל את הצרור,
-- כי צרור שנכשל חוזר מהמכשיר שוב ושוב.
create or replace function public.log_app_events(p_events jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_role text;
  v_count integer := 0;
  e jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if jsonb_typeof(p_events) is distinct from 'array' then
    return 0;
  end if;

  select coalesce(p.linked_driver, p.full_name, p.username), p.role
    into v_name, v_role
    from public.profiles p where p.id = v_uid;

  for e in select value from jsonb_array_elements(p_events) limit 200 loop
    begin
      insert into public.app_events
        (client_id, occurred_at, user_id, user_name, user_role, app, app_version, device, screen, kind, name, stop_id, detail)
      values (
        (e->>'id')::uuid,
        least(coalesce((e->>'at')::timestamptz, now()), now()),
        v_uid, v_name, v_role,
        e->>'app',
        left(e->>'version', 40),
        left(e->>'device', 40),
        left(e->>'screen', 120),
        e->>'kind',
        left(e->>'name', 120),
        nullif(e->>'stopId', '')::uuid,
        coalesce(e->'detail', '{}'::jsonb)
      )
      on conflict (client_id) do nothing;
      if found then v_count := v_count + 1; end if;
    exception when others then
      -- אירוע פגום (מזהה לא תקין, סוג לא מוכר): מדלגים.
      null;
    end;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.log_app_events(jsonb) from public, anon;
grant execute on function public.log_app_events(jsonb) to authenticated;

-- שמירה 90 יום.
select cron.unschedule('app-events-retention')
  where exists (select 1 from cron.job where jobname = 'app-events-retention');
select cron.schedule('app-events-retention', '17 2 * * *',
  $$delete from public.app_events where occurred_at < now() - interval '90 days'$$);
