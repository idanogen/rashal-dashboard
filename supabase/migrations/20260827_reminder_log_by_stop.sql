-- ראה migration שהוחל ב-Supabase: reminder_log_by_stop (27/08/2026)
-- יומן התזכורות עובר לזהות של עצירה ולא של הזמנה.
--
-- 🔴 **הצינון היה ממופתח על `order_id`, שהוא NOT NULL**, ולכן תזכורת על
-- קריאת שירות או על איסוף לא הייתה יכולה להירשם בכלל. השיבוץ חי
-- ב-`calendar_stops` מאז אפריל, ו"ביקור" הוא עצירה ולא הזמנה: לאותה
-- הזמנה יכולים להיות שני ביקורים, ולעצירה יכולה להיות אפס הזמנות.

alter table public.whatsapp_reminder_log
  add column if not exists stop_id uuid references public.calendar_stops(id) on delete cascade;

-- ⭐ הופך לאופציונלי ולא נמחק: השורות ההיסטוריות שנשענות עליו נשארות.
alter table public.whatsapp_reminder_log
  alter column order_id drop not null;

create index if not exists whatsapp_reminder_log_stop_idx
  on public.whatsapp_reminder_log (stop_id, reminder_kind);

comment on column public.whatsapp_reminder_log.stop_id is
  'העצירה ביומן שעליה נשלחה התזכורת. נוסף 27/08/2026: השיבוץ חי ב-calendar_stops, ו-order_id לבדו לא מזהה ביקור.';
