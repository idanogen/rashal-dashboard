-- ════════════════════════════════════════════════════════════════════════
-- 🔴 כתיבה לקריאה נעולה בפריוריטי לא נכשלת פעם אחת, היא נכשלת לנצח.
--
-- 18/09/2026: ההערה "הלקוח לא עונה" (סימון "לא בוצע" של ישראל, 16/09 18:16)
-- על SC2602255 חזרה מפריוריטי עם 400:
--   "שורה 2- מסך טקסט DOCTEXT_Q הינו לקריאה בלבד ולא ניתן לעדכון."
-- הקריאה בסטטוס "סופית", כלומר נעולה לשינויים. הכתיבה חזרה כל רבע שעה
-- במשך יומיים (150 ריצות, 450 בקשות לפריוריטי), כל ריצה נרשמה `error`,
-- ולכן הוואצ'דוג הודיע "הסנכרון לא רץ כצפוי" בזמן שכל השאר עבד כשורה.
-- פריט מורעל אחד הפך את הפעמון של ה-job כולו לרעש קבוע.
--
-- שני שערים, ושניהם נספרים במקום אחד (`priority_call_push_log`):
--   1. מלכתחילה: קריאה בסטטוס נעול לא נדחפת. הרשימה מבית הידע של רוני
--      (ייצוא מסך "סטטוסים לקריאות שרות", 15/09/2026): "סופית" נעולה
--      לשינויים, "מבוטלת" נעולה, "טופל טכנאי" מסומנת סופית.
--   2. בדיעבד: כתיבה שפריוריטי דחתה בשגיאת תוכן (4xx) נעצרת עם הנוסח
--      שנרשם ולא חוזרת.
--
-- 🔴 "נעצר" אינו "נעלם": הפריט נשאר ביומן עם הסיבה והנוסח, והוואצ'דוג
-- מתריע עליו פעם אחת. בלי זה היינו מחליפים רעש קבוע בשקט מוחלט.
-- ════════════════════════════════════════════════════════════════════════

alter table public.priority_call_push_log
  add column if not exists failed_at   timestamptz,
  add column if not exists fail_reason text,
  add column if not exists last_error  text,
  add column if not exists docno       text;

comment on column public.priority_call_push_log.failed_at is
  'נעצר לצמיתות: לא יידחף שוב. call_locked = הקריאה נעולה בפריוריטי, priority_rejected = 4xx מפריוריטי.';

-- ─── מקור אמת אחד לתור ────────────────────────────────────────────────────
-- גם הבחירה וגם העצירה קוראות מכאן, כדי שלא יהיו שני עותקים של האיחוד
-- שצריכים "להישאר זהים". [[comment_that_two_copies_must_match_is_not_a_guard]]
create or replace view public.priority_call_push_queue
with (security_invoker = true) as
with ev as (
  select 'event:' || te.id::text as key,
         te.type::text as kind,
         sc.priority_call_id as docno,
         sc.priority_status,
         te.user_name,
         te.content,
         te.metadata,
         te.created_at as at,
         null::text as resolution_kind
    from public.timeline_events te
    join public.service_calls sc on sc.id = te.service_call_id
    join public.profiles p on p.id::text = te.user_id and p.role = 'driver'
   where te.type::text in ('comment', 'file_upload')
     and (te.type::text <> 'file_upload'
          or jsonb_array_length(coalesce(te.metadata->'imageUrls', '[]'::jsonb)) > 0)
     and (te.type::text <> 'comment' or nullif(btrim(coalesce(te.content, '')), '') is not null)
),
notes as (
  select 'note:' || cs.id::text || ':' || md5(cs.resolution_note) as key,
         'note'::text as kind,
         sc.priority_call_id as docno,
         sc.priority_status,
         cs.driver as user_name,
         btrim(cs.resolution_note) as content,
         null::jsonb as metadata,
         coalesce(cs.completed_at, cs.updated_at) as at,
         cs.resolution_kind
    from public.calendar_stops cs
    join public.service_calls sc on sc.id = cs.service_call_id
   where cs.source_type = 'service'
     and cs.status in ('completed', 'not_completed')
     and nullif(btrim(coalesce(cs.resolution_note, '')), '') is not null
)
select c.key, c.kind, c.docno, c.priority_status, c.user_name, c.content, c.metadata,
       c.at, c.resolution_kind,
       l.claimed_at, l.pushed_at, l.failed_at, l.fail_reason, l.last_error,
       case when coalesce(c.priority_status, '') in ('סופית', 'מבוטלת', 'טופל טכנאי')
            then 'call_locked' end as blocked_reason
  from (select * from ev union all select * from notes) c
  left join public.priority_call_push_log l on l.key = c.key
 where c.docno ~ '^[A-Za-z0-9_-]{1,30}$';

comment on view public.priority_call_push_queue is
  'התור של מלל ותמונות הטכנאי לקריאת השירות בפריוריטי, כולל מה שנעצר ולמה. שרת בלבד.';

revoke all on public.priority_call_push_queue from public, anon, authenticated;

-- רצפת הזמן היא המתג, וגם הוואצ'דוג צריך אותה. פונקציה אחת, לא שני קבועים.
create or replace function public.priority_call_push_floor()
returns timestamptz language sql immutable set search_path = public as $$
  select timestamptz '2026-09-14 21:00:00+00';
$$;

-- ─── מה ממתין ─────────────────────────────────────────────────────────────
-- 🔴 `blocked_reason` חוזר החוצה במקום להיעלם בסינון: הקורא עוצר אותו
-- ביומן, וכך "לא נדחף" נשאר דבר שאפשר לספור. [[empty_row_rule_hides_committed_items]]
-- 🔴 טור חדש בתוצאה: `create or replace` לבדו נדחה ("cannot change return type").
drop function if exists public.priority_call_push_candidates(integer, text);
create or replace function public.priority_call_push_candidates(p_limit integer default 60, p_docno text default null)
returns table (
  key text,
  kind text,
  docno text,
  user_name text,
  content text,
  metadata jsonb,
  at timestamptz,
  resolution_kind text,
  blocked_reason text
)
language sql stable security definer
set search_path = public
as $$
  select q.key, q.kind, q.docno, q.user_name, q.content, q.metadata, q.at, q.resolution_kind, q.blocked_reason
    from public.priority_call_push_queue q
   where q.pushed_at is null
     and q.failed_at is null
     and (q.claimed_at is null or q.claimed_at < now() - interval '10 minutes')
     and case when p_docno is not null then q.docno = p_docno
              else q.at >= public.priority_call_push_floor() end
   order by q.at asc
   limit greatest(1, least(coalesce(p_limit, 60), 200));
$$;

-- ─── תפיסה ואישור (עברו לכאן מ-20260915_call_repair_push.sql, בלי שינוי) ──
create or replace function public.priority_call_push_claim(p_keys text[])
returns integer
language sql
security definer
set search_path = public
as $$
  with x as (
    insert into public.priority_call_push_log (key, claimed_at)
    select k, now() from unnest(p_keys) k
    on conflict (key) do update set claimed_at = excluded.claimed_at
      where public.priority_call_push_log.pushed_at is null
    returning 1
  )
  select count(*)::int from x;
$$;

create or replace function public.priority_call_push_ack(p_keys text[])
returns integer
language sql
security definer
set search_path = public
as $$
  with x as (
    insert into public.priority_call_push_log (key, pushed_at)
    select k, now() from unnest(p_keys) k
    on conflict (key) do update set pushed_at = now(), claimed_at = null
    returning 1
  )
  select count(*)::int from x;
$$;

-- ─── עצירה לצמיתות ────────────────────────────────────────────────────────
create or replace function public.priority_call_push_park(p_keys text[], p_reason text, p_error text default null)
returns integer
language sql
security definer
set search_path = public
as $$
  with x as (
    insert into public.priority_call_push_log (key, failed_at, fail_reason, last_error, docno)
    select k, now(), left(coalesce(p_reason, 'unknown'), 40), left(p_error, 500),
           (select q.docno from public.priority_call_push_queue q where q.key = k limit 1)
      from unnest(p_keys) k
    on conflict (key) do update
      set failed_at = now(),
          fail_reason = excluded.fail_reason,
          last_error = excluded.last_error,
          docno = coalesce(public.priority_call_push_log.docno, excluded.docno),
          claimed_at = null
      where public.priority_call_push_log.pushed_at is null
    returning 1
  )
  select count(*)::int from x;
$$;

revoke all on function public.priority_call_push_floor() from public, anon, authenticated;
revoke all on function public.priority_call_push_candidates(integer, text) from public, anon, authenticated;
revoke all on function public.priority_call_push_park(text[], text, text) from public, anon, authenticated;
revoke all on function public.priority_call_push_claim(text[]) from public, anon, authenticated;
revoke all on function public.priority_call_push_ack(text[]) from public, anon, authenticated;
