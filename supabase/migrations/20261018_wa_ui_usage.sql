-- מדידת שימוש בממשקי הוואטסאפ: תיבת השיחות בדשבורד מול התוסף בפריוריטי.
--
-- 🔴 הרקע (18/10/2026): מדידה של 30 יום הראתה כ-29 קריאות לתוסף, כ-13
-- הודעות שעובדים שלחו מול כ-1,200 אוטומטיות, ו-76 מתוך 87 שיחות שבוע
-- אחרון שלא נקראו. עידן רצה דרך אמינה לדעת אם הצוות משתמש בכלים, ולא
-- הייתה: שני הממשקים כתבו את אותו `triggered_by`, פתיחת התיבה לא נרשמה,
-- ו-`wa_conversations.read_by` שומר רק את הקורא האחרון.
--
-- ⭐ שלושה מקורות, שאילתה אחת:
--   · `whatsapp_outbound.sent_from` · מאיזה ממשק יצאה הודעה (api/wa-send)
--   · `wa_ui_usage_log` · פתיחות (open), שיחה שנפתחה ביד (read), חלונית
--     שעמדה על מסמך בפריוריטי (context)
--   · `wa_ui_usage_weekly()` · לכל אדם ולכל שבוע (ראשון עד שבת, שעון ישראל)
--
-- המקור נקבע ב-`api/_lib/ui-source.ts`: התוסף מזוהה לפי `Origin` שהדפדפן
-- חותם, ולכן הוא נספר בלי גרסה חדשה בחנות.

alter table public.whatsapp_outbound
  add column if not exists sent_from text;

comment on column public.whatsapp_outbound.sent_from is
  'מאיזה ממשק יצאה הודעה של עובד: inbox (דף התיבה) · dock (החלונית הצפה) · extension (התוסף בפריוריטי) · unknown. ריק לפני 18/10/2026 ובשליחות אוטומטיות.';

create table if not exists public.wa_ui_usage_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  -- ⭐ נשמר גם כטקסט: זה מה שמחבר לשליחות (`triggered_by` נושא מייל).
  email text,
  ui text not null check (ui in ('inbox', 'dock', 'extension', 'unknown')),
  event text not null check (event in ('open', 'read', 'context')),
  created_at timestamptz not null default now()
);

create index if not exists wa_ui_usage_log_recent_idx
  on public.wa_ui_usage_log (created_at desc);
create index if not exists wa_ui_usage_log_user_idx
  on public.wa_ui_usage_log (user_id, ui, event, created_at desc);

alter table public.wa_ui_usage_log enable row level security;

-- 🔴 אין מדיניות כתיבה: כותבים רק השרת (service role) והפונקציה למטה.
drop policy if exists management_reads_wa_ui_usage on public.wa_ui_usage_log;
create policy management_reads_wa_ui_usage on public.wa_ui_usage_log
  for select to authenticated using ((select public.is_management()));

comment on table public.wa_ui_usage_log is
  'שימוש של עובדים בממשקי הוואטסאפ: פתיחת התיבה, פתיחת שיחה ביד, חלונית התוסף על מסמך. נולד 18/10/2026 כדי לדעת אם הצוות משתמש בכלים.';

-- ── פתיחת התיבה בדשבורד ────────────────────────────────────
--
-- 🔴 עשר דקות של שקט לכל אדם ולכל ממשק. מעבר בין מסכים מרכיב את הלוח
-- מחדש, ו-StrictMode מרכיב פעמיים: בלי זה כל ביקור היה נספר כשלושה.
create or replace function public.log_wa_ui_open(p_ui text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;
  if p_ui not in ('inbox', 'dock') then
    raise exception 'unknown ui: %', p_ui;
  end if;
  -- נהג לא רואה את התיבה, ואם הגיע לכאן זה לא שימוש שמעניין אותנו.
  if (select public.is_office_staff()) is not true then return; end if;

  if exists (
    select 1 from public.wa_ui_usage_log
    where user_id = v_uid and ui = p_ui and event = 'open'
      and created_at > now() - interval '10 minutes'
  ) then
    return;
  end if;

  insert into public.wa_ui_usage_log (user_id, email, ui, event)
  select v_uid, lower(u.email), p_ui, 'open'
  from auth.users u where u.id = v_uid;
end;
$$;

revoke all on function public.log_wa_ui_open(text) from public, anon;
grant execute on function public.log_wa_ui_open(text) to authenticated, service_role;

-- ── השאילתה: מי משתמש במה, לפי שבוע ───────────────────────
--
-- ⭐ שליחות נספרות מ-`whatsapp_outbound` (כל ניסיון, גם שנכשל: זה שימוש).
-- `unattributed` = שליחה מלפני 18/10/2026, שאין לה מקור.
-- 🔴 המייל של עובדי ר.שעל הוא כינוי פנימי (`u…@rashal.internal`), ולכן
-- השם נלקח מ-`profiles`. המייל נשאר בעמודה נפרדת לחיבור ולבדיקה.
drop function if exists public.wa_ui_usage_weekly(integer);
create or replace function public.wa_ui_usage_weekly(p_weeks integer default 8)
returns table (
  week_start date,
  person text,
  role text,
  email text,
  inbox_opens integer,
  dock_opens integer,
  ext_contexts integer,
  reads_inbox integer,
  reads_dock integer,
  reads_ext integer,
  sends_inbox integer,
  sends_dock integer,
  sends_ext integer,
  sends_unattributed integer
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if (select public.is_management()) is not true then
    raise exception 'not allowed';
  end if;

  return query
  with since as (
    select now() - make_interval(weeks => greatest(1, least(p_weeks, 104))) as t
  ),
  ev as (
    select (l.created_at at time zone 'Asia/Jerusalem')::date as d,
           coalesce(l.email, l.user_id::text) as who,
           l.ui, l.event as kind
    from public.wa_ui_usage_log l, since
    where l.created_at >= since.t
    union all
    select (o.created_at at time zone 'Asia/Jerusalem')::date,
           lower(split_part(o.triggered_by, ':', 2)),
           coalesce(o.sent_from, 'unattributed'),
           'send'
    from public.whatsapp_outbound o, since
    where o.created_at >= since.t
      and o.triggered_by like 'priority-panel:%'
  )
  select (ev.d - extract(dow from ev.d)::int) as week_start,
         coalesce(max(p.full_name), max(p.username), ev.who) as person,
         max(p.role)::text as role,
         ev.who as email,
         count(*) filter (where kind = 'open' and ui = 'inbox')::int,
         count(*) filter (where kind = 'open' and ui = 'dock')::int,
         count(*) filter (where kind = 'context')::int,
         count(*) filter (where kind = 'read' and ui = 'inbox')::int,
         count(*) filter (where kind = 'read' and ui = 'dock')::int,
         count(*) filter (where kind = 'read' and ui = 'extension')::int,
         count(*) filter (where kind = 'send' and ui = 'inbox')::int,
         count(*) filter (where kind = 'send' and ui = 'dock')::int,
         count(*) filter (where kind = 'send' and ui = 'extension')::int,
         count(*) filter (where kind = 'send' and ui in ('unattributed', 'unknown'))::int
  from ev
  left join public.profiles p on lower(p.email) = ev.who
  group by 1, ev.who
  order by 1 desc, 2;
end;
$$;

revoke all on function public.wa_ui_usage_weekly(integer) from public, anon;
grant execute on function public.wa_ui_usage_weekly(integer) to authenticated, service_role;

comment on function public.wa_ui_usage_weekly(integer) is
  'שימוש של כל עובד בממשקי הוואטסאפ, לפי שבוע (ראשון, שעון ישראל): פתיחות, שיחות שנפתחו ביד ושליחות, לכל ממשק. להנהלה בלבד. 18/10/2026.';
