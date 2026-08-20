-- יומן גולמי של כל מה ש-heyy שולח אלינו.
--
-- 🔴 למה זה קיים: אנחנו לא יודעים את המבנה המדויק של המטענים של heyy.
-- אין להם תיעוד API לוובהוקים, ואין להם endpoint להגדרה. שלושת האירועים
-- (נכנסת / נשלחה / עודכנה) מוכרים לנו רק מהתווית בעברית בממשק שלהם.
--
-- לכן הכלל כאן: **קודם שומרים הכל, אחר כך מפרשים.** כל קריאה נכנסת נוחתת
-- בטבלה הזאת כמו שהיא, גם כשלא הצלחנו לטפל בה. האירועים האמיתיים הראשונים
-- הם מה שילמד אותנו את המבנה, ובלי היומן הזה הם היו נעלמים.
--
-- זה גם מה שהיה חסר מ-24/05: הוובהוק מעולם לא הוגדר ב-heyy, ולא היתה שום
-- דרך לראות שלא מגיע כלום. שקט נראה בדיוק כמו תקינות.

create table if not exists public.heyy_webhook_log (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),

  -- שם האירוע כפי ש-heyy שלח אותו, בלי נרמול
  event text,
  -- לאיזה מסלול טיפול ניתבנו בפועל
  route text,

  -- מזהה ההודעה אצל heyy, כשהצלחנו לחלץ אותו
  wa_message_id text,
  phone_e164 text,

  payload jsonb not null,

  -- false = הגיע ולא ידענו מה לעשות איתו. זה מה שנקרא כדי ללמוד מבנה חדש.
  handled boolean not null default false,
  note text
);

create index if not exists heyy_webhook_log_received_idx
  on public.heyy_webhook_log (received_at desc);

create index if not exists heyy_webhook_log_unhandled_idx
  on public.heyy_webhook_log (received_at desc) where not handled;

create index if not exists heyy_webhook_log_msg_idx
  on public.heyy_webhook_log (wa_message_id) where wa_message_id is not null;

alter table public.heyy_webhook_log enable row level security;

-- קריאה למשתמשים מחוברים בלבד. הכתיבה מגיעה משרת עם service role,
-- שעוקף RLS ולכן לא צריך policy.
drop policy if exists heyy_webhook_log_read on public.heyy_webhook_log;
create policy heyy_webhook_log_read
  on public.heyy_webhook_log for select
  to authenticated
  using (true);

comment on table public.heyy_webhook_log is
  'יומן גולמי של קריאות webhook מ-heyy. נשמר לפני הפירוש, כדי ללמוד מבנים לא מוכרים.';
