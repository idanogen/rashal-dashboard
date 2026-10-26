-- ─── קופת החולים של ההזמנה = "סוג לקוח" בכרטיס, ומתעדכנת כשהכרטיס משתנה (26/10/2026) ──
--
-- עידן: "לדעתי אנחנו לא ממפים נכון את המידע מפריוריטי". צדק. רבינוביץ רחל
-- (013664644) מוגדרת בפריוריטי כמאוחדת (CTYPECODE 10), ואצלנו לא הייתה לה
-- קופה, לא בכרטיס ולא בהזמנה SO2603733. הנהג היה מקבל "אין טופס קופה".
--
-- 🔴 שני חורים:
-- 1. המשיכה השוטפת של לקוחות לא ביקשה CTYPENAME בכלל. הוא מולא רק בסריקת
--    rashal-customer-type ב-1 וב-15 לחודש. תוקן בקוד (rashal-sync + api/priority-sync).
-- 2. גם כשהסוג הגיע, ההזמנה לא התעדכנה: `orders_fill_health_fund` רץ רק כשנוגעים
--    בהזמנה עצמה. הזמנה שנמשכה לפני שהכרטיס התמלא נשארה בלי קופה לתמיד.
--    כאן: טריגר על הכרטיס שמעביר את הסוג להזמנות של הלקוח שעוד פתוחות.
--
-- ⭐ `orders_fill_health_fund` עצמו היה קיים רק בפרודקשן (נוצר 02/09 בלי קובץ).
-- נשמר כאן כמו שהוא חי, בלי שינוי.

create or replace function public.orders_fill_health_fund()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $function$
declare
  v_type text;
begin
  if new.customer_number is null or new.customer_number = '' then
    return new;
  end if;

  select p.customer_type into v_type
    from public.priority_customers p
   where p.custname = new.customer_number;

  if v_type is not null and new.health_fund is distinct from v_type then
    new.health_fund := v_type;
  end if;

  return new;
end;
$function$;

drop trigger if exists orders_fill_health_fund_trg on public.orders;
create trigger orders_fill_health_fund_trg
  before insert or update of customer_number, health_fund on public.orders
  for each row execute function public.orders_fill_health_fund();

-- כרטיס שקיבל סוג (או שהסוג שלו השתנה) מעביר אותו להזמנות הפתוחות שלו.
-- 🔴 רק פתוחות: הזמנה שסופקה מתועדת עם הקופה שהייתה לה, ולא נכתבת מחדש.
create or replace function public.customer_type_to_open_orders()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $function$
begin
  if new.customer_type is null or new.customer_type is not distinct from old.customer_type then
    return new;
  end if;
  update public.orders o
     set health_fund = new.customer_type
   where o.customer_number = new.custname
     and o.order_status::text in ('ממתין לתאום', 'תואם')
     and o.health_fund is distinct from new.customer_type;
  return new;
end;
$function$;
revoke all on function public.customer_type_to_open_orders() from public, anon, authenticated;

drop trigger if exists trg_customer_type_to_open_orders on public.priority_customers;
create trigger trg_customer_type_to_open_orders
  after update of customer_type on public.priority_customers
  for each row execute function public.customer_type_to_open_orders();
