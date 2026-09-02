-- ראה migration שהוחל ב-Supabase: stop_customer_identity (02/09/2026)
-- מספר הלקוח יושב על העצירה, ולא רק על הישות שמאחוריה.
--
-- 🔴🔴 **נמצא כשניסיתי למדוד ביקורים חוזרים.** `calendar_stops.customer_number`
-- היה מלא ב-**21 מתוך 1,107** עצירות, ולכן שאילתה תמימה על "אותו לקוח
-- פעמיים" החזירה **תשעה לקוחות בסך הכול** ונראתה כמו תשובה. זה בדיוק
-- הכשל השקט: לא שגיאה, לא אפס, אלא מספר קטן ומטעה.
-- [[count_measures_spread_not_absence]]
--
-- ⭐ הזהות קיימת, היא פשוט יושבת על ההזמנה, הקריאה או האיסוף שמאחורי
-- העצירה. **619 עצירות נפתרות** מהקישור הזה, וזה מעלה את הכיסוי
-- מ-2% ל-58%. 467 הנותרות הן משימות שנפתחו ידנית בלי ישות, ואצלן באמת
-- אין מספר לקוח, והן נשארות ריקות ולא מנוחשות.

create or replace function public.stamp_stop_customer()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_num text;
begin
  if coalesce(new.customer_number, '') <> '' then
    return new;
  end if;

  select coalesce(o.customer_number, sc.customer_number, p.customer_number)
    into v_num
    from (select 1) dummy
    left join public.orders o on o.id = new.order_id
    left join public.service_calls sc on sc.id = new.service_call_id
    left join public.pickups p on p.id = new.pickup_id;

  if coalesce(v_num, '') <> '' then
    new.customer_number := v_num;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_stamp_stop_customer on public.calendar_stops;
create trigger trg_stamp_stop_customer
  before insert or update of order_id, service_call_id, pickup_id on public.calendar_stops
  for each row execute function public.stamp_stop_customer();

revoke all on function public.stamp_stop_customer() from public, anon, authenticated;

comment on function public.stamp_stop_customer() is
  'משלים מספר לקוח לעצירה מהישות שמאחוריה. נולד 02/09/2026 אחרי שהשדה היה מלא ב-21 מתוך 1,107.';

update public.calendar_stops cs
   set customer_number = v.num
  from (
    select cs2.id,
           coalesce(o.customer_number, sc.customer_number, p.customer_number) as num
      from public.calendar_stops cs2
      left join public.orders o on o.id = cs2.order_id
      left join public.service_calls sc on sc.id = cs2.service_call_id
      left join public.pickups p on p.id = cs2.pickup_id
     where coalesce(cs2.customer_number, '') = ''
  ) v
 where v.id = cs.id and coalesce(v.num, '') <> '';

create index if not exists calendar_stops_customer_date_idx
  on public.calendar_stops (customer_number, delivery_date desc)
  where customer_number is not null;
