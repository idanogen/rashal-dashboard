-- ════════════════════════════════════════════════════════════════════════
-- 🔴🔴 סגירת הסלמת הרשאות: כל משתמש מחובר יכול היה להפוך את עצמו למנהל מערכת.
--
-- **מה היה פתוח.** על `profiles` ישבו שתי מדיניויות עדכון עצמי:
--   `update own profile`               with check: id = auth.uid() AND role לא השתנה
--   `authenticated_update_own_profile` with check: id = auth.uid()   ← בלי שום שמירה
-- מדיניויות מתירות ב-Postgres מצטרפות ב-**או** ולא ב-וגם, ולכן השנייה
-- ביטלה בפועל את השמירה של הראשונה. נהג מחובר יכול היה להריץ
-- `update profiles set role='admin' where id = auth.uid()` ולעבור.
-- **אומת בפועל** ב-11/09/2026 בטרנזקציה שהוחזרה, בזהות של נהג אמיתי.
-- המשמעות המעשית: נעילת הכסף של 09/09 נשענת על `role`, כך שכל נהג יכול
-- היה להעלות את עצמו ולראות מחירים, וגם לשייך את עצמו לנהג אחר ולראות
-- את המסלולים שלו.
--
-- **למה טריגר ולא ניסוח חכם יותר של המדיניות.** מדיניות שמשווה לערך
-- הישן חייבת לשאול את הטבלה על עצמה בתוך העדכון, וזה נשען על עיתוי של
-- צילום מצב ומזמין רקורסיה. טריגר רואה את `old` ואת `new` ישירות, ולכן
-- הוא אומר בדיוק מה שהתכוונו: העמודות האלה לא משתנות מהדפדפן.
--
-- ⭐ **מסך ניהול המשתמשים לא נפגע.** הוא לא נוגע בטבלה מהדפדפן אלא עובר
--    דרך `api/admin-users.ts`, שפועל בתפקיד השירות, והטריגר פוסח עליו.
--    הכתיבה היחידה מהדפדפן היא `updateOwnProfile` על השם המלא בלבד.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.profiles_guard_protected_columns()
returns trigger
language plpgsql
as $fn$
declare
  -- 🔴 **הרשימה נבדקת דרך jsonb ולא כשדות ישירים בכוונה.** עמודה שעדיין
  --    לא נולדה (כמו `phone_e164` עד למיגרציה שמוסיפה אותה) פשוט חסרה
  --    בשני הצדדים ולכן אינה "שינוי". כתיבה ישירה של `new.phone_e164`
  --    הייתה מפילה כל עדכון פרופיל עד שהעמודה קיימת, ולכן הפונקציה
  --    מוגדרת **פעם אחת בלבד**, כאן, ולא נבנית מחדש במיגרציה מאוחרת.
  protected constant text[] :=
    array['id','role','disabled','username','email','linked_driver','phone_e164'];
  col text;
  o jsonb := to_jsonb(old);
  n jsonb := to_jsonb(new);
begin
  -- השרת עובר: כל פעולת ניהול אמיתית מגיעה מ-`api/admin-users.ts` בתפקיד
  -- השירות, אחרי ש-`_lib/user-admin-policy.ts` כבר הכריעה מי מורשה.
  if current_role in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  foreach col in array protected loop
    if (o -> col) is distinct from (n -> col) then
      raise exception
        'שדות ההרשאה של כרטיס המשתמש משתנים רק דרך מסך ניהול המשתמשים'
        using errcode = '42501';
    end if;
  end loop;

  return new;
end;
$fn$;

drop trigger if exists trg_profiles_guard on public.profiles;
create trigger trg_profiles_guard
  before update on public.profiles
  for each row execute function public.profiles_guard_protected_columns();

-- ⭐ המדיניות הכפולה יורדת. היא מיותרת מרגע שהטריגר קיים, והשארתה
--    משמרת את המראה שהכל מוגן בשכבת המדיניות בזמן שזה לא המצב.
drop policy if exists "authenticated_update_own_profile" on public.profiles;
