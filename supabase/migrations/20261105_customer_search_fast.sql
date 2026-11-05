-- ─── customer_search: מהיר ────────────────────────────────────────────────
--
-- עידן, 05/11/2026: "אני מרגיש קצת איטיות כאשר אני מחפש לקוח ספציפי במערכת".
-- נמדד ב-pg_stat_statements: customer_search ממוצע 214ms על חיפוש קצר,
-- ו-3,620ms (מקסימום 6.1 שניות) על חיפוש של 4 תווים ומעלה.
--
-- ⭐ ההגדרה כאן מחליפה את זו שב-20260830_customer_search_last_visit.sql.
-- הקובץ הזה הוא הסמכותי. [[migration_function_defined_twice]]
--
-- שלושת הגזלנים שנמדדו ב-explain analyze (05/11):
-- 1. ענף "מסמך": לכל חיפוש של 4 תווים ומעלה, גם שם, רצו ארבע סריקות מלאות
--    (orders 48K, service_calls 25K, pickups 17K, delivery_notes 8K) כי
--    upper(עמודה) = upper(q) לא משתמש באינדקס, ו-priority_doc::text = digits
--    גם לא. 881ms. עכשיו: הענף רץ רק כשהשאילתה נראית כמו מספר מסמך
--    (אותיות אופציונליות ואז 4 ספרות ומעלה), משווה ישירות לעמודה
--    המאונדקסת (המזהים בפריוריטי כבר באותיות גדולות), ול-priority_doc
--    כמספר שלם עם אינדקס חדש.
-- 2. ענף שתי מילים: ilike על המילה הראשונה (1,080 שורות ל"כהן") ואז
--    anti-join פר שורה. 330ms. עכשיו: ilike all על כל המילים, שהאינדקס
--    הטריגרמי עונה עליו ישירות.
-- 3. "ביקור אחרון": CTE ממומש של כל העצירות הסגורות (2,409) שנסרק מחדש
--    לכל תוצאה (25 × 2,409). עכשיו: שלוש חיפושי אינדקס ישירים
--    (מספר לקוח · שם · טלפון מנורמל, אינדקס חדש) ובחירת האחרון.
--
-- התוצאה הנמדדת אחרי: "כהן משה" מ-~1,350ms ל-~25ms (ראו STATUS 05/11).

create index if not exists pickups_priority_doc_idx
  on public.pickups (priority_doc) where priority_doc is not null;
create index if not exists delivery_notes_priority_doc_idx
  on public.delivery_notes (priority_doc) where priority_doc is not null;
create index if not exists calendar_stops_phone_norm_closed_idx
  on public.calendar_stops (public.wa_normalize_phone(phone), delivery_date desc)
  where status in ('completed', 'not_completed');

drop function if exists public.customer_search(text, integer);

create or replace function public.customer_search(p_query text, p_limit integer default 25)
 returns table(customer_number text, customer_name text, phone text, phone_local text,
               city text, match_kind text, score integer,
               last_visit_date date, last_visit_driver text, last_visit_outcome text)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  q        text := btrim(coalesce(p_query, ''));
  digits   text;
  norm     text;
  lim      int  := least(greatest(coalesce(p_limit, 12), 1), 50);
  q_re     text;
  qwords   text[];
  qwords_like text[];
  qwords_re text[];
  multi    boolean := false;
  doc_like boolean := false;
  doc_num  integer := null;
begin
  if public.is_office_staff() is not true then
    raise exception 'not authorized';
  end if;
  if q = '' then
    return;
  end if;

  digits := regexp_replace(q, '\D', '', 'g');
  norm   := public.wa_normalize_phone(q);
  q_re   := regexp_replace(q, '([.^$*+?()\[\]{}|\\])', '\\\1', 'g');
  -- מספר מסמך: אותיות לטיניות אופציונליות ואז ספרות (SO2603742 · SC2603957 · 2603742).
  doc_like := q ~* '^[a-z]{0,3}\d{4,}$';
  if doc_like and digits ~ '^\d{1,9}$' then
    doc_num := digits::integer;
  end if;

  select array_agg(w) into qwords
    from unnest(regexp_split_to_array(q, '\s+')) w
   where length(w) >= 2;
  multi := coalesce(array_length(qwords, 1), 0) > 1;
  if multi then
    select array_agg('%' || w || '%') into qwords_like from unnest(qwords) w;
    select array_agg(regexp_replace(w, '([.^$*+?()\[\]{}|\\])', '\\\1', 'g'))
      into qwords_re from unnest(qwords) w;
  end if;

  return query
  with hits as (
    select d.customer_number, d.customer_name, d.phone, d.phone_local, d.city,
           'number'::text as match_kind, 100 as score
      from public.customer_directory d
     where d.customer_number = q or (digits <> '' and d.customer_number = digits)

    union all
    select d.customer_number, d.customer_name, d.phone, d.phone_local, d.city,
           'phone', 95
      from public.customer_directory d
     where norm is not null and d.phone_local = norm

    union all
    select d.customer_number, d.customer_name, d.phone, d.phone_local, d.city,
           'document', 90
      from public.customer_directory d
     where doc_like
       and d.customer_number in (
             select o.customer_number from public.orders o
              where o.priority_order_id = upper(q) and coalesce(o.customer_number,'') <> ''
             union all
             select c.customer_number from public.service_calls c
              where c.priority_call_id = upper(q) and coalesce(c.customer_number,'') <> ''
             union all
             select p.customer_number from public.pickups p
              where doc_num is not null and p.priority_doc = doc_num and coalesce(p.customer_number,'') <> ''
             union all
             select n.customer_number from public.delivery_notes n
              where doc_num is not null and n.priority_doc = doc_num and coalesce(n.customer_number,'') <> ''
           )

    union all
    select d.customer_number, d.customer_name, d.phone, d.phone_local, d.city,
           'name',
           case
             when d.customer_name ilike q || '%' then 72
             when d.customer_name ~* ('(^|[\s\-])' || q_re) then 70
             else 50
           end
      from public.customer_directory d
     where length(q) >= 2 and d.customer_name ilike '%' || q || '%'

    union all
    select d.customer_number, d.customer_name, d.phone, d.phone_local, d.city,
           'name',
           case
             when not exists (
                    select 1 from unnest(qwords_re) w
                     where d.customer_name !~* ('(^|[\s\-])' || w)
                  ) then 71
             else 62
           end
      from public.customer_directory d
     where multi
       and d.customer_name ilike all (qwords_like)

    union all
    select d.customer_number, d.customer_name, d.phone, d.phone_local, d.city,
           'phone-part', 60
      from public.customer_directory d
     where length(digits) between 4 and 9
       and d.phone_digits like '%' || digits || '%'
  ),
  grouped as (
    select h.customer_number, h.customer_name, h.phone, h.phone_local, h.city,
           (array_agg(h.match_kind order by h.score desc))[1] as match_kind,
           max(h.score) as score
      from hits h
     group by h.customer_number, h.customer_name, h.phone, h.phone_local, h.city
     order by max(h.score) desc, h.customer_name
     limit lim
  )
  select g.customer_number, g.customer_name, g.phone, g.phone_local, g.city,
         g.match_kind, g.score,
         lv.delivery_date, lv.driver, lv.status
    from grouped g
    left join lateral (
      -- אותם שלושה מפתחות כמו קודם (מספר לקוח · טלפון · שם, שני האחרונים רק
      -- על עצירות בלי מספר לקוח אחר), כל אחד בחיפוש אינדקס משלו עם limit 1,
      -- ואז הביקור המאוחר מביניהם.
      select x.delivery_date, x.driver, x.status
        from (
          (select s.delivery_date, s.driver::text as driver, s.status, s.completed_at
             from public.calendar_stops s
            where coalesce(g.customer_number,'') <> ''
              and s.customer_number = g.customer_number
              and s.status in ('completed','not_completed')
              and s.delivery_date <= current_date
            order by s.delivery_date desc, s.completed_at desc nulls last
            limit 1)
          union all
          (select s.delivery_date, s.driver::text, s.status, s.completed_at
             from public.calendar_stops s
            where g.phone_local is not null
              and public.wa_normalize_phone(s.phone) = g.phone_local
              and coalesce(s.customer_number,'') in ('', coalesce(g.customer_number,''))
              and s.status in ('completed','not_completed')
              and s.delivery_date <= current_date
            order by s.delivery_date desc, s.completed_at desc nulls last
            limit 1)
          union all
          (select s.delivery_date, s.driver::text, s.status, s.completed_at
             from public.calendar_stops s
            where coalesce(g.customer_name,'') <> ''
              and s.customer_name = g.customer_name
              and coalesce(s.customer_number,'') in ('', coalesce(g.customer_number,''))
              and s.status in ('completed','not_completed')
              and s.delivery_date <= current_date
            order by s.delivery_date desc, s.completed_at desc nulls last
            limit 1)
        ) x
       order by x.delivery_date desc, x.completed_at desc nulls last
       limit 1
    ) lv on true
   order by g.score desc, g.customer_name;
end;
$function$;

-- אותה תמונת הרשאות כמו לפני ה-drop: authenticated + service_role בלבד.
revoke all on function public.customer_search(text, integer) from public, anon;
grant execute on function public.customer_search(text, integer) to authenticated, service_role;
