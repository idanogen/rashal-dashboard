-- עידן 04/11 (ערב): "לשלוח את הדוח הזה לאבירם, לא דוחות נוספים". לדוח התזכורות
-- רשימת נמענים משלו, ואבירם יורד מדוח הבוקר (נוסף אליו בטעות ב-20261104_reminder_replies).
alter table public.morning_report_settings
  add column if not exists reminder_report_recipients jsonb not null default '[]'::jsonb;
comment on column public.morning_report_settings.reminder_report_recipients is
  'נמעני דוח התזכורות (rashal_reminder_report) בלבד. נפרד מ-recipients של דוח הבוקר: אבירם מקבל רק אותו.';

update public.morning_report_settings
   set reminder_report_recipients = '[
     {"name":"רונן","phone_e164":"+972504244333"},
     {"name":"שלומי","phone_e164":"+972586664848"},
     {"name":"עמי","phone_e164":"+972584847477"},
     {"name":"אבירם","phone_e164":"+972585393000"}
   ]'::jsonb,
       recipients = (select coalesce(jsonb_agg(r), '[]'::jsonb) from jsonb_array_elements(recipients) r
                      where r->>'phone_e164' <> '+972585393000')
 where id = true;
