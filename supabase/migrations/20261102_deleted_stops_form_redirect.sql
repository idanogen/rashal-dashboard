-- ─────────────────────────────────────────────────────────────────────────
-- טופס שנחתם על עצירה שנמחקה (02/11/2026, הכרעת עידן "דרך שניה").
--
-- אבי חתם ב-01/11 בין 13:57 ל-14:00 שלושה טפסים אצל שחם דליה בלי קליטה.
-- עד שהטלפון שלח, עצירת השירות נמחקה במשרד, והשרת דחה את הטפסים: אין
-- עצירה, אין למה לצרף. הטופס חי רק בטלפון, ואחרי שלושה ימים נמחק משם.
--
-- 1. calendar_stops_deleted: כל מחיקת עצירה נרשמת עם הלקוח, הקריאה,
--    ההזמנה, הנהג ומי מחק. גם עדות, וגם הבסיס להפניה.
-- 2. form_stop_redirect(stop): העצירה עצמה אם קיימת. אם נמחקה: עצירה אחרת
--    של אותו לקוח שהנהג המחובר רשאי לחתום בה, קודם על אותה קריאה או הזמנה,
--    אחר כך לפי מספר לקוח או שם, הקרובה בתאריך. null = אין לאן.
--    האפליקציה (התור) שואלת לפני כל העלאה של טופס.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.calendar_stops_deleted (
  id              uuid primary key,
  driver          text,
  customer_name   text,
  customer_number text,
  phone           text,
  source_type     text,
  service_call_id uuid,
  order_id        uuid,
  pickup_id       uuid,
  delivery_date   date,
  status          text,
  deleted_at      timestamptz not null default now(),
  deleted_by      uuid,
  note            text
);

alter table public.calendar_stops_deleted enable row level security;
drop policy if exists calendar_stops_deleted_office_read on public.calendar_stops_deleted;
create policy calendar_stops_deleted_office_read on public.calendar_stops_deleted
  for select to authenticated using ((select public.is_office_staff()) is true);

create or replace function public.log_calendar_stop_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.calendar_stops_deleted
    (id, driver, customer_name, customer_number, phone, source_type, service_call_id, order_id, pickup_id,
     delivery_date, status, deleted_by)
  values
    (old.id, old.driver, old.customer_name, old.customer_number, old.phone, old.source_type, old.service_call_id,
     old.order_id, old.pickup_id, old.delivery_date, old.status, auth.uid())
  on conflict (id) do nothing;
  return old;
end;
$$;

drop trigger if exists trg_log_calendar_stop_delete on public.calendar_stops;
create trigger trg_log_calendar_stop_delete
  after delete on public.calendar_stops
  for each row execute function public.log_calendar_stop_delete();

-- העצירה של אבי נמחקה לפני שהיומן הזה היה קיים. הפרטים משחזור: רשימת הבדיקה
-- למנוף שאבי מילא באותן דקות (crane_forms 0c691701, נשמרה עם stop_id שהתאפס
-- במחיקה) נושאת את הקריאה ואת הלקוחה.
insert into public.calendar_stops_deleted
  (id, driver, customer_name, customer_number, phone, source_type, service_call_id, delivery_date, status, deleted_at, note)
select '4c025a38-12eb-41a4-80d8-c0ef9f222d62', 'אבי', f.customer_name, f.customer_number, sc.phone, 'service',
       f.service_call_id, '2026-11-01', null, '2026-11-01T12:00:00Z', 'שוחזר 02/11 מ-crane_forms 0c691701'
  from public.crane_forms f left join public.service_calls sc on sc.id = f.service_call_id
 where f.id = '0c691701-7c89-4434-a5e8-d2a7a40930ce'
on conflict (id) do nothing;

create or replace function public.form_stop_redirect(p_stop_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_stop public.calendar_stops;
  v_del  public.calendar_stops_deleted;
  v_to   uuid;
begin
  select * into v_stop from public.calendar_stops where id = p_stop_id;
  if found then return p_stop_id; end if;

  select * into v_del from public.calendar_stops_deleted where id = p_stop_id;
  if not found then return null; end if;

  select s.id into v_to
    from public.calendar_stops s
   where public.stop_form_access(s) is true
     and (   (v_del.service_call_id is not null and s.service_call_id = v_del.service_call_id)
          or (v_del.order_id is not null and s.order_id = v_del.order_id)
          or (nullif(trim(v_del.customer_number), '') is not null and s.customer_number = v_del.customer_number)
          or (nullif(trim(v_del.customer_name), '') is not null and s.customer_name = v_del.customer_name))
   order by (s.service_call_id is not distinct from v_del.service_call_id and v_del.service_call_id is not null) desc,
            (s.order_id is not distinct from v_del.order_id and v_del.order_id is not null) desc,
            (s.driver is not distinct from v_del.driver) desc,
            abs(s.delivery_date - coalesce(v_del.delivery_date, s.delivery_date)),
            s.created_at desc
   limit 1;
  return v_to;
end;
$$;

revoke all on function public.form_stop_redirect(uuid) from public, anon;
grant execute on function public.form_stop_redirect(uuid) to authenticated;
