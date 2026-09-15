-- ════════════════════════════════════════════════════════════════════════
-- מה שהטכנאי רושם נכנס לקריאת השירות בפריוריטי (עידן, 15/09/2026):
--   מלל → DOCUMENTS_Q(...)/DOCTEXT_Q_SUBFORM ("תאור התיקון", APPEND)
--   תמונות → DOCUMENTS_Q(...)/EXTFILES_SUBFORM ("נספחים")
--
-- "מלל" = הערות צ'אט של נהג/טכנאי על הקריאה + הסיבה שנרשמה בסימון
-- ("לא בוצע" / "להמשך טיפול"). הכתיבה לכרטיס הלקוח (priority_push_candidates)
-- נשארת כמו שהיא; זה מסלול נוסף עם יומן משלו, כדי שהצלחה באחד לא תסמן את השני.
--
-- 🔴 POST לתת-טופס אינו אידמפוטנטי. לכן יומן עם claim של 10 דקות ו-ack רק
-- אחרי שכל הכתיבות של הפריט הצליחו (rashal-push).
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.priority_call_push_log (
  key         text primary key,        -- event:<timeline_events.id> | note:<stop id>:<md5(note)>
  claimed_at  timestamptz,
  pushed_at   timestamptz,
  created_at  timestamptz not null default now()
);
comment on table public.priority_call_push_log is
  'יומן הכתיבה של מלל ותמונות הטכנאי לקריאת השירות בפריוריטי (15/09/2026). שרת בלבד.';
alter table public.priority_call_push_log enable row level security;
-- בלי מדיניות: סגור לבני אדם, רק service role.

-- ─── מה ממתין ─────────────────────────────────────────────────────────────
-- p_docno: בדיקה ממוקדת של קריאה אחת, בלי רצפת זמן.
-- 🔴 רצפת הזמן היא המתג. נפרס כבוי ('2100-01-01'), ואחרי אימות חי ב-15/09/2026
-- (SC2603217 מלל, SC2603233 ארבע תמונות ושתי הערות, כולם 201) הודלק מתחילת
-- 15/09 בשעון ישראל. מה שלפני כן כבר בכרטיס הלקוח; השלמה אחורה רק בהחלטת עידן.
create or replace function public.priority_call_push_candidates(p_limit integer default 60, p_docno text default null)
returns table (
  key text,
  kind text,
  docno text,
  user_name text,
  content text,
  metadata jsonb,
  at timestamptz,
  resolution_kind text
)
language sql stable security definer
set search_path = public
as $$
  with floor_at as (
    select timestamptz '2026-09-14 21:00:00+00' as t
  ),
  ev as (
    select 'event:' || te.id::text as key,
           te.type::text as kind,
           sc.priority_call_id as docno,
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
  select c.key, c.kind, c.docno, c.user_name, c.content, c.metadata, c.at, c.resolution_kind
    from (select * from ev union all select * from notes) c
    left join public.priority_call_push_log l on l.key = c.key
   where c.docno ~ '^[A-Za-z0-9_-]{1,30}$'
     and l.pushed_at is null
     and (l.claimed_at is null or l.claimed_at < now() - interval '10 minutes')
     and case when p_docno is not null then c.docno = p_docno
              else c.at >= (select t from floor_at) end
   order by c.at asc
   limit greatest(1, least(coalesce(p_limit, 60), 200));
$$;

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

revoke all on function public.priority_call_push_candidates(integer, text) from public, anon, authenticated;
revoke all on function public.priority_call_push_claim(text[]) from public, anon, authenticated;
revoke all on function public.priority_call_push_ack(text[]) from public, anon, authenticated;
