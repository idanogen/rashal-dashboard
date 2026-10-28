-- ─── עריכה מהשטח: מוסיפים, לא דורסים, גם אצלנו (עידן, 28/10/2026 ערב) ───
--
-- עידן: "אני לא רוצה לדרוס את הקיים". עד עכשיו `stop_details_change` החליפה את
-- הטלפון והכתובת של העצירה (הישן נשמר רק ביומן ובצ'אט). מהיום:
--   * טלפון: הוספה בלבד. הטלפון מפריוריטי (`phone`) לא משתנה; מה שהטכנאי
--     מקליד נכנס ל-`phone_extra` ומוצג לידו עם חיוג.
--   * כתובת: החדשה נכנסת לניווט (`address`/`city`), והמקורית מפריוריטי נשמרת
--     ב-`original_address`/`original_city` בפעם הראשונה ולא נדרסת אחר כך.
--     החזרה לכתובת המקורית מנקה אותן.
-- הפונקציה עצמה מוגדרת ב-`20261028_field_detail_changes.sql` (קובץ אחד לפונקציה).

alter table public.calendar_stops
  add column if not exists phone_extra text,
  add column if not exists original_address text,
  add column if not exists original_city text;

comment on column public.calendar_stops.phone_extra is 'טלפון נוסף שנרשם מהשטח או מהמשרד. הטלפון הראשי (phone) לא נדרס.';
comment on column public.calendar_stops.original_address is 'הכתובת כפי שהגיעה מפריוריטי, נשמרת כשמשנים את כתובת הניווט. ריק = לא שונה.';
