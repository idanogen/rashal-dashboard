-- ראה migration שהוחל ב-Supabase: rls_wrap_functions_in_subselect (27/08/2026)
-- כל קריאה לפונקציית תפקיד ב-RLS נעטפת בתת-שאילתה סקלרית.
--
-- 🔴🔴 **זה היה השורש של "המסך לוקח המון זמן", והוא נמצא ביום שהמדידה נולדה.**
-- יומן הטעינה הראה שלוש שליפות שנופלות על
-- `canceling statement due to statement timeout`, ומסך שלוקח 17 עד 25 שניות.
--
-- **מה קרה:** המדיניות נכתבה `is_admin_or_dispatcher()`, ופונקציה כזאת
-- נבדקת **מחדש לכל שורה**. `current_user_role()` עושה שליפה מטבלת
-- הפרופילים, ולכן ספירה אחת של טבלת ההזמנות ביצעה 47,268 שליפות פרופיל.
--
-- **נמדד, אותה שאילתה בדיוק, אותו משתמש:**
-- | | לפני | אחרי |
-- |---|---|---|
-- | `select count(*) from orders` | **6,147ms** | **14.4ms** |
-- | buffers | 144,210 | 2,578 |
--
-- ⭐ העטיפה `(select f())` הופכת את הקריאה ל-InitPlan, כלומר **פעם אחת
-- לשאילתה**. הסמנטיקה זהה לחלוטין: הפונקציות `stable` ותלויות רק ב-uid.
--
-- 🔴🔴 **והשכתוב נעשה בקוד ולא ביד.** שכתוב ידני של 38 מדיניויות אבטחה
-- הוא בדיוק המקום שבו טעות הקלדה פותחת נתונים בשקט. הבלוק קורא את
-- `pg_policies`, מחליף רק את שם הפונקציה, ובונה מחדש את אותה מדיניות.
-- גיבוי מלא: `public.rls_snapshot_20260827`.
--
-- ✅ **אומת אחרי, מטריצת נראות לכל תפקיד:** נהג רואה 247 עצירות ו-11
-- הזמנות בלבד (מוגבל כמו שצריך), חשבוניות מרוכזות נראות למנהל מערכת
-- ולהנהלה בלבד (3,039) ואפס לסדרן, למנהל צוות ולנהג. שום הרשאה לא זזה.

do $$
declare
  p record;
  new_qual text;
  new_check text;
  roles_csv text;
  stmt text;
  fn text;
  touched int := 0;
begin
  for p in
    select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual,'') ~ '(current_user_role|is_admin_or_dispatcher|current_user_driver|is_office_staff|is_management)\(\)'
        or coalesce(with_check,'') ~ '(current_user_role|is_admin_or_dispatcher|current_user_driver|is_office_staff|is_management)\(\)')
  loop
    new_qual := p.qual;
    new_check := p.with_check;

    -- 🔴 `(?<!SELECT )` מונע עטיפה כפולה כשמריצים את זה שוב.
    foreach fn in array array['current_user_role','is_admin_or_dispatcher',
                              'current_user_driver','is_office_staff','is_management']
    loop
      new_qual := regexp_replace(new_qual, '(?<!SELECT )\m' || fn || '\(\)',
                                 '(select public.' || fn || '())', 'g');
      new_check := regexp_replace(new_check, '(?<!SELECT )\m' || fn || '\(\)',
                                  '(select public.' || fn || '())', 'g');
    end loop;

    if new_qual is not distinct from p.qual and new_check is not distinct from p.with_check then
      continue;
    end if;

    roles_csv := array_to_string(p.roles, ', ');

    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);

    stmt := format('create policy %I on %I.%I as %s for %s to %s',
                   p.policyname, p.schemaname, p.tablename,
                   case when p.permissive = 'PERMISSIVE' then 'PERMISSIVE' else 'RESTRICTIVE' end,
                   p.cmd, roles_csv);
    if new_qual is not null then
      stmt := stmt || format(' using (%s)', new_qual);
    end if;
    if new_check is not null then
      stmt := stmt || format(' with check (%s)', new_check);
    end if;

    execute stmt;
    touched := touched + 1;
  end loop;

  raise notice 'rewrote % policies', touched;
end $$;
