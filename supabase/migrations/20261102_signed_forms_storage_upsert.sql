-- ─────────────────────────────────────────────────────────────────────────
-- טפסים מהשטח נדחו מאז תור "בלי קליטה" (נמצא בלוגים 02/11/2026).
--
-- התור באפליקציה מעלה את ה-PDF ואת צילום הערסל לדלי signed-forms עם
-- upsert:true, כדי ששליחה חוזרת אחרי ניתוק לא תיכשל על "כבר קיים". לדלי
-- הייתה רק מדיניות INSERT, ו-upsert דורש גם UPDATE וגם קריאה של השורה,
-- ולכן כל טופס עם קובץ שנחתם בטלפון נדחה ב-"new row violates row-level
-- security policy" (רודי 02/11, ועוד 17 דחיות בשלושה טלפונים). רשימת בדיקה
-- למנוף, בלי קבצים, עברה. הצילומים עוברים כי ל-timeline-files יש את שתיהן.
--
-- אותה תבנית בדיוק כמו timeline-files, צרה יותר: נהג קורא ודורס רק קובץ
-- שהוא עצמו העלה, ורק בתיקייה של עצירה שמותר לו לחתום בה. המשרד כמו קודם.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists signed_forms_own_read on storage.objects;
create policy signed_forms_own_read on storage.objects
  for select to authenticated
  using (bucket_id = 'signed-forms' and owner = (select auth.uid()));

drop policy if exists signed_forms_own_update on storage.objects;
create policy signed_forms_own_update on storage.objects
  for update to authenticated
  using (bucket_id = 'signed-forms' and owner = (select auth.uid()))
  with check (bucket_id = 'signed-forms' and public.signed_form_object_writable(name));
