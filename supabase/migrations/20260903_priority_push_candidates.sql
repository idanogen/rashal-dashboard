-- מועמדים לדחיפה לפריוריטי: רק אירועים שאפשר לדחוף, מהמסד ולא מסריקה בדפדפן-שרת.
--
-- 🔴🔴 **חסם ראש-תור, גלגול שני (03/09/2026).** התיקון מ-11/08 הרחיב את
-- הסריקה ל-400 האירועים הישנים ביותר וספר את המכסה על מה שנדחף בפועל. אבל
-- 400 הישנים ביותר התמלאו לאט באירועים שלעולם לא יידחפו: 228 בלי הזמנה
-- ובלי קריאה (צ'אט על עצירה ידנית), 160 על ישות בלי מספר לקוח, 7 העלאות
-- בלי תמונה. מ-02/09 09:30 כל ריצה החזירה "success, writes: 0, skipped: 397",
-- והוואצ'דוג היה ירוק. התמונה של קטרבורסקי זינאידה (SC2603094) חיכתה 30 שעות,
-- והלקוחה שאלה "?????" בוואטסאפ.
--
-- ⭐ הבחירה עוברת למסד: הסינון על "יש לקוח" ו"יש תמונה" נעשה בשאילתה, ולכן
-- אירוע שאי אפשר לדחוף אינו תופס מקום בחלון בכלל. [[endpoint_hardening_orphans_callers]]
-- ── ההגדרה **אינה כאן** ─────────────────────────────────────────────────
-- הגרסה שנולדה כאן הוחלפה פעמיים (06/09 זיהוי לקוח ישיר, 23/09 חניית
-- כשל תוכן). ההגדרה החיה: `20260923_card_push_park.sql`. העותק הישן הוסר
-- ב-24/10/2026. `priority_push_backlog` שלמטה קוראת לה בזמן ריצה.

-- כמה ממתינים, וכמה זמן הוותיק מחכה: מה שהוואצ'דוג צריך כדי להפסיק להיות ירוק על אפס.
create or replace function public.priority_push_backlog()
returns table (pending bigint, oldest_at timestamptz, oldest_minutes integer)
language sql
stable
security definer
set search_path = public
as $$
  select count(*) as pending, min(c.created_at) as oldest_at,
         coalesce(extract(epoch from now() - min(c.created_at)) / 60, 0)::int as oldest_minutes
  from public.priority_push_candidates(500, null) c;
$$;
revoke all on function public.priority_push_backlog() from public, anon, authenticated;
