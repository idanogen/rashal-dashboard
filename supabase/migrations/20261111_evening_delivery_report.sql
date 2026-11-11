-- דוח האספקות עובר לערב (שלומי ועידן, 11/11/2026): "יש מצב שאת הדו"ח הזה נקבל ערב לפני
-- סביב 19:00, כך ניתן יהיה להבין מה לא בוצע ומי לא ביצע ולהגיב כבר בתכנון שלמחרת".
-- עידן: מחליף את דוח הבוקר, לא מוסיף עליו.
--
-- ⭐ המתג במסד: report_slot. 'morning' = הדוח של אתמול ב-07:00 בתבנית rashal_morning_report
--    (template_id), 'evening' = הדוח של היום ב-send_hour בתבנית rashal_evening_report
--    (evening_template_id). חזרה לבוקר = UPDATE אחד, שתי התבניות נשמרות.
-- דוח התזכורות (rashal_reminder_report) נשאר בבוקר בכל מקרה: התשובות מגיעות בלילה.
-- מדידה לפני ההחלטה (21/10 עד 10/11): ברוב הימים 0 עד 3 עצירות מדווחות אחרי 19:00.

alter table public.morning_report_settings
  add column if not exists report_slot text not null default 'morning',
  add column if not exists evening_template_id text;

alter table public.morning_report_settings drop constraint if exists morning_report_settings_slot_check;
alter table public.morning_report_settings
  add constraint morning_report_settings_slot_check check (report_slot in ('morning', 'evening'));

comment on column public.morning_report_settings.report_slot is
  'morning = דוח אתמול ב-07:00 (template_id), evening = דוח היום ב-send_hour (evening_template_id).';
comment on column public.morning_report_settings.evening_template_id is
  'תבנית heyy rashal_evening_report (הוגשה 11/11/2026). משתנה follow_up נפרד, not_delivered מספר בלבד.';

update public.morning_report_settings
   set evening_template_id = 'cc64e289-3228-48b1-9cba-05b40850753f'
 where id = true and evening_template_id is null;

-- הקרון: רק לוח הזמנים משתנה (הפקודה והכותרות נשארות כמו שהן במסד). חלון בוקר
-- 04-05 UTC (דוח התזכורות, ומצב בוקר) וחלון ערב 16-17 UTC (19:00 בקיץ ובחורף).
-- הפונקציה מכריעה לפי השעה בישראל ולפי report_slot.
select cron.alter_job(
  (select jobid from cron.job where jobname = 'rashal-morning-report'),
  schedule := '*/10 4-5,16-17 * * 0-5');
