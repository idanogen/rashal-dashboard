-- רשימת מושתקים: מי שביקש שלא נפנה אליו יותר.
--
-- 🔴🔴 **הכלל שקדם לטבלה הזאת:** שורת הסרה שאין מי שיטפל בה גרועה
-- מאי-הבטחה. מי שישיב "הסר" וימשיך לקבל הוא בדיוק מי שיחסום את
-- המספר, וחסימות מורידות את דירוג האיכות של המספר כולו.
-- [[whatsapp_template_submission_traps]]
--
-- ⭐ עידן, 25/08/2026: "אני רוצה להיות הכי מסודר שיש... אנחנו לא
-- משווקים להם כלום, אנחנו פונים אליהם כי אנחנו צריכים." פנייה יזומה
-- ללקוח עבר מחייבת שלוש דלתות: **תבנית מאושרת · דרך יציאה שנשמעת ·
-- ובדיקה מולה לפני כל שליחה.** זו הדלת השלישית.

create table if not exists public.wa_suppressed (
  phone_local text primary key,
  -- מאיפה זה הגיע: הודעה נכנסת · הוספה ידנית · חסימה מצד heyy.
  source      text not null default 'inbound',
  reason      text,
  -- ⭐ ההודעה שגרמה לזה, מילה במילה. בלעדיה אי אפשר לבדוק אם הזיהוי
  -- האוטומטי צדק, וטעות כאן משתיקה לקוח שלא ביקש.
  evidence    text,
  added_by    text,
  created_at  timestamptz not null default now()
);

comment on table public.wa_suppressed is
  'טלפונים שביקשו שלא נפנה אליהם. נבדק לפני כל שליחה יזומה.';

alter table public.wa_suppressed enable row level security;
revoke all on public.wa_suppressed from anon, authenticated;
grant select on public.wa_suppressed to authenticated;

drop policy if exists suppressed_read_office on public.wa_suppressed;
create policy suppressed_read_office on public.wa_suppressed
  for select to authenticated using (public.is_office_staff());

-- ── הזיהוי האוטומטי ─────────────────────────────────────
--
-- 🔴 **רשימה סגורה וצרה, ורק כשההודעה כולה היא הבקשה.** "אל תשלחו לי
-- את זה בוואטסאפ, תתקשרו" אינה בקשת הסרה, ולקוח שהושתק בטעות נעלם
-- מאיתנו בלי שאיש ידע. לכן התאמה מלאה לביטוי, אחרי ניקוי סימני פיסוק,
-- ולא חיפוש מילה בתוך משפט.
create or replace function public.wa_is_optout(p_body text)
returns boolean
language sql
immutable
as $$
  select btrim(regexp_replace(lower(coalesce(p_body, '')), '[.!?,\s]+', ' ', 'g'))
         in ('הסר', 'הסירו', 'הסר אותי', 'להסיר', 'להסיר אותי', 'תסירו אותי',
             'הסירו אותי', 'תסירו', 'אל תשלחו לי הודעות', 'לא מעוניין',
             'לא מעוניינת', 'stop', 'unsubscribe', 'הפסיקו לשלוח');
$$;

comment on function public.wa_is_optout(text) is
  'האם ההודעה כולה היא בקשת הסרה. התאמה מלאה בלבד, ראה את ההערה במיגרציה.';

-- ── קליטה אוטומטית מהודעה נכנסת ─────────────────────────
--
-- ⭐ רשימה שמתמלאת ביד היא רשימה שתישאר ריקה. הקליטה קורית ברגע
-- שהלקוח כותב, בלי שאיש צריך לזכור.
create or replace function public.wa_note_optout(p_phone text, p_body text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_local text := public.wa_normalize_phone(p_phone);
begin
  if v_local is null or not public.wa_is_optout(p_body) then
    return false;
  end if;
  insert into public.wa_suppressed (phone_local, source, reason, evidence, added_by)
  values (v_local, 'inbound', 'בקשת הסרה בהודעה נכנסת', left(p_body, 300), 'system')
  on conflict (phone_local) do nothing;
  return true;
end;
$$;

revoke all on function public.wa_note_optout(text, text) from public, anon, authenticated;
