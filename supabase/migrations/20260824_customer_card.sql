-- כרטיס לקוח מאוחד: שכבת הזיהוי, וכל מה שקשור ללקוח אחד.
--
-- 🔴🔴 **הבעיה שזה פותר, כלשונו של עידן (24/08/2026):** "אני רוצה מקום
-- שירכז לי את ההיסטוריה של הפעילות עם הלקוח... וכך כאשר לקוח מתקשר
-- לנציג יש את כל המידע מול העיניים, כולל האם יש משלוח פתוח ואם כן האם
-- הוא שובץ לאספקה או לא."
--
-- 🔴🔴 **ולמה זה לא מחובר לפי מספר לקוח.** נמדד לפני הבנייה:
--   הזמנות        3,070 מתוך 7,477 עם מספר לקוח  (‎59% בלי)
--   קריאות שירות  2,971 מתוך 6,857                (‎57% בלי)
--   שיבוצים ביומן     1 מתוך   840                (אין מה לחבר)
--   סקרים             0 מתוך    29
-- מסך שמחבר לפי מספר לקוח בלבד היה מציג כחצי מההיסטוריה **ונראה שלם**,
-- והנציג היה אומר ללקוח "אין לך שום קריאה פתוחה" בקול בטוח.
--
-- ⭐ **לכן שלושה מפתחות בסדר יורד, וכל רשומה נושאת את הוודאות שלה:**
--   number ← מספר לקוח, ודאי
--   phone  ← טלפון מנורמל, כמעט ודאי
--   name   ← שם מדויק, השערה שמסומנת ככזאת במסך
--
-- 🔴 **והכלל שמונע את רוב טעויות הזיהוי: רשומה שיש עליה מספר לקוח אחר
-- שייכת למישהו אחר, נקודה.** התאמה לפי טלפון או שם נבדקת רק על רשומות
-- שאין עליהן מספר כלל. בלי הכלל הזה, לקוח עם אותו שם היה בולע את התיק
-- של השני.

-- 🔴 **ורשומה מאורכבת אינה רשומה שנעלמה.** באוגוסט 2026 אורכבו כאן
-- אלפי הזמנות וקריאות ישנות, וזו בדיוק ההיסטוריה שהמסך הזה נועד
-- להציג. לכן הזהות אינה מסננת אותן, והן מופיעות בציר הפעילות. הן
-- **לא** נספרות כפתוחות, אלא אם יש להן עצירה פעילה ביומן: עצירה כזאת
-- פירושה שנהג עדיין אמור לנסוע לשם.
-- נמדד: לקוח 013272224 מחזיק הזמנה מאורכבת עם עצירה מתוכננת ל-14/06.

-- ── מי רשאי ─────────────────────────────────────────────
-- ⭐ אותה קבוצה שרואה את מסכי המשרד ב-`lib/screen-access.ts`, כולל
-- "צפייה בלבד". 🔴 נהג **לא** נכלל: הוא רואה את הנסיעה שלו, לא את
-- התיק המלא של הלקוח.
create or replace function public.is_office_staff()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  -- ⭐ קריאת שרת: `api/priority-context` רץ עם service_role ומעביר את
  -- הכרטיס לחלונית שבתוך פריוריטי. הוא כבר דורש משתמש מחובר בעצמו
  -- (`requireUser`), ולכן ההרשאה נאכפת שם. מפתח ה-service בשרת בלבד.
  select coalesce(auth.role(), '') = 'service_role'
      or public.current_user_role() in ('admin', 'team_manager', 'dispatcher', 'viewer');
$$;

comment on function public.is_office_staff() is
  'עובד משרד: admin · team_manager · dispatcher · viewer. נהג אינו נכלל.';

-- ── חיפוש לקוח ──────────────────────────────────────────
--
-- מקבל מה שהנציג הקליד: טלפון, מספר לקוח, שם, או מספר מסמך.
--
-- ⭐ **מספר מסמך הוא נקודת כניסה אמיתית ולא קישוט:** לקוח מתקשר עם
-- תעודה ביד ומקריא את המספר שעליה.
create or replace function public.customer_search(p_query text, p_limit int default 12)
returns table (
  customer_number text,
  customer_name   text,
  phone           text,
  phone_local     text,
  city            text,
  match_kind      text,
  score           int
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  q      text := btrim(coalesce(p_query, ''));
  digits text;
  norm   text;
  lim    int  := least(greatest(coalesce(p_limit, 12), 1), 50);
begin
  if public.is_office_staff() is not true then
    raise exception 'not authorized';
  end if;
  if q = '' then
    return;
  end if;

  digits := regexp_replace(q, '\D', '', 'g');
  norm   := public.wa_normalize_phone(q);

  return query
  with hits as (
    -- מספר לקוח מדויק
    select d.customer_number, d.customer_name, d.phone, d.phone_local, d.city,
           'number'::text as match_kind, 100 as score
      from public.customer_directory d
     where d.customer_number = q or (digits <> '' and d.customer_number = digits)

    union all
    -- טלפון. 🔴 **המפתח החזק בפועל:** נמדד ב-24/08/2026 שמתוך 4,853
    -- מספרי טלפון, 4,774 מובילים ללקוח אחד ויחיד ורק 79 משותפים.
    select d.customer_number, d.customer_name, d.phone, d.phone_local, d.city,
           'phone', 95
      from public.customer_directory d
     where norm is not null and d.phone_local = norm

    union all
    -- מספר מסמך: הזמנה · קריאת שירות · איסוף · תעודת משלוח
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
    -- שם. 🔴 מתחיל-ב קודם להכיל, כי מי שמקליד "כה" מחפש את "כהן"
    -- ולא את "מכהן".
    select d.customer_number, d.customer_name, d.phone, d.phone_local, d.city,
           'name',
           case when d.customer_name ilike q || '%' then 70 else 50 end
      from public.customer_directory d
     where length(q) >= 2 and d.customer_name ilike '%' || q || '%'

    union all
    -- חלק ממספר טלפון. 🔴 לפחות ארבע ספרות: שלוש מחזירות חצי מהתיבה
    -- וזה נראה כמו חיפוש שבור.
    select d.customer_number, d.customer_name, d.phone, d.phone_local, d.city,
           'phone-part', 60
      from public.customer_directory d
     where length(digits) between 4 and 9
       and regexp_replace(coalesce(d.phone, ''), '\D', '', 'g') like '%' || digits || '%'
  )
  select h.customer_number, h.customer_name, h.phone, h.phone_local, h.city,
         (array_agg(h.match_kind order by h.score desc))[1],
         max(h.score)
    from hits h
   group by h.customer_number, h.customer_name, h.phone, h.phone_local, h.city
   order by max(h.score) desc, h.customer_name
   limit lim;
end;
$$;

comment on function public.customer_search(text, int) is
  'חיפוש לקוח לפי טלפון · מספר לקוח · שם · מספר מסמך. מחזיר מועמדים עם סוג ההתאמה.';

-- ── הכרטיס עצמו ─────────────────────────────────────────
create or replace function public.customer_card(p_customer text default null, p_phone text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_num   text;
  v_phone text;
  v_name  text;
  v_city  text;
  v_addr  text;
  v_hf    text;
  v_agent text;
  result  jsonb;
begin
  if public.is_office_staff() is not true then
    raise exception 'not authorized';
  end if;

  v_num   := nullif(btrim(coalesce(p_customer, '')), '');
  v_phone := public.wa_normalize_phone(p_phone);

  -- זהות הלקוח: מהמחסן קודם, ואם אין מספר לקוח אז לפי הטלפון.
  if v_num is not null then
    select d.customer_name, coalesce(d.phone_local, v_phone), d.city
      into v_name, v_phone, v_city
      from public.customer_directory d
     where d.customer_number = v_num
     limit 1;
  elsif v_phone is not null then
    select d.customer_number, d.customer_name, d.city
      into v_num, v_name, v_city
      from public.customer_directory d
     where d.phone_local = v_phone
     limit 1;
  end if;

  if v_num is null and v_phone is null then
    return jsonb_build_object('ok', false, 'error', 'need customer or phone');
  end if;

  -- כתובת, קופת חולים וסוכן: מפריוריטי כשיש, ואחרת מההזמנה האחרונה.
  select pc.address, pc.city, pc.health_fund, pc.agent
    into v_addr, v_city, v_hf, v_agent
    from public.priority_customers pc
   where v_num is not null and pc.custname = v_num
   limit 1;

  if v_addr is null then
    select o.address, coalesce(v_city, o.city), coalesce(v_hf, o.health_fund), coalesce(v_agent, o.agent)
      into v_addr, v_city, v_hf, v_agent
      from public.orders o
     where (v_num is not null and o.customer_number = v_num)
        or (v_num is null and public.wa_normalize_phone(o.phone) = v_phone)
     order by o.created_at desc
     limit 1;
  end if;

  with
  -- ⭐ הזהות, פעם אחת, וכל הקטעים למטה נגזרים ממנה.
  me as (
    select v_num as num, v_phone as ph, v_name as nm
  ),

  -- ── הזמנות ────────────────────────────────────────────
  o as (
    select o.*,
           case
             when nullif(o.customer_number, '') = m.num then 'number'
             when nullif(o.customer_number, '') is not null then null
             when m.ph is not null and public.wa_normalize_phone(o.phone) = m.ph then 'phone'
             when m.nm is not null and lower(btrim(o.customer_name)) = lower(btrim(m.nm)) then 'name'
             else null
           end as match_kind
      from public.orders o cross join me m
     where o.duplicate_of is null
  ),
  o_m as (select * from o where match_kind is not null),
  o_full as (
    select o_m.*,
           s.id                as stop_id,
           s.delivery_date     as stop_date,
           s.driver            as stop_driver,
           s.time_window_start as win_start,
           s.time_window_end   as win_end,
           s.coordination_status as coord,
           s.status            as stop_status
      from o_m
      left join lateral (
        select cs.* from public.calendar_stops cs
         where cs.order_id = o_m.id and cs.status in ('planned', 'in_progress')
         order by cs.delivery_date limit 1
      ) s on true
  ),

  -- ── קריאות שירות ──────────────────────────────────────
  c as (
    select c.*,
           case
             when nullif(c.customer_number, '') = m.num then 'number'
             when nullif(c.customer_number, '') is not null then null
             when m.ph is not null and public.wa_normalize_phone(c.phone) = m.ph then 'phone'
             when m.nm is not null and lower(btrim(c.customer_name)) = lower(btrim(m.nm)) then 'name'
             else null
           end as match_kind
      from public.service_calls c cross join me m
     where c.duplicate_of is null
  ),
  c_m as (select * from c where match_kind is not null),
  c_full as (
    select c_m.*,
           s.delivery_date as stop_date, s.driver as stop_driver,
           s.time_window_start as win_start, s.time_window_end as win_end,
           s.coordination_status as coord
      from c_m
      left join lateral (
        select cs.* from public.calendar_stops cs
         where cs.service_call_id = c_m.id and cs.status in ('planned', 'in_progress')
         order by cs.delivery_date limit 1
      ) s on true
  ),

  -- ── איסופים ───────────────────────────────────────────
  p as (
    select p.*,
           case
             when nullif(p.customer_number, '') = m.num then 'number'
             when nullif(p.customer_number, '') is not null then null
             when m.ph is not null and public.wa_normalize_phone(p.phone) = m.ph then 'phone'
             when m.nm is not null and lower(btrim(p.customer_name)) = lower(btrim(m.nm)) then 'name'
             else null
           end as match_kind
      from public.pickups p cross join me m
     where p.duplicate_of is null
  ),
  p_m as (select * from p where match_kind is not null),
  p_full as (
    select p_m.*,
           s.delivery_date as stop_date, s.driver as stop_driver
      from p_m
      left join lateral (
        select cs.* from public.calendar_stops cs
         where cs.pickup_id = p_m.id and cs.status in ('planned', 'in_progress')
         order by cs.delivery_date limit 1
      ) s on true
  ),

  -- ── עצירות שכבר קרו, לציר הזמן ────────────────────────
  stops as (
    select cs.*
      from public.calendar_stops cs
     where cs.status in ('completed', 'not_completed')
       and (cs.order_id in (select id from o_m)
         or cs.service_call_id in (select id from c_m)
         or cs.pickup_id in (select id from p_m))
  ),

  -- ── מסמכים ────────────────────────────────────────────
  notes as (
    select n.* from public.delivery_notes n
     where v_num is not null and n.customer_number = v_num and n.archived_at is null
  ),
  invs as (
    select i.doc_no, i.invoice_date, i.total_price, i.status, i.iv_type
      from public.consolidated_invoices i
     where v_num is not null and i.customer_number = v_num and i.archived_at is null
  ),

  -- ── סקרים ─────────────────────────────────────────────
  surveys as (
    select s.* from public.customer_surveys s
     where s.is_test is not true
       and ((v_num is not null and s.customer_number = v_num)
         or (v_phone is not null and public.wa_normalize_phone(s.phone_e164) = v_phone))
  ),

  -- ── ציוד ──────────────────────────────────────────────
  -- 🔴 לטבלת המנופים אין מספר לקוח בכלל, ולכן החיבור הוא לפי טלפון
  -- או שם בלבד, ומסומן ככזה.
  eq as (
    select cr.device_number, cr.model, cr.install_date, cr.warranty_end, cr.cancelled_at,
           case when v_phone is not null and public.wa_normalize_phone(cr.phone) = v_phone
                then 'phone' else 'name' end as match_kind
      from public.cranes cr
     where cr.cancelled_at is null
       and ((v_phone is not null and public.wa_normalize_phone(cr.phone) = v_phone)
         or (v_name is not null and lower(btrim(cr.customer_name)) = lower(btrim(v_name))))
  ),

  -- ── וואטסאפ ───────────────────────────────────────────
  conv as (
    select wc.* from public.wa_conversations wc
     where (v_phone is not null and wc.phone_local = v_phone)
        or (v_num is not null and wc.customer_number = v_num)
     order by wc.last_message_at desc nulls last
     limit 1
  ),

  -- ── ציר הפעילות ───────────────────────────────────────
  -- ⭐ הכל על ציר אחד. `kind` הוא מה שהמסך צובע לפיו.
  events as (
    select o.created_at as at, 'order' as kind, 'הזמנה נפתחה' as title,
           coalesce(o.priority_order_id, '') as ref,
           nullif(concat_ws(' · ', o.order_status, o.agent), '') as detail,
           o.match_kind, o.id as row_id
      from o_full o
    union all
    select c.created_at, 'call', 'קריאת שירות נפתחה',
           coalesce(c.priority_call_id, ''),
           nullif(concat_ws(' · ', c.device_name, c.fault_desc), ''),
           c.match_kind, c.id
      from c_full c
    union all
    select p.created_at, 'pickup', 'איסוף נפתח',
           coalesce(p.priority_doc::text, ''),
           nullif(concat_ws(' · ', p.pickup_status::text, p.to_warehouse), ''),
           p.match_kind, p.id
      from p_full p
    union all
    select coalesce(s.completed_at, s.delivery_date::timestamptz), 'stop',
           case when s.status = 'completed' then 'בוצע בשטח' else 'לא בוצע בשטח' end,
           coalesce(s.driver, ''),
           coalesce(s.resolution_note, s.notes),
           'number', s.id
      from stops s
    union all
    select n.doc_date::timestamptz, 'note', 'תעודת משלוח',
           coalesce(n.priority_doc::text, ''),
           nullif(concat_ws(' · ', n.status, case when n.invoiced = 'Y' then 'חויבה' end), ''),
           'number', n.id
      from notes n
    union all
    select s.answered_at, 'survey', 'סקר שביעות רצון',
           coalesce(s.q1_satisfaction::text, ''), s.comment, 'number', s.id
      from surveys s where s.answered_at is not null
    union all
    -- הודעות וואטסאפ: רק האחרונות, אחרת שיחה ארוכה בולעת את הציר.
    select w.sent_at, 'wa',
           case when w.direction = 'in' then 'הודעה מהלקוח' else 'הודעה ללקוח' end,
           '', left(coalesce(w.body, ''), 140), 'phone', w.id
      from public.wa_messages w
     where w.conversation_id in (select id from conv)
     order by 1 desc
     limit 400
  )

  select jsonb_build_object(
    'ok', true,
    'customer', jsonb_build_object(
      'customerNumber', v_num,
      'name',           v_name,
      'phone',          v_phone,
      'city',           v_city,
      'address',        v_addr,
      'healthFund',     v_hf,
      'agent',          v_agent
    ),
    'open', jsonb_build_object(
      'orders', (
        select coalesce(jsonb_agg(x order by x->>'created'), '[]'::jsonb) from (
          select jsonb_build_object(
                   'id', o.id, 'ref', o.priority_order_id, 'status', o.order_status,
                   'created', o.created_at, 'items', o.items, 'match', o.match_kind, 'archived', o.archived_at is not null,
                   'scheduled', o.stop_date is not null,
                   'date', o.stop_date, 'driver', o.stop_driver,
                   'winStart', o.win_start, 'winEnd', o.win_end, 'coordination', o.coord,
                   -- 🔴 הסטטוס אומר "תואמה" והיומן ריק, או להפך.
                   -- נמדד 24/08/2026: 16 כאלה בהזמנות, 9 במבוטלות,
                   -- 25 בקריאות שנסגרו. המסך אומר את זה בגלוי.
                   'mismatch', (o.order_status = 'תואמה אספקה') <> (o.stop_date is not null)
                 ) as x
            from o_full o
           where (o.archived_at is null
                  and o.order_status in ('ממתין לתאום', 'ממתין לליקוט', 'אין במלאי', 'תואמה אספקה'))
              or o.stop_date is not null
        ) t
      ),
      'calls', (
        select coalesce(jsonb_agg(x order by x->>'created'), '[]'::jsonb) from (
          select jsonb_build_object(
                   'id', c.id, 'ref', c.priority_call_id, 'status', c.service_call_status,
                   'created', c.created_at, 'device', c.device_name, 'fault', c.fault_desc,
                   'match', c.match_kind, 'archived', c.archived_at is not null, 'scheduled', c.stop_date is not null,
                   'date', c.stop_date, 'driver', c.stop_driver,
                   'winStart', c.win_start, 'winEnd', c.win_end, 'coordination', c.coord,
                   'mismatch', (c.service_call_status::text = 'תואם ביקור') <> (c.stop_date is not null)
                 ) as x
            from c_full c
           where (c.archived_at is null
                  and c.service_call_status::text in ('קריאה חדשה', 'תואם ביקור'))
              or c.stop_date is not null
        ) t
      ),
      'pickups', (
        select coalesce(jsonb_agg(x order by x->>'created'), '[]'::jsonb) from (
          select jsonb_build_object(
                   'id', p.id, 'ref', p.priority_doc::text, 'status', p.pickup_status,
                   'created', p.created_at, 'match', p.match_kind, 'archived', p.archived_at is not null,
                   'scheduled', p.stop_date is not null,
                   'date', p.stop_date, 'driver', p.stop_driver
                 ) as x
            from p_full p
           where (p.archived_at is null
                  and p.pickup_status::text in ('ממתין לתאום', 'תואם איסוף'))
              or p.stop_date is not null
        ) t
      ),
      'notes', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'ref', n.priority_doc::text, 'date', n.doc_date, 'status', n.status,
                 'total', n.total_price
               ) order by n.doc_date desc), '[]'::jsonb)
          from notes n where coalesce(n.invoiced, 'N') <> 'Y'
      )
    ),
    'timeline', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'at', e.at, 'kind', e.kind, 'title', e.title,
               'ref', nullif(e.ref, ''), 'detail', e.detail, 'match', e.match_kind
             ) order by e.at desc), '[]'::jsonb)
        from (select * from events where at is not null order by at desc limit 150) e
    ),
    'wa', (
      select case when c.id is null then null else jsonb_build_object(
        'phone', c.phone_local,
        'lastInboundAt', c.last_inbound_at,
        'unansweredSince', c.unanswered_since,
        'readAt', c.read_at,
        'messageCount', c.message_count,
        'messages', (
          select coalesce(jsonb_agg(jsonb_build_object(
                   'direction', w.direction, 'body', w.body, 'at', w.sent_at, 'status', w.status
                 ) order by w.sent_at), '[]'::jsonb)
            from (select * from public.wa_messages w2
                   where w2.conversation_id = c.id order by w2.sent_at desc limit 8) w
        )
      ) end from (select * from conv) c
    ),
    'equipment', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'device', e.device_number, 'model', e.model,
               'installedAt', e.install_date, 'warrantyEnd', e.warranty_end,
               'match', e.match_kind
             ) order by e.install_date desc nulls last), '[]'::jsonb) from eq e
    ),
    'surveys', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'at', s.answered_at, 'q1', s.q1_satisfaction, 'q2', s.q2_recommend,
               'comment', s.comment, 'driver', s.driver
             ) order by s.answered_at desc), '[]'::jsonb)
        from surveys s where s.answered_at is not null
    ),
    'documents', jsonb_build_object(
      'notes', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'ref', n.priority_doc::text, 'date', n.doc_date, 'status', n.status,
                 'invoiced', n.invoiced = 'Y', 'total', n.total_price
               ) order by n.doc_date desc), '[]'::jsonb)
          from (select * from notes order by doc_date desc limit 20) n
      ),
      'invoices', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'ref', i.doc_no, 'date', i.invoice_date, 'total', i.total_price,
                 'status', i.status, 'type', i.iv_type
               ) order by i.invoice_date desc), '[]'::jsonb)
          from (select * from invs order by invoice_date desc limit 20) i
      )
    ),
    -- ⭐ ספירת ההתאמות לפי סוג. זה מה שמאפשר למסך לומר "חלק מההיסטוריה
    -- כאן זוהתה לפי שם", במקום להציג הכל באותה ודאות.
    'match', jsonb_build_object(
      'byNumber', (select count(*) from o_m where match_kind = 'number')
                + (select count(*) from c_m where match_kind = 'number')
                + (select count(*) from p_m where match_kind = 'number'),
      'byPhone',  (select count(*) from o_m where match_kind = 'phone')
                + (select count(*) from c_m where match_kind = 'phone')
                + (select count(*) from p_m where match_kind = 'phone'),
      'byName',   (select count(*) from o_m where match_kind = 'name')
                + (select count(*) from c_m where match_kind = 'name')
                + (select count(*) from p_m where match_kind = 'name')
    ),
    'counts', jsonb_build_object(
      'orders',  (select count(*) from o_m),
      'calls',   (select count(*) from c_m),
      'pickups', (select count(*) from p_m),
      'notes',   (select count(*) from notes),
      'stops',   (select count(*) from stops)
    )
  ) into result;

  return result;
end;
$$;

comment on function public.customer_card(text, text) is
  'כל מה שקשור ללקוח אחד: פתוחים עם השיבוץ האמיתי מהיומן, ציר פעילות, וואטסאפ, ציוד, סקרים ומסמכים.';

-- 🔴 **הרשאה מפורשת לתפקיד המחובר בלבד.** `anon` לא מקבל דבר: מדובר
-- בתיק המלא של מטופל.
revoke all on function public.customer_search(text, int) from public, anon;
revoke all on function public.customer_card(text, text) from public, anon;
grant execute on function public.customer_search(text, int) to authenticated;
grant execute on function public.customer_card(text, text) to authenticated;

-- אינדקסים לחיפושי הזהות. הטבלאות קטנות, אבל הכרטיס נפתח בזמן שלקוח
-- על הקו ולכן שווה שהוא ייפתח מיד.
create index if not exists orders_customer_number_idx        on public.orders (customer_number);
create index if not exists service_calls_customer_number_idx on public.service_calls (customer_number);
create index if not exists pickups_customer_number_idx       on public.pickups (customer_number);
create index if not exists delivery_notes_customer_idx       on public.delivery_notes (customer_number);
