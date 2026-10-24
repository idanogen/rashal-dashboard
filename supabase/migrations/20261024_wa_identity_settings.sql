-- שאלת הזיהוי להודעה נכנסת שלא הצטלבה ללקוח: הנוסח ומתג ההפעלה יושבים
-- במסד, כדי שעמי או שלומי יוכלו לכבות או לנסח מחדש בלי פריסה
-- (הקורא: api/_lib/wa-link.ts).
--
-- 🔴 הטבלה הוחלה דרך הכלי ב-06/09/2026 ומעולם לא נשמרה כקובץ. הקובץ הזה
-- הושלם בדיעבד ב-24/10/2026 מתוך הסכימה החיה (information_schema +
-- pg_policy), אחרי ש-test/migrations.test.mjs תפס את החסר.

create table if not exists public.wa_identity_settings (
  -- שורה יחידה: id תמיד true, וה-check חוסם שורה שנייה.
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  ask_text text not null,
  updated_at timestamptz not null default now()
);

alter table public.wa_identity_settings enable row level security;

-- קריאה למשרד בלבד. אין מדיניות כתיבה: עריכה דרך service role בלבד.
drop policy if exists office_read_wa_identity_settings on public.wa_identity_settings;
create policy office_read_wa_identity_settings on public.wa_identity_settings
  for select to authenticated
  using ((select public.is_office_staff()));

-- הנוסח החי (06/09/2026). קיים = לא נוגעים: עריכות של המשרד גוברות.
insert into public.wa_identity_settings (id, enabled, ask_text) values
  (true, true, 'שלום, כאן ר.שעל בע"מ. קיבלנו את ההודעה, תודה. כדי שנוכל לקשר אותה לתיק הנכון, כתבו לנו בבקשה את שם הלקוח ואת מספר תעודת הזהות שלו.')
on conflict (id) do nothing;
