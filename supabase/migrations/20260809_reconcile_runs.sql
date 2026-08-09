-- ריצת ההשוואה מול פריוריטי · 09/08/2026
--
-- המשיכות הרגילות הפרשיות בלבד: כל אחת שואלת רק על מה שזז מאז הווטרמרק.
-- רשומה שנוצרה לפני שהסנכרון התחיל, או שהווטרמרק דילג עליה, לא תיכנס לעולם
-- ואף אחד לא ידע. הוואצ'דוג לא תופס את זה כי הוא סופר ריצות מוצלחות.
-- ריצת ההשוואה מושכת את המצב המלא של חלון זמן ומשווה מול מה שיש לנו.

create table if not exists public.reconcile_runs (
  id            bigserial primary key,
  ran_at        timestamptz not null default now(),
  window_days   integer     not null,
  rows_checked  integer     not null default 0,
  missing_real  integer     not null default 0,
  summary       jsonb,
  details       jsonb
);

create index if not exists reconcile_runs_ran_at_idx
  on public.reconcile_runs (ran_at desc);

alter table public.reconcile_runs enable row level security;

drop policy if exists authenticated_read_reconcile_runs on public.reconcile_runs;
create policy authenticated_read_reconcile_runs
  on public.reconcile_runs for select to authenticated using (true);

comment on table public.reconcile_runs is
  'ריצת ההשוואה היומית מול פריוריטי. missing_real = רשומות שנפתחו לפני היום וחסרות אצלנו. רשומות מהיום לא נספרות (פיגור רגיל בין ריצות).';

-- pg_cron job 8 (הורץ ידנית, מתועד כאן כמקור אמת):
--   cron.schedule('rashal-reconcile-daily', '0 6 * * 0-4', ...)
--   POST rashal-sync {"job":"reconcile-daily","days":30}
--   06:00 UTC = 09:00 שעון ישראל, ראשון עד חמישי, אחרי שתי ריצות סנכרון.
