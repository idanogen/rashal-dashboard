-- ראה migration שהוחל ב-Supabase: survey_handled (02/09/2026)
-- "האם טופל" על חוות דעת בדירוג נמוך (בקשת עידן, מהמסך של עמי).
--
-- ⭐ **הצורך:** הפאנל "לקוחות בדירוג נמוך" הציג רשימה בלי אף פעולה, ולכן
-- אותם שלושה לקוחות חזרו על עצמם בכל פתיחה של המסך ואי אפשר היה לדעת אם
-- מישהו כבר הרים אליהם טלפון. עכשיו עמי מסמן, והרשימה מתרוקנת.
--
-- 🔴 **הכתיבה עוברת ב-RPC ולא ב-policy של עדכון על הטבלה.** מדיניות
-- `update` על `customer_surveys` הייתה פותחת לכל משתמש מחובר גם את הציון,
-- את ההערה ואת `sent_at`, כלומר את המדידה עצמה. הפונקציה נוגעת בשתי
-- עמודות בלבד ולא באף אחת מהן.
--
-- 🔴 **שם המסמן נלקח מהשרת ולא מהדפדפן.** לקוח ששולח את שמו יכול לשלוח
-- כל שם; כאן הוא נגזר מ-auth.uid() דרך הפרופיל, ומשתמש מושבת נדחה.
--
-- 🔴 **בלי OUT parameters בשם של עמודה.** `returns table (handled_at ...)`
-- היה יוצר הצללה על העמודה בתוך ה-UPDATE, ולכן ההחזרה היא jsonb.
-- [[plpgsql_out_param_shadows_column]]

alter table public.customer_surveys
  add column if not exists handled_at timestamptz,
  add column if not exists handled_by text;

comment on column public.customer_surveys.handled_at is
  'מתי סומן שטופל הדירוג הנמוך (שיחה או הודעה ללקוח). NULL = פתוח. נולד 02/09/2026.';
comment on column public.customer_surveys.handled_by is
  'מי סימן שטופל. נגזר בשרת מהפרופיל של auth.uid(), לא מהדפדפן.';

-- ── הפונקציה: ההגדרה **אינה כאן** ───────────────────────────────────────
-- `set_survey_handled(uuid, boolean)` נולדה כאן. ב-10/09 היא הוחלפה בגרסה
-- עם מלל חופשי, `set_survey_handled(uuid, boolean, text)`, שמוגדרת
-- ב-`20260910_survey_handled_note.sql` (הקובץ ההוא גם מפיל את הגרסה הזו
-- ב-drop function). העותק הישן הוסר מכאן ב-24/10/2026.
