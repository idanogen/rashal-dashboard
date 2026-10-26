-- ההקשר של דירוג נמוך: על איזה ביקור הלקוח דירג, מה היה בו, ומה המצב עכשיו.
--
-- 26/10/2026, עידן על מסך הסקרים: "חסר לי פה תאריך הביקור ומהות הביקור".
-- הכרטיס הציג שם, ציון והערה, והמנהל היה צריך לחפש את הלקוח במסך אחר כדי
-- להבין על מה הוא כועס. כל סקר קשור לעצירה (`stop_id`), ולכן הכל כבר במסד.
--
-- ⭐ פונקציה אחת למסך, לפי רשימת מזהים (רק הדירוגים הנמוכים, עשרות שורות).
-- security definer כי היא מצרפת קריאות, הזמנות, איסופים ויומן; ההרשאה
-- נבדקת בראש, והיא זהה לרשימת הגישה של `/surveys` (STAFF = is_office_staff).

create or replace function public.survey_visit_context(p_ids uuid[])
returns table (
  survey_id uuid,
  visit_type text,
  visit_date date,
  window_start text,
  window_end text,
  arrived_at timestamptz,
  stop_status text,
  resolution_kind text,
  resolution_note text,
  docno text,
  essence text,
  device text,
  photos integer,
  calls_90 integer,
  prior_low integer,
  open_call_docno text,
  open_call_status text,
  next_stop_date date,
  next_stop_driver text,
  next_stop_type text
)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if public.is_office_staff() is not true then
    raise exception 'not authorized';
  end if;

  return query
  select s.id,
         st.source_type,
         st.delivery_date,
         st.time_window_start::text,
         st.time_window_end::text,
         st.arrived_at,
         st.status,
         st.resolution_kind,
         nullif(btrim(coalesce(st.resolution_note, '')), ''),
         coalesce(sc.priority_call_id, o.priority_order_id, pk.priority_pickup_id::text),
         -- מהות הביקור: בשירות תאור התקלה, באספקה ובאיסוף הפריטים, במשימה
         -- ההערה של המשרד. חתוך ל-300 תווים, המסך מקצר עוד.
         left(coalesce(
           case when st.source_type = 'service'
                then nullif(btrim(coalesce(sc.fault_text, sc.fault_desc, '')), '') end,
           case when st.source_type in ('delivery', 'customer')
                then (select string_agg(i->>'desc', ' · ')
                        from jsonb_array_elements(case when jsonb_typeof(o.items) = 'array'
                                                       then o.items else '[]'::jsonb end) i
                       where nullif(btrim(coalesce(i->>'desc', '')), '') is not null) end,
           case when st.source_type = 'pickup'
                then (select string_agg(l->>'desc', ' · ')
                        from jsonb_array_elements(case when jsonb_typeof(pk.lines) = 'array'
                                                       then pk.lines else '[]'::jsonb end) l
                       where nullif(btrim(coalesce(l->>'desc', '')), '') is not null) end,
           nullif(btrim(coalesce(st.notes, '')), '')
         ), 300),
         nullif(btrim(concat_ws(' ', sc.device_name, sc.device_desc)), ''),
         -- תמונות שהטכנאי העלה בביקור הזה.
         (select coalesce(sum(greatest(coalesce(jsonb_array_length(to_jsonb(t.files)), 0), 1)), 0)::int
            from public.timeline_events t
           where t.type = 'file_upload'
             and (t.calendar_stop_id = st.id
                  or (st.service_call_id is not null and t.service_call_id = st.service_call_id
                      and t.created_at::date = st.delivery_date))),
         -- קריאות שירות ללקוח ב-90 הימים שעד הביקור (בלי כפילויות).
         (select count(*)::int
            from public.service_calls c
           where nullif(btrim(coalesce(s.customer_number, '')), '') is not null
             and c.customer_number = s.customer_number
             and c.duplicate_of is null
             and c.created_at::date between coalesce(st.delivery_date, s.delivered_at::date) - 90
                                        and coalesce(st.delivery_date, s.delivered_at::date)),
         -- דירוג נמוך קודם של אותו לקוח (הסף של המסך: 2 ומטה).
         (select count(*)::int
            from public.customer_surveys p
           where nullif(btrim(coalesce(s.customer_number, '')), '') is not null
             and p.customer_number = s.customer_number
             and p.id <> s.id
             and p.is_test is not true
             and p.q1_satisfaction <= 2
             and p.answered_at < s.answered_at),
         oc.priority_call_id,
         oc.priority_status,
         ns.delivery_date,
         ns.driver,
         ns.source_type
    from public.customer_surveys s
    left join public.calendar_stops st on st.id = s.stop_id
    left join public.service_calls sc on sc.id = st.service_call_id
    left join public.orders o on o.id = coalesce(st.order_id, s.order_id)
    left join public.pickups pk on pk.id = st.pickup_id
    -- מה המצב עכשיו: קריאה פתוחה של הלקוח (הסטטוסים הסגורים זהים
    -- ל-PRIORITY_CALL_CLOSED ב-src/lib/constants.ts).
    left join lateral (
      select c.priority_call_id, c.priority_status
        from public.service_calls c
       where nullif(btrim(coalesce(s.customer_number, '')), '') is not null
         and c.customer_number = s.customer_number
         and c.duplicate_of is null
         and c.archived_at is null
         and c.priority_call_id is not null
         and coalesce(c.priority_status, '') not in ('בוצעה', 'סופית', 'מבוטלת', 'טיוטא')
       order by c.created_at desc
       limit 1
    ) oc on true
    -- והביקור המשובץ הבא שלו, מהיום והלאה.
    left join lateral (
      select n.delivery_date, n.driver, n.source_type
        from public.calendar_stops n
       where n.status in ('planned', 'in_progress')
         and n.delivery_date >= public.israel_today()
         and (case when nullif(btrim(coalesce(s.customer_number, '')), '') is not null
                   then n.customer_number = s.customer_number
                   else n.customer_name = s.customer_name end)
       order by n.delivery_date
       limit 1
    ) ns on true
   where s.id = any(p_ids);
end;
$$;
revoke all on function public.survey_visit_context(uuid[]) from public, anon;
grant execute on function public.survey_visit_context(uuid[]) to authenticated;
