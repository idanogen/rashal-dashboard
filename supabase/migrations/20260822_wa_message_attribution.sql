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

-- ── הקריאה, מצד הוובהוק: ההגדרה **אינה כאן** ────────────────────────────
-- `wa_record_message` נכתבה כאן במלואה (הוספת שליפת הייחוס), אבל ההגדרה
-- החיה עברה ב-06/09 ל-`20260906_customer_contacts.sql` (זיהוי מכל
-- המקורות), והעותק הישן הוסר ב-24/10/2026: הרצה מחדש של הקובץ הזה הייתה
-- מחזירה בשקט גרסה שמזהה לקוח רק לפי priority_customers.phone.
