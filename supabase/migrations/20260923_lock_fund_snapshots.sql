-- שתי טבלאות הגיבוי מתיקון הקופות (02/09/2026) נוצרו בלי RLS, והרשאת ברירת
-- המחדל של anon/authenticated חלה עליהן: כ-47 אלף שורות של מספר לקוח + קופת
-- חולים היו קריאות לכל מי שמחזיק את המפתח הציבורי (הוא בחבילה של הדפדפן).
-- Supabase סימן rls_disabled_in_public כקריטי (מייל 22/09).
-- לא מוחקים (החלטת עידן, 23/09): RLS בלי מדיניות + שלילת הרשאות. רק service role רואה.
-- 🔴 צילום גיבוי חדש ב-public: אותן שלוש שורות ביום היצירה.

alter table public.health_fund_snapshot_20260902 enable row level security;
alter table public.survey_fund_snapshot_20260902 enable row level security;
revoke all on public.health_fund_snapshot_20260902 from anon, authenticated;
revoke all on public.survey_fund_snapshot_20260902 from anon, authenticated;

-- 🔴🔴 נמצא באותה בדיקה (23/09): שני אובייקטים שעוקפים RLS היו קריאים בלי
-- התחברות, רק עם המפתח הציבורי. `contact_phones` (תצוגה security definer:
-- שם, תפקיד וטלפון של אנשי קשר) ו-`customer_directory` (תצוגה ממומשת: שם
-- וטלפון של כל הלקוחות). שניהם נקראים רק בשרת (`api/priority-context` עם
-- service role) ובפונקציות security definer, ולכן anon לא צריך אותם.
-- מחוץ לתיקון הזה בכוונה: `parts_*` (האפליקציה rashal-eparts עובדת עם anon)
-- ו-`rashal_mgmt_overview` (דשבורד ניהול מקומי שקורא עם anon). החלטה של עידן.
revoke all on public.contact_phones from anon;
revoke all on public.customer_directory from anon;
