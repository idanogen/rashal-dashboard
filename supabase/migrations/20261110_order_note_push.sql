-- ════════════════════════════════════════════════════════════════════════
-- אספקה שלא בוצעה → הערות ההזמנה בפריוריטי (עמי 09/11/2026, עידן 10/11/2026)
--
-- עמי: "הגעתי, לא רוצים את המנוף" נשאר בדשבורד ("חזרו מהקו") ולא מגיע
-- להזמנה. עד היום הדחיפה כתבה רק לקריאות שירות (`priority_call_push_queue`).
--
-- נמדד 10/11 על 23 הזמנות שהאספקה שלהן סומנה "לא בוצע": הדו שיח הפנימי
-- של ההזמנה ריק בכולן, ו"הערות ההזמנה" (ORDERSTEXT_SUBFORM) הוא המקום שבו
-- המשרד כותב ביד את סיבת הביטול.
-- 🔴 אבל כתיבה לשם נדחית: הזמנה בסטטוס "בוצעה" מחזירה 400 "מסך טקסט ORDERSTEXT
-- הינו לקריאה בלבד" (נבדק חי 10/11 על SO2603742), ו-23 מתוך 24 ה"לא בוצע"
-- יושבות על הזמנה כזו. הדו שיח הפנימי של אותה הזמנה עבר ב-201, ולשם כותבים.
-- כל עצירות האספקה עם הערה (198 מתוך 198 ב-30 יום) נושאות מספר SO.
--
-- 🔴 רצפת הזמן היא המתג (`infinity` = כבוי). עידן ראה את כתיבת הבדיקה על
-- SO2603742 ואישר 10/11/2026: נכתב מ-10/11 00:00 שעון ישראל והלאה, בלי לשפוך אחורה.
-- היומן, התפיסה, האישור והעצירה משותפים עם הקריאות (`priority_call_push_log`).
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.priority_order_note_floor()
returns timestamptz language sql immutable set search_path = public as $$
  select timestamptz '2026-11-09 22:00:00+00';
$$;

create or replace function public.priority_order_note_candidates(p_limit integer default 20)
returns table (
  key text,
  docno text,
  user_name text,
  content text,
  at timestamptz,
  resolution_kind text
)
language sql stable security definer
set search_path = public
as $$
  select c.key, c.docno, c.user_name, c.content, c.at, c.resolution_kind
    from (
      -- המפתח כולל md5 של הטקסט: עריכת הסיבה אחרי שנכתבה = שורה נוספת, כמו בקריאות.
      select 'ordnote:' || cs.id::text || ':' || md5(cs.resolution_note) as key,
             o.priority_order_id as docno,
             cs.driver as user_name,
             btrim(cs.resolution_note) as content,
             coalesce(cs.completed_at, cs.updated_at) as at,
             cs.resolution_kind
        from public.calendar_stops cs
        join public.orders o on o.id = cs.order_id
       where cs.source_type = 'delivery'
         and cs.status = 'not_completed'
         and nullif(btrim(coalesce(cs.resolution_note, '')), '') is not null
         and o.priority_order_id ~ '^SO[0-9]{1,20}$'
    ) c
    left join public.priority_call_push_log l on l.key = c.key
   where l.pushed_at is null
     and l.failed_at is null
     and (l.claimed_at is null or l.claimed_at < now() - interval '10 minutes')
     and c.at >= public.priority_order_note_floor()
   order by c.at asc
   limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

revoke all on function public.priority_order_note_floor() from public, anon, authenticated;
revoke all on function public.priority_order_note_candidates(integer) from public, anon, authenticated;
