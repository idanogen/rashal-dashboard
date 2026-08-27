-- ראה migration שהוחל ב-Supabase: new_customers_rpc (27/08/2026)
-- "מי מהלקוחות החדשים כבר יש לו הזמנה", בקריאה אחת במקום 34.
--
-- 🔴🔴 **הדפדפן שאל את זה בעצמו, ובלולאה.** הוא שאב את כל 1,462
-- הלקוחות שבחלון, ואז שאל ארבע שאלות נפרדות (הזמנה · קריאה · איסוף ·
-- שיבוץ), כל אחת באצוות של 200 מספרי לקוח **בלולאה סדרתית**, כלומר
-- שמונה סבבי רשת לכל טבלה. ⭐ ובנוסף "האם קיימת הזמנה" הוחזר כשורות:
-- **1,477 שורות הזמנה נסעו לדפדפן** רק כדי לסמן וי על 1,214 לקוחות.
--
-- ⭐ **וזה מה שמדידת הטעינה חשפה ביום שהיא נולדה:** השליפה הזאת יצאה
-- הנתיב הקריטי של מסך הסדרן גם כשהיא מחזירה אפס שורות, כי מה שעולה
-- זמן הוא הסבבים ולא הנתונים.
--
-- **נמדד אחרי: 60 מילישניות לכל 1,462 השורות עם ארבעת הדגלים.**
--
-- 🔴 `security invoker`, ולכן ה-RLS של כל אחת מארבע הטבלאות חל כאן
-- מעצמו ואין צורך בשומר נפרד שאפשר לשכוח לעדכן.

create or replace function public.new_customers(p_since timestamptz)
returns table (
  custname text,
  cdes text,
  address text,
  city text,
  phone text,
  fax text,
  agent text,
  health_fund text,
  opened_by text,
  priority_udate timestamptz,
  has_order boolean,
  has_service_call boolean,
  has_pickup boolean,
  is_scheduled boolean
)
language sql
stable
security invoker
set search_path to 'public'
as $$
  select
    c.custname, c.cdes, c.address, c.city, c.phone, c.fax,
    c.agent, c.health_fund, c.opened_by, c.priority_udate,
    -- ⭐ `exists` ולא `count`: עוצר על השורה הראשונה, וזה בדיוק מה
    -- שאינדקס על customer_number עושה טוב.
    exists (select 1 from public.orders o where o.customer_number = c.custname),
    exists (select 1 from public.service_calls s where s.customer_number = c.custname),
    exists (select 1 from public.pickups p where p.customer_number = c.custname),
    exists (
      select 1 from public.calendar_stops cs
      where cs.customer_number = c.custname
        and cs.source_type = 'customer'
        and cs.status in ('planned', 'in_progress')
    )
  from public.priority_customers c
  where c.priority_udate >= p_since
  -- מהחדש לישן: הלקוח שנפתח היום הוא זה שהאספקה שלו הכי קרובה.
  order by c.priority_udate desc;
$$;

grant execute on function public.new_customers(timestamptz) to authenticated;

comment on function public.new_customers(timestamptz) is
  'לקוחות שנפתחו בפריוריטי בחלון, עם סימון מה כבר קיים לצדם. החליף 34 קריאות רשת מהדפדפן בקריאה אחת. נולד 27/08/2026.';
