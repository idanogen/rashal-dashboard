-- ─── אנשי קשר של לקוח בוואטסאפ: מספר שאינו של הלקוח, ובכל זאת שלו ────────
--
-- הבעיה (עידן, 06/09/2026, מהמשרד של ר.שעל): "יש לקוחות ששולחים לנו תמונות
-- לוואטסאפ אבל אין להם כרטיס לקוח בחברה, כי אין להם מכשיר שאפשר לשלוח ממנו
-- תמונות" (הבת שולחת מהטלפון שלה). ההודעה מזוהה לפי טלפון בלבד, ולכן השיחה
-- נשארת "לא מזוהה" והתמונה לא מגיעה לא לקריאה ולא לכרטיס הלקוח בפריוריטי.
--
-- ⭐ העיקרון: **המערכת זוכרת מספר ללקוח, לא רק לשיחה.** פעם אחת מקשרים
-- (בשליחה למספר אחר, בלחיצה "שייך ללקוח", או מתשובה עם ת.ז.), ומאז כל מה
-- שמגיע מהמספר מזוהה, נכנס לשיחה של הלקוח, סוגר בקשת תמונה פתוחה, ועולה
-- לכרטיס בפריוריטי.
--
-- ההחלטות של עידן (06/09): ההודעות האוטומטיות יוצאות **גם** אל בן המשפחה
-- (לא במקום הלקוח), והמספר נכתב **גם לפריוריטי** כאיש קשר (CUSTPERSONNEL).
--
-- 🔴 רק אנשי קשר שאנחנו קישרנו לוואטסאפ נחשבים יעד להודעות אוטומטיות.
-- אנשי הקשר שמסונכרנים מפריוריטי (`priority_contacts`) הם לרוב פיזיותרפיסט
-- או הנהלת חשבונות, ולשלוח להם סקר או "בדרך אליך" היה שגיאה. הם משמשים
-- **לזיהוי נכנס בלבד**.

create table if not exists public.customer_contacts (
  id               uuid primary key default gen_random_uuid(),
  customer_number  text not null,
  phone_e164       text not null,
  phone_local      text,
  label            text,            -- "הבת, מיכל". חופשי, לא חובה
  source           text not null check (source in ('sent_from_card', 'linked_by_user', 'identity_reply')),
  created_by       text,
  created_at       timestamptz not null default now(),
  -- נכתב לפריוריטי כאיש קשר (החלטת עידן). null = עדיין לא.
  priority_pushed_at      timestamptz,
  priority_push_claimed_at timestamptz,
  unique (customer_number, phone_e164)
);
create index if not exists customer_contacts_phone_idx on public.customer_contacts (phone_e164);
create index if not exists customer_contacts_customer_idx on public.customer_contacts (customer_number);

alter table public.customer_contacts enable row level security;
drop policy if exists office_read_customer_contacts on public.customer_contacts;
create policy office_read_customer_contacts on public.customer_contacts
  for select to authenticated using ((select public.is_office_staff()));
-- כתיבה: service-role בלבד, דרך השרת.

-- על השיחה: מה הוצע, מתי ביקשנו זיהוי, ומי קישר.
alter table public.wa_conversations
  add column if not exists contact_label     text,          -- "הבת, מיכל": מי מדבר איתנו
  add column if not exists identity_asked_at timestamptz,   -- ביקשנו שם ות.ז.
  add column if not exists suggested         jsonb,         -- מועמדים לאישור [{customer_number, customer_name, city, by}]
  add column if not exists linked_by         text,
  add column if not exists linked_at         timestamptz;

-- אירוע שמחובר ללקוח בלי הזמנה, קריאה או עצירה: תמונה משיחה ששויכה ידנית.
alter table public.timeline_events
  add column if not exists customer_number text;

-- ─── מי הלקוח מאחורי הטלפון הזה ──────────────────────────────────────────
-- מאחד את כל המקורות שיש לנו, מהחזק לחלש. הקורא מחליט מה לעשות עם יותר
-- ממועמד אחד (בשיחה: לא מנחשים, מציעים לבחירה).
create or replace function public.wa_customers_for_phone(p_phone text)
returns table (customer_number text, customer_name text, city text, source text, label text, score integer)
language sql
stable
security definer
set search_path = public
as $$
  with local as (select public.wa_normalize_phone(p_phone) as l),
  cands as (
    select cc.customer_number, 'contact'::text as source, cc.label, 100 as score
      from public.customer_contacts cc, local
     where cc.phone_local = local.l or cc.phone_e164 = p_phone
    union all
    select pc.custname, 'priority_contact', coalesce(nullif(trim(pc.name), '') || ' · ', '') || coalesce(pc.position_des, ''), 90
      from public.priority_contacts pc, local
     where local.l is not null
       and (public.wa_normalize_phone(pc.cellphone) = local.l or public.wa_normalize_phone(pc.phonenum) = local.l)
    union all
    select c.custname, 'customer_phone', null, 80
      from public.priority_customers c, local
     where local.l is not null
       and (public.wa_normalize_phone(c.phone) = local.l or public.wa_normalize_phone(c.fax) = local.l)
    union all
    select o.customer_number, 'order', null, 70
      from public.orders o, local
     where local.l is not null and o.phone = local.l and nullif(trim(o.customer_number), '') is not null
    union all
    select sc.customer_number, 'service_call', null, 70
      from public.service_calls sc, local
     where local.l is not null and sc.phone = local.l and nullif(trim(sc.customer_number), '') is not null
  ),
  best as (
    select customer_number, max(score) as score,
           (array_agg(source order by score desc))[1] as source,
           (array_agg(label  order by score desc nulls last))[1] as label
      from cands
     where nullif(trim(customer_number), '') is not null
     group by customer_number
  )
  select b.customer_number, c.cdes as customer_name, c.city, b.source, b.label, b.score
    from best b
    left join public.priority_customers c on c.custname = b.customer_number
   order by b.score desc, c.cdes;
$$;
revoke all on function public.wa_customers_for_phone(text) from public, anon;
grant execute on function public.wa_customers_for_phone(text) to authenticated, service_role;

-- ─── הצעה מתוך תשובה חופשית: "עשר שרה 053357547" ─────────────────────────
-- מספר הלקוח בפריוריטי אצל ר.שעל הוא תעודת הזהות (33,562 מתוך 42,845
-- עוברים את ספרת הביקורת, נמדד 06/09). ת.ז. בתשובה = התאמה מדויקת אחת.
-- שם בלבד = עד שלושה מועמדים דרך customer_search.
create or replace function public.wa_suggest_customers(p_text text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ids   text[];
  v_id    text;
  v_name  text;
  v_out   jsonb := '[]'::jsonb;
  r       record;
begin
  if p_text is null or length(trim(p_text)) < 2 then return v_out; end if;

  -- כל רצף של 8-9 ספרות, גם עם רווחים או מקפים בפנים.
  select array_agg(distinct m[1]) into v_ids
    from regexp_matches(regexp_replace(p_text, '[\s\-]', '', 'g'), '(\d{8,9})', 'g') m;
  if v_ids is not null then
    foreach v_id in array v_ids loop
      for r in
        select c.custname, c.cdes, c.city from public.priority_customers c
         where c.custname = v_id or c.custname = lpad(v_id, 9, '0') or c.custname = ltrim(v_id, '0')
         limit 2
      loop
        v_out := v_out || jsonb_build_object('customer_number', r.custname, 'customer_name', r.cdes, 'city', r.city, 'by', 'id');
      end loop;
    end loop;
  end if;

  -- השם: מה שנשאר אחרי הורדת הספרות והפיסוק. שתי אותיות לפחות.
  v_name := trim(regexp_replace(regexp_replace(p_text, '\d', ' ', 'g'), '[^֐-׿a-zA-Z ]', ' ', 'g'));
  v_name := regexp_replace(v_name, '\s+', ' ', 'g');
  -- מילים שאינן שם: "שלום", "אמא", "של", "זה", "ת.ז", "תעודת זהות"
  v_name := trim(regexp_replace(v_name, '(^|\s)(שלום|היי|אמא|אבא|של|שלי|זה|זאת|תז|ת ז|תעודת|זהות|הלקוח|לקוח|שם)(?=\s|$)', ' ', 'g'));
  if length(v_name) >= 2 and jsonb_array_length(v_out) < 3 then
    for r in
      select s.customer_number, s.customer_name, s.city
        from public.customer_search(v_name, 3) s
       where s.match_kind = 'name'
    loop
      if not exists (select 1 from jsonb_array_elements(v_out) e where e->>'customer_number' = r.customer_number) then
        v_out := v_out || jsonb_build_object('customer_number', r.customer_number, 'customer_name', r.customer_name, 'city', r.city, 'by', 'name');
      end if;
    end loop;
  end if;
  return v_out;
end;
$$;
revoke all on function public.wa_suggest_customers(text) from public, anon;
grant execute on function public.wa_suggest_customers(text) to authenticated, service_role;

-- ─── השיוך עצמו ───────────────────────────────────────────────────────────
-- מקשר שיחה ללקוח, זוכר את המספר אם ביקשו, ומחזיר את ההודעות הנכנסות עם
-- תמונות שעדיין לא הגיעו לאף רשומה, כדי שהשרת ישכפל אותן ללקוח (רטרואקטיבית).
create or replace function public.wa_link_conversation(
  p_conversation uuid,
  p_customer     text,
  p_label        text,
  p_remember     boolean,
  p_author       text,
  p_source       text default 'linked_by_user'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv   public.wa_conversations%rowtype;
  v_name   text;
  v_msgs   jsonb;
begin
  select * into v_conv from public.wa_conversations where id = p_conversation;
  if v_conv.id is null then raise exception 'conversation not found'; end if;
  select c.cdes into v_name from public.priority_customers c where c.custname = p_customer;
  if v_name is null then raise exception 'customer % not found', p_customer; end if;

  update public.wa_conversations set
    customer_number = p_customer,
    customer_name   = v_name,
    contact_label   = nullif(trim(coalesce(p_label, '')), ''),
    suggested       = null,
    linked_by       = p_author,
    linked_at       = now(),
    updated_at      = now()
  where id = p_conversation;

  if p_remember then
    insert into public.customer_contacts (customer_number, phone_e164, phone_local, label, source, created_by)
    values (p_customer, v_conv.phone_e164, v_conv.phone_local, nullif(trim(coalesce(p_label, '')), ''), p_source, p_author)
    on conflict (customer_number, phone_e164) do update
      set label = coalesce(excluded.label, customer_contacts.label);
  end if;

  -- הודעות נכנסות עם תמונות שעוד לא שוכפלו לשום רשומה.
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'heyy_message_id', m.heyy_message_id, 'sent_at', m.sent_at, 'body', m.body, 'attachments', m.attachments) order by m.sent_at), '[]'::jsonb)
    into v_msgs
    from public.wa_messages m
   where m.conversation_id = p_conversation
     and m.direction = 'in'
     and jsonb_array_length(coalesce(m.attachments, '[]'::jsonb)) > 0
     and not exists (select 1 from public.timeline_events te where te.metadata->>'wa_message_id' = m.id::text);

  return jsonb_build_object('customer_number', p_customer, 'customer_name', v_name,
                            'phone_e164', v_conv.phone_e164, 'messages', v_msgs);
end;
$$;
revoke all on function public.wa_link_conversation(uuid, text, text, boolean, text, text) from public, anon, authenticated;

-- זכירת מספר בלי שיחה: השליחה "למספר אחר" מהכרטיס של הלקוח.
create or replace function public.wa_remember_contact(
  p_customer text, p_phone text, p_label text, p_author text, p_source text default 'sent_from_card'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_e164 text; v_local text;
begin
  v_local := public.wa_normalize_phone(p_phone);
  if v_local is null or v_local !~ '^05\d{8}$' then raise exception 'not a mobile number'; end if;
  v_e164 := '+972' || substr(v_local, 2);
  insert into public.customer_contacts (customer_number, phone_e164, phone_local, label, source, created_by)
  values (p_customer, v_e164, v_local, nullif(trim(coalesce(p_label, '')), ''), p_source, p_author)
  on conflict (customer_number, phone_e164) do update
    set label = coalesce(excluded.label, customer_contacts.label);
  -- שיחה קיימת עם המספר הזה, שעדיין לא מזוהה: מתחברת עכשיו.
  update public.wa_conversations c set
    customer_number = p_customer,
    customer_name   = (select cdes from public.priority_customers where custname = p_customer),
    contact_label   = coalesce(c.contact_label, nullif(trim(coalesce(p_label, '')), '')),
    linked_by = p_author, linked_at = now(), updated_at = now()
  where c.phone_e164 = v_e164 and c.customer_number is null;
end;
$$;
revoke all on function public.wa_remember_contact(text, text, text, text, text) from public, anon, authenticated;

-- ─── יעדי ההודעות האוטומטיות: הלקוח וגם בני המשפחה שקישרנו ────────────────
-- (החלטת עידן 06/09: "אל שניהם"). רק customer_contacts, לא priority_contacts.
create or replace function public.customer_extra_phones(p_customer text)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select distinct cc.phone_e164 from public.customer_contacts cc
   where cc.customer_number = p_customer and cc.phone_e164 ~ '^\+9725\d{8}$';
$$;
revoke all on function public.customer_extra_phones(text) from public, anon;
grant execute on function public.customer_extra_phones(text) to authenticated, service_role;

-- ─── זיהוי נכנס: כל המקורות, ורק כשיש מועמד אחד ─────────────────────────
-- עד היום: priority_customers.phone בלבד. מעכשיו גם אנשי הקשר שלנו, אנשי
-- הקשר מפריוריטי, הפקס (שאצל ר.שעל מחזיק לא פעם את המספר השני), ההזמנות
-- והקריאות. 🔴 יותר ממועמד אחד = לא מנחשים; השיחה נשארת לא מזוהה והמסך
-- מציע את שניהם לבחירה.
create or replace function public.wa_record_message(p_heyy_message_id text, p_vendor_message_id text, p_chat_id text, p_contact_id text, p_phone_e164 text, p_contact_name text, p_direction text, p_body text, p_attachments jsonb, p_status text, p_template_id text, p_entity_type text, p_entity_key text, p_author text, p_sent_at timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_local text := public.wa_normalize_phone(p_phone_e164);
  v_conv  uuid;
  v_custnum text;
  v_custname text;
  v_label text;
  v_n int;
  v_author text := p_author;
  v_etype  text := p_entity_type;
  v_ekey   text := p_entity_key;
begin
  if p_heyy_message_id is not null then
    select coalesce(v_author, a.author),
           coalesce(v_etype,  a.entity_type),
           coalesce(v_ekey,   a.entity_key)
      into v_author, v_etype, v_ekey
      from public.wa_message_attribution a
     where a.heyy_message_id = p_heyy_message_id;
  end if;

  -- מי הלקוח מאחורי המספר: רק כשהתשובה יחידה.
  select count(*) into v_n from public.wa_customers_for_phone(p_phone_e164);
  if v_n = 1 then
    select f.customer_number, f.customer_name, case when f.source in ('contact', 'priority_contact') then f.label end
      into v_custnum, v_custname, v_label
      from public.wa_customers_for_phone(p_phone_e164) f;
  end if;

  insert into public.wa_conversations as w (
    heyy_chat_id, heyy_contact_id, phone_e164, phone_local,
    contact_name, customer_number, customer_name, contact_label
  )
  values (
    p_chat_id, p_contact_id, p_phone_e164, v_local,
    p_contact_name, v_custnum, v_custname, v_label
  )
  on conflict (phone_e164) do update set
    heyy_chat_id    = coalesce(excluded.heyy_chat_id, w.heyy_chat_id),
    heyy_contact_id = coalesce(excluded.heyy_contact_id, w.heyy_contact_id),
    contact_name    = coalesce(excluded.contact_name, w.contact_name),
    customer_number = coalesce(w.customer_number, excluded.customer_number),
    customer_name   = case when w.customer_number is null then excluded.customer_name else w.customer_name end,
    contact_label   = coalesce(w.contact_label, excluded.contact_label),
    updated_at      = now()
  returning w.id into v_conv;

  insert into public.wa_messages (
    conversation_id, heyy_message_id, vendor_message_id, direction, body,
    attachments, status, template_id, entity_type, entity_key, author, sent_at
  )
  values (
    v_conv, p_heyy_message_id, p_vendor_message_id, p_direction, p_body,
    coalesce(p_attachments, '[]'::jsonb), p_status, p_template_id,
    v_etype, v_ekey, v_author, coalesce(p_sent_at, now())
  )
  on conflict (heyy_message_id) do update set
    status            = coalesce(excluded.status, wa_messages.status),
    vendor_message_id = coalesce(excluded.vendor_message_id, wa_messages.vendor_message_id),
    author            = coalesce(wa_messages.author, excluded.author),
    entity_type       = coalesce(wa_messages.entity_type, excluded.entity_type),
    entity_key        = coalesce(wa_messages.entity_key, excluded.entity_key);

  update public.wa_conversations c set
    message_count      = (select count(*) from public.wa_messages m where m.conversation_id = v_conv),
    last_inbound_at    = (select max(m.sent_at) from public.wa_messages m where m.conversation_id = v_conv and m.direction = 'in'),
    last_outbound_at   = (select max(m.sent_at) from public.wa_messages m where m.conversation_id = v_conv and m.direction = 'out'),
    last_message_at    = (select max(m.sent_at) from public.wa_messages m where m.conversation_id = v_conv),
    updated_at         = now()
  where c.id = v_conv;

  update public.wa_conversations c set
    last_message_preview  = left(coalesce(m.body, ''), 200),
    last_message_direction = m.direction,
    unanswered_since = case
      when c.last_inbound_at is null then null
      when c.last_outbound_at is null then c.last_inbound_at
      when c.last_inbound_at > c.last_outbound_at then c.last_inbound_at
      else null
    end
  from (
    select body, direction from public.wa_messages
     where conversation_id = v_conv order by sent_at desc limit 1
  ) m
  where c.id = v_conv;

  return v_conv;
end;
$function$;

-- ─── תמונה מבן משפחה סוגרת את בקשת התמונה של הלקוח ─────────────────────
-- הבקשה יושבת על הטלפון שאליו נשלחה. תמונה שמגיעה ממספר אחר של אותו לקוח
-- (איש קשר שקישרנו) נחשבת כתשובה לאותה בקשה.
create or replace function public.wa_apply_media_reply(p_phone text, p_has_media boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  hit uuid;
  v_cust text;
begin
  -- הלקוח שמאחורי המספר, רק כשהוא יחיד ומקושר אצלנו (score 100).
  select f.customer_number into v_cust
    from public.wa_customers_for_phone(p_phone) f
   where f.source = 'contact'
   limit 1;

  if p_has_media then
    update public.media_requests
       set state = 'media_received', media_received_at = now()
     where id = (
       select m.id from public.media_requests m
        left join public.service_calls sc on sc.id = m.service_call_id
        where (m.phone_e164 = p_phone or (v_cust is not null and sc.customer_number = v_cust))
          and m.state in ('pending','first_sent','reminder_sent')
        order by (m.phone_e164 = p_phone) desc, m.created_at desc limit 1
     )
    returning id into hit;
  else
    update public.media_requests
       set state = 'replied_no_media', replied_at = now()
     where id = (
       select m.id from public.media_requests m
        left join public.service_calls sc on sc.id = m.service_call_id
        where (m.phone_e164 = p_phone or (v_cust is not null and sc.customer_number = v_cust))
          and m.state in ('first_sent','reminder_sent')
        order by (m.phone_e164 = p_phone) desc, m.created_at desc limit 1
     )
    returning id into hit;
  end if;
  return hit;
end;
$function$;

-- ─── דחיפה לפריוריטי: גם אירוע שמחובר ללקוח ישירות ───────────────────────
create or replace function public.priority_push_candidates(p_limit integer default 60, p_custname text default null)
returns table (
  id text, order_id text, service_call_id text, type text, user_name text, content text,
  metadata jsonb, created_at timestamptz, cust text, ctx text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    te.id::text, te.order_id::text, te.service_call_id::text, te.type::text, te.user_name, te.content, te.metadata, te.created_at,
    coalesce(nullif(trim(o.customer_number), ''), nullif(trim(sc.customer_number), ''),
             nullif(trim(p.customer_number), ''), nullif(trim(cs.customer_number), ''),
             nullif(trim(te.customer_number), '')) as cust,
    case
      when te.order_id is not null then trim('הזמנה ' || coalesce(o.priority_order_id, ''))
      when te.service_call_id is not null then trim('קריאה ' || coalesce(sc.priority_call_id, ''))
      when p.id is not null then trim('איסוף ' || coalesce(p.priority_pickup_id, ''))
      when te.customer_number is not null then 'וואטסאפ'
      else 'משימה'
    end as ctx
  from public.timeline_events te
  left join public.orders o on o.id = te.order_id
  left join public.service_calls sc on sc.id = te.service_call_id
  left join public.calendar_stops cs on cs.id = te.calendar_stop_id
  left join public.pickups p on p.id = cs.pickup_id
  where te.pushed_to_priority_at is null
    and (te.push_claimed_at is null or te.push_claimed_at < now() - interval '10 minutes')
    and te.type::text in ('comment', 'file_upload')
    and coalesce(nullif(trim(o.customer_number), ''), nullif(trim(sc.customer_number), ''),
                 nullif(trim(p.customer_number), ''), nullif(trim(cs.customer_number), ''),
                 nullif(trim(te.customer_number), '')) is not null
    and (te.type::text <> 'file_upload'
         or jsonb_array_length(coalesce(te.metadata->'imageUrls', '[]'::jsonb)) > 0)
    and (p_custname is null or o.customer_number = p_custname or sc.customer_number = p_custname or te.customer_number = p_custname)
  order by te.created_at asc
  limit greatest(1, least(p_limit, 500));
$$;
revoke all on function public.priority_push_candidates(integer, text) from public, anon, authenticated;

-- ─── אנשי קשר שממתינים לכתיבה לפריוריטי (CUSTPERSONNEL_SUBFORM) ───────────
-- מדלגים על מספר שכבר קיים אצל הלקוח בפריוריטי (מסונכרן ל-priority_contacts).
create or replace function public.priority_contact_candidates(p_limit integer default 20)
returns table (id uuid, customer_number text, phone_local text, label text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select cc.id, cc.customer_number, cc.phone_local, cc.label, cc.created_at
    from public.customer_contacts cc
   where cc.priority_pushed_at is null
     and (cc.priority_push_claimed_at is null or cc.priority_push_claimed_at < now() - interval '10 minutes')
     and not exists (
       select 1 from public.priority_contacts pc
        where pc.custname = cc.customer_number
          and (public.wa_normalize_phone(pc.cellphone) = cc.phone_local or public.wa_normalize_phone(pc.phonenum) = cc.phone_local))
   order by cc.created_at asc
   limit greatest(1, least(p_limit, 200));
$$;
revoke all on function public.priority_contact_candidates(integer) from public, anon, authenticated;

-- ─── (הוחל בנפרד: wa_suggest_customers_inline_name_search) ───────────────
-- customer_search דורשת משתמש מחובר ומהשרת היא זורקת "not authorized", ולכן
-- החיפוש לפי שם ב-wa_suggest_customers נעשה ישירות על priority_customers:
-- כל המילים, בכל סדר, על שם הלקוח, שלוש תוצאות. (הגרסה החיה במסד.)

-- ─── (הוחל בנפרד: engines_send_to_linked_contacts_too) ────────────────────
-- media_claim_due · survey_claim_due · on_way_claim מחזירות עמודה נוספת
-- extra_phones text[] = customer_extra_phones(לקוח) בלי הטלפון הראשי, ושלוש
-- פונקציות הקצה (rashal-media-request · rashal-surveys · rashal-on-way)
-- שולחות גם אליהם אחרי שההודעה ללקוח יצאה. המצב נרשם על הרשומה האחת.
