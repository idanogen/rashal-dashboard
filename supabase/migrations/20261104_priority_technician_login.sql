-- "לטיפול" בקריאת שירות (DOCUMENTS_Q.TECHNICIANLOGIN): מי טיפל, נכתב בסיום הביקור
-- יחד עם הסטטוס (עידן, 04/11/2026). הכותב: rashal-call-status, הפעמון: rashal-watchdog.
--
-- 🔴 הערך הוא שם משתמש בפריוריטי, לא שם חופשי. המיפוי במסך הצוות (assignees.priority_login),
--    ורשימת המשתמשים החיה ב-priority_users (נמשכת פעם ביום בימי עבודה, ראשון עד חמישי).
-- 🔴 "רשימת נותני שרות" שעידן ייצא (12 שמות) אינה רשימת הערכים: הטכנאים חסרים בה
--    ובכל זאת יושבים בשדה. השמות שלמטה לקוחים ממה שפריוריטי כבר שמרה ב-TECHNICIANLOGIN.
-- 🔴 מוהנד ומוחמד: אין משתמש. הוכרע דילוג עם התרעה (04/11), לכן נשארים null.

alter table public.assignees add column if not exists priority_login text;
comment on column public.assignees.priority_login is
  'שם המשתמש בפריוריטי (USERS.USERLOGIN). נכתב ל-DOCUMENTS_Q.TECHNICIANLOGIN ("לטיפול") כשהטכנאי מסמן בוצע/המשך טיפול. ריק = לא נכתב, והוואצ\'דוג מתריע.';

update public.assignees set priority_login = v.login, updated_at = now()
  from (values
    ('אבי', 'אבי'), ('אולג', 'אולג'), ('ישראל', 'ישראל'), ('מיכאל', 'מיכאל'), ('אלכסיי', 'אלכסיי'),
    ('דוד גוזלן', 'גוזלן'), ('דוד חסידים', 'חסידים'), ('רודי', 'רודי')
  ) as v(name, login)
 where assignees.name = v.name and assignees.priority_login is null;

create table if not exists public.priority_users (
  login     text primary key,
  full_name text,
  seen_at   timestamptz not null default now()
);
comment on table public.priority_users is 'רשימת המשתמשים של פריוריטי (USERS), מטמון יומי לאימות "לטיפול". נמשך בימי עבודה בלבד.';
alter table public.priority_users enable row level security;
drop policy if exists priority_users_read_office on public.priority_users;
create policy priority_users_read_office on public.priority_users
  for select to authenticated using ((select public.is_office_staff()));

alter table public.priority_call_status_writes
  add column if not exists technician_login text,
  add column if not exists technician_result text check (technician_result in ('done', 'skipped', 'failed')),
  add column if not exists technician_error text;
comment on column public.priority_call_status_writes.technician_result is
  'done = TECHNICIANLOGIN נכתב ואומת בקריאה חוזרת · skipped = לא נכתב (סיבה ב-technician_error) · failed = פריוריטי דחה';
