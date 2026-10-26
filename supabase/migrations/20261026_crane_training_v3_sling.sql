-- ─── אישור הדרכה למנוף, גרסה 3 (טופס הנייר): פרטי הערסל או צילום (26/10/2026) ───
--
-- עידן: "או שממלאים את כל הפרטים של 6 או שמצרפים תמונה, אחד מהם זה תנאי
-- בשביל להמשיך בשליחה". הצילום עולה לדלי `signed-forms` תחת תיקיית העצירה
-- (אותה הרשאת העלאה כמו ה-PDF, `signed_form_object_writable`), והנתיב נשמר כאן.
--
-- 🔴 הבדיקה במסד ולא רק באפליקציה: שורה בטבלה הזאת היא מה שפותח את "סופק"
-- (`trg_crane_form_gate`), ולכן אישור הדרכה בגרסה 3 בלי ערסל ובלי צילום לא
-- נכנס בכלל. טופס הנייר הוא גרסה 3 ולא 2, כי עד היום הווב שמר על אישור הדרכה
-- את גרסת רשימת הבדיקה (2) ושתי שורות כאלה קיימות. גרסאות קודמות לא נבדקות:
-- מכשירים שעוד לא קיבלו את העדכון ממשיכים לעבוד, ושורות ישנות לא נפסלות.

alter table public.crane_forms add column if not exists sling_photo_path text;

alter table public.crane_forms drop constraint if exists crane_forms_training_v2_sling;
alter table public.crane_forms add constraint crane_forms_training_v2_sling check (
  form_type <> 'training'
  or checklist_version < 3
  or sling_photo_path is not null
  or (nullif(trim(sling_manufacturer), '') is not null
      and nullif(trim(sling_production_date), '') is not null
      and nullif(trim(sling_serial), '') is not null)
);

comment on column public.crane_forms.sling_photo_path is
  'צילום הערסל/התווית בדלי signed-forms (stop_id/sling-<uuid>.jpg). מחליף את שלושת שדות הערסל באישור הדרכה גרסה 3.';
