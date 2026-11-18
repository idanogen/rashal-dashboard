-- ─── ההודעה האחרונה של הלקוח על כרטיס הקריאה (עידן, 18/11/2026) ─────────────
--
-- "ענה בלי תמונה" אמר שהלקוח כתב, אבל לא מה. מעכשיו הכרטיס מציג ציטוט קצר של
-- ההודעה האחרונה שהלקוח שלח מאז שהקריאה נפתחה, נקודה כחולה כשאף אחד במשרד עוד
-- לא קרא, ולחיצה פותחת את תיבת השיחות ישר על הלקוח (phone_local).
--
-- השיוך כמו ברמזור ובמנוע הבקשות: שיחה עם מספר הלקוח, או עם הטלפון שאליו נשלחה
-- בקשת התמונה, או הנייד שבקריאה. רק קריאות פתוחות ("קריאה חדשה", לא בארכיון).

create or replace function public.service_call_last_inbound()
returns table(service_call_id uuid, phone_local text, body text, has_media boolean, at timestamptz, unread boolean)
language sql
stable
security definer
set search_path = public
as $$
  with oc as (
    select sc.id, sc.created_at, sc.customer_number,
           (select r.phone_e164 from media_requests r
             where r.service_call_id = sc.id and r.phone_e164 is not null
             order by r.created_at desc limit 1) as req_phone,
           case when regexp_replace(coalesce(sc.phone, ''), '\D', '', 'g') ~ '^0?5[0-9]{8}$'
                then '+972' || right(regexp_replace(sc.phone, '\D', '', 'g'), 9) end as call_phone
      from service_calls sc
     where (select public.is_office_staff()) is true
       and sc.archived_at is null
       and sc.duplicate_of is null
       and sc.service_call_status::text = 'קריאה חדשה'
  )
  select distinct on (oc.id)
         oc.id, c.phone_local,
         left(nullif(btrim(m.body), ''), 140),
         jsonb_typeof(m.attachments) = 'array' and jsonb_array_length(m.attachments) > 0,
         coalesce(m.sent_at, m.created_at),
         c.read_at is null or c.read_at < coalesce(m.sent_at, m.created_at)
    from oc
    join wa_conversations c
      on (nullif(btrim(coalesce(oc.customer_number, '')), '') is not null and c.customer_number = oc.customer_number)
      or c.phone_e164 = oc.req_phone
      or c.phone_e164 = oc.call_phone
    join wa_messages m on m.conversation_id = c.id
                      and m.direction = 'in'
                      and coalesce(m.sent_at, m.created_at) >= oc.created_at
   order by oc.id, coalesce(m.sent_at, m.created_at) desc;
$$;

revoke all on function public.service_call_last_inbound() from public, anon;
grant execute on function public.service_call_last_inbound() to authenticated;
