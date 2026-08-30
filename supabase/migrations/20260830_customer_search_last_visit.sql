-- ─── customer_search: "ביקור אחרון" על כל תוצאה ─────────────────────────
--
-- עידן, 30/08/2026 (בקשת עמי): "כאשר עמי מחפש שם מסוים אני רוצה שיודגש
-- לו אם היה ביקור אצל הלקוח לאחרונה."
--
-- ⭐ ההגדרה כאן מחליפה את זו שב-20260825_customer_directory_mv.sql
-- (שהחליפה את 20260824_customer_card.sql). הקובץ הזה הוא הסמכותי.
-- [[migration_function_defined_twice]]
--
-- מה נוסף: לכל תוצאה שלוש עמודות — last_visit_date · last_visit_driver ·
-- last_visit_outcome — הביקור האחרון שקרה בפועל (completed/not_completed)
-- מתוך calendar_stops. עתידי/מתוכנן אינו "ביקור".
--
-- 🔴 זיהוי העצירה לפי שלושת המפתחות של הכרטיס, עם אותו שומר:
-- עצירה שנושאת מספר לקוח אחר שייכת למישהו אחר; טלפון ושם נבדקים רק
-- על עצירות בלי מספר. (נמדד 24/08: מספר לקוח קיים בשורה אחת מתוך 840
-- שיבוצים, ולכן טלפון ושם הם המפתחות בפועל.)
--
-- ביצועים: הגרסה הראשונה קראה ל-wa_normalize_phone על כל שורת עצירות
-- לכל תוצאה (25 × ~940 = ~23.5K קריאות) ונמדדה ב-313ms. התיקון: CTE
-- `visits` **ממומש** שמנרמל פעם אחת (~940 קריאות), והלטרל סורק אותו
-- בלי פונקציות. materialized במפורש, אחרת Postgres מטמיע CTE שמאוזכר
-- פעם אחת והפונקציה חוזרת לרוץ פר-שורה. [[rls_function_runs_per_row]]

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
  qwords_re text[];
  multi    boolean := false;
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

  select array_agg(w) into qwords
    from unnest(regexp_split_to_array(q, '\s+')) w
   where length(w) >= 2;
  multi := coalesce(array_length(qwords, 1), 0) > 1;
  if multi then
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
     where length(q) >= 4
       and d.customer_number in (
             select o.customer_number from public.orders o
              where upper(o.priority_order_id) = upper(q) and coalesce(o.customer_number,'') <> ''
             union all
             select c.customer_number from public.service_calls c
              where upper(c.priority_call_id) = upper(q) and coalesce(c.customer_number,'') <> ''
             union all
             select p.customer_number from public.pickups p
              where p.priority_doc::text = digits and coalesce(p.customer_number,'') <> ''
             union all
             select n.customer_number from public.delivery_notes n
              where n.priority_doc::text = digits and coalesce(n.customer_number,'') <> ''
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
       and d.customer_name ilike '%' || qwords[1] || '%'
       and not exists (
             select 1 from unnest(qwords) w
              where d.customer_name not ilike '%' || w || '%'
           )

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
  ),
  visits as materialized (
    select s.delivery_date, s.driver::text as driver, s.status, s.completed_at,
           s.customer_number, s.customer_name,
           public.wa_normalize_phone(s.phone) as phone_local
      from public.calendar_stops s
     where s.status in ('completed','not_completed')
       and s.delivery_date <= current_date
  )
  select g.customer_number, g.customer_name, g.phone, g.phone_local, g.city,
         g.match_kind, g.score,
         lv.delivery_date, lv.driver, lv.status
    from grouped g
    left join lateral (
      select v.delivery_date, v.driver, v.status
        from visits v
       where (coalesce(g.customer_number,'') <> '' and v.customer_number = g.customer_number)
          or (
            coalesce(v.customer_number,'') in ('', coalesce(g.customer_number,''))
            and (
              (g.phone_local is not null and v.phone_local = g.phone_local)
              or (coalesce(g.customer_name,'') <> '' and v.customer_name = g.customer_name)
            )
          )
       order by v.delivery_date desc, v.completed_at desc nulls last
       limit 1
    ) lv on true
   order by g.score desc, g.customer_name;
end;
$function$;

-- אותה תמונת הרשאות כמו לפני ה-drop: authenticated + service_role בלבד.
-- בלי זה default privileges מעניקות execute ל-public, כולל anon.
revoke all on function public.customer_search(text, integer) from public, anon;
grant execute on function public.customer_search(text, integer) to authenticated, service_role;
