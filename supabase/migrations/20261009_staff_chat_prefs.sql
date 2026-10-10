-- ─── סדר ונעיצה ברשימת צ'אט הצוות, לכל עובד (עידן, 09/10/2026) ──────────
-- "תן אפשרות לעובדים לנהל את סדר הרשימה וגם לנעוץ עובדים לראש הרשימה."
-- ⭐ במסד ולא ב-localStorage: הסדר של העובד עובר איתו מהדשבורד לאפליקציה ולמחשב אחר.
create table if not exists public.staff_chat_prefs (
  user_id    uuid primary key references public.profiles(id),
  pinned     uuid[] not null default '{}',
  sort_order uuid[] not null default '{}',
  updated_at timestamptz not null default now()
);
comment on table public.staff_chat_prefs is 'העדפות רשימת צ''אט הצוות לכל עובד: נעוצים וסדר ידני (09/10/2026).';
alter table public.staff_chat_prefs enable row level security;
drop policy if exists staff_chat_prefs_own on public.staff_chat_prefs;
create policy staff_chat_prefs_own on public.staff_chat_prefs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
