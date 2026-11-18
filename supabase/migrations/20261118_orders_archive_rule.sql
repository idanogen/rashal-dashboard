-- ─── ארכיון הזמנות ממתינות לתיאום (18/11/2026) ─────────────────────────────
--
-- עידן, אחרי ניקוי הקריאות: "אפשר לעשות את זה גם עם הזמנות?". ברשימת "הזמנות
-- ממתינות לתיאום" עמדו 964 הזמנות, הוותיקה מ-20/04 (בפגישה 17/11: "זבל במערכת").
--
-- 🔴 בהזמנה אי אפשר לנקות לפי סטטוס בלבד כמו בקריאות: "בוצעה" נקבע בפריוריטי
-- בזמן החיוב, לפעמים לפני הנסיעה (ORDER_TERMINAL = מבוטלת בלבד). לכן הכלל הוא
-- סטטוס + גיל + אף פעם לא שובצה ביומן:
--   rule:billed-30d    "בוצעה"/"שולמה" ומעל 30 יום (688 ב-18/11, לכמעט כולן תעודה סופית)
--   rule:approved-90d  "מאושרת לבצוע" ומעל 90 יום (82 ב-18/11, עידן אישר)
-- הכלל רץ כל יום (קרון למטה), כי הוא תלוי בגיל ולא בשינוי שורה.
--
-- ⭐ החזרה: המסך כותב archived_reason='restored' עם archived_at ריק, והכלל
-- מדלג על שורה כזאת, אחרת ההזמנה הייתה חוזרת לארכיון למחרת בבוקר.
-- ידני: הכפתור "העבר לארכיון" כותב archived_reason='manual'.
--
-- 🔴 אין כתיבה לפריוריטי ואין נגיעה ב-calendar_stops. הסנכרון לא כותב
-- archived_at על הזמנה קיימת, לכן הארכיון לא נדרס.
--
-- הפיך: update orders set archived_at = null, archived_reason = null
--        where archived_reason like 'rule:%';

create or replace function public.orders_archive_stale()
returns integer
language plpgsql
set search_path = public
as $$
declare
  n integer;
  d integer;
begin
  with target as (
    select o.id,
      case when o.priority_status = 'מאושרת לבצוע' then 'rule:approved-90d' else 'rule:billed-30d' end as reason
    from orders o
    where o.archived_at is null
      and o.archived_reason is distinct from 'restored'
      and o.duplicate_of is null
      and coalesce(o.order_status::text, 'ממתין לתאום') = 'ממתין לתאום'
      and (
        (o.priority_status in ('בוצעה', 'שולמה') and o.created_at < now() - interval '30 days')
        or (o.priority_status = 'מאושרת לבצוע' and o.created_at < now() - interval '90 days')
      )
      and not exists (select 1 from calendar_stops cs where cs.order_id = o.id)
  )
  update orders o
     set archived_at = now(), archived_reason = t.reason
    from target t
   where o.id = t.id;
  get diagnostics n = row_count;

  -- כפילים של מה שעבר יוצאים איתו, אחרת כפיל יתום צץ ברשימה במקומו.
  update orders d2
     set archived_at = now(), archived_reason = 'rule:dup'
    from orders h
   where d2.duplicate_of = h.id
     and d2.archived_at is null
     and d2.archived_reason is distinct from 'restored'
     and h.archived_reason like 'rule:%'
     and not exists (select 1 from calendar_stops cs where cs.order_id = d2.id);
  get diagnostics d = row_count;

  return n + d;
end;
$$;

revoke all on function public.orders_archive_stale() from public, anon, authenticated;

-- כל יום ב-03:20 UTC (05:20 או 06:20 בישראל), לפני שהמשרד פותח את המסך.
select cron.unschedule('rashal-orders-archive')
 where exists (select 1 from cron.job where jobname = 'rashal-orders-archive');
select cron.schedule('rashal-orders-archive', '20 3 * * *', $$select public.orders_archive_stale()$$);

-- הריצה הראשונה = הניקוי של היום.
select public.orders_archive_stale();
