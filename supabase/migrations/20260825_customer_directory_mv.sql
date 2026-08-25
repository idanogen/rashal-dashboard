-- מחסן הלקוחות הופך מתצוגה מחושבת לטבלה מוחשית.
--
-- 🔴🔴 **הסיבה נמדדה, לא שוערה.** עידן, 25/08/2026: "החיפוש עכשיו מאוד
-- איטי." `customer_search('קורן')` לקח **2,853 מילישניות**.
-- `customer_directory` היה `VIEW` שמאחד ארבע טבלאות
-- (‎42,754 + 47,212 + 24,321 + 14,497 ≈ **128,784 שורות**), ממיין את
-- כולן ב-`DISTINCT ON`, ומריץ `wa_normalize_phone` על כל שורה.
-- ו-`customer_search` סורק אותו **חמש פעמים**, פעם לכל ענף.
-- כל הקלדה בחיפוש שילמה את המחיר הזה מחדש.
--
-- ⭐ **וזה נהיה נכון רק היום.** עד הבוקר היו כאן 5,006 לקוחות והתצוגה
-- הייתה מספיקה. הייבוא ההיסטורי הכפיל את הנפח פי שמונה, ומה שהיה
-- החלטה סבירה הפך לצוואר בקבוק.

drop view if exists public.customer_directory cascade;

create materialized view public.customer_directory as
  with src as (
    select custname as customer_number, cdes as customer_name, phone, city,
           1 as source_rank, 'priority_customers'::text as source, synced_at as seen_at
      from public.priority_customers where coalesce(custname, '') <> ''
    union all
    select customer_number, customer_name, phone, city, 2, 'orders', created_at
      from public.orders where coalesce(customer_number, '') <> ''
    union all
    select customer_number, customer_name, phone, city, 2, 'service_calls', created_at
      from public.service_calls where coalesce(customer_number, '') <> ''
    union all
    select customer_number, customer_name, phone, city, 2, 'pickups', created_at
      from public.pickups where coalesce(customer_number, '') <> ''
  )
  select distinct on (customer_number)
         customer_number, customer_name, phone,
         public.wa_normalize_phone(phone) as phone_local,
         -- ⭐ ספרות הטלפון מחושבות פעם אחת בריענון, כדי שחיפוש לפי חלק
         -- ממספר יוכל להישען על אינדקס במקום על `regexp_replace` פר שורה.
         regexp_replace(coalesce(phone, ''), '\D', '', 'g') as phone_digits,
         city, source
    from src
   order by customer_number, source_rank, (phone is null or phone = ''), seen_at desc nulls last;

-- 🔴 ייחודי, וזה גם התנאי ל-`refresh ... concurrently`, כלומר לריענון
-- שאינו נועל את המסך בזמן שהוא רץ.
create unique index customer_directory_pk on public.customer_directory (customer_number);

create extension if not exists pg_trgm;

-- ⭐ חיפוש שם לפי מכיל, על אינדקס. בלי זה כל הקלדה היא סריקה מלאה.
create index customer_directory_name_trgm
  on public.customer_directory using gin (customer_name gin_trgm_ops);
create index customer_directory_digits_trgm
  on public.customer_directory using gin (phone_digits gin_trgm_ops);
create index customer_directory_phone_local
  on public.customer_directory (phone_local) where phone_local is not null;

grant select on public.customer_directory to authenticated;

comment on materialized view public.customer_directory is
  'לקוח אחד לכל מספר, מאוחד מכרטיסי הלקוח ומהמסמכים. מרוענן כל 10 דקות.';

-- ── ריענון ──────────────────────────────────────────────
--
-- 🔴 **`concurrently` ולא ריענון רגיל.** ריענון רגיל נועל את התצוגה
-- לקריאה, ובאמצע יום עבודה זה אומר שכל חיפוש וכל כרטיס לקוח נתקעים
-- עד שהוא נגמר.
create or replace function public.refresh_customer_directory()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  refresh materialized view concurrently public.customer_directory;
end;
$$;

revoke all on function public.refresh_customer_directory() from public, anon, authenticated;

-- כל עשר דקות. ⭐ הסנכרון עצמו רץ כל עשרים, ולכן זה לא מוסיף פיגור
-- מעבר למה שכבר קיים.
select cron.unschedule('refresh-customer-directory')
 where exists (select 1 from cron.job where jobname = 'refresh-customer-directory');
select cron.schedule('refresh-customer-directory', '*/10 * * * *',
                     $$select public.refresh_customer_directory();$$);
