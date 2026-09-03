-- הזמנות שנפתחו לפי חודש, כולל מה שבארכיון.
--
-- 🔴 הגרף "אספקות לפי חודש" בדשבורד ההנהלה ספר "הוזמנו" מרשימת ההזמנות
-- שהמסך טוען, וזו מסננת ארכיון. ב-05/08 וב-09/08 עברו לארכיון אלפי הזמנות
-- ישנות (webhook-legacy, historic-cutoff), ולכן אפריל הראה 83 הזמנות
-- במקום 653, ומאי 135 במקום 925. שלומי (03/09/2026) שאל מאיפה המספר.
--
-- ⭐ הספירה יושבת במסד ולא בדפדפן בכוונה: הדפדפן לא טוען ארכיון, ולא
-- צריך שיטען אלפי שורות רק כדי לספור אותן. `created_at` של הזמנה הוא
-- תאריך ההזמנה בפריוריטי (CURDATE), ולכן זה החודש העסקי.
--
-- 🔴🔴 ורק שורות עם מסמך הזמנה בפריוריטי (`priority_order_id`). בתקופת
-- הוובהוק (עד 05/08) תרחיש "לקוחות קיימים" כתב לטבלת ההזמנות **כרטיסי
-- לקוח**, לא הזמנות (384 באפריל, 501 במאי, 474 ביוני, 365 ביולי), ואף אחת
-- מהן אינה SO. ספירה של כל השורות הייתה מראה 653 באפריל כשבפריוריטי
-- נפתחו 255. נמדד 03/09/2026.
--
-- מבוטלות נספרות בנפרד: מי שמציג "הוזמנו" מחליט אם להוריד אותן.
create or replace function public.orders_opened_by_month(p_from date)
returns table (month date, opened bigint, cancelled bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    date_trunc('month', o.created_at)::date as month,
    count(*) as opened,
    count(*) filter (
      where o.order_status = 'בוטל' or o.priority_status = 'מבוטלת'
    ) as cancelled
  from public.orders o
  where o.duplicate_of is null
    and o.priority_order_id is not null
    and o.created_at >= p_from
  group by 1
  order by 1;
$$;

revoke all on function public.orders_opened_by_month(date) from public, anon;
grant execute on function public.orders_opened_by_month(date) to authenticated;

comment on function public.orders_opened_by_month(date) is
  'הזמנות שנפתחו לפי חודש (תאריך ההזמנה בפריוריטי), כולל ארכיון, רק שורות עם מסמך הזמנה בפריוריטי, בלי כפילויות. מבוטלות בעמודה נפרדת.';
