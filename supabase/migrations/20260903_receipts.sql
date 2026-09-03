-- קבלות מהספר הכספי, וטיוטות שאינן חוב. שלומי (03/09/2026): "נתוני הגבייה מהיכן מגיעים?"
--
-- ⭐ **הקבלות יושבות ב-`GENINVOICES` (הספר הכספי), שהיה סגור ל-API עד
-- 03/09/2026.** עידן פתח אותו, ונמדד: הגבייה מלקוחות היא `TYPE='T'` (קבלות,
-- קידומת `RC`, בעיקר קופות) ו-`TYPE='E'` (חשבוניות מס קבלה, `OV` חיובי
-- ו-`ON` זיכוי שלילי, לקוחות פרטיים). 🔴 ההעברות (`Q`) וההמחאות (`H`) באותו
-- מסך הן תשלומים **לספקים**, ולכן אינן נמשכות. הפענוח בבית הידע של רוני.
--
-- 🔴 כסף = הנהלה בלבד, כמו `consolidated_invoices`. הפונקציות `security
-- invoker` כדי שה-RLS יחול עליהן מעצמו.

create table if not exists public.receipts (
  id               uuid primary key default gen_random_uuid(),
  priority_iv_id   text not null unique,      -- IVNUM (RC / OV / ON)
  doc_type         text,                      -- TYPE: T = קבלה · E = חשבונית מס קבלה
  doc_desc         text,                      -- IVDES
  customer_number  text,                      -- CUSTNAME
  customer_name    text,                      -- CUSTDES
  receipt_date     date,                      -- IVDATE
  total_price      numeric,                   -- TOTPRICE (חתום: ON שלילי)
  currency         text,                      -- CODE
  debit            text,                      -- DEBIT
  fnc_num          text,                      -- FNCNUM (ריק = טיוטה)
  book_num         text,                      -- BOOKNUM
  archived_at      timestamptz,
  archived_reason  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists receipts_date_idx on public.receipts (receipt_date desc) where archived_at is null;
create index if not exists receipts_customer_idx on public.receipts (customer_number, receipt_date desc);

alter table public.receipts enable row level security;
drop policy if exists management_reads_receipts on public.receipts;
create policy management_reads_receipts on public.receipts
  for all to authenticated using (public.is_management()) with check (public.is_management());

comment on table public.receipts is
  'קבלות וחשבוניות מס קבלה מהספר הכספי בפריוריטי (GENINVOICES, TYPE T/E). הנהלה בלבד. נולד 03/09/2026.';

-- ─── קבלות לפי חודש ולקוח ─────────────────────────────────────────────────
-- 🔴 טיוטת קבלה (FNCNUM ריק) אינה כסף שנכנס, ולכן מסוננת.
create or replace function public.receipts_by_month(p_from date)
returns table (month date, customer_number text, customer_name text, n bigint, total numeric)
language sql
stable
security invoker
set search_path to 'public'
as $$
  select
    date_trunc('month', r.receipt_date)::date as month,
    coalesce(nullif(trim(r.customer_number), ''), r.customer_name, 'ללא מספר') as customer_number,
    mode() within group (order by r.customer_name) as customer_name,
    count(*) as n,
    sum(r.total_price) as total
  from public.receipts r
  where r.archived_at is null
    and r.receipt_date is not null
    and r.receipt_date >= p_from
    and r.fnc_num is not null
  group by 1, 2
  order by 1, 5 desc;
$$;
grant execute on function public.receipts_by_month(date) to authenticated;
comment on function public.receipts_by_month(date) is
  'קבלות (T) וחשבוניות מס קבלה (E) לפי חודש ולקוח, בלי טיוטות. הנהלה בלבד דרך RLS.';

-- ─── הקבלות של לקוח אחד ────────────────────────────────────────────────────
create or replace function public.customer_receipts(p_customer text, p_from date default (current_date - 365))
returns table (doc_no text, receipt_date date, total_price numeric, doc_type text, doc_desc text)
language sql
stable
security invoker
set search_path to 'public'
as $$
  select r.priority_iv_id, r.receipt_date, r.total_price, r.doc_type, r.doc_desc
  from public.receipts r
  where r.archived_at is null
    and r.fnc_num is not null
    and r.receipt_date >= p_from
    and coalesce(nullif(trim(r.customer_number), ''), r.customer_name, 'ללא מספר') = p_customer
  order by r.receipt_date desc;
$$;
grant execute on function public.customer_receipts(text, date) to authenticated;

-- ─── טיוטות חשבוניות מרכזות: ממתינות להפקה, לא חוב ─────────────────────────
-- 🔴 נמדד 03/09/2026: 12 טיוטות מאוגוסט (מספר שמתחיל ב-T) נספרו כחוב פתוח,
-- ₪430K, בהן מכבי 197K ולאומית 142K. טיוטה עוד לא יצאה לקופה, ולכן
-- `debt_aging` מסננת אותן מהיום, וכאן הן מוצגות בנפרד.
create or replace function public.debt_drafts()
returns table (customer_number text, customer_name text, draft_count bigint, total numeric, oldest_date date)
language sql
stable
security invoker
set search_path to 'public'
as $$
  select
    coalesce(nullif(trim(ci.customer_number), ''), ci.customer_name, 'ללא מספר') as customer_number,
    mode() within group (order by ci.customer_name) as customer_name,
    count(*) as draft_count,
    sum(ci.total_price) as total,
    min(ci.invoice_date) as oldest_date
  from public.consolidated_invoices ci
  where ci.archived_at is null
    and ci.status = 'טיוטא'
    and ci.recon_date is null
  group by 1
  order by 4 desc;
$$;
grant execute on function public.debt_drafts() to authenticated;
comment on function public.debt_drafts() is
  'חשבוניות מרכזות בטיוטא לפי לקוח. ממתינות להפקה, אינן חוב. הנהלה בלבד דרך RLS.';
