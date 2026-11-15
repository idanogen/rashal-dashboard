-- ─── קריאות שחוזרות מהקו: הכרעה של המשרד ורכש חלקים (15/11/2026) ─────────
--
-- עמי (שיחה עם עידן 15/11, ואחריה הודעה בוואטסאפ 12:07): בקריאות שחוזרות יש
-- בלגן, לא ברור מה עושים עם כל אחת. ארבעה סטטוסים להמשכי טיפול, בנוסח שלו:
--   1. לקוח לא בבית
--   2. המשך טיפול, קריאה חוזרת (חוסר ציוד, ציוד לא מתאים וכד')
--   3. המשך טיפול, רכש אלכס מחסן
--   4. המשך טיפול, רכש אלכס בית מלאכה
-- עמי או אבירם מכריעים על ביקור שחזר; רכש עובר לעמוד של האלכס המתאים, שמסמן
-- הוזמן (עם צפי), הגיע, או לא ניתן להשיג. כשהחלק הגיע הקריאה חוזרת לראש מסך
-- הקריאות, והשיבוץ סוגר את הבקשה לבד (הטריגר בסוף הקובץ).
--
-- 🔴 אין שום כתיבה לפריוריטי מכאן (הכרעת עידן 15/11). הטבלה לא נוגעת
-- ב-`calendar_stops` ולכן לא מפעילה את טריגרי הסטטוס שכותבים לקריאה.
--
-- שורה אחת לכל ביקור שחזר (`stop_id` ייחודי). הכרעה מחדש = עדכון אותה שורה.
-- פרטי הקריאה נצרבים בשרת ברגע ההכרעה (טריגר), כדי שהעמוד של אלכס לא יהיה
-- תלוי בחלון הנתונים של הקריאות ולא יסמוך על מה שהדפדפן שלח.

create table if not exists public.call_followups (
  id                uuid primary key default gen_random_uuid(),
  stop_id           uuid not null unique references public.calendar_stops(id) on delete cascade,
  service_call_id   uuid references public.service_calls(id) on delete set null,
  kind              text not null check (kind in ('not_home', 'revisit', 'buy_warehouse', 'buy_workshop')),
  -- רכש: מה צריך (ממולא מההערה של הטכנאי), דחיפות, הערה לאלכס. קריאה חוזרת: מה חסר.
  item              text,
  urgency           text not null default 'normal' check (urgency in ('normal', 'urgent')),
  note              text,
  status            text not null default 'open'
                    check (status in ('open', 'ordered', 'arrived', 'unavailable', 'closed')),
  eta               date,
  po_number         text,
  unavailable_note  text,
  closed_reason     text,
  -- מי ומתי, לציר ההיסטוריה בכרטיס
  decided_by        uuid references public.profiles(id),
  decided_by_name   text,
  decided_at        timestamptz not null default now(),
  ordered_by_name   text,
  ordered_at        timestamptz,
  arrived_by_name   text,
  arrived_at        timestamptz,
  unavailable_by_name text,
  unavailable_at    timestamptz,
  closed_at         timestamptz,
  -- תמונת מצב של הקריאה והביקור ברגע ההכרעה (נכתבת בטריגר)
  customer_name     text,
  customer_number   text,
  city              text,
  call_docno        text,
  device            text,
  tech_name         text,
  tech_note         text,
  visit_date        date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
comment on table public.call_followups is
  'הכרעת המשרד על ביקור שירות שחזר מהקו, ורכש חלקים אצל אלכס מחסן / בית מלאכה (15/11/2026). בלי כתיבה לפריוריטי.';
create index if not exists call_followups_call_idx on public.call_followups (service_call_id) where status <> 'closed';
create index if not exists call_followups_kind_status_idx on public.call_followups (kind, status);

-- מי יושב על כל שולחן רכש. מתמלא ב-SQL כשעמי אומר מי מהאלכסים הוא מה;
-- עד אז העמוד מציג למנהלים מתג בין השניים.
create table if not exists public.call_followup_desks (
  desk        text primary key check (desk in ('warehouse', 'workshop')),
  label       text not null,
  profile_id  uuid references public.profiles(id)
);
insert into public.call_followup_desks (desk, label) values
  ('warehouse', 'מחסן'),
  ('workshop', 'בית מלאכה')
on conflict (desk) do nothing;

-- ── צריבת הפרטים בהכרעה, ו-updated_at ──
create or replace function public.call_followups_fill()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  s public.calendar_stops%rowtype;
begin
  if tg_op = 'INSERT' or new.stop_id is distinct from old.stop_id then
    select * into s from public.calendar_stops where id = new.stop_id;
    if not found then
      raise exception 'call_followups: stop % not found', new.stop_id;
    end if;
    if s.source_type is distinct from 'service' or s.status is distinct from 'not_completed' then
      raise exception 'call_followups: only a service visit that came back (not_completed)';
    end if;
    new.service_call_id := s.service_call_id;
    new.tech_name := s.driver;
    new.tech_note := coalesce(nullif(btrim(s.resolution_note), ''), nullif(btrim(s.notes), ''));
    new.visit_date := s.delivery_date;
    new.customer_name := s.customer_name;
    new.customer_number := s.customer_number;
    new.city := s.city;
    select sc.priority_call_id, coalesce(nullif(btrim(sc.device_desc), ''), nullif(btrim(sc.device_name), ''))
      into new.call_docno, new.device
      from public.service_calls sc where sc.id = s.service_call_id;
  end if;
  if tg_op = 'UPDATE' then
    new.updated_at := now();
    -- הכרעה מחדש (סוג אחר) פותחת את הבקשה מההתחלה
    if new.kind is distinct from old.kind then
      new.status := 'open';
      new.eta := null; new.po_number := null; new.unavailable_note := null;
      new.ordered_at := null; new.ordered_by_name := null;
      new.arrived_at := null; new.arrived_by_name := null;
      new.unavailable_at := null; new.unavailable_by_name := null;
      new.closed_at := null; new.closed_reason := null;
      new.decided_at := now();
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_call_followups_fill on public.call_followups;
create trigger trg_call_followups_fill before insert or update on public.call_followups
  for each row execute function public.call_followups_fill();

-- ── השיבוץ סוגר את ההכרעה ──
-- ביקור חדש לאותה קריאה (או עצירה שחזרה לתכנון) = המשרד שיבץ שוב, ולכן
-- ההכרעה הקודמת נסגרת, כולל רכש שעוד לא הגיע. לא נוגע בשום דבר אחר.
create or replace function public.call_followups_close_on_schedule()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.service_call_id is null or new.source_type is distinct from 'service' then
    return new;
  end if;
  if new.status not in ('planned', 'in_progress') then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status in ('planned', 'in_progress')
     and old.service_call_id is not distinct from new.service_call_id then
    return new;
  end if;
  update public.call_followups
     set status = 'closed', closed_at = now(), closed_reason = 'scheduled'
   where service_call_id = new.service_call_id
     and status <> 'closed'
     and stop_id <> new.id;
  return new;
end;
$$;
drop trigger if exists trg_call_followups_close_on_schedule on public.calendar_stops;
create trigger trg_call_followups_close_on_schedule after insert or update of status, service_call_id on public.calendar_stops
  for each row execute function public.call_followups_close_on_schedule();

-- ── הרשאות: כל צוות המשרד רואה ומעדכן; אין מחיקה ──
alter table public.call_followups enable row level security;
alter table public.call_followup_desks enable row level security;

drop policy if exists call_followups_select on public.call_followups;
create policy call_followups_select on public.call_followups
  for select to authenticated using ((select public.is_office_staff()));

drop policy if exists call_followups_insert on public.call_followups;
create policy call_followups_insert on public.call_followups
  for insert to authenticated
  with check ((select public.is_office_staff()) and decided_by = (select auth.uid()));

drop policy if exists call_followups_update on public.call_followups;
create policy call_followups_update on public.call_followups
  for update to authenticated
  using ((select public.is_office_staff()))
  with check ((select public.is_office_staff()));

revoke delete on public.call_followups from authenticated, anon;

drop policy if exists call_followup_desks_select on public.call_followup_desks;
create policy call_followup_desks_select on public.call_followup_desks
  for select to authenticated using ((select public.is_office_staff()));
revoke insert, update, delete on public.call_followup_desks from authenticated, anon;
