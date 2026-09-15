-- כתיבת סטטוס לקריאות שירות בפריוריטי (החלטת עידן, 15/09/2026).
--
-- "סיימתי כאן" של טכנאי → CALLSTATUSCODE='בוצעה', "המשך טיפול" → 'להמשך טיפול',
-- "לא בוצע" → לא כותבים כלום. בהגדרות של ר.שעל "בוצעה" היא סטטוס פעיל ולא סופי,
-- ורק "סופית" נועלת (meetings/rashal/2026-09-15-סטטוסים-לקריאות-שירות-מפריוריטי.xlsx).
--
-- ⭐ הטבלה היא גם התור וגם היומן: כל שורה היא כתיבה אחת מתוכננת, והיא נושאת
-- מה ראינו בפריוריטי לפני, מה כתבנו, ומה קראנו אחרי. כך "מי שינה את זה" נענה
-- משורה אחת, והרשימה של גל ההשלמה קפואה ולא מחושבת מחדש בכל ריצה.
--
-- 🔴 כותבים רק כשהסטטוס שנקרא מפריוריטי ברגע הכתיבה שווה ל-`expected_from`.
-- קריאה שהמשרד כבר קידם (סופית, מבוטלת) מסומנת skipped ולא נדרסת.
--
-- הכותב: Edge Function `rashal-call-status` (דורש x-sync-secret).

create table if not exists public.priority_call_status_writes (
  id bigint generated always as identity primary key,
  source text not null,
  priority_call_id text not null check (priority_call_id ~ '^SC[0-9]+$'),
  service_call_id uuid references public.service_calls(id) on delete set null,
  calendar_stop_id uuid references public.calendar_stops(id) on delete set null,
  technician text,
  visit_completed_at timestamptz,
  expected_from text not null,
  target_status text not null check (target_status in ('בוצעה', 'להמשך טיפול')),
  state text not null default 'pending' check (state in ('pending', 'done', 'skipped', 'failed')),
  seen_status text,
  seen_at timestamptz,
  status_before text,
  status_after text,
  http_status integer,
  error text,
  attempted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source, priority_call_id)
);

create index if not exists priority_call_status_writes_pending_idx
  on public.priority_call_status_writes (source, state) where state = 'pending';

-- תפקיד השירות בלבד: אין מדיניות, ולכן אף משתמש מחובר לא קורא ולא כותב.
alter table public.priority_call_status_writes enable row level security;
