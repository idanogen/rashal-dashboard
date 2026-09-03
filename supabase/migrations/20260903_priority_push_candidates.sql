-- מועמדים לדחיפה לפריוריטי: רק אירועים שאפשר לדחוף, מהמסד ולא מסריקה בדפדפן-שרת.
--
-- 🔴🔴 **חסם ראש-תור, גלגול שני (03/09/2026).** התיקון מ-11/08 הרחיב את
-- הסריקה ל-400 האירועים הישנים ביותר וספר את המכסה על מה שנדחף בפועל. אבל
-- 400 הישנים ביותר התמלאו לאט באירועים שלעולם לא יידחפו: 228 בלי הזמנה
-- ובלי קריאה (צ'אט על עצירה ידנית), 160 על ישות בלי מספר לקוח, 7 העלאות
-- בלי תמונה. מ-02/09 09:30 כל ריצה החזירה "success, writes: 0, skipped: 397",
-- והוואצ'דוג היה ירוק. התמונה של קטרבורסקי זינאידה (SC2603094) חיכתה 30 שעות,
-- והלקוחה שאלה "?????" בוואטסאפ.
--
-- ⭐ הבחירה עוברת למסד: הסינון על "יש לקוח" ו"יש תמונה" נעשה בשאילתה, ולכן
-- אירוע שאי אפשר לדחוף אינו תופס מקום בחלון בכלל. [[endpoint_hardening_orphans_callers]]
create or replace function public.priority_push_candidates(p_limit integer default 60, p_custname text default null)
returns table (
  id text,
  order_id text,
  service_call_id text,
  type text,
  user_name text,
  content text,
  metadata jsonb,
  created_at timestamptz,
  cust text,
  ctx text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    te.id::text, te.order_id::text, te.service_call_id::text, te.type::text, te.user_name, te.content, te.metadata, te.created_at,
    coalesce(nullif(trim(o.customer_number), ''), nullif(trim(sc.customer_number), '')) as cust,
    case
      when te.order_id is not null then trim('הזמנה ' || coalesce(o.priority_order_id, ''))
      else trim('קריאה ' || coalesce(sc.priority_call_id, ''))
    end as ctx
  from public.timeline_events te
  left join public.orders o on o.id = te.order_id
  left join public.service_calls sc on sc.id = te.service_call_id
  where te.pushed_to_priority_at is null
    and (te.push_claimed_at is null or te.push_claimed_at < now() - interval '10 minutes')
    and te.type::text in ('comment', 'file_upload')
    and coalesce(nullif(trim(o.customer_number), ''), nullif(trim(sc.customer_number), '')) is not null
    and (te.type::text <> 'file_upload'
         or jsonb_array_length(coalesce(te.metadata->'imageUrls', '[]'::jsonb)) > 0)
    and (p_custname is null or o.customer_number = p_custname or sc.customer_number = p_custname)
  order by te.created_at asc
  limit greatest(1, least(p_limit, 500));
$$;

revoke all on function public.priority_push_candidates(integer, text) from public, anon, authenticated;

comment on function public.priority_push_candidates(integer, text) is
  'אירועי צ׳אט ותמונות שממתינים לדחיפה לכרטיס הלקוח בפריוריטי, רק כאלה שאפשר לדחוף (יש לקוח, ולתמונה יש קובץ). service-role בלבד.';

-- כמה ממתינים, וכמה זמן הוותיק מחכה: מה שהוואצ'דוג צריך כדי להפסיק להיות ירוק על אפס.
create or replace function public.priority_push_backlog()
returns table (pending bigint, oldest_at timestamptz, oldest_minutes integer)
language sql
stable
security definer
set search_path = public
as $$
  select count(*) as pending, min(c.created_at) as oldest_at,
         coalesce(extract(epoch from now() - min(c.created_at)) / 60, 0)::int as oldest_minutes
  from public.priority_push_candidates(500, null) c;
$$;
revoke all on function public.priority_push_backlog() from public, anon, authenticated;
