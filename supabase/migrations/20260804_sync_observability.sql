-- מערך הלוגים של הסנכרון הישיר (מחליף את היסטוריית הריצות של Make)
-- MAKE-MIGRATION-PLAN §4: sync_runs = ריצה, sync_events = קריאה בודדת.

create table if not exists public.sync_runs (
  id bigint generated always as identity primary key,
  job text not null,                       -- pull-core | pull-pickups | pull-pickup-addresses | push-chat
  trigger_source text not null default 'cron',  -- cron | manual | backfill
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',  -- running | success | partial | error
  rows_fetched int not null default 0,
  rows_upserted int not null default 0,
  retries int not null default 0,
  watermark_before jsonb,
  watermark_after jsonb,
  error_summary text,
  duration_ms int
);

create table if not exists public.sync_events (
  id bigint generated always as identity primary key,
  run_id bigint references public.sync_runs(id) on delete cascade,
  created_at timestamptz not null default now(),
  entity text not null,          -- customers | orders | service_calls | pickups_lines | pickups_addresses | push_write | inbox_post | watermarks
  attempt int not null default 1,
  http_status int,
  ok boolean not null default false,
  duration_ms int,
  rows int,
  url_path text,                 -- הנתיב בלי סודות
  error_snippet text
);

create index if not exists sync_runs_job_started_idx on public.sync_runs (job, started_at desc);
create index if not exists sync_events_run_idx on public.sync_events (run_id);

-- נעול: service_role בלבד (אין policies; anon/authenticated לא קוראים)
alter table public.sync_runs enable row level security;
alter table public.sync_events enable row level security;

-- מצב התראות פר-job (למניעת מייל בכל שעה + זיהוי התאוששות)
create table if not exists public.sync_alerts (
  job text primary key,
  state text not null default 'ok',      -- ok | alerting
  last_alerted_at timestamptz,
  last_recovered_at timestamptz,
  detail text,
  updated_at timestamptz not null default now()
);
alter table public.sync_alerts enable row level security;
