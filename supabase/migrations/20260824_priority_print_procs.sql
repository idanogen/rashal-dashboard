-- מה שנלמד על מסכי ההדפסה של פריוריטי, פעם אחת לכל החברה.
--
-- 🔴🔴 **הבעיה שזה פותר, כלשונו של עידן (24/08/2026):** "למה המערכת לא
-- מכירה את המסמכים?" התוסף מפיק מסמך על ידי הרצת פרוצדורת ההדפסה של
-- פריוריטי, ולפריוריטי אין שום ממשק שמספר איזו פרוצדורה שייכת לאיזה
-- מסך ובאילו פרמטרים. לכן התוסף **לומד** מצפייה בהדפסה ידנית אחת.
--
-- עד היום מה שנלמד נשמר ב-`chrome.storage`, כלומר **פר דפדפן**. כל עובד
-- חדש התחיל מאפס, החלפת מחשב מחקה את הידע, וכפתור השליחה היה אפור בפעם
-- הראשונה בכל סוג מסמך. זה ידע של החברה, לא של המשתמש.
--
-- ⭐ **מה נשמר כאן, ומה לא:** רק המיפוי הטכני של המסך אל פרוצדורת
-- ההדפסה. אין כאן שום נתון של לקוח ושום תוכן מסמך.
--
-- 🔴 **הפרמטרים שונים בין מסכים ואי אפשר לנחש אותם.** אומת ב-17/08:
-- תעודת משלוח שולחת `format=-3` וחשבונית מס שולחת `format=-1`, בזמן
-- שבשני המסכים הבחירה בתפריט נראית זהה. לכן נשמרת **כל התשובה לדיאלוג**
-- ולא רק שם הפרוצדורה.

create table if not exists public.priority_print_procs (
  -- שם המסך בפריוריטי, למשל DOCUMENTS_D
  form            text primary key,
  ename           text not null,
  table_name      text not null,
  avoidmessages   text,
  -- mode · format · sendattach · copies · pdf · sign · quick
  print_args      jsonb not null default '{}'::jsonb,
  learned_by      text,
  learned_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.priority_print_procs is
  'מיפוי מסך בפריוריטי אל פרוצדורת ההדפסה שלו. נלמד מצפייה בהדפסה ידנית אחת, ומשותף לכל העובדים.';

alter table public.priority_print_procs enable row level security;

-- ⭐ קריאה לכל מי שמחובר: זה מיפוי טכני פנימי, והוא נדרש לכל עובד
-- שמפעיל את התוסף.
drop policy if exists print_procs_read on public.priority_print_procs;
create policy print_procs_read
  on public.priority_print_procs
  for select
  to authenticated
  using (true);

-- 🔴 **ואין שום מדיניות כתיבה, בכוונה.** הכתיבה נעשית רק דרך
-- `api/priority-context` שרץ עם service_role, אחרי ש**אותה הרצה באמת
-- החזירה קובץ**. בלי זה כל לשונית פתוחה יכלה לדרוס לכל החברה את מה
-- שנלמד, בערך שלא הוכיח את עצמו.

create index if not exists priority_print_procs_updated_idx
  on public.priority_print_procs (updated_at desc);
