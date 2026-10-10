-- ─── כרטיס העצירה לנהג גם לאספקה ולאיסוף (עמי, 06/10/2026) ──────────────────
--
-- הבקשה: "לבדוק האם הנהג רואה פרטי אספקה או איסוף, הכוונה כשפותח את הלקוח
-- יראה את המשימה". עד היום הכרטיס (`stop_call_info`) נפתח רק על קריאת
-- שירות. לאספקה ולאיסוף הנהג ראה שם, כתובת, טלפון והערה, בלי מה לספק ומה
-- לאסוף, למרות שהפריטים כבר יושבים אצלנו (`orders.items` מ-ORDERITEMS_SUBFORM
-- ב-98% מההזמנות, `pickups.lines` ב-92% מהאיסופים).
--
-- ⭐ אותו דפוס כמו `call_info_payload`: הכרטיס נבנה במקום אחד, והעוטפת
-- (`stop_call_info`, בקובץ המקור 20260915) רק בודקת הרשאה ומנתבת לפי סוג.

-- ─── אספקה: מה לספק ───────────────────────────────────────────────────────
create or replace function public.order_info_payload(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_items jsonb;
  v_note  jsonb;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then
    return null;
  end if;

  -- "השתתפות עצמית" היא שורת חיוב, לא ציוד. לנהג היא רעש.
  select coalesce(jsonb_agg(jsonb_build_object(
           'part', i->>'part', 'desc', i->>'desc', 'qty', i->'qty', 'serial', i->>'serial')), '[]'::jsonb)
    into v_items
    from jsonb_array_elements(coalesce(v_order.items, '[]'::jsonb)) i
   where coalesce(i->>'desc', i->>'part', '') <> ''
     and coalesce(i->>'part', '') <> 'השתתפות עצמית';

  select jsonb_build_object('user_name', t.user_name, 'content', t.content, 'at', t.created_at)
    into v_note
    from public.timeline_events t
    join public.profiles p on p.id::text = t.user_id
   where t.order_id = v_order.id
     and t.type = 'comment'
     and p.role in ('admin', 'management', 'team_manager', 'dispatcher')
     and nullif(btrim(coalesce(t.content, '')), '') is not null
   order by t.created_at desc
   limit 1;

  return jsonb_build_object(
    'order', jsonb_build_object(
      'id', v_order.id,
      'docno', v_order.priority_order_id,
      'order_type', v_order.order_type,
      'health_fund', v_order.health_fund,
      'priority_status', v_order.priority_status,
      'opened_at', v_order.created_at,
      'agent', v_order.agent,
      'items', v_items
    ),
    'office_note', v_note
  );
end;
$$;
revoke all on function public.order_info_payload(uuid) from public, anon, authenticated;

-- ─── איסוף: מה לאסוף ──────────────────────────────────────────────────────
-- הערת המשרד לאיסוף יושבת על העצירה (הצ'אט של איסוף מעוגן ל-calendar_stop).
create or replace function public.pickup_info_payload(p_pickup_id uuid, p_stop_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pickup public.pickups;
  v_lines  jsonb;
  v_note   jsonb;
begin
  select * into v_pickup from public.pickups where id = p_pickup_id;
  if not found then
    return null;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'part', l->>'part', 'desc', l->>'desc', 'qty', l->'qty', 'unit', l->>'unit',
           'barcode', l->>'barcode', 'source_order', l->>'sourceOrder', 'return_reason', l->>'returnReason')
           order by (l->>'kline')::numeric nulls last), '[]'::jsonb)
    into v_lines
    from jsonb_array_elements(coalesce(v_pickup.lines, '[]'::jsonb)) l
   where coalesce(l->>'desc', l->>'part', '') <> '';

  if p_stop_id is not null then
    select jsonb_build_object('user_name', t.user_name, 'content', t.content, 'at', t.created_at)
      into v_note
      from public.timeline_events t
      join public.profiles p on p.id::text = t.user_id
     where t.calendar_stop_id = p_stop_id
       and t.type = 'comment'
       and p.role in ('admin', 'management', 'team_manager', 'dispatcher')
       and nullif(btrim(coalesce(t.content, '')), '') is not null
     order by t.created_at desc
     limit 1;
  end if;

  return jsonb_build_object(
    'pickup', jsonb_build_object(
      'id', v_pickup.id,
      'docno', v_pickup.priority_pickup_id,
      'pickup_status', v_pickup.pickup_status,
      'pickup_date', v_pickup.pickup_date,
      'source_order', v_pickup.source_order,
      'delivery_note', v_pickup.delivery_note,
      'reference', v_pickup.reference,
      'to_warehouse', v_pickup.to_warehouse,
      'agent', v_pickup.agent,
      'total_qty', v_pickup.total_qty,
      'lines', v_lines
    ),
    'office_note', v_note
  );
end;
$$;
revoke all on function public.pickup_info_payload(uuid, uuid) from public, anon, authenticated;
