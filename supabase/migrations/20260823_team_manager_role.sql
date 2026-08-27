-- תפקיד "מנהל צוות": כל מה שלסדרן, ובנוסף ניהול משתמשים וצוות השטח.
-- 🔴 הוא **אינו** מנהל מערכת: אין מחיקת משתמש, אין תבניות וואטסאפ, ואסור
-- לו לגעת במנהל מערכת או להעניק את התפקיד. שלושת האיסורים נאכפים
-- ב-`api/_lib/user-admin-policy.ts`, ויש עליהם בדיקות.

create or replace function public.is_admin_or_dispatcher()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.current_user_role() in ('admin', 'dispatcher', 'team_manager', 'management');
  -- 🔴 `management` נוסף 27/08/2026. **מתעדכן כאן ולא בקובץ חדש**, כי
  -- פונקציה שמוגדרת בשני קבצים חוזרת לגרסה ישנה ברגע שמריצים מחדש את
  -- הקובץ הישן, בלי שום שגיאה. [[test/migrations.test.mjs]]
$$;

create or replace function public.can_manage_team()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.current_user_role() in ('admin', 'team_manager');
$$;

-- אין מדיניות מחיקה בכוונה: עובד שעזב מסומן לא פעיל, כדי שכל העצירות
-- ההיסטוריות שלו יישארו קריאות.
create policy assignees_insert_managers on public.assignees
  for insert to authenticated with check (public.can_manage_team());

create policy assignees_update_managers on public.assignees
  for update to authenticated using (public.can_manage_team())
                            with check (public.can_manage_team());
