-- ─── הקופה האמיתית של הלקוח = הלקוח המשלם (עידן, 18/11/2026) ─────────────────
--
-- "מאוד חשוב לי לדעת על כל לקוח מאיזו קופת חולים הוא". עד היום הקופה אצלנו הייתה
-- סוג הלקוח (CTYPENAME, `health_fund`), וכמחצית מהלקוחות רשומים שם "משרד הבריאות".
-- הקופה עצמה יושבת על המסמך כלקוח המשלם: `TOPP_PAYCUSTDES` בקריאה (99.8% מלא),
-- `MARK_PAYCUSTDES` בהזמנה (90%). נמשכת מעכשיו בסנכרון לעמודה `payer_fund`.
--
-- `customer_fund_lookup` עונה לכל מספר לקוח: המשלם במסמך האחרון שלו (קריאה או
-- הזמנה), אחרת סוג הלקוח כשהוא קופה. לאיסופים, לביקורים ביומן וללקוחות חדשים.

alter table public.service_calls add column if not exists payer_fund text;
alter table public.orders add column if not exists payer_fund text;
comment on column public.service_calls.payer_fund is 'הלקוח המשלם בפריוריטי (TOPP_PAYCUSTDES) = הקופה. health_fund הוא סוג הלקוח.';
comment on column public.orders.payer_fund is 'הלקוח המשלם בפריוריטי (MARK_PAYCUSTDES) = הקופה. health_fund הוא סוג הלקוח.';

create index if not exists service_calls_customer_payer_idx
  on public.service_calls (customer_number, created_at desc) where payer_fund is not null;
create index if not exists orders_customer_payer_idx
  on public.orders (customer_number, created_at desc) where payer_fund is not null;

create or replace function public.customer_fund_lookup(p_numbers text[])
returns table(customer_number text, fund text, source text)
language sql
stable
security invoker
set search_path = public
as $$
  with n as (select distinct btrim(x) as num from unnest(p_numbers) x where nullif(btrim(x), '') is not null),
  docs as (
    select sc.customer_number as num, sc.payer_fund as fund, sc.created_at as at from service_calls sc
     where sc.customer_number in (select num from n) and sc.payer_fund is not null
    union all
    select o.customer_number, o.payer_fund, o.created_at from orders o
     where o.customer_number in (select num from n) and o.payer_fund is not null
  ),
  latest as (
    select distinct on (num) num, fund from docs order by num, at desc
  )
  select n.num,
         coalesce(l.fund, case when pc.customer_type ~ '(כללית|מכבי|לאומית|מאוחדת|בטחון|ביטחון)' then pc.customer_type end),
         case when l.fund is not null then 'payer' when pc.customer_type ~ '(כללית|מכבי|לאומית|מאוחדת|בטחון|ביטחון)' then 'customer_type' end
    from n
    left join latest l on l.num = n.num
    left join priority_customers pc on pc.custname = n.num;
$$;

revoke all on function public.customer_fund_lookup(text[]) from public, anon;
grant execute on function public.customer_fund_lookup(text[]) to authenticated;
