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
-- הטריגר דיווח לנהג על עצירה חדשה להיום, מחר ומחרתיים, וזה היה מדליף
-- את המחר (שם הלקוח והתאריך). מעכשיו האופק הוא היום בלבד. שיבוץ למחר
-- לא מדווח, והנהג רואה אותו כשהוא פותח את האפליקציה בבוקר.
create or replace function public.driver_push_capture_stop()
returns trigger
language plpgsql security definer set search_path = public
as $fn$
declare
  today date := (now() at time zone 'Asia/Jerusalem')::date;
  horizon date := (now() at time zone 'Asia/Jerusalem')::date;
begin
  begin
    if tg_op = 'INSERT' then
      if new.driver is not null and new.status = 'planned'
         and new.delivery_date between today and horizon then
        insert into public.driver_notify_queue (driver_name, kind, title, body, stop_id)
        values (new.driver::text, 'new_stop', 'נוספה עצירה לסידור שלך',
                new.customer_name || coalesce(' · ' || new.city, '')
                  || ' · ' || to_char(new.delivery_date, 'DD/MM'),
                new.id);
        perform public.driver_push_kick();
      end if;

    elsif tg_op = 'UPDATE' then
      if new.driver is distinct from old.driver then
        if old.driver is not null and old.status in ('planned','in_progress')
           and old.delivery_date between today and horizon then
          insert into public.driver_notify_queue (driver_name, kind, title, body, stop_id)
          values (old.driver::text, 'removed', 'עצירה הוסרה מהסידור שלך',
                  old.customer_name || coalesce(' · ' || old.city, ''), new.id);
        end if;
        if new.driver is not null and new.status in ('planned','in_progress')
           and new.delivery_date between today and horizon then
          insert into public.driver_notify_queue (driver_name, kind, title, body, stop_id)
          values (new.driver::text, 'new_stop', 'נוספה עצירה לסידור שלך',
                  new.customer_name || coalesce(' · ' || new.city, '')
                    || ' · ' || to_char(new.delivery_date, 'DD/MM'),
                  new.id);
        end if;
        perform public.driver_push_kick();

      elsif new.delivery_date is distinct from old.delivery_date
            and new.driver is not null
            and new.status in ('planned','in_progress')
            and (new.delivery_date between today and horizon
                 or old.delivery_date between today and horizon) then
        -- עצירה שנדחתה מהיום למחר: לא חושפים את התאריך החדש, רק שיצאה.
        insert into public.driver_notify_queue (driver_name, kind, title, body, stop_id)
        values (new.driver::text, 'schedule_change', 'שינוי בסידור שלך',
                case when new.delivery_date > horizon
                     then new.customer_name || ' יצא מהסידור של היום'
                     else new.customer_name || ' עבר ל-' || to_char(new.delivery_date, 'DD/MM') end,
                new.id);
        perform public.driver_push_kick();

      elsif new.status = 'cancelled' and old.status in ('planned','in_progress')
            and new.driver is not null
            and new.delivery_date between today and horizon then
        insert into public.driver_notify_queue (driver_name, kind, title, body, stop_id)
        values (new.driver::text, 'removed', 'עצירה בוטלה',
                new.customer_name || coalesce(' · ' || new.city, ''), new.id);
        perform public.driver_push_kick();
      end if;
    end if;
  exception when others then
    null; -- בליעה מכוונת: ההתראה לעולם לא מפילה את השיבוץ.
  end;
  return new;
end;
$fn$;

-- טריגר הצ'אט: עוגן להודעה רק בעצירה שתאריכה הגיע. בלי זה הודעת משרד על
-- עצירה של מחר הייתה מגיעה לנהג עם שם הלקוח לפני חצות.
create or replace function public.driver_push_capture_chat()
returns trigger
language plpgsql security definer set search_path = public
as $fn$
declare
  stop record;
  today date := (now() at time zone 'Asia/Jerusalem')::date;
begin
  begin
    if new.type not in ('comment', 'file_upload') then
      return new;
    end if;

    select s.id, s.driver, s.customer_name
      into stop
      from public.calendar_stops s
     where ((new.order_id is not null and s.order_id = new.order_id)
         or (new.service_call_id is not null and s.service_call_id = new.service_call_id)
         or (new.calendar_stop_id is not null and s.id = new.calendar_stop_id))
       and s.driver is not null
       and s.status in ('planned', 'in_progress')
       and s.delivery_date between today - 7 and today
     order by s.delivery_date desc
     limit 1;

    if stop.id is null then
      return new;
    end if;

    if new.user_id is not null and exists (
      select 1 from public.driver_devices dd
       where dd.driver_name = stop.driver::text
         and dd.profile_id::text = new.user_id
    ) then
      return new;
    end if;

    insert into public.driver_notify_queue (driver_name, kind, title, body, stop_id)
    values (
      stop.driver::text,
      case when new.type = 'file_upload' then 'photo' else 'chat' end,
      case when new.type = 'file_upload'
           then 'התקבלה תמונה · ' || stop.customer_name
           else 'הודעה חדשה · ' || stop.customer_name end,
      case when new.type = 'file_upload'
           then coalesce(new.user_name, '')
           else coalesce(new.user_name, '') || ': ' || left(coalesce(new.content, ''), 120) end,
      stop.id);
    perform public.driver_push_kick();
  exception when others then
    null;
  end;
  return new;
end;
$fn$;

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
