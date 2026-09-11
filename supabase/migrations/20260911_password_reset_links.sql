-- ════════════════════════════════════════════════════════════════════════
-- קישור איפוס סיסמה אישי, שהמנהל יוזם והמשתמש משלים בעצמו.
--
-- ⭐ **זה נוסף על כפתור המפתח הקיים ולא במקומו.** המפתח מגריל סיסמה
--    ומציג אותה למנהל פעם אחת; כאן המנהל לא רואה שום סיסמה, אלא שולח
--    לאדם קישור והוא בוחר בעצמו.
--
-- 🔴 **האסימון הגולמי לא נשמר כאן, רק הטביעה שלו.** מי שקורא את הטבלה
--    מחזיק בידיו מפתח לשינוי סיסמה של כל משתמש, ולכן הטבלה מחזיקה
--    `sha256` ולא את הערך עצמו. הערך הגולמי חי רק בהודעת הוואטסאפ
--    ובכתובת שהאדם פותח.
--
-- 🔴 **הטבלה סגורה לחלוטין בפני הדפדפן.** אין עליה שום מדיניות, כלומר
--    כל קריאה מהלקוח מחזירה ריק. הקריאה והכתיבה נעשות מהשרת בלבד,
--    בתפקיד השירות, ב-`api/admin-users.ts` וב-`api/password-reset.ts`.
-- ════════════════════════════════════════════════════════════════════════

-- ── טלפון על כרטיס המשתמש ────────────────────────────────────────────────
-- 🔴 בלי זה אין לאן לשלוח. הנהגים מקבלים התראות באפליקציה, ולכן עד היום
--    לא היה למערכת שום מספר של עובד, רק של לקוחות.
alter table public.profiles
  add column if not exists phone_e164 text;

comment on column public.profiles.phone_e164 is
  'טלפון העובד בפורמט E.164 (+9725...). משמש אך ורק לשליחת קישור איפוס סיסמה.';

-- ⭐ שומר פורמט ברמת המסד, כדי ששגיאת הקלדה לא תתגלה רק בשליחה שנכשלת.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_phone_e164_format'
  ) then
    alter table public.profiles
      add constraint profiles_phone_e164_format
      check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$');
  end if;
end $$;

-- ── האסימונים ────────────────────────────────────────────────────────────
create table if not exists public.password_reset_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  token_hash    text not null unique,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  used_at       timestamptz,
  -- מי יזם. 🔴 נשמר כדי שאפשר יהיה לשאול "מי שלח איפוס לחשבון הזה",
  -- וזו השאלה הראשונה כשחשבון נלקח.
  created_by    uuid references auth.users(id) on delete set null,
  -- צילום של המספר שאליו באמת יצאה ההודעה. הכרטיס יכול להשתנות אחר כך.
  sent_to_phone text,
  send_ok       boolean,
  send_detail   text,
  used_ip       text
);

create index if not exists idx_prt_user    on public.password_reset_tokens (user_id, created_at desc);
create index if not exists idx_prt_expires on public.password_reset_tokens (expires_at);

alter table public.password_reset_tokens enable row level security;
-- בכוונה בלי אף מדיניות: אין קורא לגיטימי בדפדפן.
revoke all on public.password_reset_tokens from anon, authenticated;

-- ── תצוגה למנהל: מתי נשלח איפוס אחרון לכל משתמש ──────────────────────────
-- ⭐ בלי האסימון ובלי הטביעה שלו, רק העובדה והזמן. זה מה שמנהל צריך
--    לראות בטבלה ("נשלח לפני 3 דקות") בלי לפתוח דלת לשום דבר אחר.
create or replace view public.password_reset_status
with (security_invoker = true) as
select
  t.user_id,
  max(t.created_at)                                    as last_sent_at,
  max(t.used_at)                                       as last_used_at,
  (array_agg(t.send_ok order by t.created_at desc))[1] as last_send_ok,
  count(*) filter (
    where t.used_at is null and t.expires_at > now()
  )                                                    as open_links
from public.password_reset_tokens t
group by t.user_id;

-- 🔴 התצוגה היא `security_invoker`, ולכן היא נשענת על ההרשאות של הקורא.
--    בלי ההענקה הזאת היא מחזירה ריק לכולם, כולל למנהל.
grant select on public.password_reset_status to authenticated;

-- ── ניקוי ────────────────────────────────────────────────────────────────
-- אסימון שפג או שומש כבר לא מוסיף דבר, וכל שורה שנשארת היא עוד טביעה
-- לשמור עליה. נשמר שבוע לצורך בירור "מי שלח למי", ואז נמחק.
create or replace function public.purge_password_reset_tokens()
returns integer
language sql
security definer
set search_path = public
as $fn$
  with gone as (
    delete from public.password_reset_tokens
     where created_at < now() - interval '7 days'
    returning 1
  )
  select count(*)::int from gone;
$fn$;

-- ── הערה על השומר ────────────────────────────────────────────────────────
-- ⭐ `phone_e164` כבר מוגן. השומר ב-`20260911_profiles_privilege_escalation_fix`
--    בודק את רשימת השדות הרגישים דרך `jsonb`, ולכן העמודה הזאת נכנסת
--    לתוקף ברגע שהיא נוצרת, **בלי להגדיר את הפונקציה פעם שנייה**.
--    🔴 הגדרה כפולה של פונקציה בשני קבצי מיגרציה היא מלכודת: הרצה מחדש
--    של הקובץ הישן מחזירה גרסה קודמת בשקט, בלי שום שגיאה. יש על זה בדיקה.
