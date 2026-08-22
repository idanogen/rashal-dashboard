-- ייחוס הודעה: מי שלח אותה מאיתנו, ועל איזה מסמך.
--
-- 🔴 למה זה קיים: הוובהוק הוא הכותב היחיד ל-`wa_messages`, וזו החלטה
-- נכונה (ראה `api/_lib/wa-thread.ts`). אבל המטען של heyy לא יודע ולא
-- יכול לדעת שני דברים שרק אנחנו יודעים: **מי אצלנו לחץ שלח**, ו**על
-- איזה מסמך בפריוריטי השיחה הזאת**.
--
-- התוצאה עד היום, נמדד ב-22/08/2026: כל 17 ההודעות שהוובהוק כתב חסרות
-- מחבר, ו-0 מתוך 34 ההודעות נושאות הקשר. השדות הוכרזו בסכימה, החלונית
-- אפילו שלחה חלק מהם, ו-`api/wa-send` קיבל אותם ולא עשה איתם דבר.
--
-- ⭐ הפתרון: טבלת ייחוס קטנה שממופתחת במזהה ההודעה של heyy. השולח כותב
-- אליה, והוובהוק קורא ממנה. שני הצדדים לא צריכים להכיר זה את זה.
--
-- 🔴 **והסדר בין השניים אינו מובטח.** heyy יורה `message.sent` מהר, ונצפה
-- חי שהוא מגיע תוך פחות משנייה. לכן הייחוס עובד לשני הכיוונים:
--   · הוובהוק הקדים  ⟵ `wa_attribute_message` מעדכן את השורה הקיימת
--   · השולח הקדים    ⟵ `wa_record_message` קורא את הייחוס בזמן ההוספה
-- בלי שני הכיוונים היינו מקבלים מחבר על חלק מההודעות, וזה גרוע ממחבר
-- על אף אחת: טבלה שנראית מלאה ומשקרת לפעמים.

create table if not exists public.wa_message_attribution (
  -- `data.id` של heyy, אותו מזהה שמופיע ב-`wa_messages.heyy_message_id`
  heyy_message_id text primary key,

  -- מי אצלנו שלח. הפורמט `user:<email>` נשמר זהה ל-`whatsapp_outbound.triggered_by`
  author text,

  -- שם הטופס בפריוריטי שממנו יצאה ההודעה, למשל AINVOICES
  entity_type text,
  -- מספר המסמך עצמו, למשל SH2603398
  entity_key text,

  created_at timestamptz not null default now()
);

comment on table public.wa_message_attribution is
  'מי שלח ועל מה, ממופתח במזהה ההודעה של heyy. נכתב בשליחה, נקרא בוובהוק.';

alter table public.wa_message_attribution enable row level security;
-- אין policy במכוון: הכתיבה והקריאה מגיעות מהשרת עם service role, שעוקף
-- RLS. משתמש מחובר קורא את הייחוס דרך `wa_messages`, לא מכאן.

-- ── הכתיבה, מצד השולח ───────────────────────────────────────────────────
create or replace function public.wa_attribute_message(
  p_heyy_message_id text,
  p_author text,
  p_entity_type text,
  p_entity_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_heyy_message_id is null or btrim(p_heyy_message_id) = '' then
    return;
  end if;

  insert into public.wa_message_attribution as a (
    heyy_message_id, author, entity_type, entity_key
  )
  values (p_heyy_message_id, p_author, p_entity_type, p_entity_key)
  on conflict (heyy_message_id) do update set
    -- 🔴 לא דורסים ערך קיים בערך ריק. שליחה חוזרת אחרי כישלון חלקי
    -- לא אמורה למחוק מחבר שכבר נרשם.
    author      = coalesce(excluded.author, a.author),
    entity_type = coalesce(excluded.entity_type, a.entity_type),
    entity_key  = coalesce(excluded.entity_key, a.entity_key);

  -- הוובהוק אולי כבר הקדים אותנו. אם השורה קיימת, משלימים עליה.
  update public.wa_messages m set
    author      = coalesce(m.author, p_author),
    entity_type = coalesce(m.entity_type, p_entity_type),
    entity_key  = coalesce(m.entity_key, p_entity_key)
  where m.heyy_message_id = p_heyy_message_id;
end;
$$;

comment on function public.wa_attribute_message is
  'רושם מי שלח ועל מה. אידמפוטנטי, ומשלים גם על שורה שהוובהוק כבר יצר.';

revoke all on function public.wa_attribute_message(text, text, text, text) from public, anon;

-- ── הקריאה, מצד הוובהוק ─────────────────────────────────────────────────
-- `wa_record_message` נכתבת מחדש **במלואה** ולא כטלאי, כי היא הגוף היחיד
-- שכותב לשכבת השיחות ורצוי שהוא יהיה קריא בקובץ אחד. השינוי היחיד לעומת
-- `20260820_wa_conversations.sql` הוא שליפת הייחוס והזרמתו להוספה.
create or replace function public.wa_record_message(
  p_heyy_message_id text,
  p_vendor_message_id text,
  p_chat_id text,
  p_contact_id text,
  p_phone_e164 text,
  p_contact_name text,
  p_direction text,
  p_body text,
  p_attachments jsonb,
  p_status text,
  p_template_id text,
  p_entity_type text,
  p_entity_key text,
  p_author text,
  p_sent_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local text := public.wa_normalize_phone(p_phone_e164);
  v_conv  uuid;
  v_custnum text;
  v_custname text;
  v_author text := p_author;
  v_etype  text := p_entity_type;
  v_ekey   text := p_entity_key;
begin
  -- ⭐ הייחוס שנרשם בשליחה. הפרמטרים המפורשים גוברים עליו, כדי שקורא
  -- עתידי שכן יודע את התשובה לא יידרס על ידי טבלת עזר.
  if p_heyy_message_id is not null then
    select coalesce(v_author, a.author),
           coalesce(v_etype,  a.entity_type),
           coalesce(v_ekey,   a.entity_key)
      into v_author, v_etype, v_ekey
      from public.wa_message_attribution a
     where a.heyy_message_id = p_heyy_message_id;
  end if;

  -- צליבה מול המחסן של פריוריטי לפי טלפון מנורמל
  select c.custname, c.cdes into v_custnum, v_custname
    from public.priority_customers c
   where public.wa_normalize_phone(c.phone) = v_local
   limit 1;

  insert into public.wa_conversations as w (
    heyy_chat_id, heyy_contact_id, phone_e164, phone_local,
    contact_name, customer_number, customer_name
  )
  values (
    p_chat_id, p_contact_id, p_phone_e164, v_local,
    p_contact_name, v_custnum, v_custname
  )
  on conflict (phone_e164) do update set
    heyy_chat_id    = coalesce(excluded.heyy_chat_id, w.heyy_chat_id),
    heyy_contact_id = coalesce(excluded.heyy_contact_id, w.heyy_contact_id),
    contact_name    = coalesce(excluded.contact_name, w.contact_name),
    customer_number = coalesce(excluded.customer_number, w.customer_number),
    customer_name   = coalesce(excluded.customer_name, w.customer_name),
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
    -- ⭐ עדכון חוזר משלים ייחוס שהגיע באיחור, ולעולם לא מוחק קיים.
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
$$;

comment on function public.wa_record_message is
  'רושם הודעה אחת לשרשור השיחה, אטומית. אידמפוטנטית לפי heyy_message_id. מושכת מחבר והקשר מ-wa_message_attribution.';

revoke all on function public.wa_record_message from public, anon;
