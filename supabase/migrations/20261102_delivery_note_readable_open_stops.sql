-- ─────────────────────────────────────────────────────────────────────────
-- תעודת משלוח של עצירה פתוחה מימים קודמים (נמצא בלוגים 02/11/2026).
--
-- נהג קורא את תמונות התעודה רק של עצירה מ-3 הימים האחרונים. אבל עצירה
-- שנשארה פתוחה (שארית) מוצגת לו ונטענת מראש לעבודה בלי קליטה, וכרטיס
-- התעודה עצמו (stop_delivery_note) פתוח לו בלי גבול תאריך. רודי, ליברמן
-- צבי מ-26/10: התעודה SH2604320 לא נפתחה, והטלפון ניסה שוב כל כמה שניות.
-- מהיום: 3 הימים האחרונים, או עצירה שעדיין פתוחה. עצירה סגורה וישנה נשארת חסומה.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.delivery_note_object_readable(p_name text)
returns boolean
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_docno text := split_part(p_name, '/', 1);
  v_drv   text;
begin
  if public.is_office_staff() is true then return true; end if;
  if public.current_user_role() is distinct from 'driver' then return false; end if;
  v_drv := public.current_user_driver();
  if v_drv is null or v_docno !~ '^SH[0-9]+$' then return false; end if;
  return exists (
    select 1 from public.calendar_stops s
     where s.driver = v_drv
       and s.source_type in ('delivery', 'customer')
       and s.delivery_date <= public.israel_today()
       and (s.delivery_date >= public.israel_today() - 3 or s.status in ('planned', 'in_progress'))
       and (public.stop_delivery_doc(s)).docno = v_docno);
end;
$function$;
