-- מלל חופשי על טיפול בדירוג נמוך: מה הייתה התקלה ואיך היא טופלה.
--
-- ⭐ **הבקשה (עידן, 10/09/2026):** "באזור הזה איפה שאנחנו מנהלים את הטיפול
-- בקריאות שירות בדירוג נמוך שיהיה מקום למלל חופשי מה הייתה התקלה ואיך היא
-- טופלה". עד היום הסימון אמר רק **שמישהו טיפל**, ולא **מה קרה**, ולכן אחרי
-- שבוע אי אפשר היה ללמוד כלום מהרשימה. הווי הירוק סוגר את המשימה ומאבד את
-- הידע.
--
-- 🔴 **חתימת הפונקציה משתנה, והפרמטר החדש עם ברירת מחדל בכוונה.** לשונית
-- שעדיין מריצה קוד ישן קוראת בשני ארגומנטים, ועם `default null` היא ממשיכה
-- לעבוד במקום לקבל "פונקציה לא נמצאה". [[open_tab_runs_stale_code]]
--
-- 🔴 **`handled_at` ו-`handled_by` לא זזים בעריכת המלל.** `coalesce` על שניהם:
-- מי שמתקן ניסוח בעוד שבוע לא הופך את "טופל היום 11:18" ל"טופל בעוד שבוע".
-- זמן הטיפול הוא עובדה, לא חותמת עדכון אחרון.
--
-- 🔴 **ביטול סימון לא מוחק את מה שמישהו כתב.** `p_note is null` פירושו "אל
-- תיגע במלל". מחיקת טקסט שאדם הקליד היא הרס, וביטול סימון הוא בדרך כלל
-- תיקון של לחיצה בטעות. מחיקה מפורשת נעשית בשמירת מלל ריק.

alter table public.customer_surveys
  add column if not exists handled_note text;

comment on column public.customer_surveys.handled_note is
  'מלל חופשי: מה הייתה התקלה ואיך היא טופלה. נערך בנפרד מהסימון, ואינו מזיז את handled_at. נולד 10/09/2026.';

drop function if exists public.set_survey_handled(uuid, boolean);

create or replace function public.set_survey_handled(
  p_survey_id uuid,
  p_handled boolean,
  p_note text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  v_actor text;
  v_handled_at timestamptz;
  v_handled_by text;
  v_handled_note text;
begin
  select coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.username), ''), split_part(p.email, '@', 1))
    into v_actor
    from public.profiles p
   where p.id = auth.uid()
     and p.disabled = false;

  if v_actor is null then
    raise exception 'לא מורשה לסמן טיפול' using errcode = '42501';
  end if;

  -- 🔴 תקרה על אורך המלל. שדה טקסט חופשי בלי גבול הוא דלת להדבקה של מסמך
  -- שלם לתוך שורה שאמורה להיקרא ברשימה.
  if p_note is not null and length(p_note) > 2000 then
    raise exception 'התיאור ארוך מדי (מקסימום 2000 תווים)' using errcode = '22001';
  end if;

  update public.customer_surveys s
     set handled_at = case when p_handled then coalesce(s.handled_at, now()) else null end,
         handled_by = case when p_handled then coalesce(s.handled_by, v_actor) else null end,
         handled_note = case
                          when p_note is null then s.handled_note
                          else nullif(btrim(p_note), '')
                        end
   -- רק חוות דעת שנענתה. סקר שעדיין בתור אין מה "לטפל" בו.
   where s.id = p_survey_id
     and s.answered_at is not null
  returning s.handled_at, s.handled_by, s.handled_note
       into v_handled_at, v_handled_by, v_handled_note;

  if not found then
    raise exception 'חוות הדעת לא נמצאה' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'handled_at', v_handled_at,
    'handled_by', v_handled_by,
    'handled_note', v_handled_note
  );
end;
$$;

revoke all on function public.set_survey_handled(uuid, boolean, text) from public, anon;
grant execute on function public.set_survey_handled(uuid, boolean, text) to authenticated;

comment on function public.set_survey_handled(uuid, boolean, text) is
  'סימון "טופל" על חוות דעת בדירוג נמוך, ומלל חופשי על מה שקרה. השם נגזר בשרת. p_note = null אינו נוגע במלל.';

notify pgrst, 'reload schema';
