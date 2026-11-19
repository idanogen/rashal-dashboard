-- ─────────────────────────────────────────────────────────────────────────
-- קריאה בלבד לנהג של עצירות מחר מ-16:00 (#903, אישור עידן 19/11/2026).
-- האפליקציה מורידה מראש את העצירות של מחר (driver_stop_visible חושפת אותן
-- מ-16:00), אבל כרטיס הקריאה, הטפסים ותעודת המשלוח נדחו ב-"not authorized"
-- (356 פעמים ב-18/11), ולכן בבוקר בלי קליטה הם לא היו בטלפון.
--
-- ⭐ stop_read_access: אותו חלון כמו driver_stop_visible, רק לפונקציות קריאה.
-- stop_form_access נשאר לכתיבה (submit_signed_form, stop_action_apply,
-- signed_form_object_writable, stop_details_change ...): עד היום, לא מחר.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.stop_read_access(p_stop public.calendar_stops)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_office_staff() is true
      or (public.current_user_role() = 'driver'
          and public.driver_stop_visible(p_stop.driver, p_stop.delivery_date));
$$;

revoke all on function public.stop_read_access(public.calendar_stops) from public, anon;
grant execute on function public.stop_read_access(public.calendar_stops) to authenticated;

-- הפונקציות שעברו ל-stop_read_access מעודכנות בקבצים שלהן (פונקציה = קובץ אחד,
-- test/migrations.test.mjs): stop_form_context (20261016_signed_forms),
-- stop_delivery_note, stops_delivery_notes, delivery_note_object_readable
-- (20261018_delivery_note_docs), stops_form_status (20261110_chair_checklist),
-- stop_call_info (20260915_stop_call_info).
