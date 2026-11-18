-- ════════════════════════════════════════════════════════════════════════
-- רמזור קריאות שירות (עידן אישר את המוקאפ, 15/09/2026)
--   meetings/rashal/2026-09-15-מסך-קריאות-שירות-רמזור-מוקאפ.html
--
-- צבע אחד לכל קריאה פתוחה, לפי הסדר (הראשון שמתקיים):
--   צהוב  = סוג קריאה "פרונטלית": הלקוח מגיע לבד, לא משבצים.
--   כתום  = הביקור האחרון חזר מהקו כ"להמשך טיפול".
--   ירוק  = הלקוח שלח תמונה/סרטון מאז שהקריאה נפתחה (מכל מספר משויך),
--           או שעובד משרד סימן ירוק ידנית עם סיבה וחתימה.
--   אדום  = כל השאר.
-- ובנוסף: "נהג כבר נגע" (עידן): הנהג והתאריך של הביקור האחרון, בכל צבע.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.service_call_manual_green (
  service_call_id uuid primary key references public.service_calls(id) on delete cascade,
  reason          text not null check (reason in ('phone_described', 'photo_other_channel', 'known_fix', 'other')),
  note            text,
  marked_by       uuid not null,
  marked_by_name  text not null,
  created_at      timestamptz not null default now()
);
comment on table public.service_call_manual_green is
  'סימון ידני של קריאת שירות כמוכנה לשיבוץ בלי תמונה: מי, מתי, למה. נכתב רק דרך mark_service_call_green.';
alter table public.service_call_manual_green enable row level security;
drop policy if exists service_call_manual_green_read on public.service_call_manual_green;
create policy service_call_manual_green_read on public.service_call_manual_green
  for select to authenticated
  using ((select public.is_office_staff()));

-- ─── הצבע לכל קריאה פתוחה: ההגדרה **אינה כאן** ────────────────────────────
-- `service_call_lights()` הוגדרה כאן במקור. ההגדרה החיה עברה ב-18/11/2026 ל-
-- `20261118_media_nudges.sql` (ירוק גם כשמנוע הבקשות קיבל תמונה לפי הטלפון),
-- יחד עם ההרשאות שלה.



-- ─── סימון ירוק ידני: פעולה של עובד, וחתימה ───────────────────────────────
-- רשאי: מי שמשבץ (is_admin_or_dispatcher: מנהל מערכת, סדרן, מנהל צוות, הנהלה).
-- נרשם גם בצ'אט של הקריאה, כדי שהטכנאי ומי שבודק אחר כך יראו שזה לא מהלקוח.
create or replace function public.mark_service_call_green(p_call uuid, p_reason text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name  text;
  v_label text;
  v_note  text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if (select public.is_admin_or_dispatcher()) is not true then
    raise exception 'not authorized';
  end if;
  if p_reason not in ('phone_described', 'photo_other_channel', 'known_fix', 'other') then
    raise exception 'bad reason';
  end if;
  if p_reason = 'other' and v_note is null then
    raise exception 'note required for other';
  end if;
  if not exists (select 1 from public.service_calls where id = p_call) then
    raise exception 'call not found';
  end if;

  select coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(p.username), ''), p.email)
    into v_name
    from public.profiles p where p.id = auth.uid();
  v_name := coalesce(v_name, 'משתמש');

  insert into public.service_call_manual_green (service_call_id, reason, note, marked_by, marked_by_name)
  values (p_call, p_reason, v_note, auth.uid(), v_name)
  on conflict (service_call_id) do update
    set reason = excluded.reason, note = excluded.note,
        marked_by = excluded.marked_by, marked_by_name = excluded.marked_by_name,
        created_at = now();

  v_label := case p_reason
    when 'phone_described' then 'הלקוח תיאר את התקלה בטלפון'
    when 'photo_other_channel' then 'התמונה הגיעה בדרך אחרת'
    when 'known_fix' then 'ברור מה צריך'
    else 'אחר'
  end;

  insert into public.timeline_events (id, type, user_id, user_name, content, service_call_id, created_at)
  values ('event-' || (extract(epoch from clock_timestamp()) * 1000)::bigint,
          'comment', auth.uid()::text, v_name,
          'סומנה ירוקה ידנית, בלי תמונה מהלקוח: ' || v_label || coalesce(' · ' || v_note, ''),
          p_call, now());

  return jsonb_build_object('ok', true, 'by', v_name);
end;
$$;

revoke all on function public.mark_service_call_green(uuid, text, text) from public, anon;
grant execute on function public.mark_service_call_green(uuid, text, text) to authenticated;
