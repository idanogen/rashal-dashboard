-- 🔴🔴 דליפה (23/09/2026): מדיניות SELECT לתפקיד `public` על שני דליים אפשרה לכל
-- מי שמחזיק את המפתח הציבורי (הוא בחבילה של הדפדפן) **לרשום ולהוריד את כל
-- הקבצים**: `timeline-files` (987 קבצים: תמונות וסרטונים מלקוחות בוואטסאפ ומהטכנאים)
-- ו-`signed-forms` (טפסים חתומים עם קופה, חתימות ומיקום).
--
-- ⭐ דלי ציבורי מגיש קישור /object/public/... בלי לעבור במדיניות, ולכן הורדת
-- המדיניות סוגרת את הרישום ואת ההורדה לפי שם מבלי לשבור קישור קיים בדשבורד,
-- באפליקציית הנהגים ובדחיפה לפריוריטי. איש בקוד לא רושם את הדליים.
-- השלב הבא (תוכנית נפרדת): `timeline-files` פרטי + קישורים חתומים.
--
-- `signed-forms` נסגר לגמרי: קובץ אחד מ-11/08, ואף קוד לא קורא את `pdf_url`.

drop policy if exists timeline_files_public_read on storage.objects;
drop policy if exists signed_forms_read on storage.objects;
update storage.buckets set public = false where id = 'signed-forms';

-- העלאה (גם upsert) עלולה לקרוא את השורה שנוצרה. משתמש מחובר רואה רק את
-- הקבצים שהוא עצמו העלה, לא רשימה של כולם.
drop policy if exists timeline_files_own_read on storage.objects;
create policy timeline_files_own_read on storage.objects for select to authenticated
  using (bucket_id = 'timeline-files' and owner = (select auth.uid()));
