-- ראה migration שהוחל ב-Supabase: debt_aging (27/08/2026)
-- גיול חובות ותיעוד שיחות גבייה. שלומי, 20/08: "אני רוצה לדעת מי חייב לי,
-- כמה זמן, ומה עשינו בנידון."
--
-- 🔴 **הצבירה נעשית בשרת ולא בדפדפן**, משתי סיבות שאינן קשורות זו לזו:
--   1. **הרשאה.** גיול הוא כסף, וכסף נחתך בשרת. מסך שרק מסתיר סכום אינו
--      הגנה, כי הערך כבר נסע לדפדפן.
--   2. **גודל.** יש 1,238 חשבוניות פתוחות, ו-PostgREST חותך תשובה על
--      1,000 שורות **בשקט**. מסך שנבנה על שליפה כזאת מציג חוב חלקי
--      ונראה תקין לחלוטין. הצבירה מחזירה ~350 שורות ולא נוגעת בגבול.
--
-- ⭐ **וגבולות הדליים כאן חייבים להיות זהים ל-`bucketOf` שב-`src/lib/aging.ts`.**
--    יש על זה בדיקה שקוראת את הקובץ הזה (`test/aging.test.mjs`), כי אותה
--    מתמטיקה בשני מקומות מתפצלת בשקט והמסך מתחיל לשקר.

-- ─── תיעוד שיחות גבייה ──────────────────────────────────────────────────────
create table if not exists public.collection_notes (
  id uuid primary key default gen_random_uuid(),
  customer_number text not null,
  customer_name text,
  note text not null,
  -- ⭐ תוצאה סגורה ולא טקסט חופשי: זה מה שיאפשר בהמשך לשאול "כמה הבטיחו
  --    לשלם ולא שילמו", וטקסט חופשי לעולם לא יענה על זה.
  outcome text not null default 'other'
    check (outcome in ('promised', 'partial', 'paid', 'no_answer', 'dispute', 'other')),
  promised_amount numeric,
  next_action_date date,
  created_by uuid references auth.users (id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists collection_notes_customer_idx
  on public.collection_notes (customer_number, created_at desc);

-- 🔴 מעקב אחרי מי שהבטיח ולא שילם. אינדקס חלקי, כי רוב השורות בלי תאריך.
create index if not exists collection_notes_next_action_idx
  on public.collection_notes (next_action_date)
  where next_action_date is not null;

alter table public.collection_notes enable row level security;

drop policy if exists management_manages_collection_notes on public.collection_notes;
create policy management_manages_collection_notes on public.collection_notes
  for all to authenticated using (public.is_management()) with check (public.is_management());

comment on table public.collection_notes is
  'תיעוד שיחות גבייה. הנהלה בלבד. נולד 27/08/2026 עם מסך הגבייה.';

-- ─── גיול לפי לקוח ──────────────────────────────────────────────────────────
-- 🔴 `security invoker` בכוונה, ולא definer: כך ה-RLS של
-- `consolidated_invoices` חל כאן מעצמו, ואין צורך בשומר נפרד שאפשר לשכוח
-- לעדכן. מי שאינו הנהלה מקבל אפס שורות, לא שגיאה ולא נתונים.
create or replace function public.debt_aging(p_as_of date default current_date)
returns table (
  customer_number text,
  customer_name text,
  open_count bigint,
  total numeric,
  oldest_days integer,
  b0_30 numeric,
  b31_60 numeric,
  b61_90 numeric,
  b91_120 numeric,
  b120_plus numeric,
  last_note_at timestamptz,
  next_action_date date
)
language sql
stable
security invoker
set search_path to 'public'
as $$
  with open_iv as (
    select
      coalesce(nullif(trim(ci.customer_number), ''), ci.customer_name, 'ללא מספר') as cnum,
      ci.customer_name,
      ci.total_price,
      (p_as_of - ci.invoice_date)::int as age_days
    from public.consolidated_invoices ci
    where ci.recon_date is null
      and ci.archived_at is null
      -- 🔴 חשבונית מבוטלת אינה חוב. הסכום שלה שלילי, ובלי הסינון הזה היא
      -- מקזזת חוב אמיתי של לקוח אחר בשורת הסיכום.
      and ci.status <> 'מבוטלת'
      and ci.invoice_date is not null
  ),
  agg as (
    select
      cnum,
      -- ⭐ השם הנפוץ ביותר לאותו מספר לקוח, ולא השרירותי הראשון.
      mode() within group (order by customer_name) as cname,
      count(*) as open_count,
      sum(total_price) as total,
      max(age_days) as oldest_days,
      sum(total_price) filter (where age_days <= 30) as b0_30,
      sum(total_price) filter (where age_days > 30 and age_days <= 60) as b31_60,
      sum(total_price) filter (where age_days > 60 and age_days <= 90) as b61_90,
      sum(total_price) filter (where age_days > 90 and age_days <= 120) as b91_120,
      sum(total_price) filter (where age_days > 120) as b120_plus
    from open_iv
    group by cnum
  )
  select
    agg.cnum,
    agg.cname,
    agg.open_count,
    agg.total,
    agg.oldest_days,
    coalesce(agg.b0_30, 0),
    coalesce(agg.b31_60, 0),
    coalesce(agg.b61_90, 0),
    coalesce(agg.b91_120, 0),
    coalesce(agg.b120_plus, 0),
    n.last_note_at,
    n.next_action_date
  from agg
  left join lateral (
    select max(cn.created_at) as last_note_at,
           min(cn.next_action_date) filter (where cn.next_action_date >= p_as_of) as next_action_date
    from public.collection_notes cn
    where cn.customer_number = agg.cnum
  ) n on true
  order by agg.total desc;
$$;

comment on function public.debt_aging(date) is
  'גיול חובות פתוחים לפי לקוח. קירוב ולא ספר חשבונות: ב-CINVOICES אין זיכויים.';

grant execute on function public.debt_aging(date) to authenticated;

-- ─── החשבוניות הפתוחות של לקוח אחד ──────────────────────────────────────────
-- ⭐ שליפה נפרדת ובלחיצה, ולא הכל מראש: הרשימה המלאה היא 1,238 שורות,
-- והלקוח הגדול לבדו מחזיק 998 מהן.
create or replace function public.customer_open_invoices(p_customer text)
returns table (
  doc_no text,
  invoice_date date,
  total_price numeric,
  status text,
  source_order text,
  age_days integer
)
language sql
stable
security invoker
set search_path to 'public'
as $$
  select
    ci.doc_no,
    ci.invoice_date,
    ci.total_price,
    ci.status,
    ci.source_order,
    (current_date - ci.invoice_date)::int
  from public.consolidated_invoices ci
  where ci.recon_date is null
    and ci.archived_at is null
    and ci.status <> 'מבוטלת'
    and ci.invoice_date is not null
    and coalesce(nullif(trim(ci.customer_number), ''), ci.customer_name, 'ללא מספר') = p_customer
  order by ci.invoice_date asc;
$$;

grant execute on function public.customer_open_invoices(text) to authenticated;
