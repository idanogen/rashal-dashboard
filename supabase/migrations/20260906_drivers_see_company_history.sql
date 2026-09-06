-- נהגים וטכנאים רואים את כל ההיסטוריה של החברה (החלטת עידן, 06/09/2026,
-- מהמשרד של ר.שעל): "אני רוצה שכולם יוכלו לראות את ההיסטוריה של כל מה
-- שעשינו במערכת שלנו, בלי קשר להיסטוריית ביקורים".
--
-- עד היום נהג ראה שני מעגלים: העצירות שלו, ועצירות סגורות של עמיתים רק
-- אצל לקוח שיש לו אליו שיבוץ פתוח (driver_customer_keys, 02/09). המעגל
-- השני מוחלף במעגל רחב: **כל עצירה סגורה של כל עובד**, מכל התאריכים.
-- מה שנשאר חסוי מנהג: עבודה פתוחה של אחרים (מתוכנן / בדרך) ושיבוצים
-- עתידיים של אחרים. "היום שלי" והמונים באפליקציה ממשיכים לספור רק את
-- העבודה שלו (הסינון בצד הלקוח, visit-history.ts).
--
-- הרשומות שמאחורי העצירה (הזמנה, קריאה, מסמכים, צ'אט) נפתחות באותו
-- קו: אם יש לישות עצירה סגורה של מישהו, הנהג רואה אותה. בלי זה כרטיס
-- ההיסטוריה של עמית היה נפתח ריק.

create or replace function public.stop_is_history(p_status text)
returns boolean
language sql
immutable
as $$
  select p_status in ('completed', 'not_completed', 'cancelled');
$$;

-- calendar_stops: המעגל הרחב במקום מעגל הלקוח-הפתוח.
drop policy if exists drivers_select_customer_history on public.calendar_stops;
create policy drivers_select_company_history on public.calendar_stops
  for select to authenticated
  using (
    (select public.current_user_role()) = 'driver'
    and public.stop_is_history(status)
  );

-- הפונקציה של מעגל הלקוח-הפתוח מתה עם המדיניות. לא משאירים מנגנון מת.
drop function if exists public.driver_customer_keys();

-- הישויות שמאחורי העצירה: שלו, או כל עצירה סגורה.
drop policy if exists drivers_select_related_orders on public.orders;
create policy drivers_select_related_orders on public.orders
  for select to authenticated
  using (
    (select public.current_user_role()) = 'driver'
    and exists (
      select 1 from public.calendar_stops cs
      where cs.order_id = orders.id
        and (cs.driver = (select public.current_user_driver()) or public.stop_is_history(cs.status))
    )
  );

drop policy if exists drivers_select_related_order_documents on public.order_documents;
create policy drivers_select_related_order_documents on public.order_documents
  for select to authenticated
  using (
    (select public.current_user_role()) = 'driver'
    and exists (
      select 1 from public.calendar_stops cs
      where cs.order_id = order_documents.order_id
        and (cs.driver = (select public.current_user_driver()) or public.stop_is_history(cs.status))
    )
  );

drop policy if exists drivers_select_related_service_calls on public.service_calls;
create policy drivers_select_related_service_calls on public.service_calls
  for select to authenticated
  using (
    (select public.current_user_role()) = 'driver'
    and exists (
      select 1 from public.calendar_stops cs
      where cs.service_call_id = service_calls.id
        and (cs.driver = (select public.current_user_driver()) or public.stop_is_history(cs.status))
    )
  );

drop policy if exists drivers_select_related_inbound on public.whatsapp_inbound;
create policy drivers_select_related_inbound on public.whatsapp_inbound
  for select to authenticated
  using (
    (select public.current_user_role()) = 'driver'
    and order_id is not null
    and exists (
      select 1 from public.calendar_stops cs
      where cs.order_id = whatsapp_inbound.order_id
        and (cs.driver = (select public.current_user_driver()) or public.stop_is_history(cs.status))
    )
  );

drop policy if exists drivers_select_related_outbound on public.whatsapp_outbound;
create policy drivers_select_related_outbound on public.whatsapp_outbound
  for select to authenticated
  using (
    (select public.current_user_role()) = 'driver'
    and order_id is not null
    and exists (
      select 1 from public.calendar_stops cs
      where cs.order_id = whatsapp_outbound.order_id
        and (cs.driver = (select public.current_user_driver()) or public.stop_is_history(cs.status))
    )
  );
