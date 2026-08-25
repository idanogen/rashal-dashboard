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
-- ── רישום הודעה: ההגדרה **אינה כאן** ────────────────────
--
-- 🔴 **`wa_record_message` מוגדרת אך ורק ב-`20260822_wa_message_attribution.sql`.**
-- היא הייתה כתובה גם כאן, והרצה מחדש של הקובץ הזה הייתה מוחקת בשקט את
-- ייחוס השולח (מי שלח ועל איזה מסמך) בלי שום שגיאה.
-- נתפס ב-25/08/2026 על ידי `test/migrations.test.mjs`, אחרי שאותה
-- משפחת תקלות נשכה ב-`customer_card`.

comment on function public.wa_record_message is
  'רושם הודעה אחת לשרשור השיחה, אטומית. אידמפוטנטית לפי heyy_message_id.';

revoke all on function public.wa_record_message from public, anon;
