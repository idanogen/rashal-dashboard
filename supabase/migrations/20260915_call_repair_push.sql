-- ════════════════════════════════════════════════════════════════════════
-- מה שהטכנאי רושם נכנס לקריאת השירות בפריוריטי (עידן, 15/09/2026):
--   מלל → DOCUMENTS_Q(...)/DOCTEXT_Q_SUBFORM ("תאור התיקון", APPEND)
--   תמונות → DOCUMENTS_Q(...)/EXTFILES_SUBFORM ("נספחים")
--
-- "מלל" = הערות צ'אט של נהג/טכנאי על הקריאה + הסיבה שנרשמה בסימון
-- ("לא בוצע" / "להמשך טיפול"). הכתיבה לכרטיס הלקוח (priority_push_candidates)
-- נשארת כמו שהיא; זה מסלול נוסף עם יומן משלו, כדי שהצלחה באחד לא תסמן את השני.
--
-- 🔴 POST לתת-טופס אינו אידמפוטנטי. לכן יומן עם claim של 10 דקות ו-ack רק
-- אחרי שכל הכתיבות של הפריט הצליחו (rashal-push).
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.priority_call_push_log (
  key         text primary key,        -- event:<timeline_events.id> | note:<stop id>:<md5(note)>
  claimed_at  timestamptz,
  pushed_at   timestamptz,
  created_at  timestamptz not null default now()
);
comment on table public.priority_call_push_log is
  'יומן הכתיבה של מלל ותמונות הטכנאי לקריאת השירות בפריוריטי (15/09/2026). שרת בלבד.';
alter table public.priority_call_push_log enable row level security;
-- בלי מדיניות: סגור לבני אדם, רק service role.

-- 🔴 הפונקציות של התור (בחירה, claim, ack, עצירה) עברו כולן לקובץ אחד:
--    `20260918_call_push_park.sql`.
-- פונקציה שמוגדרת בשני קבצים חוזרת לגרסה ישנה ברגע שמריצים את הקובץ הישן,
-- בלי שום שגיאה (`test/migrations.test.mjs`). כאן נשארת רק הטבלה.
