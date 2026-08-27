-- ראה migration שהוחל ב-Supabase: close_anon_exec_and_snapshot_rls (27/08/2026)
-- סגירת פונקציות שהיו פתוחות ל-anon, וטבלאות גיבוי בלי RLS.
--
-- 🔴🔴 **נמצא בבדיקת עשן לפני ההדגמה בחברה.** מנוע הסקרים חושף שלוש
-- פונקציות `SECURITY DEFINER`, **וכולן היו ניתנות להרצה על ידי `anon`**,
-- כלומר על ידי כל מי שמחזיק את המפתח הציבורי שיושב ממילא בדפדפן.
-- `send_one_survey` **שולחת הודעת וואטסאפ**, ו-`survey_enqueue` דוחפת
-- לתור. זו לא תיאוריה: הקריאה מהאינטרנט הצליחה עד הרגע הזה.
--
-- ⭐ **ואף אחת מהן אינה נקראת מהדפדפן.** שלושתן נקראות רק
-- מ-`supabase/functions/rashal-surveys`, שרץ עם `SERVICE_ROLE_KEY`,
-- ול-`service_role` ההרשאה נשמרת. אומת בשתי בקרות: קריאה מבחוץ עם
-- המפתח הציבורי מחזירה `42501 permission denied`, וריצה יבשה של
-- `survey_enqueue(false)` תחת service_role עוברת כרגיל.
--
-- ⭐ ופונקציות טריגר אינן נקראות ישירות לעולם. טריגר רץ בזכות הטבלה
-- ולא בזכות הקורא, ולכן הסרת ההרשאה אינה נוגעת בו.
--
-- 🔴 ושלוש טבלאות הגיבוי היו ציבוריות בלי RLS. שתיים מהן נוצרו היום.
-- RLS דלוקה בלי אף מדיניות פירושה סגורה לכולם חוץ מ-service_role.

revoke all on function public.send_one_survey(uuid, text) from public, anon, authenticated;
revoke all on function public.survey_enqueue(boolean) from public, anon, authenticated;
revoke all on function public.survey_claim_due(integer) from public, anon, authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.bump_feedback_thread() from public, anon, authenticated;
revoke all on function public.mark_new_order_as_duplicate() from public, anon, authenticated;
revoke all on function public.mark_new_service_call_as_duplicate() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;

alter table if exists public.rls_snapshot_20260827 enable row level security;
alter table if exists public.rls_probe_before enable row level security;
alter table if exists public.role_snapshot_20260827 enable row level security;

comment on table public.rls_snapshot_20260827 is
  'גיבוי מדיניויות RLS לפני עטיפת הפונקציות, 27/08/2026. סגורה: RLS דלוקה בלי מדיניות.';
