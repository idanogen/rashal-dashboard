-- ─── אפליקציה בלי קליטה, שלב 0: פעולה אטומית שדוחה חזרה (28/10/2026) ───
--
-- התוכנית: `~/Idan-HQ/meetings/rashal/2026-10-26-תוכנית-אפליקציה-בלי-קליטה.html`
-- (עידן: "834 צא לדרך", 28/10). הכלל: פעולה היא עובדה מהשטח, לא בקשה. לכן:
--   * לכל פעולה מזהה קבוע שהאפליקציה מייצרת בלחיצה. שליחה חוזרת עם אותו
--     מזהה מחזירה "כפול" בלי לכתוב שוב (הקליטה נפלה באמצע, שני מכשירים).
--   * שעת הביצוע היא שעת הלחיצה (`performed_at`), והשרת שומר גם מתי קיבל.
--   * המקור (הזמנה / קריאה / איסוף) והעצירה מתעדכנים בעסקה אחת, במקום שני
--     עדכונים עוקבים מהאפליקציה עם גלגול לאחור ידני.
--   * עצירה שבוטלה או עברה לנהג אחר בינתיים: הפעולה נדחית עם סיבה, נרשמת
--     ב-`stop_actions` ובציר הזמן של העצירה, ולא נבלעת ולא דורסת.
--
-- הדשבורד (המשרד) ממשיך לעבוד כרגיל דרך `stop-source-sync.ts`; מחרוזות
-- הסטטוס של המקור כאן חייבות להישאר זהות לשם (בדיקת ההתאמה
-- `test/stop-action-parity.test.mjs` קוראת את שני הקבצים).

create table if not exists public.stop_actions (
  action_id uuid primary key,
  stop_id uuid not null references public.calendar_stops(id) on delete cascade,
  kind text not null check (kind in ('arrive', 'resolve')),
  status text check (status in ('completed', 'not_completed')),
  resolution_kind text check (resolution_kind in ('not_done', 'follow_up')),
  note text,
  performed_at timestamptz not null,
  received_at timestamptz not null default now(),
  actor uuid,
  actor_name text,
  result text not null check (result in ('applied', 'duplicate', 'rejected')),
  reject_reason text,
  device text
);
create index if not exists stop_actions_stop_idx on public.stop_actions (stop_id, received_at desc);

alter table public.stop_actions enable row level security;
drop policy if exists stop_actions_read on public.stop_actions;
create policy stop_actions_read on public.stop_actions
  for select to authenticated using ((select public.is_office_staff()));

create or replace function public.stop_action_apply(
  p_action_id uuid, p_stop_id uuid, p_kind text,
  p_status text default null, p_resolution_kind text default null, p_note text default null,
  p_performed_at timestamptz default null, p_device text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stop     public.calendar_stops%rowtype;
  v_prev     public.stop_actions%rowtype;
  v_uid      uuid := auth.uid();
  v_actor    text;
  v_at       timestamptz := coalesce(p_performed_at, now());
  v_reason   text;
  v_row      jsonb;
  v_source   text;
  v_kind     text;
begin
  -- כפילות: אותו מזהה פעולה = אותה תשובה, בלי לכתוב שוב.
  select * into v_prev from public.stop_actions where action_id = p_action_id;
  if v_prev.action_id is not null then
    return jsonb_build_object('result', 'duplicate', 'first_result', v_prev.result,
      'reject_reason', v_prev.reject_reason, 'received_at', v_prev.received_at);
  end if;
  if p_kind not in ('arrive', 'resolve') then
    raise exception 'bad kind';
  end if;
  if p_kind = 'resolve' and p_status not in ('completed', 'not_completed') then
    raise exception 'bad status';
  end if;
  -- שעת ביצוע מהעתיד או מלפני שבוע = שעון מקולקל: נרשם עכשיו, והמקור נשמר ב-note.
  if v_at > now() + interval '5 minutes' or v_at < now() - interval '7 days' then
    v_at := now();
  end if;

  select coalesce(nullif(btrim(p.full_name), ''), p.username, 'משתמש') into v_actor
    from public.profiles p where p.id = v_uid;
  v_actor := coalesce(v_actor, 'משתמש');

  select * into v_stop from public.calendar_stops where id = p_stop_id;
  if v_stop.id is null then
    v_reason := 'stop_not_found';
  elsif public.stop_form_access(v_stop) is not true then
    -- העצירה כבר לא של הנהג (הועברה) או לא שלו בכלל.
    v_reason := 'not_yours';
  elsif v_stop.status = 'cancelled' then
    v_reason := 'cancelled';
  elsif p_kind = 'resolve' and v_stop.status in ('completed', 'not_completed') then
    v_reason := 'already_resolved';
  end if;

  if v_reason is null then
    begin
      if p_kind = 'arrive' then
        if v_stop.status = 'planned' then
          update public.calendar_stops set status = 'in_progress', arrived_at = coalesce(arrived_at, v_at)
           where id = v_stop.id;
        end if;
        -- כבר in_progress או סגור: "הגעתי" חוזר הוא רעש, לא שגיאה.
      else
        v_kind := case when p_status = 'not_completed' then coalesce(p_resolution_kind, 'not_done') end;
        -- המקור קודם, כמו stop-source-sync.ts בדשבורד. אותן מחרוזות בדיוק.
        if v_stop.source_type = 'delivery' and v_stop.order_id is not null then
          -- 🔴 order_status ו-service_call_status הם enum: בלי cast הכתיבה נופלת (נמצא בבדיקה החיה 28/10).
          update public.orders set order_status = (case when p_status = 'completed' then 'סופק' else 'ממתין לתאום' end)::public.order_status
           where id = v_stop.order_id;
        elsif v_stop.source_type = 'service' and v_stop.service_call_id is not null then
          update public.service_calls set service_call_status = (case when p_status = 'completed' then 'בוצע' else 'קריאה חדשה' end)::public.service_call_status
           where id = v_stop.service_call_id;
        elsif v_stop.source_type = 'pickup' and v_stop.pickup_id is not null then
          update public.pickups set pickup_status = case when p_status = 'completed' then 'נאסף' else 'ממתין לתאום' end
           where id = v_stop.pickup_id;
        end if;
        update public.calendar_stops set
          status = p_status,
          completed_at = v_at,
          resolution_note = case when p_note is not null then p_note else resolution_note end,
          resolution_kind = v_kind
        where id = v_stop.id;
      end if;
    exception when others then
      -- טריגר שחוסם (למשל מנוף בלי טופס הדרכה): דחייה עם הנוסח, לא שגיאה
      -- שהתור ינסה לנצח. העסקה הפנימית מתגלגלת לאחור, המקור לא נגוע.
      v_reason := 'blocked: ' || left(sqlerrm, 300);
    end;
  end if;

  insert into public.stop_actions (action_id, stop_id, kind, status, resolution_kind, note, performed_at, actor, actor_name, result, reject_reason, device)
  values (p_action_id, p_stop_id, p_kind, case when p_kind = 'resolve' then p_status end,
          case when p_kind = 'resolve' and p_status = 'not_completed' then coalesce(p_resolution_kind, 'not_done') end,
          p_note, v_at, v_uid, v_actor, case when v_reason is null then 'applied' else 'rejected' end, v_reason, p_device);

  -- דחייה נראית למשרד בציר הזמן של העצירה (לא בלעה, לא דרסה).
  if v_reason is not null and v_stop.id is not null then
    insert into public.timeline_events (id, type, user_id, user_name, content, metadata, order_id, service_call_id, calendar_stop_id)
    values (
      'sa-' || replace(p_action_id::text, '-', ''), 'reschedule', v_uid::text, v_actor,
      '⚠️ פעולה מהשטח נדחתה: ' || case p_kind when 'arrive' then 'הגעתי' else case p_status when 'completed' then 'בוצע' else 'לא בוצע' end end
        || ' ע״י ' || v_actor || ' ב-' || to_char(v_at at time zone 'Asia/Jerusalem', 'DD/MM HH24:MI')
        || '. סיבה: ' || case v_reason when 'cancelled' then 'העצירה בוטלה מהמשרד'
                                      when 'not_yours' then 'העצירה כבר לא משובצת לנהג הזה'
                                      when 'already_resolved' then 'העצירה כבר נסגרה'
                                      else v_reason end,
      jsonb_build_object('action', 'stop_action_rejected', 'action_id', p_action_id, 'reason', v_reason),
      case when v_stop.source_type = 'delivery' then v_stop.order_id end,
      case when v_stop.source_type = 'service' then v_stop.service_call_id end,
      case when v_stop.source_type not in ('delivery', 'service') then v_stop.id end
    );
  end if;

  return jsonb_build_object('result', case when v_reason is null then 'applied' else 'rejected' end,
    'reject_reason', v_reason, 'performed_at', v_at, 'received_at', now());
end;
$$;
revoke all on function public.stop_action_apply(uuid, uuid, text, text, text, text, timestamptz, text) from public, anon;
grant execute on function public.stop_action_apply(uuid, uuid, text, text, text, text, timestamptz, text) to authenticated, service_role;
