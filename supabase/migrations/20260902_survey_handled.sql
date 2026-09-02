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

create or replace function public.set_survey_handled(p_survey_id uuid, p_handled boolean)
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
begin
  select coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.username), ''), split_part(p.email, '@', 1))
    into v_actor
    from public.profiles p
   where p.id = auth.uid()
     and p.disabled = false;

  if v_actor is null then
    raise exception 'לא מורשה לסמן טיפול' using errcode = '42501';
  end if;

  update public.customer_surveys s
     set handled_at = case when p_handled then now() else null end,
         handled_by = case when p_handled then v_actor else null end
   -- רק חוות דעת שנענתה. סקר שעדיין בתור אין מה "לטפל" בו, וסימון עליו
   -- היה יוצר שורה מטופלת שלא תופיע בשום מסך.
   where s.id = p_survey_id
     and s.answered_at is not null
  returning s.handled_at, s.handled_by into v_handled_at, v_handled_by;

  if not found then
    raise exception 'חוות הדעת לא נמצאה' using errcode = 'P0002';
  end if;

  return jsonb_build_object('handled_at', v_handled_at, 'handled_by', v_handled_by);
end;
$$;

-- ⭐ סגור ל-anon. הלקח מ-27/08: פונקציית SECURITY DEFINER שנשארת פתוחה
-- ל-anon היא פתח לכל מי שמחזיק את המפתח הציבורי שיושב ממילא בדפדפן.
revoke all on function public.set_survey_handled(uuid, boolean) from public, anon;
grant execute on function public.set_survey_handled(uuid, boolean) to authenticated;

comment on function public.set_survey_handled(uuid, boolean) is
  'סימון "טופל" על חוות דעת בדירוג נמוך, בשני הכיוונים. השם נגזר בשרת. נולד 02/09/2026.';
