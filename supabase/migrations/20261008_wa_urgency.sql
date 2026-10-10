-- ─── דחיפות בתיבת השיחות (עידן אישר את ההגדרה, 08/10/2026) ───────────────
--
-- דחיפות היא תג על שיחה, משני מקורות: כללים אוטומטיים (מחושבים בשרת,
-- `api/_lib/urgency.ts`) וסימון ידני של הנציגה. כאן: הסימון הידני, והעובדות
-- שהכללים צריכים ואינן על שורת השיחה (ההודעה הנכנסת האחרונה, הביקור הקרוב).
--
-- 🔴 הסימון הידני לא נמחק בטריגר. הוא "פעיל" כל עוד ההודעה האנושית
-- האחרונה לא יצאה מאיתנו אחרי הסימון, וזה מחושב בקריאה. אין מצב שבו
-- דגל נשאר דלוק כי שכחו לנקות אותו.

alter table public.wa_conversations
  add column if not exists urgent_marked_at timestamptz,
  add column if not exists urgent_marked_by text;

comment on column public.wa_conversations.urgent_marked_at is
  'סימון ידני "דחוף" של נציג (08/10/2026). פעיל עד שהודעה אנושית יוצאת מאיתנו אחריו.';

-- ─── סימון ידני ───────────────────────────────────────────────────────────
create or replace function public.wa_mark_urgent(p_conversation uuid, p_on boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_author text; v_at timestamptz;
begin
  if public.is_office_staff() is not true then
    raise exception 'not authorized';
  end if;
  select coalesce(nullif(btrim(p.full_name), ''), p.username, 'משתמש') into v_author
    from public.profiles p where p.id = auth.uid();
  v_at := case when p_on then now() else null end;
  update public.wa_conversations
     set urgent_marked_at = v_at,
         urgent_marked_by = case when p_on then coalesce(v_author, 'משתמש') else null end,
         updated_at = now()
   where id = p_conversation;
  if not found then
    raise exception 'conversation not found';
  end if;
  return jsonb_build_object('id', p_conversation, 'urgent_marked_at', v_at, 'urgent_marked_by', case when p_on then v_author end);
end;
$$;
revoke all on function public.wa_mark_urgent(uuid, boolean) from public, anon;
grant execute on function public.wa_mark_urgent(uuid, boolean) to authenticated, service_role;

-- ─── העובדות לכללים, בקריאה אחת לכל הרשימה ──────────────────────────────
-- last_inbound_body: ההודעה הנכנסת האנושית האחרונה (לא כפתור ולא תבנית).
-- next_stop_date:    הביקור הקרוב של הלקוח (לפי מספר לקוח או טלפון) מהיום
--                    עד מחר, עצירה שלא בוטלה ולא נסגרה.
create or replace function public.wa_inbox_urgency_facts(p_ids uuid[])
returns table (conversation_id uuid, last_inbound_body text, next_stop_date date)
language sql
stable
security definer
set search_path = public
as $$
  with conv as (
    select c.id, c.customer_number, c.phone_local
      from public.wa_conversations c
     where c.id = any(p_ids)
       and public.is_office_staff() is true
  ),
  last_in as (
    select distinct on (m.conversation_id) m.conversation_id, m.body
      from public.wa_messages m
      join conv on conv.id = m.conversation_id
     where m.direction = 'in'
       and nullif(btrim(coalesce(m.body, '')), '') is not null
     order by m.conversation_id, coalesce(m.sent_at, m.created_at) desc
  ),
  stops as (
    select conv.id as conversation_id, min(cs.delivery_date) as next_stop_date
      from conv
      join public.calendar_stops cs
        on cs.status in ('planned', 'in_progress')
       and cs.delivery_date between public.israel_today() and public.israel_today() + 1
       and (
         (nullif(conv.customer_number, '') is not null and cs.customer_number = conv.customer_number)
         or (nullif(conv.phone_local, '') is not null and public.wa_normalize_phone(cs.phone) = conv.phone_local)
       )
     group by conv.id
  )
  select conv.id, li.body, st.next_stop_date
    from conv
    left join last_in li on li.conversation_id = conv.id
    left join stops st on st.conversation_id = conv.id;
$$;
revoke all on function public.wa_inbox_urgency_facts(uuid[]) from public, anon;
grant execute on function public.wa_inbox_urgency_facts(uuid[]) to authenticated, service_role;
