-- ─── משימות למשרד (הרעיון של עידן, אושר 08/10/2026) ──────────────────────
--
-- "מנהל יכול לפתוח משימות לעובד, ושם העובד מנהל את זה."
--
-- 🔴 למה טבלה משלה ולא עצירת `task` ב-`calendar_stops`, אף שזה מה שהצעתי
-- בהתחלה: (1) האינדקס `calendar_stops_no_active_dup_v2` מרשה עצירה פעילה
-- אחת לכל לקוח לכל סוג, ושתי משימות משרד פתוחות על אותו לקוח הן דבר
-- רגיל. (2) נציגות המשרד (אילונה, שורה, קוסאי) הן `viewer`, שיש לו רק
-- קריאה על העצירות, והמשימה צריכה שהעובד יסגור אותה בעצמו. (3) עצירה
-- היא נסיעה ביום של נהג, והיא מצוירת כמסלול; משימת משרד היא שורה ברשימה.
-- משימת שטח (ביקור) נשארת עצירה ביומן כמו היום; כאן רק מה שנעשה מהכיסא.
--
-- הרשאות: כל צוות המשרד (`is_office_staff`, כולל viewer) רואה את כל
-- המשימות ופותח משימה. סגירה ועריכה: המבצע, מי שפתח, ומנהלים.

create table if not exists public.office_tasks (
  id              uuid primary key default gen_random_uuid(),
  title           text not null check (btrim(title) <> ''),
  details         text,
  customer_number text,
  customer_name   text,
  assignee_id     uuid not null references public.profiles(id),
  assignee_name   text not null,
  created_by      uuid references public.profiles(id),
  created_by_name text,
  due_date        date,
  priority        text not null default 'normal' check (priority in ('normal', 'high')),
  status          text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  done_at         timestamptz,
  done_by         text,
  done_note       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
comment on table public.office_tasks is 'משימות משרד: מנהל פותח לעובד, העובד סוגר. לא עצירה ביומן (08/10/2026).';
create index if not exists office_tasks_assignee_open_idx on public.office_tasks (assignee_id) where status = 'open';
create index if not exists office_tasks_status_due_idx on public.office_tasks (status, due_date);

create or replace function public.office_tasks_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists trg_office_tasks_touch on public.office_tasks;
create trigger trg_office_tasks_touch before update on public.office_tasks
  for each row execute function public.office_tasks_touch();

alter table public.office_tasks enable row level security;

drop policy if exists office_tasks_select on public.office_tasks;
create policy office_tasks_select on public.office_tasks
  for select to authenticated using ((select public.is_office_staff()));

drop policy if exists office_tasks_insert on public.office_tasks;
create policy office_tasks_insert on public.office_tasks
  for insert to authenticated
  with check ((select public.is_office_staff()) and created_by = (select auth.uid()));

-- עדכון: המבצע, הפותח, או מנהל (admin · team_manager · management · dispatcher).
drop policy if exists office_tasks_update on public.office_tasks;
create policy office_tasks_update on public.office_tasks
  for update to authenticated
  using (
    (select public.is_office_staff())
    and (
      assignee_id = (select auth.uid())
      or created_by = (select auth.uid())
      or (select public.is_admin_or_dispatcher())
    )
  )
  with check ((select public.is_office_staff()));

-- אין מחיקה: משימה שבוטלה נשארת עם הסטטוס שלה.
revoke delete on public.office_tasks from authenticated, anon;
