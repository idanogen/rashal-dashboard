-- priority_customers נוצרה עם RLS מופעל ובלי אף policy.
-- בפוסטגרס זה אומר: הסנכרון (service_role) כותב, והדפדפן קורא אפס שורות
-- בלי שגיאה. לכן טאב "לקוחות חדשים" הציג 0 מאז שנבנה ב-09/08/2026,
-- בזמן שבמסד יושבים 1,206 לקוחות ומהם 198 בלי הזמנה.
-- ההרשאות מועתקות מהתבנית של orders: צוות משרד קורא, נהגים לא.

create policy admins_dispatchers_all_priority_customers
  on public.priority_customers
  for all
  using (is_admin_or_dispatcher())
  with check (is_admin_or_dispatcher());

create policy viewer_select_priority_customers
  on public.priority_customers
  for select
  using (current_user_role() = 'viewer');
