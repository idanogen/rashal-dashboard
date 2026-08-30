-- ─── גלאי תצוגה: רשומות פתוחות שאף מסך לא מציג ──────────────────────────────
--
-- הרקע (30/08/2026): עמי דיווח על "קריאות שלא מופיעות", והתברר שהסנכרון היה
-- שלם — הרשומות ישבו במסד ופשוט לא הוצגו (סטטוס NULL מהכנסה קבוצתית מעורבת).
-- ריצת ההשוואה היומית בודקת "האם הרשומה קיימת אצלנו" ואף בדיקה לא שאלה
-- "האם הרשומה שקיימת גם מוצגת". זו הפונקציה שסוגרת את החור: היא משחזרת את
-- מסנני הטעינה של המסך אחד לאחד ומחזירה כל רשומה פתוחה שלא תגיע לאף רשימה.
-- נקראת מריצת הבוקר (reconcile-daily) וכל שורה שחוזרת נכנסת למייל.
--
-- 🔴 הקבועים כאן חייבים להישאר זהים ל-src/lib/constants.ts (חלון 180 יום,
-- רשימות הסגורים, רצפת האיסופים). test/visibility-audit.test.mjs קורא את
-- הקובץ הזה ומוודא שהם לא התפצלו.

create or replace function public.visibility_audit()
returns table (entity text, reason text, pkey text, customer_name text, city text, created_on date)
language sql
stable
set search_path = public
as $$
with cutoff as (select (now() - interval '180 days') as c)

-- 1) פתוחה אבל מסנן הטעינה של המסך מפיל אותה (חלון/רצפה/ארכיון).
select 'orders', 'not_loaded', o.priority_order_id, o.customer_name, o.city, o.created_at::date
from orders o, cutoff
where o.archived_at is null
  and (o.order_status is null or o.order_status::text not in ('סופק','בוטל'))
  and not (o.created_at >= c or (o.updated_at >= c and o.order_status::text not in ('סופק','בוטל')))

union all
select 'service_calls', 'not_loaded', s.priority_call_id, s.customer_name, s.city, s.created_at::date
from service_calls s, cutoff
where s.archived_at is null
  and (s.service_call_status is null or s.service_call_status::text not in ('בוצע','בוטל'))
  and not (s.created_at >= c or (s.updated_at >= c and s.service_call_status::text not in ('בוצע','בוטל')))

union all
select 'pickups', 'not_loaded', p.priority_pickup_id, p.customer_name, p.city, p.created_at::date
from pickups p, cutoff
where p.archived_at is null
  and (p.pickup_status is null or p.pickup_status::text not in ('נאסף','בוטל'))
  and not (p.pickup_date >= '2024-04-01'
           and (p.created_at >= c or (p.updated_at >= c and p.pickup_status::text not in ('נאסף','בוטל'))))

-- 2) סטטוס ריק = תקלת ההכנסה הקבוצתית חזרה. המסך מציג אותן מאז השריון,
--    אבל זה סימן שהסנכרון שוב כותב NULL ושווה לתפוס אותו מיד.
union all
select 'orders', 'null_status', o.priority_order_id, o.customer_name, o.city, o.created_at::date
from orders o where o.archived_at is null and o.order_status is null
union all
select 'service_calls', 'null_status', s.priority_call_id, s.customer_name, s.city, s.created_at::date
from service_calls s where s.archived_at is null and s.service_call_status is null
union all
select 'pickups', 'null_status', p.priority_pickup_id, p.customer_name, p.city, p.created_at::date
from pickups p where p.archived_at is null and p.pickup_status is null

-- 3) כפיל מוסתר שפתוח באמת: המסך מציג רק את ראש קבוצת הכפילויות, וכשהראש
--    נסגר והכפיל עדיין פתוח גם אצלנו וגם בפריוריטי — אין לו שום מסך.
--    "פתוח בפריוריטי" מחריג בוצעה/שולמה (חיוב) וטיוטא, אחרת ~15 הזמנות
--    שכבר סופקו דרך הראש היו מציפות את המייל (נמדד 30/08/2026).
union all
select 'orders', 'hidden_dup', d.priority_order_id, d.customer_name, d.city, d.created_at::date
from orders d join orders h on h.id = d.duplicate_of
where d.archived_at is null and d.order_status::text = 'ממתין לתאום'
  and (h.archived_at is not null or h.order_status::text in ('סופק','בוטל'))
  and d.priority_status is not null
  and d.priority_status not in ('בוצעה','שולמה','מבוטלת','טיוטא')
union all
select 'service_calls', 'hidden_dup', d.priority_call_id, d.customer_name, d.city, d.created_at::date
from service_calls d join service_calls h on h.id = d.duplicate_of
where d.archived_at is null and d.service_call_status::text = 'קריאה חדשה'
  and (h.archived_at is not null or h.service_call_status::text in ('בוצע','בוטל'))
  and d.priority_status is not null
  and d.priority_status not in ('בוצעה','סופית','מבוטלת','טיוטא')
$$;

-- הפונקציה חושפת שמות וטלפונים של לקוחות — service_role בלבד, כמו שאר
-- פונקציות התפעול (הלקח מ-send_one_survey שהייתה פתוחה ל-anon).
revoke all on function public.visibility_audit() from public, anon, authenticated;
