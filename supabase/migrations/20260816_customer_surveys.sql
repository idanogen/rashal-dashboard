-- סקר שביעות רצון לקוחות · 16/08/2026
--
-- שורה אחת = אספקה אחת שנסגרה = קישור אישי אחד.
-- הלקוח לא ממלא שום פרט מזהה: הטוקן שבכתובת הוא שקושר את התשובה לעצירה,
-- ודרכה לנהג, לקופה ולהזמנה.
--
-- העמוד עצמו לא ניגש לטבלה הזו. הגישה היחידה היא דרך /api/survey עם הרשאת
-- שרת, ולכן אין כאן שום policy ל-anon. משתמש מחובר בדשבורד מקבל קריאה בלבד.

create table if not exists public.customer_surveys (
  id uuid primary key default gen_random_uuid(),

  -- הטוקן שבכתובת. 32 תווים הקסה, מקורם ב-uuid אקראי (122 ביט).
  token text not null unique
    default replace(gen_random_uuid()::text, '-', ''),

  -- ── מה סופק, ולמי ─────────────────────────────────────────────────
  stop_id         uuid references public.calendar_stops(id) on delete set null,
  order_id        uuid references public.orders(id) on delete set null,
  customer_number text,          -- CUSTNAME בפריוריטי
  customer_name   text,
  phone_e164      text,
  driver          text,
  health_fund     text,          -- הקופה כפי שהייתה ברגע האספקה
  delivered_at    timestamptz,   -- calendar_stops.completed_at

  -- ── השליחה ────────────────────────────────────────────────────────
  scheduled_send_at timestamptz, -- מתי ההודעה אמורה לצאת (סגירה + שעה, אחרי ההגנות)
  sent_at           timestamptz,
  send_channel      text check (send_channel in ('template', 'text')),
  send_error        text,

  status      text not null default 'pending'
    check (status in ('pending', 'sent', 'answered', 'skipped', 'failed')),
  skip_reason text,              -- למה לא נשלח: אין טלפון · נשלח לאותו לקוח החודש · לא בוצע

  -- ── התשובה ────────────────────────────────────────────────────────
  opened_at   timestamptz,       -- הפעם הראשונה שהעמוד נפתח
  answered_at timestamptz,       -- נכתב פעם אחת בלבד. קיים = לא נדרס

  q1_satisfaction smallint check (q1_satisfaction between 1 and 5),
  q2_recommend    smallint check (q2_recommend    between 1 and 5),
  comment         text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.customer_surveys.token is
  'הטוקן שבכתובת הסקר. סודי דיו כדי שלא ינוחש, ובכל מקרה נקודת הקצה מחזירה דרכו שם פרטי בלבד.';
comment on column public.customer_surveys.answered_at is
  'חד-פעמי. שורה שנענתה לא נדרסת, כדי שרענון של העמוד לא ימחק תשובה.';
comment on column public.customer_surveys.q2_recommend is
  'שאלת ההמלצה. בטופס המקורי היא 0 עד 10 (NPS); כאן 1 עד 5, כי הבחירה בכוכבים.';

-- התור של השולח: מה מגיע לשליחה עכשיו
create index if not exists customer_surveys_due_idx
  on public.customer_surveys (scheduled_send_at)
  where status = 'pending';

-- הדשבורד: התשובות האחרונות
create index if not exists customer_surveys_answered_idx
  on public.customer_surveys (answered_at desc)
  where answered_at is not null;

-- מכסת פעם ב-30 יום ללקוח
create index if not exists customer_surveys_customer_idx
  on public.customer_surveys (customer_number, created_at desc);

create index if not exists customer_surveys_stop_idx on public.customer_surveys (stop_id);

alter table public.customer_surveys enable row level security;

-- קריאה בלבד למשתמשי המערכת (הדשבורד). כתיבה עוברת רק דרך הרשאת שרת.
drop policy if exists authenticated_read_customer_surveys on public.customer_surveys;
create policy authenticated_read_customer_surveys on public.customer_surveys
  for select to authenticated using (true);

drop trigger if exists set_updated_at on public.customer_surveys;
create trigger set_updated_at before update on public.customer_surveys
  for each row execute function public.set_updated_at();
