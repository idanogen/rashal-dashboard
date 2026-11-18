-- ─── ארכיון קריאות שירות לפי סטטוס בפריוריטי (18/11/2026) ─────────────────
--
-- עידן (17-18/11, אחרי השוואה מול ייצוא של כל הקריאות מפריוריטי): ברשימת
-- הקריאות של הסדרן נשארות רק "לביצוע" ו"להמשך טיפול". כל השאר עובר לארכיון,
-- שאפשר לחפש בו ולהחזיר ממנו קריאה לרשימה.
--
-- ⭐ למה כלל במסד ולא העברה חד פעמית: מ-15/09 המערכת שלנו כותבת את הסטטוס
-- לפריוריטי (668 כתיבות עד 18/11), ולכן קדימה הרשימה נקייה לבד. הכלל מטפל
-- בקריאה שמגיעה בסטטוס אחר (בעיקר "שובצה", ששובץ פעם בפריוריטי ולא אצלנו),
-- ומחזיר לרשימה קריאה שהמשרד פתח מחדש בפריוריטי.
--
-- 🔴 אין כאן כתיבה לפריוריטי ואין נגיעה ב-`calendar_stops`. ארכיון = `archived_at`,
-- שכבר מסנן את כל המסכים (20260805_priority_status_and_archive.sql). הסנכרון
-- לא כותב לעמודה הזאת, לכן הארכיון לא נדרס בריצה הבאה.
--
-- הפיך: update service_calls set archived_at = null, archived_reason = null
--        where archived_reason like 'cleanup-20261118%';

-- ── הכלל קדימה ──
create or replace function public.service_call_archive_by_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- סטטוס שאינו עבודה פתוחה ואינו סגירה (שובצה, טופל טכנאי, השלמת פרטים...) → ארכיון.
  if new.priority_status is not null
     and new.priority_status not in ('לביצוע', 'להמשך טיפול', 'בוצעה', 'סופית', 'מבוטלת', 'טיוטא')
     and (tg_op = 'INSERT' or new.priority_status is distinct from old.priority_status)
     and new.archived_at is null then
    new.archived_at := now();
    new.archived_reason := 'rule:' || new.priority_status;
  -- המשרד פתח מחדש בפריוריטי → חוזרת לרשימה. רק מה שהכלל או הניקוי העבירו;
  -- ארכיון ישן מאוגוסט (webhook-legacy, backfill) לא נפתח מכאן.
  elsif tg_op = 'UPDATE'
     and new.priority_status in ('לביצוע', 'להמשך טיפול')
     and new.priority_status is distinct from old.priority_status
     and (new.archived_reason like 'rule:%' or new.archived_reason like 'cleanup-20261118%') then
    new.archived_at := null;
    new.archived_reason := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_service_call_archive_by_status on public.service_calls;
create trigger trg_service_call_archive_by_status
  before insert or update of priority_status on public.service_calls
  for each row execute function public.service_call_archive_by_status();

-- ── הניקוי החד פעמי ──
-- שלוש קבוצות (234 ב-18/11): סטטוס שאינו לביצוע/להמשך טיפול, קריאה ישנה
-- (לפני 15/09) שלא שובצה אצלנו אף פעם, ושורה בלי מספר קריאה (שאריות Make).
-- קריאה עם ביקור פתוח מהשבוע האחרון או קדימה נשארת, כדי שלא יהיה ביקור חי
-- על קריאה שנעלמה מהרשימה.
with target as (
  select sc.id,
    case
      when sc.priority_call_id is null then 'cleanup-20261118:no-sc'
      when sc.priority_status not in ('לביצוע', 'להמשך טיפול') then 'cleanup-20261118:status'
      else 'cleanup-20261118:legacy'
    end as reason
  from public.service_calls sc
  where sc.archived_at is null
    and sc.duplicate_of is null
    and (sc.priority_status is null or sc.priority_status not in ('בוצעה', 'סופית', 'מבוטלת', 'טיוטא'))
    and (sc.service_call_status is null or sc.service_call_status::text not in ('בוצע', 'בוטל'))
    -- רק מה שמוצג היום (חלון הנתונים של המסך, 180 יום), לא אלפי קריאות ישנות שממילא מוסתרות.
    and (sc.created_at >= now() - interval '180 days' or sc.updated_at >= now() - interval '180 days')
    and (sc.priority_call_id is null
         or sc.priority_status not in ('לביצוע', 'להמשך טיפול')
         or (sc.created_at < '2026-09-15'
             and not exists (select 1 from public.calendar_stops cs where cs.service_call_id = sc.id)))
    and not exists (
      select 1 from public.calendar_stops cs
      where cs.service_call_id = sc.id
        and cs.status not in ('completed', 'not_completed')
        and cs.delivery_date >= current_date - 7)
)
update public.service_calls sc
   set archived_at = now(), archived_reason = t.reason
  from target t
 where sc.id = t.id;

-- כפילים של מה שעבר: יוצאים איתו, אחרת כפיל יתום צץ ברשימה במקומו.
update public.service_calls d
   set archived_at = now(), archived_reason = 'cleanup-20261118:dup'
  from public.service_calls h
 where d.duplicate_of = h.id
   and d.archived_at is null
   and h.archived_reason like 'cleanup-20261118%';
