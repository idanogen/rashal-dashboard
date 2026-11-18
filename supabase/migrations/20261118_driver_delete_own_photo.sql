-- ─── הטכנאי מוחק תמונה שהוא צילם (עמי, 18/11/2026) ─────────────────────────
--
-- "אם טכנאי צילם או צירף תמונה ורוצה למחוק, אז שיוכל". הכלל (עידן אישר):
-- רק תמונה שהוא עצמו העלה מהאפליקציה, ורק באותו יום (שעון ישראל).
--
-- 🔴 תמונה על קריאת שירות נכתבת לקריאה בפריוריטי (EXTFILES_SUBFORM) בריצה הבאה
-- של `rashal-push`. מחיקה לפני הריצה = התמונה לא תגיע לשם. אחרי שנכתבה, המחיקה
-- היא אצלנו בלבד, והפונקציה מחזירה `pushed=true` כדי שהאפליקציה תגיד את זה.
--
-- ⭐ פונקציה ולא מחיקה ישירה: המדיניות על timeline_events פתוחה לכל מחובר
-- (`authenticated_all_timeline_events`), ולכן הכלל נאכף כאן, לא בטלפון.

create or replace function public.driver_delete_own_photo(p_event_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ev record;
  was_pushed boolean;
begin
  select id, user_id, type, created_at, pushed_to_priority_at
    into ev
    from timeline_events
   where id = p_event_id;
  if not found then
    return jsonb_build_object('deleted', false, 'reason', 'not_found');
  end if;
  if ev.type <> 'file_upload' or ev.user_id is distinct from (select auth.uid())::text then
    return jsonb_build_object('deleted', false, 'reason', 'not_mine');
  end if;
  if (ev.created_at at time zone 'Asia/Jerusalem')::date <> (now() at time zone 'Asia/Jerusalem')::date then
    return jsonb_build_object('deleted', false, 'reason', 'not_today');
  end if;

  was_pushed := ev.pushed_to_priority_at is not null
    or exists (select 1 from priority_call_push_log l where l.key = 'event:' || ev.id and l.pushed_at is not null);

  delete from timeline_events where id = ev.id;
  return jsonb_build_object('deleted', true, 'pushed', was_pushed);
end;
$$;

revoke all on function public.driver_delete_own_photo(text) from public, anon;
grant execute on function public.driver_delete_own_photo(text) to authenticated;
