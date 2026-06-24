-- ─────────────────────────────────────────────────────────────────────────
-- activity_events — לוג כל פעולה משמעותית במערכת (בדגש על נהגים),
-- למדידת עבודה ולהפקת דוחות. רשומה לכל לחיצה/פעולה.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.activity_events (
  id            uuid primary key default gen_random_uuid(),
  occurred_at   timestamptz not null default now(),   -- מתי הפעולה קרתה
  actor_id      uuid references auth.users(id) on delete set null,
  actor_name    text,        -- denormalized: linkedDriver / fullName / username
  actor_role    text,        -- 'driver' | 'dispatcher' | 'admin' | 'viewer'
  action        text not null,  -- 'stop_completed' | 'stop_not_completed' | 'navigate' | 'call' | 'coordinate_open' | 'chat_open' | 'login' ...
  entity_type   text,        -- 'calendar_stop' | 'order' | 'service_call' | 'route' | null
  entity_id     uuid,        -- מזהה הרשומה (ללא FK — הלוג נשמר גם אם המקור נמחק)
  source_type   text,        -- 'delivery' | 'service' | 'task' | null
  customer_name text,        -- denormalized לדוחות מהירים
  metadata      jsonb not null default '{}'::jsonb  -- סיבה / עיר / משך / כל הקשר נוסף
);

create index if not exists activity_events_actor_time_idx on public.activity_events (actor_name, occurred_at desc);
create index if not exists activity_events_action_idx      on public.activity_events (action);
create index if not exists activity_events_time_idx        on public.activity_events (occurred_at desc);
create index if not exists activity_events_entity_idx      on public.activity_events (entity_type, entity_id);

alter table public.activity_events enable row level security;

-- משתמש מחובר רשאי לרשום אירועים ולקרוא את כולם (דוחות במוקד)
drop policy if exists activity_events_insert_authenticated on public.activity_events;
create policy activity_events_insert_authenticated
  on public.activity_events for insert to authenticated with check (true);

drop policy if exists activity_events_select_authenticated on public.activity_events;
create policy activity_events_select_authenticated
  on public.activity_events for select to authenticated using (true);
