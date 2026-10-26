-- ─── אספקת מנוף: הנהג חייב להחתים על אישור ההדרכה לפני "סופק" (26/10/2026) ──
--
-- עידן: "אני רוצה לחייב אותו לחתום על זה שהוא העביר הדרכה על המנוף".
-- עמי, 15/10: טופס המנוף חובה בכל ביקור אצל מנוף ובכל אספקת מנוף.
--
-- 🔴 הרקע: החסימה ישבה רק בכפתור "בוצע" של האפליקציה, ו-19 מנופים נסגרו
-- בלי טופס בין 20/10 ל-26/10: דרך "✓ בוצע" ברשימת הפתוחות (עקף את הבדיקה),
-- דרך מכשירים שעדיין על 1.0.0 (לא מקבלים OTA), ודרך הווב. שער בקוד הלקוח
-- הוא בקשה; שער במסד הוא חוק, והוא תופס כל גרסה וכל מסך.
--
-- ⭐ מי נחסם: נהג (משתמש מחובר שאינו משרד). המשרד (`is_office_staff`) יכול
-- עדיין לסגור, והפער נשאר גלוי ביומן ("⚠️ בלי הדרכה") ובמייל הוואצ'דוג.
-- שרת (service_role, pg_cron, בלי auth.uid) לא נחסם.
--
-- ⭐ "זו עצירת מנוף" = `stop_crane_kind(s)` (20261016_signed_forms.sql), אותה
-- פונקציה שהאפליקציה שואלת דרך `stops_form_status`, כדי שהשניים יסכימו תמיד.

create or replace function public.crane_form_gate()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_kind text;
begin
  if coalesce(new.status, '') <> 'completed' or old.status is not distinct from 'completed' then
    return new;
  end if;
  -- שרת ומשרד עוברים. 🔴 `is_office_staff` מחזיר true גם ל-service_role.
  if auth.uid() is null or (select public.is_office_staff()) is true then
    return new;
  end if;
  v_kind := public.stop_crane_kind(new);
  if v_kind is null then
    return new;
  end if;
  if exists (select 1 from public.crane_forms cf where cf.stop_id = new.id) then
    return new;
  end if;
  raise exception using
    message = case when v_kind = 'training'
                then 'אספקת מנוף: צריך להחתים את הלקוח על אישור ההדרכה לפני שמסמנים סופק'
                else 'ביקור אצל מנוף: צריך למלא את רשימת הבדיקה ולהחתים לפני שמסמנים בוצע' end,
    hint = 'הטופס נפתח מכרטיס העצירה באפליקציה',
    errcode = 'P0001';
end;
$$;
revoke all on function public.crane_form_gate() from public, anon, authenticated;

drop trigger if exists trg_crane_form_gate on public.calendar_stops;
create trigger trg_crane_form_gate
  before update of status on public.calendar_stops
  for each row execute function public.crane_form_gate();

comment on trigger trg_crane_form_gate on public.calendar_stops is
  'נהג לא מסמן בוצע על עצירת מנוף בלי טופס מנוף (crane_forms). המשרד והשרת עוברים. 26/10/2026';
