-- ─── צ'אט צוות: הודעה ישירה בין עובדים (הרעיון של עידן, אושר 09/10/2026) ──
--
-- "שלכל עובד תהיה אפשרות לכתוב לעובד אחר, בתוך המערכת, במקום הוואטסאפ הפרטי."
-- הצ'אט על פריט עבודה (`timeline_events`) נשאר כמו שהוא: זו שכבה דקה לצידו,
-- הודעה מאדם לאדם, בלי קשר להזמנה או לקריאה.
--
-- ⭐ זמן אמת דרך supabase_realtime (הטבלה מתווספת לפרסום), ולנהג גם התראת
-- דחיפה דרך התור הקיים `driver_notify_queue` (kind='chat'). 🔴 כל עוד אין
-- פרויקט Firebase ואף מכשיר לא רשום ב-`driver_devices` (0 מכשירים, 1,871
-- "no_device" בתור), הנהג רואה את ההודעה רק כשהאפליקציה פתוחה. זה ידוע
-- ונאמר לעידן.

create table if not exists public.staff_messages (
  id             uuid primary key default gen_random_uuid(),
  sender_id      uuid not null references public.profiles(id),
  sender_name    text not null,
  recipient_id   uuid not null references public.profiles(id),
  recipient_name text not null,
  body           text not null check (btrim(body) <> ''),
  created_at     timestamptz not null default now(),
  read_at        timestamptz,
  constraint staff_messages_not_self check (sender_id <> recipient_id)
);
comment on table public.staff_messages is 'צ''אט צוות: הודעה ישירה מעובד לעובד (09/10/2026).';
create index if not exists staff_messages_recipient_unread_idx on public.staff_messages (recipient_id, created_at) where read_at is null;
create index if not exists staff_messages_pair_idx on public.staff_messages (sender_id, recipient_id, created_at);

alter table public.staff_messages enable row level security;

-- רואים רק מה ששלחתי או מה שנשלח אליי. אין "משרד רואה הכל": זו התכתבות אישית.
drop policy if exists staff_messages_select on public.staff_messages;
create policy staff_messages_select on public.staff_messages
  for select to authenticated
  using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));

drop policy if exists staff_messages_insert on public.staff_messages;
create policy staff_messages_insert on public.staff_messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = recipient_id and p.disabled = false)
  );

-- רק הנמען מסמן "נקרא", ורק את זה.
drop policy if exists staff_messages_update on public.staff_messages;
create policy staff_messages_update on public.staff_messages
  for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

revoke delete on public.staff_messages from authenticated, anon;

-- זמן אמת לשני הצדדים (RLS חל גם על postgres_changes).
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'staff_messages') then
    alter publication supabase_realtime add table public.staff_messages;
  end if;
end $$;

-- ─── כמה לא נקראו, לפי שולח ──────────────────────────────────────────────
create or replace function public.staff_unread()
returns table (sender_id uuid, sender_name text, unread int, last_at timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select m.sender_id, max(m.sender_name), count(*)::int, max(m.created_at)
    from public.staff_messages m
   where m.recipient_id = auth.uid() and m.read_at is null
   group by m.sender_id;
$$;
grant execute on function public.staff_unread() to authenticated;

-- ─── סימון "נקרא" על כל מה שהגיע ממישהו ─────────────────────────────────
create or replace function public.staff_mark_read(p_peer uuid)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare n int;
begin
  update public.staff_messages
     set read_at = now()
   where recipient_id = auth.uid() and sender_id = p_peer and read_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;
grant execute on function public.staff_mark_read(uuid) to authenticated;

-- ─── דחיפה לנהג דרך התור הקיים ──────────────────────────────────────────
-- 🔴 הטריגר לעולם לא מפיל את השליחה: הכל עטוף בבליעת שגיאות, כמו ביומן.
create or replace function public.staff_message_push()
returns trigger
language plpgsql security definer set search_path = public
as $fn$
declare v_driver text;
begin
  begin
    select p.linked_driver into v_driver
      from public.profiles p
     where p.id = new.recipient_id and p.role = 'driver' and p.disabled = false;
    if v_driver is null then
      return new;
    end if;
    insert into public.driver_notify_queue (driver_name, kind, title, body, stop_id)
    values (v_driver, 'chat', 'הודעה מ' || new.sender_name, left(new.body, 120), null);
    perform public.driver_push_kick();
  exception when others then
    null;
  end;
  return new;
end;
$fn$;
drop trigger if exists staff_message_push_tg on public.staff_messages;
create trigger staff_message_push_tg after insert on public.staff_messages
  for each row execute function public.staff_message_push();
