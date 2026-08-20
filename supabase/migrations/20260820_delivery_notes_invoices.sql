-- תעודות משלוח וחשבוניות מפריוריטי (20/08/2026)
--
-- שתי הישויות אומתו כפתוחות ב-API של ר.שעל באותו יום:
--   תעודת משלוח  DOCUMENTS_D  (DOCNO בפורמט SH...,  TYPE='D')
--   חשבונית מס   AINVOICES    (IVNUM בפורמט IN...,  DEBIT='D')
-- GENINVOICES (ספר המסמכים הכספי) מחזיר 400 ולכן גבייה אינה זמינה.
--
-- הגדרת "פתוח" שנקבעה עם עידן: סטטוס 'טיוטא', כלומר המסמך טרם נסגר סופית.

create table if not exists public.delivery_notes (
  id                uuid primary key default gen_random_uuid(),
  priority_doc_id   text unique not null,      -- DOCNO
  priority_doc      integer,                   -- DOC
  customer_number   text,                      -- CUSTNAME
  customer_name     text,                      -- CDES
  doc_date          date,                      -- CURDATE
  status            text,                      -- STATDES: טיוטא / סופית / מבוטלת
  invoiced          text,                      -- IVALL: Y = חויב הכל, N = לא
  source_order      text,                      -- ORDNAME
  warehouse         text,                      -- WARHSDES
  agent             text,                      -- AGENTNAME
  opened_by         text,                      -- USERLOGIN
  total_qty         numeric,                   -- TOTQUANT
  total_price       numeric,                   -- TOTPRICE
  -- UDATE זז בכל עדכון. עבור מסמך שכבר אינו טיוטא זהו בקירוב טוב רגע הסגירה,
  -- וזה מה שמזין את עמודת "נסגרו" בגרף החודשי. קירוב, לא עובדה.
  priority_udate    timestamptz,               -- UDATE
  archived_at       timestamptz,
  archived_reason   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.invoices (
  id                uuid primary key default gen_random_uuid(),
  priority_iv_id    text unique not null,      -- IVNUM
  customer_number   text,                      -- CUSTNAME
  customer_name     text,                      -- CDES
  invoice_date      date,                      -- IVDATE
  status            text,                      -- STATDES
  source_order      text,                      -- ORDNAME
  agent             text,                      -- AGENTNAME
  book_num          text,                      -- BOOKNUM
  fnc_num           text,                      -- FNCNUM
  -- התאמת מסמכים, לא גבייה. אומת ב-20/08: 227 חשבוניות מבוטלות מסומנות
  -- כמותאמות, ולכן אסור לקרוא לשדה הזה "שולמה".
  recon_date        date,                      -- IVRECONDATE
  debit             text,                      -- DEBIT
  iv_type           text,                      -- IVTYPE
  vat               numeric,                   -- VAT
  total_price       numeric,                   -- TOTPRICE
  archived_at       timestamptz,
  archived_reason   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- המסכים שואלים "מה לא בארכיון", וזה הרוב המכריע.
create index if not exists delivery_notes_active_idx
  on public.delivery_notes (doc_date desc) where archived_at is null;
create index if not exists invoices_active_idx
  on public.invoices (invoice_date desc) where archived_at is null;
create index if not exists delivery_notes_status_idx on public.delivery_notes (status);
create index if not exists invoices_status_idx       on public.invoices (status);

-- RLS כמו בשאר הטבלאות: משתמש מחובר בלבד, anon נשלל במפורש.
alter table public.delivery_notes enable row level security;
alter table public.invoices       enable row level security;

drop policy if exists authenticated_all_delivery_notes on public.delivery_notes;
create policy authenticated_all_delivery_notes on public.delivery_notes
  for all to authenticated using (true) with check (true);

drop policy if exists authenticated_all_invoices on public.invoices;
create policy authenticated_all_invoices on public.invoices
  for all to authenticated using (true) with check (true);

revoke all on public.delivery_notes from anon;
revoke all on public.invoices       from anon;

-- updated_at אוטומטי, אותו trigger שכבר קיים בפרויקט
drop trigger if exists set_updated_at_delivery_notes on public.delivery_notes;
create trigger set_updated_at_delivery_notes before update on public.delivery_notes
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_invoices on public.invoices;
create trigger set_updated_at_invoices before update on public.invoices
  for each row execute function public.set_updated_at();
