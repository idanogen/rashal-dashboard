-- ════════════════════════════════════════════════════════════════════════
-- איפוס סיסמה בשירות עצמי ממסך ההתחברות (עידן, 18/09/2026).
-- התוכנית המלאה: `docs/PASSWORD-RESET-SELF-SERVICE-PLAN.md`.
--
-- הליבה כבר קיימת מ-11/09 (`20260911_password_reset_links.sql`): אסימון
-- מגובב, מסך `/reset/<אסימון>`, ושינוי סיסמה בלי משתמש מחובר. כאן נבנית
-- **הדלת הקדמית בלבד**: מאיפה בא הטלפון, ומי מותר לו לבקש.
--
-- 🔴 **המדידה שהתהפכה.** ב-11/09 הפיצ'ר נעצר כי 3 מתוך 21 משתמשים החזיקו
-- טלפון ואפס מעשרת הנהגים. הסתבר (18/09) שהמספרים של כל הנהגים היו שם
-- כל הזמן, בכרטיס העובד (`assignees.phone`), עם קישור מלא דרך
-- `profiles.linked_driver`. חיפשתי בטבלה אחת ולא בשתיים.
-- [[missing_attribute_is_not_absence]]
--
-- 🔴 **אין כאן אף מספר טלפון כתוב.** המילוי נגזר מהמסד, והמספרים של מי
-- שאינו צוות שטח מוזנים דרך מסך ניהול המשתמשים. קובץ מיגרציה יושב בגיט,
-- ומספר אישי לא נכנס לגיט.
-- ════════════════════════════════════════════════════════════════════════

-- ── E.164, על גבי הנרמול הקיים ואל מולו ─────────────────────────────────
-- 🔴 בלי להמציא נרמול שני: `wa_normalize_phone` הוא הצורה המקומית שכל
--    התאמת טלפון במערכת עוברת דרכה, וכאן רק נעטפת לנייד ישראלי תקין.
--    מה שאינו נייד ישראלי מחזיר null, כי לשם ממילא אין לנו איך לשלוח.
create or replace function public.phone_to_e164(raw text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when public.wa_normalize_phone(raw) ~ '^05[0-9]{8}$'
      then '+972' || right(public.wa_normalize_phone(raw), 9)
  end;
$$;

comment on function public.phone_to_e164(text) is
  'נייד ישראלי בלבד → +9725XXXXXXXX. כל השאר null.';

-- ── טלפון העובד זורם מכרטיס העובד לכרטיס המשתמש ─────────────────────────
-- ⭐ מקור האמת לטלפון של צוות השטח הוא מסך הצוות, שבו המשרד כבר מתחזק
--    מספרים. בלי הזרימה הזאת, עדכון מספר במסך הצוות משאיר את האיפוס
--    תלוי במספר ישן, וזה מתגלה רק כשמישהו לא מקבל הודעה.
-- 🔴 `security definer`: הטריגר `trg_profiles_guard` חוסם כתיבה ל-
--    `phone_e164` מכל מי שאינו תפקיד שירות, והבעלים כאן הוא postgres.
create or replace function public.sync_profile_phone_from_assignee()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  e164 text := public.phone_to_e164(new.phone);
begin
  if e164 is null then return new; end if;

  update public.profiles p
     set phone_e164 = e164,
         updated_at = now()
   where p.linked_driver = new.name
     and coalesce(p.disabled, false) = false
     and p.phone_e164 is distinct from e164
     -- 🔴 אותו מספר על שני חשבונות פעילים הופך את הזיהוי לדו-משמעי,
     --    והאינדקס למטה יפיל את הכתיבה. מוותרים בשקט על העדכון במקום
     --    להפיל עריכה של כרטיס עובד במסך הצוות.
     and not exists (
       select 1 from public.profiles q
        where q.phone_e164 = e164
          and q.id <> p.id
          and coalesce(q.disabled, false) = false
     );
  return new;
end;
$fn$;

drop trigger if exists trg_assignee_phone_to_profile on public.assignees;
create trigger trg_assignee_phone_to_profile
  after insert or update of phone, name on public.assignees
  for each row execute function public.sync_profile_phone_from_assignee();

-- מילוי ראשון, נגזר מהמסד ובר-הרצה חוזרת.
update public.profiles p
   set phone_e164 = public.phone_to_e164(a.phone),
       updated_at = now()
  from public.assignees a
 where a.name = p.linked_driver
   and coalesce(p.disabled, false) = false
   and public.phone_to_e164(a.phone) is not null
   and p.phone_e164 is distinct from public.phone_to_e164(a.phone);

-- ── מספר אחד, חשבון אחד ─────────────────────────────────────────────────
-- 🔴 זיהוי לפי טלפון (החלטת עידן 18/09) שווה בדיוק לחד-משמעיות של המספר.
--    בלי האינדקס הזה, שני חשבונות על אותו נייד שולחים קישור לחשבון הלא
--    נכון, והאדם משנה סיסמה של מישהו אחר בלי לדעת.
create unique index if not exists profiles_phone_e164_active_uniq
  on public.profiles (phone_e164)
  where phone_e164 is not null and coalesce(disabled, false) = false;

-- ── הגדרות המנגנון ──────────────────────────────────────────────────────
-- ⭐ התקרות יושבות במסד ולא בקוד, כדי שאפשר יהיה לכבות או להרפות בלי
--    פריסה. `enabled=false` מכבה את הכפתור הציבורי ומשאיר את המסלול של
--    המנהל עובד.
create table if not exists public.password_reset_settings (
  id              boolean primary key default true check (id),
  enabled         boolean not null default true,
  ttl_minutes     integer not null default 15  check (ttl_minutes between 5 and 60),
  per_phone_hour  integer not null default 3   check (per_phone_hour  between 1 and 20),
  per_phone_day   integer not null default 5   check (per_phone_day   between 1 and 50),
  per_ip_hour     integer not null default 10  check (per_ip_hour     between 1 and 100),
  global_hour     integer not null default 30  check (global_hour     between 1 and 500),
  updated_at      timestamptz not null default now()
);
insert into public.password_reset_settings (id) values (true) on conflict (id) do nothing;

alter table public.password_reset_settings enable row level security;
-- בלי מדיניות: קריאה וכתיבה מהשרת בלבד.

-- ── יומן הבקשות והתקרות ─────────────────────────────────────────────────
-- 🔴 **המספר עצמו לא נשמר כאן, רק גיבוב.** זו הטבלה שמזינה נקודת קצה
--    פתוחה לאינטרנט, ומי שמצליח לקרוא אותה לא יקבל רשימת ניידים של
--    עובדי ר.שעל. הגיבוב מספיק כדי לספור.
create table if not exists public.password_reset_requests (
  id          uuid primary key default gen_random_uuid(),
  phone_hash  text not null,
  ip          text,
  outcome     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists prr_phone_time on public.password_reset_requests (phone_hash, created_at desc);
create index if not exists prr_ip_time    on public.password_reset_requests (ip, created_at desc);
create index if not exists prr_time       on public.password_reset_requests (created_at desc);

alter table public.password_reset_requests enable row level security;
-- בלי מדיניות: שרת בלבד.

comment on table public.password_reset_requests is
  'כל בקשת איפוס מהמסך הציבורי, לפי גיבוב המספר. מזין את התקרות. שרת בלבד.';

-- ── השער: סופר, מחליט, ורושם, בקריאה אחת ────────────────────────────────
-- ⭐ הספירה והרישום באותה פונקציה בכוונה. שתי קריאות נפרדות נפרדות גם
--    בזמן, ושתי בקשות שמגיעות יחד עוברות שתיהן את התקרה.
-- מחזיר: {"verdict":"ok|disabled|phone_hour|phone_day|ip_hour|global_hour",
--          "id":"<uuid>", "ttl_minutes":15}
create or replace function public.password_reset_request_gate(p_phone_hash text, p_ip text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  s public.password_reset_settings%rowtype;
  verdict text := 'ok';
  new_id uuid;
begin
  select * into s from public.password_reset_settings where id;

  if not coalesce(s.enabled, false) then
    verdict := 'disabled';
  elsif (select count(*) from public.password_reset_requests
          where phone_hash = p_phone_hash and created_at > now() - interval '1 hour') >= s.per_phone_hour then
    verdict := 'phone_hour';
  elsif (select count(*) from public.password_reset_requests
          where phone_hash = p_phone_hash and created_at > now() - interval '1 day') >= s.per_phone_day then
    verdict := 'phone_day';
  elsif p_ip is not null and (select count(*) from public.password_reset_requests
          where ip = p_ip and created_at > now() - interval '1 hour') >= s.per_ip_hour then
    verdict := 'ip_hour';
  elsif (select count(*) from public.password_reset_requests
          where created_at > now() - interval '1 hour') >= s.global_hour then
    verdict := 'global_hour';
  end if;

  insert into public.password_reset_requests (phone_hash, ip, outcome)
  values (p_phone_hash, p_ip, verdict)
  returning id into new_id;

  return jsonb_build_object('verdict', verdict, 'id', new_id, 'ttl_minutes', s.ttl_minutes);
end;
$fn$;

-- סגירת הבקשה בתוצאה האמיתית (נשלח · אין משתמש · שליחה נכשלה · מושתק).
create or replace function public.password_reset_request_outcome(p_id uuid, p_outcome text)
returns void
language sql
security definer
set search_path = public
as $fn$
  update public.password_reset_requests
     set outcome = left(coalesce(p_outcome, 'unknown'), 40)
   where id = p_id;
$fn$;

-- ── ניקוי ───────────────────────────────────────────────────────────────
-- שלושים יום מספיקים לכל בירור ("מי ביקש איפוס למספר הזה"), ומעבר לזה
-- זו רק ערימת גיבובים לשמור עליה.
create or replace function public.purge_password_reset_requests()
returns integer
language sql
security definer
set search_path = public
as $fn$
  with gone as (
    delete from public.password_reset_requests
     where created_at < now() - interval '30 days'
    returning 1
  )
  select count(*)::int from gone;
$fn$;

revoke all on function public.phone_to_e164(text) from public, anon, authenticated;
revoke all on function public.password_reset_request_gate(text, text) from public, anon, authenticated;
revoke all on function public.password_reset_request_outcome(uuid, text) from public, anon, authenticated;
revoke all on function public.purge_password_reset_requests() from public, anon, authenticated;
