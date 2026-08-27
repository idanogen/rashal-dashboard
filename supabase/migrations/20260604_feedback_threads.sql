-- ראה migration שהוחל ב-Supabase: feedback_threads_system (04/06/2026)
-- לוח ההערות הפנימי: כל משתמש פותח שרשור, כולם רואים הכל, מנהל מערכת
-- עונה בכל שרשור, ופותח השרשור עונה בשלו. תמונות דרך Storage.
--
-- 🔴 **הקובץ הזה שוחזר מהמסד ב-27/08/2026 אחרי שהתגלה שהוא חסר.**
-- המיגרציה הוחלה דרך הכלי ולא נשמרה כקובץ, ולכן המאגר הפסיק לתאר את
-- הסכימה בלי שום שגיאה, כבר כמעט שלושה חודשים.

create table if not exists public.feedback_threads (
  id          uuid primary key default gen_random_uuid(),
  created_by  uuid not null references auth.users(id) on delete cascade,
  subject     text,
  status      text not null default 'open' check (status in ('open','resolved')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.feedback_messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.feedback_threads(id) on delete cascade,
  author_id   uuid not null references auth.users(id) on delete cascade,
  body        text,
  image_path  text,
  created_at  timestamptz not null default now(),
  -- ⭐ הודעה חייבת להיות טקסט או תמונה. שורה ריקה לגמרי היא תקלה, לא תוכן.
  constraint feedback_message_not_empty
    check (coalesce(btrim(body), '') <> '' or image_path is not null)
);

create index if not exists feedback_messages_thread_idx on public.feedback_messages(thread_id, created_at);
create index if not exists feedback_threads_updated_idx on public.feedback_threads(updated_at desc);

-- ⭐ הודעה חדשה מקפיצה את `updated_at` של השרשור, ולכן הרשימה ממוינת
-- לפי פעילות אמיתית ולא לפי מועד הפתיחה.
create or replace function public.bump_feedback_thread() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.feedback_threads set updated_at = now() where id = new.thread_id;
  return new;
end; $$;

drop trigger if exists feedback_message_bumps_thread on public.feedback_messages;
create trigger feedback_message_bumps_thread
  after insert on public.feedback_messages
  for each row execute function public.bump_feedback_thread();

alter table public.feedback_threads enable row level security;
alter table public.feedback_messages enable row level security;

-- כל מי שמחובר רואה את כל השרשורים וההודעות: זה לוח שקוף בכוונה.
drop policy if exists feedback_threads_select on public.feedback_threads;
create policy feedback_threads_select on public.feedback_threads
  for select to authenticated using (true);

drop policy if exists feedback_messages_select on public.feedback_messages;
create policy feedback_messages_select on public.feedback_messages
  for select to authenticated using (true);

-- כל מי שמחובר פותח שרשור, בשמו שלו.
drop policy if exists feedback_threads_insert on public.feedback_threads;
create policy feedback_threads_insert on public.feedback_threads
  for insert to authenticated with check (created_by = auth.uid());

-- 🔴 תגובה: מנהל מערכת בכל שרשור, ופותח השרשור בשלו בלבד. ובשני המקרים
-- `author_id` חייב להיות המשתמש עצמו, אחרת אפשר לחתום בשם מישהו אחר.
drop policy if exists feedback_messages_insert on public.feedback_messages;
create policy feedback_messages_insert on public.feedback_messages
  for insert to authenticated with check (
    author_id = auth.uid()
    and (
      public.is_admin()
      or exists (
        select 1 from public.feedback_threads t
        where t.id = thread_id and t.created_by = auth.uid()
      )
    )
  );

drop policy if exists feedback_threads_update on public.feedback_threads;
create policy feedback_threads_update on public.feedback_threads
  for update to authenticated
  using (public.is_admin() or created_by = auth.uid())
  with check (public.is_admin() or created_by = auth.uid());

drop policy if exists feedback_threads_delete on public.feedback_threads;
create policy feedback_threads_delete on public.feedback_threads
  for delete to authenticated using (public.is_admin() or created_by = auth.uid());

drop policy if exists feedback_messages_delete on public.feedback_messages;
create policy feedback_messages_delete on public.feedback_messages
  for delete to authenticated using (public.is_admin() or author_id = auth.uid());

-- Realtime
-- 🔴 `add table` על טבלה שכבר בפרסום מרים שגיאה, ולכן הבלוק מותנה.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'feedback_threads'
  ) then
    alter publication supabase_realtime add table public.feedback_threads;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'feedback_messages'
  ) then
    alter publication supabase_realtime add table public.feedback_messages;
  end if;
end $$;
