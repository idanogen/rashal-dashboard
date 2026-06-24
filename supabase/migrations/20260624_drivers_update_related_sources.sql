-- נהג רשאי לעדכן הזמנה/קריאת שירות המשויכת לעצירה שלו בלבד
-- (נדרש כדי שסימון "סופק"/"לא בוצע" יסנכרן את סטטוס המקור — אחרת UPDATE נוגע ב-0 שורות
--  ו-.single() זורק "Cannot coerce the result to a single JSON object").
create policy drivers_update_related_orders on public.orders
  for update to authenticated
  using (
    current_user_role() = 'driver'
    and exists (select 1 from public.calendar_stops cs
                where cs.order_id = orders.id and cs.driver = current_user_driver())
  )
  with check (
    current_user_role() = 'driver'
    and exists (select 1 from public.calendar_stops cs
                where cs.order_id = orders.id and cs.driver = current_user_driver())
  );

create policy drivers_update_related_service_calls on public.service_calls
  for update to authenticated
  using (
    current_user_role() = 'driver'
    and exists (select 1 from public.calendar_stops cs
                where cs.service_call_id = service_calls.id and cs.driver = current_user_driver())
  )
  with check (
    current_user_role() = 'driver'
    and exists (select 1 from public.calendar_stops cs
                where cs.service_call_id = service_calls.id and cs.driver = current_user_driver())
  );
