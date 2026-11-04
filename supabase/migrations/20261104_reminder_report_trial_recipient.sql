-- עידן 04/11 (ערב): "בשלושת הימים הראשונים לקבל בעצמי את דוח התזכורות, לראות איך הוא יוצא".
-- נמען עם `days` הוא זמני: מקבל רק עד שנשלחו N דוחות אמיתיים, ואז נופל לבד.
-- הספירה לפי `reminder_report_sent_dates` (תאריכים שיצאו באמת, לא יבש), כדי שלא
-- תהיה תלות בתאריך ההדלקה, שתלוי באישור של מטא.
alter table public.morning_report_settings
  add column if not exists reminder_report_sent_dates jsonb not null default '[]'::jsonb;
comment on column public.morning_report_settings.reminder_report_sent_dates is
  'תאריכי דוח התזכורות שיצאו באמת. נמען עם days מקבל רק עד שהרשימה מגיעה ל-days.';

update public.morning_report_settings
   set reminder_report_recipients = reminder_report_recipients
       || '[{"name":"עידן","phone_e164":"+972523694547","days":3}]'::jsonb
 where id = true
   and not exists (select 1 from jsonb_array_elements(reminder_report_recipients) r where r->>'name' = 'עידן');
