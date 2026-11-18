-- ─── דוחות הבוקר והערב גם במייל (שלומי, 18/11/2026) ─────────────────────────
-- "לשלוח רק למיילים הבאים, כל השאר להשאיר בוואטסאפ": tikon, logistics, info.
-- נמעני הוואטסאפ (`recipients`, `reminder_report_recipients`) לא משתנים.
alter table public.morning_report_settings
  add column if not exists email_recipients text[] not null default '{}';
comment on column public.morning_report_settings.email_recipients is
  'כתובות שמקבלות את דוח האספקות ודוח התזכורות במייל (rashal-morning-report). ריק = רק וואטסאפ.';
update public.morning_report_settings
   set email_recipients = array['tikon@mishal.co.il', 'logistics@mishal.co.il', 'info@mishal.co.il']
 where id;
