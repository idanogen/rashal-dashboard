-- מה יש אצל הלקוח עכשיו: השורה הראשונה בכרטיס הלקוח.
--
-- 🔴🔴 עידן, 25/08/2026: "כמעט לכל לקוח של ר.שעל יש מוצר של החברה.
-- הייתי רוצה שישר יקפוץ לנציגה איזה מוצר יש ללקוח. נכון לעכשיו אנחנו
-- לא יודעים את זה. כמובן לעשות את זה חכם וחסכוני."
--
-- ⭐ "חכם וחסכוני" קיבל תשובה מדודה: **אפס קריאות API חדשות לפריוריטי.**
-- שלושת המקורות כבר יושבים אצלנו במסד ורק לא חוברו זה לזה:
--   קריאות שירות  device_name · device_serial · install_date · warranty_until
--   שורות הזמנה   items[].part · desc · qty · serial
--   מרשם המנופים  model · device_number
-- באיחוד: 2,374 לקוחות עם לפחות פריט אחד, 3,406 שורות ציוד.
--
-- ⭐ והמדידה שהכריעה את הבנייה: **הם מדברים אותה שפה.** `device_name`
-- של קריאה, `model` של מנוף ו-`part` של שורת הזמנה הם אותו קוד קטלוגי,
-- ולכן פריט אחד יכול לשאת שלוש עדויות במקום להופיע שלוש פעמים.
--
-- 🔴 מה שהמסך **לא** יודע: ציוד שנמסר לפני 01/01/2026 ולא נפתחה עליו
-- קריאת שירות. זו לא תקלה אלא גבול החלון, והמסך אומר את זה בעצמו
-- דרך `stock.since`.

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
  v_via   text;
  v_hint  text;
  v_hits  int;
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
    v_via := 'number';
  elsif v_phone is not null then
    select d.customer_number, d.customer_name, d.city
      into v_num, v_name, v_city
      from public.customer_directory d
     where d.phone_local = v_phone
     limit 1;
    if v_num is not null then v_via := 'phone'; end if;
  end if;

  -- ── הטלפון שכותב אינו הטלפון שרשום בפריוריטי ──────────
  --
  -- 🔴🔴 **נתפס חי ב-25/08/2026, מצילום מסך של עידן.** לקוחה כתבה
  -- מ-0527663357 והכרטיס אמר "לא מזוהה" ו"לא רשום אצלנו ציוד". היא
  -- לקוחה מוכרת, מספר 8449321, **ויש לה מנוף שסופק ב-17/08**. הטלפון
  -- שרשום בפריוריטי הוא 0522548868, כלומר מספר אחר לגמרי.
  -- לקוחות ר.שעל הם מטופלים, ומי שכותב בוואטסאפ הוא לרוב בן משפחה.
  --
  -- ⭐ **והשם כבר היה אצלנו כל הזמן.** הסקר שאנחנו עצמנו שלחנו לטלפון
  -- הזה נושא `customer_name`. זו אינה השערה משם: זו רשומה שאומרת
  -- ששלחנו לטלפון הזה סקר על אספקה לאדם הזה.
  -- נמדד: 9 מתוך 13 השיחות ה"לא מזוהות" נפתרות ככה, בלי אף קריאת API.
  --
  -- 🔴 **ורק כשיש התאמה אחת בדיוק.** שני לקוחות באותו שם היו נבלעים
  -- זה בתיק של זה. נמדד: 25 חד-משמעיים, 1 דו-משמעי, 4 בלי התאמה.
  -- האחד הדו-משמעי הוא בדיוק המקרה שבו זיהוי שגוי היה נראה נכון.
  -- [[customer_360_identity_is_the_product]]
  if v_num is null and v_phone is not null then
    select btrim(s.customer_name) into v_hint
      from public.customer_surveys s
     where public.wa_normalize_phone(s.phone_e164) = v_phone
       and nullif(btrim(coalesce(s.customer_name, '')), '') is not null
     order by s.created_at desc
     limit 1;

    if v_hint is not null then
      select count(*) into v_hits
        from public.customer_directory d
       where lower(btrim(d.customer_name)) = lower(v_hint);

      if v_hits = 1 then
        select d.customer_number, d.customer_name, d.city
          into v_num, v_name, v_city
          from public.customer_directory d
         where lower(btrim(d.customer_name)) = lower(v_hint)
         limit 1;
        v_via := 'survey';
      end if;
    end if;
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

  -- ── מה יש אצל הלקוח עכשיו ─────────────────────────────
  --
  -- 🔴🔴 **הבקשה, כלשונו של עידן (25/08/2026):** "כמעט לכל לקוח של
  -- ר.שעל יש מוצר של החברה. הייתי רוצה שישר יקפוץ לנציגה איזה מוצר יש
  -- ללקוח. נכון לעכשיו אנחנו לא יודעים את זה."
  --
  -- ⭐ **וזה מחושב, כי אין ולו טבלה אחת שאומרת מה נמצא אצל לקוח.**
  -- מה שסופק פחות מה שנאסף בחזרה שווה מה שאצלו עכשיו.
  --
  -- ⭐ **מה שמאפשר לאחד שלושה מקורות: הם מדברים אותה שפה.**
  -- `orders.items[].part` · `service_calls.device_name` · `cranes.model`
  -- כולם אותו קוד קטלוגי (G175, 216RAFPS), ו-`device_serial` מול
  -- `cranes.device_number` הוא אותו מספר סידורי.
  --
  -- 🔴 **קריאת שירות היא העדות החזקה יותר, לא ההזמנה.** קריאה נפתחת על
  -- מכשיר עם מספר סידורי, כלומר טכנאי ראה אותו אצל הלקוח. הזמנה רק
  -- אומרת שהוא יצא מהמחסן. לכן קריאה מביאה גם מכשירים שנמסרו לפני
  -- שהסנכרון התחיל, וזה המקור היחיד שחוצה את החלון.
  --
  -- 🔴 **שני הצדדים חייבים לכסות את אותו חלון זמן, אחרת החישוב משקר
  -- לכיוון המסוכן.** נמדד 25/08/2026: הזמנות וקריאות מ-01/01/2026,
  -- ואיסופים גם הם מ-01/01/2026 (1,392 מתוך 1,676 לפני יולי, למרות
  -- שהשורות אצלנו נוצרו ב-08/07). לו האיסופים היו מתחילים מאוחר יותר,
  -- כל מה שנאסף לפני כן היה מוצג לנציגה כ"נמצא אצל הלקוח".

  -- קודי הפריטים שהם מכשיר ולא אביזר.
  -- ⭐ **נגזר מהנתונים ולא מרשימה קשיחה:** פריט שנפתחת עליו קריאת שירות,
  -- או שהוא רשום במרשם המנופים, הוא מכשיר. 183 קודים, 7 מילישניות.
  device_codes as (
    select distinct upper(btrim(sc.device_name)) as part
      from public.service_calls sc
     where nullif(btrim(coalesce(sc.device_name, '')), '') is not null
    union
    select distinct upper(btrim(cr.model))
      from public.cranes cr
     where nullif(btrim(coalesce(cr.model, '')), '') is not null
  ),

  -- מה שיצא אל הלקוח, משלושת המקורות
  stock_out as (
    select 'delivery'::text                              as src,
           o.match_kind,
           upper(btrim(x->>'part'))                      as part,
           btrim(coalesce(x->>'desc', ''))               as descr,
           nullif(btrim(coalesce(x->>'serial', '')), '') as serial,
           greatest(coalesce((x->>'qty')::numeric, 1), 1) as qty,
           null::date                                    as installed,
           null::date                                    as warranty,
           coalesce(o.delivery_date, o.created_at::date) as at
      from o_m o,
           lateral jsonb_array_elements(
             case when jsonb_typeof(o.items) = 'array' then o.items else '[]'::jsonb end) x
     -- ⭐ "סופק" מהסטטוס **או** עצירה שבוצעה ביומן, בדיוק כמו ש"שובץ"
     -- נגזר מהיומן. אותם שני מנגנונים, אותה הכרעה.
     where o.order_status::text = 'סופק'
        or exists (select 1 from public.calendar_stops cs
                    where cs.order_id = o.id and cs.status = 'completed')
    union all
    select 'service', c.match_kind, upper(btrim(c.device_name)),
           btrim(coalesce(c.device_desc, '')),
           nullif(btrim(coalesce(c.device_serial, '')), ''), 1,
           c.install_date, c.warranty_until, c.created_at::date
      from c_m c
     where nullif(btrim(coalesce(c.device_name, '')), '') is not null
    union all
    select 'register', e.match_kind, upper(btrim(e.model)), '',
           nullif(btrim(coalesce(e.device_number, '')), ''), 1,
           e.install_date, e.warranty_end, e.install_date
      from eq e
     where nullif(btrim(coalesce(e.model, '')), '') is not null
  ),

  -- מה שחזר למחסן
  stock_back as (
    select upper(btrim(x->>'part'))                       as part,
           btrim(coalesce(x->>'desc', ''))                as descr,
           greatest(coalesce((x->>'qty')::numeric, 1), 1) as qty,
           coalesce(p.pickup_date, p.created_at::date)    as at
      from p_m p,
           lateral jsonb_array_elements(
             case when jsonb_typeof(p.lines) = 'array' then p.lines else '[]'::jsonb end) x
     where p.pickup_status = 'נאסף'
  ),

  -- 🔴 **שורת תשלום אינה ציוד.** נמדד: 359 שורות "השתתפות עצמית"
  -- בהזמנות שסופקו. בלי הסינון הזה הנציגה הייתה רואה "יש ללקוח:
  -- השתתפות עצמית" בראש הכרטיס.
  --
  -- ⭐ **ומפתח הפריט הוא הקוד הקטלוגי, ואם אין קוד אז התיאור.** 167
  -- שורות נושאות `part = '*'` (חגורת פרפר, שולחן, רגליות). הן ציוד
  -- אמיתי, ולו קיבצנו אותן לפי הקוד הן היו נערמות לשורה אחת חסרת פשר.
  stock_out_k as (
    select s.*, case when s.part ~ '^[A-Z0-9]' and s.part <> '*'
                     then s.part else 'D:' || upper(s.descr) end as k
      from stock_out s
     where coalesce(s.part, '') <> ''
       and s.part !~ 'השתתפות' and s.descr !~ 'השתתפות' and s.part <> 'ש''ע'
  ),
  stock_back_k as (
    select s.*, case when s.part ~ '^[A-Z0-9]' and s.part <> '*'
                     then s.part else 'D:' || upper(s.descr) end as k
      from stock_back s
     where coalesce(s.part, '') <> ''
       and s.part !~ 'השתתפות' and s.descr !~ 'השתתפות' and s.part <> 'ש''ע'
  ),
  stock_taken as (
    select k, sum(qty) as qty, max(at) as at from stock_back_k group by k
  ),
  stock_g as (
    select o.k,
           max(o.part) filter (where o.part <> '*')      as part,
           max(nullif(o.descr, ''))                      as descr,
           count(distinct o.serial)                      as serials,
           sum(o.qty) filter (where o.src = 'delivery')  as delivered_qty,
           -- 🔴🔴 **תאריך האחריות נלקח מפריוריטי, ולא הגדול מבין השניים.**
           -- נמדד 25/08/2026: מתוך 88 מספרים סידוריים שמופיעים גם
           -- בקריאות שירות וגם במרשם המנופים, **51 חולקים על תאריך
           -- האחריות, בפער ממוצע של 373 יום**, והמרשם הוא המאוחר יותר
           -- ב-47 מהם. `max()` היה מאריך ללקוח את האחריות בשנה בממוצע,
           -- בשקט, ובדיוק בכיוון שעולה כסף: נציגה שאומרת "אתה באחריות"
           -- כשהוא כבר לא. המרשם מיובא מאקסל ביד פעם בחודש, פריוריטי
           -- הוא מערכת המקור. [[label_and_math_from_two_mechanisms]]
           (array_agg(o.installed order by case o.src when 'service' then 1
                                                      when 'register' then 2 else 3 end,
                                           o.at desc nulls last)
              filter (where o.installed is not null))[1]  as installed,
           (array_agg(o.warranty order by case o.src when 'service' then 1
                                                     when 'register' then 2 else 3 end,
                                          o.at desc nulls last)
              filter (where o.warranty is not null))[1]   as warranty,
           max(o.at)                                     as last_seen,
           -- ⭐ הפריט נושא את הוודאות **החזקה ביותר** מבין הרשומות
           -- שהעידו עליו. פריט שנתמך גם בהזמנה עם מספר לקוח אינו
           -- "השערה" רק מפני שגם קריאה בלי מספר הזכירה אותו.
           min(case o.match_kind when 'number' then 1
                                 when 'phone'  then 2 else 3 end) as match_rank,
           array_agg(distinct o.serial) filter (where o.serial is not null) as serials_list,
           array_agg(distinct o.src)                     as sources
      from stock_out_k o
     group by o.k
  ),
  stock_final as (
    select g.*,
           coalesce(t.qty, 0) as returned_qty,
           t.at               as returned_at,
           -- ⭐ מספר סידורי הוא עדות חזקה מכמות. מכשיר שנפתחו עליו שלוש
           -- קריאות הוא מכשיר אחד, ולכן נספרים סידוריים **שונים**.
           greatest(coalesce(g.delivered_qty, 0), g.serials, 1) - coalesce(t.qty, 0) as net,
           exists (select 1 from device_codes d where d.part = g.k) as is_device
      from stock_g g
      left join stock_taken t on t.k = g.k
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
      -- 🔴 **איך זוהה הלקוח נאמר, ולא נבלע.** זיהוי דרך הסקר הוא חיבור
      -- בין טלפון אחד לשם, והנציגה חייבת לדעת שזה מה שקרה לפני
      -- שהיא מקריאה ללקוח את ההיסטוריה שלו.
      'identifiedBy',   v_via,
      'identifiedHint', case when v_via = 'survey' then v_hint end,
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
    -- ⭐⭐ **הדבר הראשון שהנציגה רואה, וזה מה שביקש עידן.**
    'stock', jsonb_build_object(
      -- ⭐ מכשירים למעלה, אביזרים למטה. ההבחנה נגזרת מהנתונים
      -- (`device_codes`), לא מרשימה שמישהו יצטרך לתחזק.
      'devices', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'part', f.part, 'desc', f.descr, 'qty', f.net,
                 'serials', to_jsonb(coalesce(f.serials_list, array[]::text[])),
                 'installedAt', f.installed, 'warrantyEnd', f.warranty,
                 'lastSeen', f.last_seen, 'sources', to_jsonb(f.sources),
                 'match', case f.match_rank when 1 then 'number'
                                            when 2 then 'phone' else 'name' end
               ) order by f.last_seen desc nulls last), '[]'::jsonb)
          from stock_final f where f.net > 0 and f.is_device
      ),
      'accessories', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'part', f.part, 'desc', f.descr, 'qty', f.net,
                 'serials', to_jsonb(coalesce(f.serials_list, array[]::text[])),
                 'installedAt', f.installed, 'warrantyEnd', f.warranty,
                 'lastSeen', f.last_seen, 'sources', to_jsonb(f.sources),
                 'match', case f.match_rank when 1 then 'number'
                                            when 2 then 'phone' else 'name' end
               ) order by f.last_seen desc nulls last), '[]'::jsonb)
          from stock_final f where f.net > 0 and not f.is_device
      ),
      -- 🔴 **מה שכבר נאסף נאמר בקול ולא נבלע.** רשימה ריקה נראית
      -- לנציגה בדיוק כמו "אין ללקוח כלום", ואלה שתי מציאויות שונות.
      -- [[empty_state_must_speak]]
      'returned', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'part', f.part, 'desc', f.descr, 'at', f.returned_at
               ) order by f.returned_at desc nulls last), '[]'::jsonb)
          from stock_final f where f.net <= 0
      ),
      -- ⭐ **החלון שהנתונים מכסים, מחושב ולא כתוב ביד במסך.** תאריך
      -- קשיח ברכיב היה נשאר נכון עד לייבוא ההיסטורי ואז ישקר בשקט.
      'since', (select least((select min(o2.created_at)::date from public.orders o2),
                             (select min(p2.pickup_date)     from public.pickups p2)))
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
  'כל מה שקשור ללקוח אחד: מה שנמצא אצלו עכשיו (מחושב: סופק פחות נאסף), פתוחים עם השיבוץ האמיתי מהיומן, ציר פעילות, וואטסאפ, סקרים ומסמכים.';
