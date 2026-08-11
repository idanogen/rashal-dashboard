-- נעילת סדר לנהג + טפסים חתומים · 11/08/2026
--
-- שלושה שינויים שהם בעצם מנגנון אחד:
--
-- 1. עד היום הנהג יכול היה לסגור כל עצירה בכל סדר, ואף אחד לא ידע. אין כאן
--    חסימה קשיחה בכוונה: נהג שנחסם בשטח פשוט ישקר למערכת. במקום זה כל סטייה
--    מהסדר נרשמת עם סיבה, ומפעילה התראה.
-- 2. "אצל הלקוח" מקבל חותמת זמן ומיקום, כדי שהשאלה "הוא באמת היה שם" תהיה
--    שאלה שיש לה תשובה.
-- 3. סגירת עצירה כ"בוצעה" תדרוש טופס חתום לפי קופת החולים. החתימה היא הנעילה
--    האמיתית: הדרך היחידה לסגור עצירה בלי חתימה היא "לא בוצע", וזו בדיוק
--    הדרך שמפעילה הודעה לעמי.

-- ── 1. הגעה ודילוג על עצירה ─────────────────────────────────────────────

alter table public.calendar_stops
  add column if not exists arrived_at    timestamptz,
  add column if not exists arrived_lat   numeric,
  add column if not exists arrived_lng   numeric,
  add column if not exists bypassed_at   timestamptz,
  add column if not exists bypass_reason text,
  add column if not exists bypassed_by   text;

comment on column public.calendar_stops.arrived_at is
  'הרגע שבו הנהג סימן שהוא אצל הלקוח. עד היום ההגעה חיה רק ב-status=in_progress ולא נשמר לה זמן.';
comment on column public.calendar_stops.arrived_lat is
  'מיקום הנהג ברגע ההגעה. נתפס פעם אחת בלבד, לא מעקב רציף.';
comment on column public.calendar_stops.bypass_reason is
  'למה הנהג עבר לעצירה הזו מחוץ לסדר. חובה ברמת ה-UI. ריק = נעשתה בסדר.';

-- שליפת החריגות של יום נתון לדוח הסדרן
create index if not exists calendar_stops_bypassed_idx
  on public.calendar_stops (delivery_date, driver)
  where bypassed_at is not null;

-- ── 2. טפסים חתומים ─────────────────────────────────────────────────────
--
-- טופס אחד = שורה אחת. `payload` מחזיק את הערכים כפי שנחתמו, ולא רק הפניה
-- לישות המקור, כי הטופס הוא מסמך משפטי: מה שהלקוח חתם עליו חייב להישמר כפי
-- שהיה גם אם ההזמנה תתעדכן אחר כך.

create table if not exists public.signed_forms (
  id              uuid primary key default gen_random_uuid(),

  -- מה נחתם ועל מה
  stop_id         uuid references public.calendar_stops(id) on delete set null,
  order_id        uuid references public.orders(id) on delete set null,
  service_call_id uuid references public.service_calls(id) on delete set null,

  form_key        text not null,   -- מזהה ההגדרה, למשל 'clalit-delivery'
  form_kind       text not null check (form_kind in ('delivery','return','repair')),
  health_fund     text,            -- הקופה כפי שהייתה ברגע החתימה
  customer_number text,            -- CUSTNAME בפריוריטי, לצירוף הקובץ

  -- הערכים שנחתמו, כפי שנחתמו
  payload         jsonb not null default '{}'::jsonb,

  -- חתימות. בטפסי החזרה יש שתיים: הלקוח שמחזיר, והנהג שמקבל.
  customer_signature text,
  driver_signature   text,
  signer_name        text,

  -- נסיבות החתימה
  signed_at       timestamptz not null default now(),
  signed_by       text,
  signed_lat      numeric,
  signed_lng      numeric,

  -- הפלט
  pdf_path        text,            -- נתיב ב-bucket signed-forms
  pdf_url         text,

  -- מסע הקובץ לפריוריטי (הצינור הקיים ב-api/priority-push.ts)
  priority_event_id  text,
  priority_pushed_at timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists signed_forms_stop_idx    on public.signed_forms (stop_id);
create index if not exists signed_forms_order_idx   on public.signed_forms (order_id);
create index if not exists signed_forms_call_idx    on public.signed_forms (service_call_id);
create index if not exists signed_forms_signed_idx  on public.signed_forms (signed_at desc);

alter table public.signed_forms enable row level security;

drop policy if exists authenticated_all_signed_forms on public.signed_forms;
create policy authenticated_all_signed_forms on public.signed_forms
  for all to authenticated using (true) with check (true);

drop trigger if exists set_updated_at on public.signed_forms;
create trigger set_updated_at before update on public.signed_forms
  for each row execute function public.set_updated_at();

-- הטופס נכנס ליומן ולמסכי הסדרן בזמן אמת, כמו שאר הטבלאות
alter publication supabase_realtime add table public.signed_forms;

-- ── 3. אחסון ה-PDF ──────────────────────────────────────────────────────
--
-- public כדי ש-api/priority-push.ts יוכל למשוך את הקובץ ב-fetch רגיל ולהמיר
-- ל-data-URI, בדיוק כמו bucket התמונות הקיים. המסמכים לא מכילים מידע רפואי,
-- אבל כן ת"ז, ולכן הנתיב כולל uuid ולא ניתן לניחוש.
insert into storage.buckets (id, name, public)
values ('signed-forms', 'signed-forms', true)
on conflict (id) do nothing;

drop policy if exists signed_forms_upload on storage.objects;
create policy signed_forms_upload on storage.objects
  for insert to authenticated with check (bucket_id = 'signed-forms');

drop policy if exists signed_forms_read on storage.objects;
create policy signed_forms_read on storage.objects
  for select to public using (bucket_id = 'signed-forms');
