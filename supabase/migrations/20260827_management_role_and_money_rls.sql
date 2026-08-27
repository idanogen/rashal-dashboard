-- ראה migration שהוחל ב-Supabase: management_role_and_money_rls (27/08/2026)
-- תפקיד "הנהלה", וכסף שנחתך בשרת. עידן, 26/08: "כל דבר שמדבר על כסף
-- ומחזורי מכירות חשוף רק להרשאת הנהלה, שזה נכון לעכשיו שלומי ורונן."
--
-- 🔴 מסך שרק מסתיר שדה אינו הגנה: הערך עדיין נוסע לדפדפן ונשלף משם.
-- ⭐ 79 מדיניויות RLS, ורק 13 נוקבות בתפקיד, וכולן דרך שתי פונקציות
--    עוזרות. לכן הוספת תפקיד היא שינוי של שתיים ולא של 79.

create or replace function public.is_admin_or_dispatcher()
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select public.current_user_role() in ('admin', 'dispatcher', 'team_manager', 'management');
$$;

create or replace function public.is_office_staff()
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select coalesce(auth.role(), '') = 'service_role'
      or public.current_user_role() in ('admin', 'team_manager', 'dispatcher', 'viewer', 'management');
$$;

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
