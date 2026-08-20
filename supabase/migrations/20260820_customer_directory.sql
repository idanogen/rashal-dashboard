-- ספר הלקוחות: מקור אחד לשאלה "מי הלקוח הזה".
-- הוחל בפרודקשן 20/08/2026. ראה STATUS.md, סבב 20/08 ערב.
--
-- 🔴 הבעיה שזה פותר: `priority_customers` היא מראה מבוססת דלתא, וקולטת
-- לקוח רק כשהוא נוצר או מתעדכן אחרי שהסנכרון התחיל. לקוח ותיק שלא נגעו
-- בו מאז לעולם לא ייכנס. נמדד: 2,018 במראה מול 4,635 עם עבודה אצלנו,
-- כלומר 2,921 לקוחות (63%) היו בלתי נראים.
--
-- ⭐ טבלאות העבודה הן האמת על מי שאנחנו משרתים. המראה היא נוחות.
create or replace view public.customer_directory as
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
  city, source
from src
-- 🔴 שורה עם טלפון מנצחת שורה בלי, גם בתוך אותה דרגה.
order by customer_number, source_rank, (phone is null or phone = ''), seen_at desc nulls last;

grant select on public.customer_directory to authenticated, service_role;
