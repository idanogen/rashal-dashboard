-- ראה migration שהוחל ב-Supabase: screen_load_log (27/08/2026)
-- מדידת זמן הטעינה של מסכים, ומה שורף אותו.
--
-- ⭐ **נולד מהתלונה של עמי:** מסך הסדרן הראה "אין הזמנות ממתינות לתיאום"
-- בזמן ש-829 הזמנות ישבו במסד, **ולא הייתה שום דרך לדעת מה קרה בדפדפן
-- שלו.** מדידה שחיה רק בקונסולה של המשתמש אינה מדידה.
--
-- 🔴 **נרשם רק מה שמסביר תלונה:** שליפה שנכשלה, או טעינה מעל 4 שניות.
-- עשרה עובדים שפותחים את המסך עשר פעמים ביום הם 100 שורות רעש ליום,
-- ורעש הוא הדרך הבטוחה לכך שאיש לא יסתכל בטבלה.

create table if not exists public.screen_load_log (
  id uuid primary key default gen_random_uuid(),
  screen text not null,
  total_ms integer not null,
  -- ⭐ השליפה שנגמרה אחרונה. היא הנתיב הקריטי, והיא היחידה ששווה לייעל:
  -- השליפות רצות במקביל, ולכן הכבדה ביותר אינה בהכרח זו שקובעת.
  critical_fetch text,
  critical_ms integer,
  total_rows integer,
  -- כל עמוד של 1,000 שורות הוא סבב רשת שמחכה לקודמו, וזה מה שמצטבר.
  total_pages integer,
  parallelism numeric,
  failures text[] not null default '{}',
  verdict text,
  marks jsonb,
  user_agent text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists screen_load_log_recent_idx
  on public.screen_load_log (created_at desc);

-- 🔴 אינדקס חלקי על הכשלים: זו השאילתה היחידה שנריץ בדחיפות.
create index if not exists screen_load_log_failures_idx
  on public.screen_load_log (created_at desc)
  where cardinality(failures) > 0;

alter table public.screen_load_log enable row level security;

-- ⭐ כל מי שמחובר כותב את המדידה של עצמו, כולל נהג. זו כל הנקודה:
-- התלונה מגיעה מהשטח, ולכן המדידה חייבת להגיע משם גם היא.
drop policy if exists anyone_logs_own_load on public.screen_load_log;
create policy anyone_logs_own_load on public.screen_load_log
  for insert to authenticated with check (true);

-- 🔴 אבל קריאה למי שמנהל בלבד. זה יומן תפעולי ולא נתון של המשתמש.
drop policy if exists managers_read_load_log on public.screen_load_log;
create policy managers_read_load_log on public.screen_load_log
  for select to authenticated using (public.is_admin_or_dispatcher());

comment on table public.screen_load_log is
  'מדידת זמן טעינה של מסכים. נרשם רק כשיש מה לספר: שליפה שנכשלה, או טעינה מעל 4 שניות. נולד 27/08/2026 אחרי שלא הייתה שום דרך לדעת למה מסך הסדרן היה ריק אצל עמי.';
