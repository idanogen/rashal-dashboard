-- מסך ההרשאות קורא מכאן.
--
-- ⭐ **המסך אינו מגדיר הרשאות, הוא מצלם אותן.** ההגדרה חיה בכללי האבטחה
-- של Postgres, וזה מה שבאמת נאכף כשמישהו מבקש נתונים. מסך שמחזיק רשימה
-- משלו מתיישן בשקט ברגע שכלל אחד משתנה, ומציג ביטחון שאין לו כיסוי.
--
-- 🔴 **וטבלה בלי אף מדיניות חייבת להופיע גם היא.** `pg_policies` לא
-- מחזירה עליה שום שורה, ולכן מסך שנשען רק עליה היה מדלג עליה לגמרי,
-- והחוסר היה נראה בדיוק כמו "אין בעיה". לכן הרשימה נבנית מהטבלאות
-- ומצרפת להן את המדיניות, ולא להפך.
create or replace function public.security_matrix()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  result jsonb;
begin
  if public.can_manage_team() is not true then
    raise exception 'not authorized';
  end if;

  select coalesce(jsonb_agg(t order by t.tbl), '[]'::jsonb) into result
  from (
    select c.relname as tbl,
           c.relrowsecurity as rls_enabled,
           coalesce((
             select jsonb_agg(jsonb_build_object(
                      'policy', p.policyname,
                      'cmd',    p.cmd,
                      'roles',  p.roles,
                      'expr',   btrim(coalesce(p.qual, p.with_check, 'true'))
                    ) order by p.policyname)
               from pg_policies p
              where p.schemaname = 'public' and p.tablename = c.relname
           ), '[]'::jsonb) as policies
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
  ) t;

  return result;
end;
$$;

revoke all on function public.security_matrix() from public;
grant execute on function public.security_matrix() to authenticated;
