-- שיחה שנקראה יוצאת מ"ממתינים", גם בלי לענות.
--
-- 🔴🔴 **הבעיה שזה פותר, כלשונו של עידן (24/08/2026):** "הודעה שכבר
-- נקראה זה לא תמיד מסמן אותה כאחת כזאת". עד היום היה במסד מושג אחד
-- בלבד, `unanswered_since`, והוא נמחק **רק כששולחים תשובה**. כלומר
-- עובד שפתח שיחה, קרא אותה והחליט שאין מה לענות, ראה אותה ממשיכה
-- לצעוק "מחכה 27 דקות" ולהיספר בלשונית הממתינים. ה"לא תמיד" שלו מדויק:
-- כשעונים זה נסגר, כשרק קוראים זה לא.
--
-- ⭐ **"נקרא" ו"נענה" הם שני דברים, ולכן שתי עמודות ולא דריסה של אחת.**
-- מחיקת `unanswered_since` בקריאה הייתה מוחקת את העובדה שהלקוח עדיין
-- ממתין לתשובה, וזה מידע שלא נרצה לאבד. [[label_and_math_from_two_mechanisms]]

alter table public.wa_conversations
  add column if not exists read_at timestamptz,
  add column if not exists read_by text;

comment on column public.wa_conversations.read_at is
  'מתי מישהו פתח את השיחה במפורש. שיחה נחשבת נקראה רק אם read_at מאוחר מ-last_inbound_at.';

-- 🔴 **ההשוואה היא מול `last_inbound_at`, לא דגל בוליאני.** דגל "נקרא"
-- היה נשאר דלוק כשההודעה הבאה נכנסת, כלומר לקוח שכתב שוב היה נעלם
-- מהרשימה בשקט. חותמת זמן מחזירה אותו מעצמה.
create index if not exists wa_conversations_read_idx
  on public.wa_conversations (read_at desc nulls last);
