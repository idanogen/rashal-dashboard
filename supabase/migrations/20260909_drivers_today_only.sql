-- המסלול נחשף לנהג רק מחצות של אותו יום (החלטת עידן, 09/09/2026:
-- "להציג את המסלול לנהגים רק ב-00:00 בלילה, מ-00:01 של אותו יום הוא
-- יחפש שיבוצים", ובחר חסימה במסד ולא הסתרה באפליקציה).
--
-- עד היום נהג ראה את שיבוציו לשבועיים קדימה (מחר, השבוע). מעכשיו המסד
-- מחזיר לנהג רק עצירות שתאריך האספקה שלהן הוא היום או קודם (בשעון
-- ישראל), וההיסטוריה של החברה נשארת כמו שהייתה. שיבוץ להיום שנוסף
-- במהלך היום מופיע מיד, כמו קודם.
--
-- 🔴 "היום" הוא לפי שעון ישראל, לא UTC: current_date במסד היה פותח את
-- המסלול בשעה 02:00 או 03:00 בלילה, לא בחצות.

create or replace function public.israel_today()
returns date
language sql stable
as $$
  select (now() at time zone 'Asia/Jerusalem')::date;
$$;

-- עצירה שנהג רשאי לראות כשלו: שלו, ותאריכה הגיע.
create or replace function public.driver_stop_visible(p_driver text, p_delivery_date date)
returns boolean
language sql stable
as $$
  select p_driver = (select public.current_user_driver())
     and p_delivery_date <= (select public.israel_today());
$$;

-- ── היומן ─────────────────────────────────────────────────────────────
drop policy if exists drivers_select_own_calendar_stops on public.calendar_stops;
create policy drivers_select_own_calendar_stops on public.calendar_stops
  for select to authenticated
  using (
    (select public.current_user_role()) = 'driver'
    and public.driver_stop_visible(driver, delivery_date)
  );

drop policy if exists drivers_update_own_calendar_stops on public.calendar_stops;
create policy drivers_update_own_calendar_stops on public.calendar_stops
  for update to authenticated
  using (
    (select public.current_user_role()) = 'driver'
    and public.driver_stop_visible(driver, delivery_date)
  );

-- ── הישויות שמאחורי העצירה: אותו קו (שלו והגיע תאריכה, או היסטוריה) ──
drop policy if exists drivers_select_related_orders on public.orders;
create policy drivers_select_related_orders on public.orders
  for select to authenticated
  using (
    (select public.current_user_role()) = 'driver'
    and exists (
      select 1 from public.calendar_stops cs
      where cs.order_id = orders.id
        and (public.driver_stop_visible(cs.driver, cs.delivery_date) or public.stop_is_history(cs.status))
    )
  );

drop policy if exists drivers_update_related_orders on public.orders;
create policy drivers_update_related_orders on public.orders
  for update to authenticated
  using (
    (select public.current_user_role()) = 'driver'
    and exists (select 1 from public.calendar_stops cs
                where cs.order_id = orders.id and public.driver_stop_visible(cs.driver, cs.delivery_date))
  )
  with check (
    (select public.current_user_role()) = 'driver'
    and exists (select 1 from public.calendar_stops cs
                where cs.order_id = orders.id and public.driver_stop_visible(cs.driver, cs.delivery_date))
  );

drop policy if exists drivers_select_related_order_documents on public.order_documents;
create policy drivers_select_related_order_documents on public.order_documents
  for select to authenticated
  using (
    (select public.current_user_role()) = 'driver'
    and exists (
      select 1 from public.calendar_stops cs
      where cs.order_id = order_documents.order_id
        and (public.driver_stop_visible(cs.driver, cs.delivery_date) or public.stop_is_history(cs.status))
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
        and (public.driver_stop_visible(cs.driver, cs.delivery_date) or public.stop_is_history(cs.status))
    )
  );

drop policy if exists drivers_update_related_service_calls on public.service_calls;
create policy drivers_update_related_service_calls on public.service_calls
  for update to authenticated
  using (
    (select public.current_user_role()) = 'driver'
    and exists (select 1 from public.calendar_stops cs
                where cs.service_call_id = service_calls.id and public.driver_stop_visible(cs.driver, cs.delivery_date))
  )
  with check (
    (select public.current_user_role()) = 'driver'
    and exists (select 1 from public.calendar_stops cs
                where cs.service_call_id = service_calls.id and public.driver_stop_visible(cs.driver, cs.delivery_date))
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
        and (public.driver_stop_visible(cs.driver, cs.delivery_date) or public.stop_is_history(cs.status))
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
        and (public.driver_stop_visible(cs.driver, cs.delivery_date) or public.stop_is_history(cs.status))
    )
  );

drop policy if exists drivers_select_own_reminder_log on public.whatsapp_reminder_log;
create policy drivers_select_own_reminder_log on public.whatsapp_reminder_log
  for select to authenticated
  using (
    (select public.current_user_role()) = 'driver'
    and exists (select 1 from public.calendar_stops cs
                where cs.order_id = whatsapp_reminder_log.order_id and public.driver_stop_visible(cs.driver, cs.delivery_date))
  );

-- ── התראות הדחיפה: רק להיום ─────────────────────────────────────────
-- הטריגרים driver_push_capture_stop / driver_push_capture_chat דיווחו לנהג
-- על עצירה (ועל צ'אט) גם למחר ומחרתיים, וזה היה מדליף את שם הלקוח לפני
-- חצות. השינוי (אופק = היום, ועוגן צ'אט עד היום) נעשה בקובץ המקור,
-- 20260831_driver_push_engine.sql, לפי כלל הבית: פונקציה אחת, קובץ אחד.

-- גם ההיסטוריה של החברה נעצרת בהיום: עצירה של מחר שבוטלה היא "סגורה"
-- לפי stop_is_history, ובלי הרצפה הזאת הייתה מציצה לנהג לפני חצות.
drop policy if exists drivers_select_company_history on public.calendar_stops;
create policy drivers_select_company_history on public.calendar_stops
  for select to authenticated
  using (
    (select public.current_user_role()) = 'driver'
    and public.stop_is_history(status)
    and delivery_date <= (select public.israel_today())
  );
