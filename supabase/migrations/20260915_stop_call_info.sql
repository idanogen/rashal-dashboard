-- ════════════════════════════════════════════════════════════════════════
-- כרטיס קריאה לנהג ולטכנאי (עידן אישר את המוקאפ, 15/09/2026)
--   meetings/rashal/2026-09-15-כרטיס-קריאה-לנהג-מוקאפ.html
--
-- 1. service_calls.fault_text: "תאור התקלה" מפריוריטי (DOCTEXT_Q_2_SUBFORM),
--    מנוקה מ-HTML בסנכרון (api/_lib/priority-text.ts).
-- 2. stop_call_info(stop): מה הטכנאי צריך, בקריאה אחת. כל מה שהלקוח שלח
--    בוואטסאפ מאז שהקריאה נפתחה, מכל המספרים שמשויכים ללקוח.
-- 3. stops_call_info_counts(stops): לשורה "יש מה לראות" בכרטיס.
-- 4. 🔴 צמצום הרשאות: עד היום כל מחובר (כולל נהג) קרא את כל שיחות
--    הוואטסאפ, וגם דרך התצוגה wa_messages_classified שרצה בהרשאות הבעלים
--    ועקפה RLS. מהיום: משרד קורא הכל, נהג רואה קבצים רק של לקוחות מהסידור
--    שלו, ורק דרך הפונקציות כאן ודרך מדיניות האחסון.
-- ════════════════════════════════════════════════════════════════════════

alter table public.service_calls add column if not exists fault_text text;
comment on column public.service_calls.fault_text is
  'תאור התקלה מפריוריטי (DOCTEXT_Q_2_SUBFORM), שורות טקסט. נמשך בסנכרון, 15/09/2026.';

-- ─── מי רואה לקוח ─────────────────────────────────────────────────────────
-- משרד: תמיד. נהג: לקוח שיש לו אצלו עצירה (לא מבוטלת) מהיום ועד 30 יום אחורה.
create or replace function public.driver_customer_visible(p_customer_number text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select case
    when nullif(btrim(coalesce(p_customer_number, '')), '') is null then false
    when public.is_office_staff() is true then true
    when public.current_user_role() = 'driver' then exists (
      select 1
        from public.calendar_stops cs
        left join public.service_calls sc on sc.id = cs.service_call_id
       where cs.driver = public.current_user_driver()
         and cs.delivery_date <= public.israel_today()
         and cs.delivery_date >= public.israel_today() - 30
         and cs.status <> 'cancelled'
         and coalesce(sc.customer_number, cs.customer_number) = p_customer_number
    )
    else false
  end;
$$;

-- נתיב בדלי wa-media מתחיל במזהה השיחה: <conversation_id>/<...>/<file>
create or replace function public.wa_media_object_visible(p_name text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.is_office_staff() is true
      or exists (
        select 1 from public.wa_conversations c
         where c.id::text = split_part(coalesce(p_name, ''), '/', 1)
           and public.driver_customer_visible(c.customer_number)
      );
$$;

revoke all on function public.driver_customer_visible(text) from public, anon;
revoke all on function public.wa_media_object_visible(text) from public, anon;
grant execute on function public.driver_customer_visible(text) to authenticated;
grant execute on function public.wa_media_object_visible(text) to authenticated;

-- ─── מה הלקוח שלח על הקריאה ───────────────────────────────────────────────
-- פנימית בלבד (נקראת מתוך הפונקציות למטה). "תשובת כפתור" = טקסט נכנס
-- שזהה לכפתור של הודעה יוצאת באותה שיחה ("מתאים לי", "English").
create or replace function public.call_customer_inbound(p_call_id uuid)
returns table (
  message_id uuid,
  at timestamptz,
  body text,
  attachments jsonb,
  is_button_reply boolean
)
language sql stable security definer
set search_path = public
as $$
  select m.id,
         coalesce(m.sent_at, m.created_at),
         m.body,
         case when jsonb_typeof(m.attachments) = 'array' then m.attachments else '[]'::jsonb end,
         exists (
           select 1
             from public.wa_messages o,
                  jsonb_array_elements(case when jsonb_typeof(o.attachments) = 'array' then o.attachments else '[]'::jsonb end) b
            where o.conversation_id = m.conversation_id
              and o.direction = 'out'
              and b->>'type' = 'button'
              and b->>'text' = btrim(coalesce(m.body, ''))
         )
    from public.service_calls sc
    join public.wa_conversations c on c.customer_number = sc.customer_number
    join public.wa_messages m on m.conversation_id = c.id
   where sc.id = p_call_id
     and nullif(btrim(coalesce(sc.customer_number, '')), '') is not null
     and m.direction = 'in'
     and coalesce(m.sent_at, m.created_at) >= sc.created_at;
$$;

revoke all on function public.call_customer_inbound(uuid) from public, anon, authenticated;

-- ─── תוכן הכרטיס, לפי קריאה: ההגדרה **אינה כאן** ────────────────────────
-- `call_info_payload` נולדה כאן כמקור האמת היחיד לכרטיס (נהג ומשרד).
-- ההגדרה החיה עברה ב-19/10 ל-`20261019_service_call_docs.sql` (נוסף
-- מפתח 'doc'). העותק הישן הוסר ב-24/10/2026. העוטפות למטה קוראות לה
-- בזמן ריצה.

-- ─── הכרטיס של הנהג (לפי עצירה) ───────────────────────────────────────────
create or replace function public.stop_call_info(p_stop_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_stop public.calendar_stops;
begin
  select * into v_stop from public.calendar_stops where id = p_stop_id;
  if not found then
    return null;
  end if;

  if not (
    public.is_office_staff() is true
    or (public.current_user_role() = 'driver'
        and v_stop.driver = public.current_user_driver()
        and v_stop.delivery_date <= public.israel_today())
  ) then
    raise exception 'not authorized';
  end if;

  -- 08/10/2026 (עמי): גם אספקה ואיסוף. המטען של כל סוג נבנה בפונקציה שלו
  -- (20261008_stop_info_delivery_pickup.sql); כאן רק ניתוב.
  if v_stop.service_call_id is not null then
    return jsonb_build_object('stop_id', p_stop_id)
           || coalesce(public.call_info_payload(v_stop.service_call_id), '{}'::jsonb);
  end if;

  return jsonb_build_object('stop_id', p_stop_id, 'call', null,
                            'media', '[]'::jsonb, 'texts', '[]'::jsonb,
                            'office_note', null, 'media_request', null)
         || case
              when v_stop.order_id is not null then coalesce(public.order_info_payload(v_stop.order_id), '{}'::jsonb)
              when v_stop.pickup_id is not null then coalesce(public.pickup_info_payload(v_stop.pickup_id, p_stop_id), '{}'::jsonb)
              else '{}'::jsonb
            end;
end;
$$;

revoke all on function public.stop_call_info(uuid) from public, anon;
grant execute on function public.stop_call_info(uuid) to authenticated;

-- ─── אותו כרטיס במסך הסדרן (לפי קריאה, משרד בלבד) ─────────────────────────
create or replace function public.service_call_info(p_call_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
begin
  if public.is_office_staff() is not true then
    raise exception 'not authorized';
  end if;
  return jsonb_build_object('stop_id', '')
         || coalesce(public.call_info_payload(p_call_id), '{}'::jsonb);
end;
$$;

revoke all on function public.service_call_info(uuid) from public, anon;
grant execute on function public.service_call_info(uuid) to authenticated;

-- ─── "יש מה לראות" לכל העצירות במסך ──────────────────────────────────────
create or replace function public.stops_call_info_counts(p_stop_ids uuid[])
returns table (stop_id uuid, has_fault boolean, images int, videos int, texts int)
language sql stable security definer
set search_path = public
as $$
  with visible as (
    select cs.id, cs.service_call_id, sc.fault_text
      from public.calendar_stops cs
      join public.service_calls sc on sc.id = cs.service_call_id
     where cs.id = any(p_stop_ids)
       and coalesce(cardinality(p_stop_ids), 0) <= 300
       and (
         public.is_office_staff() is true
         or (public.current_user_role() = 'driver'
             and cs.driver = public.current_user_driver()
             and cs.delivery_date <= public.israel_today())
       )
  )
  select v.id,
         nullif(btrim(coalesce(v.fault_text, '')), '') is not null,
         coalesce(sum((a.a->>'type' = 'image')::int), 0)::int,
         coalesce(sum((a.a->>'type' = 'video')::int), 0)::int,
         (select count(*)::int
            from public.call_customer_inbound(v.service_call_id) i
           where nullif(btrim(coalesce(i.body, '')), '') is not null
             and not i.is_button_reply)
    from visible v
    left join lateral (
      select t.a
        from public.call_customer_inbound(v.service_call_id) i,
             jsonb_array_elements(i.attachments) t(a)
       where t.a ? 'stored_path'
    ) a on true
   group by v.id, v.service_call_id, v.fault_text;
$$;

revoke all on function public.stops_call_info_counts(uuid[]) from public, anon;
grant execute on function public.stops_call_info_counts(uuid[]) to authenticated;

-- ─── צמצום קריאת הוואטסאפ ─────────────────────────────────────────────────
-- 🔴 היה `true` לכל מחובר. המשרד ממשיך לקרוא הכל (תיבה, כרטיס לקוח, realtime);
-- השרת (api/*) עובד עם service role ולא מושפע.
drop policy if exists wa_conversations_read on public.wa_conversations;
create policy wa_conversations_read on public.wa_conversations
  for select to authenticated
  using ((select public.is_office_staff()));

drop policy if exists wa_messages_read on public.wa_messages;
create policy wa_messages_read on public.wa_messages
  for select to authenticated
  using ((select public.is_office_staff()));

-- 🔴🔴 התצוגה רצה בהרשאות הבעלים ועוקפת RLS: בלי השורה הזאת הצמצום למעלה
-- היה נראה סגור ונשאר פתוח לגמרי דרך /rest/v1/wa_messages_classified.
alter view public.wa_messages_classified set (security_invoker = true);
revoke insert, update, delete, truncate on public.wa_messages_classified from authenticated, anon;

-- ─── הדלי הפרטי wa-media: נהג חותם רק קבצים של לקוחות מהסידור שלו ─────────
drop policy if exists wa_media_read_visible on storage.objects;
create policy wa_media_read_visible on storage.objects
  for select to authenticated
  using (bucket_id = 'wa-media' and public.wa_media_object_visible(name));
