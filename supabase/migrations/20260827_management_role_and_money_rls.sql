-- ראה migration שהוחל ב-Supabase: management_role_and_money_rls (27/08/2026)
-- תפקיד "הנהלה", וכסף שנחתך בשרת. עידן, 26/08: "כל דבר שמדבר על כסף
-- ומחזורי מכירות חשוף רק להרשאת הנהלה, שזה נכון לעכשיו שלומי ורונן."
--
-- 🔴 מסך שרק מסתיר שדה אינו הגנה: הערך עדיין נוסע לדפדפן ונשלף משם.
-- ⭐ 79 מדיניויות RLS, ורק 13 נוקבות בתפקיד, וכולן דרך שתי פונקציות
--    עוזרות. לכן הוספת תפקיד היא שינוי של שתיים ולא של 79.
--
-- 🔴 **ושתי הפונקציות האלה עודכנו בקבצים שבהם הן נולדו**, ולא כאן:
--    `is_admin_or_dispatcher` ב-20260823, `is_office_staff` ב-20260824.
--    פונקציה שמוגדרת בשני קבצים חוזרת לגרסה ישנה ברגע שמריצים מחדש את
--    הישן, בלי שום שגיאה. זה כבר נשך אותנו, ויש על זה בדיקה.

-- 🔴 מנהל צוות וסדרן **אינם** כאן, וזו כל הנקודה.
create or replace function public.is_management()
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select coalesce(auth.role(), '') = 'service_role'
      or public.current_user_role() in ('admin', 'management');
$$;

comment on function public.is_management() is
  'רשאי לראות כסף ומחזורי מכירות. שלומי ורונן, ועידן כמנהל מערכת. נקבע 26/08/2026.';

-- 🔴 נעשה לפני שנבנה מסך גיול החובות, כדי שהמסך ייוולד מוגן.
drop policy if exists authenticated_all_cinvoices on public.consolidated_invoices;
create policy management_reads_cinvoices on public.consolidated_invoices
  for all to authenticated using (public.is_management()) with check (public.is_management());

drop policy if exists authenticated_all_invoices on public.invoices;
create policy management_reads_invoices on public.invoices
  for all to authenticated using (public.is_management()) with check (public.is_management());

-- ⭐ תעודות משלוח נשארות פתוחות: מסמך תפעולי, והמסך אינו מציג מהן סכום.
