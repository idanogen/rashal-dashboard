-- שכבת השיחות: שרשור אחד לכל לקוח, על פני כל ההודעות וכל העובדים.
--
-- למה זה קיים: `whatsapp_inbound` ו-`whatsapp_outbound` הן שתי רשימות
-- שטוחות ונפרדות. אי אפשר לשאול אותן "מה נאמר ללקוח הזה", וזו בדיוק
-- השאלה שהמוצר כולו נשען עליה. השרשור הוא היחידה, לא ההודעה.
--
-- ⭐ `heyy_chat_id` מגיע מ-`data.chat.id` במטען של heyy. **ל-heyy כבר יש
-- מושג של שיחה**, ולכן אנחנו לא ממציאים מפתח שרשור משלנו אלא מאמצים שלהם.

-- ── נרמול טלפון ─────────────────────────────────────────────────────────
-- הטלפונים במחסן מגיעים בשלושה פורמטים לפחות (`0545412903`, `054-5412903`,
-- `+972545412903`). כל התאמה חייבת לעבור דרך צורה אחת.
create or replace function public.wa_normalize_phone(raw text)
returns text
language sql
immutable
as $$
  select case
    when raw is null then null
    else (
      with d as (select regexp_replace(raw, '\D', '', 'g') as digits)
      select case
        when length(digits) = 0 then null
        when digits like '972%' then '0' || right(digits, length(digits) - 3)
        when digits like '0%'   then digits
        else '0' || digits
      end from d
    )
  end
$$;

comment on function public.wa_normalize_phone(text) is
  'מנרמל טלפון לצורה מקומית 0XXXXXXXXX. כל התאמת טלפון עוברת דרכו.';

create index if not exists priority_customers_phone_norm_idx
  on public.priority_customers (public.wa_normalize_phone(phone));

-- ── השיחה ───────────────────────────────────────────────────────────────
create table if not exists public.wa_conversations (
  id uuid primary key default gen_random_uuid(),

  heyy_chat_id text unique,
  heyy_contact_id text,

  phone_e164 text not null unique,
  phone_local text,

  -- השם כפי ש-heyy מכיר אותו (מפרופיל הוואטסאפ של הלקוח)
  contact_name text,

  -- מספר הלקוח בפריוריטי, כשהצלחנו לצלוב לפי טלפון
  customer_number text,
  customer_name text,

  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  last_message_at timestamptz,
  last_message_preview text,
  last_message_direction text,

  -- 🔴 חלון 24 השעות של מטא **לא נשמר כעמודה**, במכוון.
  -- ניסיתי `generated always as (last_inbound_at + interval '24 hours')`
  -- ופוסטגרס דחה: חיבור אינטרוול ל-timestamptz הוא stable ולא immutable,
  -- כי התוצאה תלויה באזור הזמן של הסשן. וזה דווקא לטובה: עמודה שמורה
  -- היתה מתיישנת בשקט וגורמת למסך להציג "אפשר לכתוב חופשי" בדיוק
  -- ברגע שאי אפשר. החלון נגזר מ-`last_inbound_at` בזמן הקריאה.

  -- מתי הגיעה הודעה נכנסת שעדיין לא ענינו עליה. NULL = אין חוב מענה.
  unanswered_since timestamptz,

  message_count integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wa_conversations_phone_local_idx
  on public.wa_conversations (phone_local);
create index if not exists wa_conversations_customer_idx
  on public.wa_conversations (customer_number) where customer_number is not null;
create index if not exists wa_conversations_unanswered_idx
  on public.wa_conversations (unanswered_since) where unanswered_since is not null;
create index if not exists wa_conversations_recent_idx
  on public.wa_conversations (last_message_at desc nulls last);

-- ── ההודעה ──────────────────────────────────────────────────────────────
create table if not exists public.wa_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.wa_conversations(id) on delete cascade,

  heyy_message_id text unique,
  vendor_message_id text,

  direction text not null check (direction in ('in', 'out')),
  body text,
  attachments jsonb not null default '[]'::jsonb,

  -- רלוונטי ליוצאות בלבד
  status text,
  template_id text,

  -- ⭐ ההקשר, וזה מה שמבדיל אותנו מתיבת דואר וואטסאפ רגילה:
  -- heyy יודע מספר טלפון. אנחנו יודעים על איזה מסמך השיחה הזאת.
  entity_type text,
  entity_key text,

  -- מי אצלנו שלח. NULL בהודעה נכנסת.
  author text,

  -- זמן ההודעה האמיתי מ-heyy, לא זמן הקליטה אצלנו
  sent_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists wa_messages_conversation_idx
  on public.wa_messages (conversation_id, sent_at);
create index if not exists wa_messages_entity_idx
  on public.wa_messages (entity_type, entity_key) where entity_key is not null;

-- ── RLS ─────────────────────────────────────────────────────────────────
-- קריאה למשתמשים מחוברים. הכתיבה מגיעה מהשרת עם service role, שעוקף RLS.
alter table public.wa_conversations enable row level security;
alter table public.wa_messages enable row level security;

drop policy if exists wa_conversations_read on public.wa_conversations;
create policy wa_conversations_read on public.wa_conversations
  for select to authenticated using (true);

drop policy if exists wa_messages_read on public.wa_messages;
create policy wa_messages_read on public.wa_messages
  for select to authenticated using (true);

-- ── הרישום ──────────────────────────────────────────────────────────────
-- פונקציה אחת אטומית במקום ארבע קריאות מהשרת. הסיבה אינה יופי אלא מרוץ:
-- heyy יורה כמה עדכונים לאותה הודעה בהפרש של מילישניות (נצפה חי 20/08),
-- ושתי קריאות במקביל היו יוצרות שתי שיחות לאותו טלפון.
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
begin
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
    -- לא דורסים ערך קיים בערך ריק
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
    p_entity_type, p_entity_key, p_author, coalesce(p_sent_at, now())
  )
  on conflict (heyy_message_id) do update set
    -- אותה הודעה מגיעה שוב עם סטטוס מתקדם יותר. הגוף לא משתנה.
    status            = coalesce(excluded.status, wa_messages.status),
    vendor_message_id = coalesce(excluded.vendor_message_id, wa_messages.vendor_message_id);

  -- מצבירי השיחה. מחושבים מחדש מהאמת ולא מקודמים בהפרשים,
  -- כדי שהודעה שהגיעה פעמיים לא תנפח את המונה.
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
    -- חוב מענה: נפתח בהודעה נכנסת, נסגר ברגע שיצאה תשובה אחריה
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
  'רושם הודעה אחת לשרשור השיחה, אטומית. אידמפוטנטית לפי heyy_message_id.';

revoke all on function public.wa_record_message from public, anon;
