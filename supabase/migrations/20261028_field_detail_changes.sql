-- ─── עריכת טלפון וכתובת מהשטח: חד פעמי או קבוע, מייל למשרד (28/10/2026) ───
--
-- הכרעות עידן 28/10/2026:
--   * הנהג והטכנאי עורכים טלפון וכתובת בכרטיס העצירה באפליקציה, כמו העיפרון
--     של המשרד בדשבורד. במעמד השמירה שואלים: חד פעמי (רק הביקור הזה) או קבוע.
--   * 🔴 בפריוריטי לא מוחקים ולא דורסים כלום, רק מוסיפים: נייד קבוע נכנס כשורת
--     איש קשר (CUSTPERSONNEL, המנגנון של 06/09), וכתובת קבועה נכנסת כשורה בדו-שיח
--     הפנימי של כרטיס הלקוח (INTERNALDIALOGTEXT, המנגנון של `priority_push_candidates`).
--     הכתובת בכרטיס עצמו נשארת, והמשרד מעדכן אותה ביד אחרי המייל.
--   * על כל שינוי, גם חד פעמי, מייל HTML לעמי, שלומי ואילונה (הנמענים בטבלה,
--     לא בקוד). המייל נשלח ב-`rashal-field-change-mail`: קריאה מיידית מכאן
--     (pg_net), וקרון שסורק כל 10 דקות את מה שלא יצא.
--
-- 🔴 28/10 ערב (עידן: "לא דורסים את הקיים"): טלפון = הוספה ל-`phone_extra`, הטלפון
-- הראשי לא משתנה; כתובת = חדשה לניווט והמקורית נשמרת ב-`original_address/city`
-- (עמודות ב-`20261028_stop_details_add_only.sql`). p_phone הוא הטלפון הנוסף.
--
-- מקור אחד: גם הדשבורד וגם האפליקציה קוראים ל-`stop_details_change`. הלוגיקה
-- הטהורה של "מה השתנה" (`src/lib/stop-details.ts`) נשארת בלקוח לתצוגה בלבד;
-- ההכרעה מה נכתב נעשית כאן, מול הערכים החיים של העצירה.

-- ── הנמענים ───────────────────────────────────────────────────────────────
create table if not exists public.field_change_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  -- [{"name": "עמי גז", "email": "ami@mishal.co.il"}]
  recipients jsonb not null default '[]'::jsonb,
  last_result jsonb,
  updated_at timestamptz not null default now()
);
insert into public.field_change_settings (id, recipients) values (true, jsonb_build_array(
  jsonb_build_object('name', 'עמי גז', 'email', 'ami@mishal.co.il'),
  jsonb_build_object('name', 'שלומי קורן', 'email', 'shlomi@mishal.co.il'),
  jsonb_build_object('name', 'אילונה', 'email', 'info@mishal.co.il')
)) on conflict (id) do nothing;

alter table public.field_change_settings enable row level security;
drop policy if exists field_change_settings_read on public.field_change_settings;
create policy field_change_settings_read on public.field_change_settings
  for select to authenticated using ((select public.is_office_staff()));
drop policy if exists field_change_settings_update on public.field_change_settings;
create policy field_change_settings_update on public.field_change_settings
  for update to authenticated using ((select public.is_management())) with check ((select public.is_management()));

-- ── יומן השינויים: שורה לכל שמירה, והמייל יוצא ממנה ─────────────────────
create table if not exists public.stop_detail_changes (
  id uuid primary key default gen_random_uuid(),
  stop_id uuid not null references public.calendar_stops(id) on delete cascade,
  customer_number text,
  customer_name text not null,
  source_type text not null,
  delivery_date date not null,
  driver text,
  doc_number text,
  changed_by uuid,
  changed_by_name text not null,
  -- 'driver' = מהאפליקציה בשטח, 'office' = מהדשבורד או ממנהל באפליקציה
  changed_by_role text not null check (changed_by_role in ('driver', 'office')),
  scope text not null check (scope in ('once', 'permanent')),
  old_address text, new_address text,
  old_city text, new_city text,
  old_phone text, new_phone text,
  relocate boolean not null default false,
  -- כמה ביקורים פתוחים נוספים של אותו לקוח עודכנו (קבוע בלבד)
  other_stops_updated integer not null default 0,
  -- מה נכנס לפריוריטי: נייד כאיש קשר, והערה לכרטיס (מזהה האירוע ב-timeline_events)
  priority_contact_added boolean not null default false,
  priority_event_id text,
  timeline_event_id text,
  created_at timestamptz not null default now(),
  emailed_at timestamptz,
  email_to text[],
  email_error text,
  email_attempts integer not null default 0
);
create index if not exists stop_detail_changes_pending_idx
  on public.stop_detail_changes (created_at) where emailed_at is null;
create index if not exists stop_detail_changes_stop_idx on public.stop_detail_changes (stop_id);

alter table public.stop_detail_changes enable row level security;
drop policy if exists stop_detail_changes_read on public.stop_detail_changes;
create policy stop_detail_changes_read on public.stop_detail_changes
  for select to authenticated using ((select public.is_office_staff()));

-- ── הפעולה עצמה ──────────────────────────────────────────────────────────
create or replace function public.stop_details_change(
  p_stop_id uuid, p_address text, p_city text, p_phone text, p_scope text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stop      public.calendar_stops%rowtype;
  v_role      text;
  v_by_role   text;
  v_author    text;
  v_uid       uuid := auth.uid();
  v_addr      text; v_city text; v_phone text;
  v_new_addr  text; v_new_city text; v_new_phone text;
  v_relocate  boolean := false;
  v_changed   boolean := false;
  v_others    integer := 0;
  v_contact   boolean := false;
  v_main      text;
  v_local     text;
  v_doc       text;
  v_change_id uuid := gen_random_uuid();
  v_event_id  text := 'fc-' || replace(v_change_id::text, '-', '');
  v_pevent_id text;
  v_desc      text;
  v_parts     text[] := '{}';
  v_cur_addr  text; v_cur_city text; v_cur_extra text;
  v_restore   boolean := false;
  v_anon      text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a3N0Znh0em55bWZraXJkbXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNDQ2MjMsImV4cCI6MjA5MTgyMDYyM30.oF-pwjnAki4LiDE8nLa6SIjHHP_tLvsoZwEyxlu2f6E';
begin
  if p_scope not in ('once', 'permanent') then
    raise exception 'bad scope';
  end if;
  select * into v_stop from public.calendar_stops where id = p_stop_id;
  if v_stop.id is null then
    raise exception 'stop not found';
  end if;
  -- אותה דלת כמו הטפסים: משרד תמיד, נהג רק על עצירה שלו עד היום.
  if public.stop_form_access(v_stop) is not true then
    raise exception 'not authorized';
  end if;

  v_role := public.current_user_role();
  v_by_role := case when v_role = 'driver' then 'driver' else 'office' end;
  select coalesce(nullif(btrim(p.full_name), ''), p.username, 'משתמש') into v_author
    from public.profiles p where p.id = v_uid;
  v_author := coalesce(v_author, 'משתמש');

  -- ניקוי: רווחים כפולים וקצוות, כמו `buildStopDetailsPatch` בלקוח.
  v_addr  := btrim(regexp_replace(coalesce(p_address, ''), '\s+', ' ', 'g'));
  v_city  := btrim(regexp_replace(coalesce(p_city, ''), '\s+', ' ', 'g'));
  v_phone := btrim(regexp_replace(coalesce(p_phone, ''), '\s+', ' ', 'g'));

  v_cur_addr  := btrim(regexp_replace(coalesce(v_stop.address, ''), '\s+', ' ', 'g'));
  v_cur_city  := btrim(regexp_replace(coalesce(v_stop.city, ''), '\s+', ' ', 'g'));
  v_cur_extra := btrim(regexp_replace(coalesce(v_stop.phone_extra, ''), '\s+', ' ', 'g'));
  if v_addr is distinct from v_cur_addr then
    v_new_addr := v_addr; v_changed := true; v_relocate := true;
  end if;
  if v_city is distinct from v_cur_city then
    v_new_city := v_city; v_changed := true; v_relocate := true;
  end if;
  -- טלפון: הוספה בלבד. ריק = לא נגעו; זהה לראשי או לנוסף הקיים = כלום.
  -- השוואה לפי ספרות בלבד: 050-1111111 ו-050 1111111 הם אותו מספר (כמו `digits` בלקוח).
  if v_phone <> '' and regexp_replace(v_phone, '\D', '', 'g') is distinct from regexp_replace(coalesce(v_stop.phone, ''), '\D', '', 'g')
     and regexp_replace(v_phone, '\D', '', 'g') is distinct from regexp_replace(v_cur_extra, '\D', '', 'g') then
    v_new_phone := v_phone; v_changed := true;
  end if;
  -- חזרה לכתובת המקורית: הניווט חוזר, ו"במקור" נמחק.
  if v_relocate and v_stop.original_address is not null
     and coalesce(v_new_addr, v_cur_addr) = btrim(regexp_replace(v_stop.original_address, '\s+', ' ', 'g'))
     and coalesce(v_new_city, v_cur_city) = btrim(regexp_replace(coalesce(v_stop.original_city, ''), '\s+', ' ', 'g')) then
    v_restore := true;
  end if;
  if not v_changed then
    return jsonb_build_object('changed', false);
  end if;

  -- העצירה עצמה. כתובת שזזה מאפסת את המיקום, אחרת הסיכה והניווט נשארים
  -- על הכתובת הישנה בלי שום סימן (הלקח מ-08/10).
  update public.calendar_stops set
    original_address = case when v_restore then null when v_relocate and original_address is null then coalesce(address, '') else original_address end,
    original_city    = case when v_restore then null when v_relocate and original_address is null then city else original_city end,
    address = case when v_new_addr is not null then nullif(v_new_addr, '') else address end,
    city    = case when v_new_city is not null then nullif(v_new_city, '') else city end,
    phone_extra = case when v_new_phone is not null then v_new_phone else phone_extra end,
    geocoded_lat = case when v_relocate then null else geocoded_lat end,
    geocoded_lng = case when v_relocate then null else geocoded_lng end,
    geocoded_at  = case when v_relocate then null else geocoded_at end,
    geocoded_address = case when v_relocate then null else geocoded_address end
  where id = v_stop.id;

  -- קבוע: גם שאר הביקורים הפתוחים של אותו לקוח (מהיום והלאה), כדי שהנהג
  -- הבא לא ייסע לכתובת הישנה. ביקורים ישנים לא נוגעים: הם היסטוריה.
  if p_scope = 'permanent' and coalesce(v_stop.customer_number, '') <> '' then
    with upd as (
      update public.calendar_stops s set
        original_address = case when v_relocate and s.original_address is null then coalesce(s.address, '') else s.original_address end,
        original_city    = case when v_relocate and s.original_address is null then s.city else s.original_city end,
        address = case when v_new_addr is not null then nullif(v_new_addr, '') else s.address end,
        city    = case when v_new_city is not null then nullif(v_new_city, '') else s.city end,
        phone_extra = case when v_new_phone is not null then v_new_phone else s.phone_extra end,
        geocoded_lat = case when v_relocate then null else s.geocoded_lat end,
        geocoded_lng = case when v_relocate then null else s.geocoded_lng end,
        geocoded_at  = case when v_relocate then null else s.geocoded_at end,
        geocoded_address = case when v_relocate then null else s.geocoded_address end
      where s.customer_number = v_stop.customer_number
        and s.id <> v_stop.id
        and s.status in ('planned', 'in_progress')
        and s.delivery_date >= public.israel_today()
      returning 1
    ) select count(*) into v_others from upd;
  end if;

  -- תיאור השינוי, אותו נוסח כמו `describeStopDetailsChange` בלקוח.
  if v_new_addr is not null then
    v_parts := v_parts || ('כתובת לניווט: ' || coalesce(nullif(v_stop.address, ''), 'ריק') || ' ← ' || coalesce(nullif(v_new_addr, ''), 'ריק')
      || case when v_restore then ' (חזרה למקורית)' else ' (המקורית נשמרת)' end);
  end if;
  if v_new_city is not null then
    v_parts := v_parts || ('עיר: ' || coalesce(nullif(v_stop.city, ''), 'ריק') || ' ← ' || coalesce(nullif(v_new_city, ''), 'ריק'));
  end if;
  if v_new_phone is not null then
    v_parts := v_parts || ('טלפון נוסף: ' || v_new_phone || ' (הראשי ' || coalesce(nullif(v_stop.phone, ''), 'ריק') || ' נשאר'
      || case when v_cur_extra <> '' then ', במקום הנוסף הקודם ' || v_cur_extra else '' end || ')');
  end if;
  v_desc := array_to_string(v_parts, ' · ');

  -- הודעת מערכת בצ'אט של ההזמנה / הקריאה / העצירה, כמו העיפרון של המשרד.
  insert into public.timeline_events (id, type, user_id, user_name, content, metadata, order_id, service_call_id, calendar_stop_id)
  values (
    v_event_id, 'reschedule', v_uid::text, v_author,
    '✏️ פרטי העצירה עודכנו ע״י ' || v_author || ' (' || case when p_scope = 'permanent' then 'קבוע' else 'חד פעמי, רק הביקור הזה' end || '): ' || v_desc
      || case when p_scope = 'permanent' then '. הטלפון והכתובת החדשים נוספים לכרטיס הלקוח בפריוריטי, בלי למחוק את הקיימים.' else '. בפריוריטי לא השתנה כלום.' end,
    jsonb_build_object('action', 'stop_details', 'scope', p_scope, 'change_id', v_change_id,
      'address', v_new_addr, 'city', v_new_city, 'phone', v_new_phone),
    case when v_stop.source_type = 'delivery' then v_stop.order_id end,
    case when v_stop.source_type = 'service' then v_stop.service_call_id end,
    case when v_stop.source_type not in ('delivery', 'service') then v_stop.id end
  );

  -- קבוע: הוספה בפריוריטי, לעולם לא מחיקה.
  if p_scope = 'permanent' and coalesce(v_stop.customer_number, '') <> '' then
    -- (א) נייד חדש = איש קשר נוסף בכרטיס (CUSTPERSONNEL דרך customer_contacts).
    if v_new_phone is not null and v_new_phone <> '' then
      v_local := public.wa_normalize_phone(v_new_phone);
      select public.wa_normalize_phone(c.phone) into v_main
        from public.priority_customers c where c.custname = v_stop.customer_number;
      if v_local is not null and v_local ~ '^05\d{8}$' and v_local is distinct from v_main then
        begin
          perform public.wa_remember_contact(v_stop.customer_number, v_local, 'עודכן מהשטח', v_author, 'linked_by_user');
          v_contact := true;
        exception when others then
          v_contact := false;
        end;
      end if;
    end if;
    -- (ב) שורה בדו-שיח הפנימי של הכרטיס. אירוע 'comment' שמעוגן ללקוח בלבד:
    -- `priority_push_candidates` דוחפת אותו ל-INTERNALDIALOGTEXT, הצ'אט של
    -- הקריאה לא רואה אותו (אין service_call_id) והנהגים לא מקבלים עליו דחיפה.
    v_pevent_id := 'fcp-' || replace(v_change_id::text, '-', '');
    insert into public.timeline_events (id, type, user_id, user_name, content, metadata, customer_number)
    values (
      v_pevent_id, 'comment', v_uid::text, v_author,
      '📍 עדכון קבוע מהשטח: ' || v_desc
        || case when v_contact then ' (הנייד נוסף גם כאיש קשר)' else '' end
        || '. הכתובת והטלפון בכרטיס לא שונו, נא לעדכן.',
      jsonb_build_object('action', 'field_change', 'scope', 'permanent', 'change_id', v_change_id),
      v_stop.customer_number
    );
  end if;

  select coalesce(o.priority_order_id, sc.priority_call_id, pk.priority_pickup_id) into v_doc
    from (select 1) d
    left join public.orders o on o.id = v_stop.order_id
    left join public.service_calls sc on sc.id = v_stop.service_call_id
    left join public.pickups pk on pk.id = v_stop.pickup_id;

  insert into public.stop_detail_changes (
    id, stop_id, customer_number, customer_name, source_type, delivery_date, driver, doc_number,
    changed_by, changed_by_name, changed_by_role, scope,
    old_address, new_address, old_city, new_city, old_phone, new_phone,
    relocate, other_stops_updated, priority_contact_added, priority_event_id, timeline_event_id
  ) values (
    v_change_id, v_stop.id, nullif(v_stop.customer_number, ''), v_stop.customer_name, v_stop.source_type, v_stop.delivery_date, v_stop.driver::text, v_doc,
    v_uid, v_author, v_by_role, p_scope,
    case when v_new_addr is not null then coalesce(v_stop.address, '') end, v_new_addr,
    case when v_new_city is not null then coalesce(v_stop.city, '') end, v_new_city,
    case when v_new_phone is not null then coalesce(v_stop.phone_extra, '') end, v_new_phone,
    v_relocate, v_others, v_contact, v_pevent_id, v_event_id
  );

  -- המייל: קריאה מיידית לפונקציה. אם זה נכשל, הקרון ישלים תוך 10 דקות.
  begin
    perform net.http_post(
      url := 'https://kukstfxtznymfkirdmty.supabase.co/functions/v1/rashal-field-change-mail',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_anon, 'x-sync-secret', public.sync_secret()),
      body := jsonb_build_object('id', v_change_id),
      timeout_milliseconds := 20000
    );
  exception when others then
    null;
  end;

  return jsonb_build_object(
    'changed', true, 'change_id', v_change_id, 'scope', p_scope, 'relocate', v_relocate,
    'description', v_desc, 'other_stops_updated', v_others, 'priority_contact_added', v_contact
  );
end;
$$;
revoke all on function public.stop_details_change(uuid, text, text, text, text) from public, anon;
grant execute on function public.stop_details_change(uuid, text, text, text, text) to authenticated, service_role;

-- ── הקרון: סריקה כל 10 דקות של מיילים שלא יצאו (עד 5 ניסיונות) ─────────
do $$
declare
  fn text := 'https://kukstfxtznymfkirdmty.supabase.co/functions/v1/rashal-field-change-mail';
  anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a3N0Znh0em55bWZraXJkbXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNDQ2MjMsImV4cCI6MjA5MTgyMDYyM30.oF-pwjnAki4LiDE8nLa6SIjHHP_tLvsoZwEyxlu2f6E';
begin
  perform cron.schedule('rashal-field-change-mail-sweep', '*/10 * * * *', format(
    $c$select net.http_post(url:=%L, headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s','x-sync-secret', public.sync_secret()), body:='{"sweep":true}'::jsonb, timeout_milliseconds:=60000) where exists (select 1 from public.stop_detail_changes where emailed_at is null and email_attempts < 5 and created_at < now() - interval '2 minutes')$c$,
    fn, anon));
end $$;
