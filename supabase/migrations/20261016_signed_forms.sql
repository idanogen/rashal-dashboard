-- ═══════════════════════════════════════════════════════════════════════════
-- טפסי הקופות החתומים (16/10/2026)
--
-- עמי שלח ב-04/08 את טפסי הקופות, ואילונה אישרה ב-15/10 שהם הנכונים. הטכנאי
-- ממלא וחותם עם הלקוח, נוצר PDF, והוא נכנס לכרטיס הלקוח בפריוריטי בצינור
-- הקיים (timeline_events → api/priority-push → CUSTEXTFILE_SUBFORM).
--
-- הטבלה `signed_forms` נוצרה ב-11/08 מענף ההדגמה (feature/driver-forms-demo,
-- מיגרציה שלא נכנסה ל-main) והיא קיימת בייצור עם שורה אחת. ⭐ ההגדרה
-- נרשמת כאן כדי שלטבלה יהיה קובץ (חוק הפרויקט), `if not exists` לא נוגע בה.
--
-- 🔴 **הנהג לא כותב לטבלה ישירות.** מ-23/09 היא למשרד בלבד, וכך נשארת. הכתיבה
-- והקריאה של הנהג עוברות בשתי פונקציות שבודקות שהעצירה שלו ושהיא של היום,
-- באותה בדיקה כמו `stop_call_info`.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.signed_forms (
  id              uuid primary key default gen_random_uuid(),
  stop_id         uuid references public.calendar_stops(id) on delete set null,
  order_id        uuid references public.orders(id) on delete set null,
  service_call_id uuid references public.service_calls(id) on delete set null,
  form_key        text not null,
  form_kind       text not null check (form_kind in ('delivery','return','repair')),
  health_fund     text,
  customer_number text,
  payload         jsonb not null default '{}'::jsonb,
  customer_signature text,
  driver_signature   text,
  signer_name        text,
  signed_at       timestamptz not null default now(),
  signed_by       text,
  signed_lat      numeric,
  signed_lng      numeric,
  pdf_path        text,
  pdf_url         text,
  priority_event_id  text,
  priority_pushed_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- איסוף הוא מקור שלישי (טפסי ההחזרה), שלא היה בענף ההדגמה.
alter table public.signed_forms
  add column if not exists pickup_id uuid references public.pickups(id) on delete set null;

create index if not exists signed_forms_stop_idx   on public.signed_forms (stop_id);
create index if not exists signed_forms_signed_idx on public.signed_forms (signed_at desc);

alter table public.signed_forms enable row level security;

-- ─── הרשאה לעצירה: אותה בדיקה כמו stop_call_info ──────────────────────────
create or replace function public.stop_form_access(p_stop public.calendar_stops)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.is_office_staff() is true
      or (public.current_user_role() = 'driver'
          and p_stop.driver = public.current_user_driver()
          and p_stop.delivery_date <= public.israel_today());
$$;
revoke all on function public.stop_form_access(public.calendar_stops) from public, anon, authenticated;

-- ─── מה הטופס צריך לדעת על העצירה ────────────────────────────────────────
--
-- ⭐ הקופה: `health_fund` של ההזמנה או הקריאה (= CTYPENAME בפריוריטי), ואם
-- ריק אז `customer_type` של כרטיס הלקוח (אותו CTYPENAME). 🔴 לא
-- `priority_customers.health_fund`: שם יושב המשלם ("ל.ב ת"א", "מרכז רפואי
-- ברזילי"), לא הקופה של המטופל.
create or replace function public.stop_form_context(p_stop_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_stop  public.calendar_stops;
  v_cust  text;
  v_fund  text;
  v_doc   text;
  v_lines jsonb := '[]'::jsonb;
  v_call  public.service_calls;
  v_order public.orders;
  v_pick  public.pickups;
  v_crane jsonb;
begin
  select * into v_stop from public.calendar_stops where id = p_stop_id;
  if not found then return null; end if;
  if public.stop_form_access(v_stop) is not true then
    raise exception 'not authorized';
  end if;

  v_cust := nullif(trim(v_stop.customer_number), '');

  if v_stop.service_call_id is not null then
    select * into v_call from public.service_calls where id = v_stop.service_call_id;
    v_fund := nullif(trim(v_call.health_fund), '');
    v_doc  := v_call.priority_call_id;
    v_cust := coalesce(v_cust, nullif(trim(v_call.customer_number), ''));
    if coalesce(v_call.device_name, v_call.device_serial) is not null then
      v_lines := jsonb_build_array(jsonb_build_object(
        'name', coalesce(v_call.device_desc, v_call.device_name, ''),
        'serial', coalesce(v_call.device_serial, ''), 'catalog', coalesce(v_call.device_name, '')));
    end if;
  elsif v_stop.order_id is not null then
    select * into v_order from public.orders where id = v_stop.order_id;
    v_fund := nullif(trim(v_order.health_fund), '');
    v_doc  := v_order.priority_order_id;
    v_cust := coalesce(v_cust, nullif(trim(v_order.customer_number), ''));
    -- "השתתפות עצמית" היא שורת חיוב, לא ציוד (כמו order_info_payload).
    select coalesce(jsonb_agg(jsonb_build_object(
             'name', coalesce(i->>'desc', ''), 'serial', coalesce(i->>'serial', ''),
             'catalog', coalesce(i->>'part', ''))), '[]'::jsonb)
      into v_lines
      from jsonb_array_elements(coalesce(v_order.items, '[]'::jsonb)) i
     where coalesce(i->>'desc', i->>'part', '') <> ''
       and coalesce(i->>'part', '') <> 'השתתפות עצמית';
  elsif v_stop.pickup_id is not null then
    select * into v_pick from public.pickups where id = v_stop.pickup_id;
    v_doc  := v_pick.priority_pickup_id;
    v_cust := coalesce(v_cust, nullif(trim(v_pick.customer_number), ''));
    select coalesce(jsonb_agg(jsonb_build_object(
             'name', coalesce(l->>'desc', ''), 'serial', coalesce(l->>'barcode', ''),
             'catalog', coalesce(l->>'part', ''))), '[]'::jsonb)
      into v_lines
      from jsonb_array_elements(coalesce(v_pick.lines, '[]'::jsonb)) l
     where coalesce(l->>'desc', l->>'part', '') <> '';
  end if;

  -- ⭐ מנוף: אותו כלל כמו `lib/crane-identity.ts` (שם הדגם G + 3 ספרות + E
  -- אופציונלי, ובהזמנה לפי המק"ט ולא לפי התיאור). קריאת שירות על מנוף =
  -- רשימת בדיקה; אספקת מנוף = אישור הדרכה. 🔴 עמי, 15/10: בכל תקלת מנוף
  -- שמשובצת הטופס חובה, והאפליקציה לא סוגרת את העצירה בלעדיו.
  if v_call.id is not null and v_call.device_name ~* '^G[0-9]{3}E?$' then
    v_crane := jsonb_build_object('kind', 'inspection', 'serial', v_call.device_serial, 'model', v_call.device_name);
  elsif v_order.id is not null then
    select jsonb_build_object('kind', 'training', 'serial', coalesce(i->>'serial', i->>'part'), 'model', i->>'part')
      into v_crane
      from jsonb_array_elements(coalesce(v_order.items, '[]'::jsonb)) i
     where coalesce(i->>'part', '') ~* '^G[0-9]{3}E?$'
     limit 1;
  end if;

  if v_fund is null and v_cust is not null then
    select nullif(trim(customer_type), '') into v_fund
      from public.priority_customers where custname = v_cust;
  end if;

  return jsonb_build_object(
    'stop_id', v_stop.id,
    'source_type', v_stop.source_type,
    'order_id', v_stop.order_id,
    'service_call_id', v_stop.service_call_id,
    'driver', v_stop.driver,
    'customer_name', v_stop.customer_name,
    'phone', v_stop.phone,
    'address', v_stop.address,
    'city', v_stop.city,
    'customer_number', v_cust,
    'health_fund', v_fund,
    'doc_number', v_doc,
    'device_name', v_call.device_name,
    'device_desc', v_call.device_desc,
    'device_serial', v_call.device_serial,
    'install_date', v_call.install_date,
    'warranty_until', v_call.warranty_until,
    'fault_desc', coalesce(v_call.fault_desc, v_call.symptom_desc),
    'lines', v_lines,
    'crane', v_crane,
    'crane_signed', (select coalesce(jsonb_agg(jsonb_build_object(
                       'id', c.id, 'form_type', c.form_type, 'submitted_at', c.submitted_at)
                       order by c.submitted_at), '[]'::jsonb)
                       from public.crane_forms c where c.stop_id = v_stop.id),
    'signed', (select coalesce(jsonb_agg(jsonb_build_object(
                 'id', f.id, 'form_key', f.form_key, 'signed_at', f.signed_at, 'signed_by', f.signed_by)
                 order by f.signed_at), '[]'::jsonb)
                 from public.signed_forms f where f.stop_id = v_stop.id)
  );
end;
$$;
revoke all on function public.stop_form_context(uuid) from public, anon;
grant execute on function public.stop_form_context(uuid) to authenticated;

-- ─── שמירת טופס חתום ─────────────────────────────────────────────────────
--
-- ה-PDF כבר הועלה לדלי `signed-forms` (פרטי) לפני הקריאה. כאן: שורה בטבלה,
-- ואירוע ביומן שהצינור לפריוריטי ימשוך. ⭐ הקובץ נרשם ב-`metadata.fileUrls`
-- ולא ב-`imageUrls`, כי היומן במסכים מציג את `imageUrls` כתמונות, ו-PDF שם
-- היה תמונה שבורה. `priority_push_candidates` ו-`api/priority-push` קוראים
-- את שניהם.
create or replace function public.submit_signed_form(
  p_stop_id uuid,
  p_form_key text,
  p_form_kind text,
  p_health_fund text,
  p_payload jsonb,
  p_customer_signature text,
  p_driver_signature text,
  p_signer_name text,
  p_lat numeric,
  p_lng numeric,
  p_pdf_path text,
  p_file_des text
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_stop  public.calendar_stops;
  v_id    uuid := gen_random_uuid();
  v_event text := gen_random_uuid()::text;
  v_cust  text;
  v_by    text;
begin
  select * into v_stop from public.calendar_stops where id = p_stop_id;
  if not found then raise exception 'stop not found'; end if;
  if public.stop_form_access(v_stop) is not true then
    raise exception 'not authorized';
  end if;
  if p_pdf_path is null or p_pdf_path !~ ('^' || v_stop.id::text || '/') then
    -- הקובץ חייב לשבת תחת תיקיית העצירה, אחרת אפשר היה לצרף קובץ של מישהו אחר.
    raise exception 'pdf path must start with the stop id';
  end if;

  v_cust := coalesce(nullif(trim(v_stop.customer_number), ''),
                     (select nullif(trim(customer_number), '') from public.orders where id = v_stop.order_id),
                     (select nullif(trim(customer_number), '') from public.service_calls where id = v_stop.service_call_id),
                     (select nullif(trim(customer_number), '') from public.pickups where id = v_stop.pickup_id));
  v_by := coalesce(public.current_user_driver(), v_stop.driver);

  insert into public.signed_forms (
    id, stop_id, order_id, service_call_id, pickup_id, form_key, form_kind, health_fund,
    customer_number, payload, customer_signature, driver_signature, signer_name,
    signed_at, signed_by, signed_lat, signed_lng, pdf_path, priority_event_id)
  values (
    v_id, v_stop.id, v_stop.order_id, v_stop.service_call_id, v_stop.pickup_id, p_form_key, p_form_kind,
    nullif(trim(p_health_fund), ''), v_cust, coalesce(p_payload, '{}'::jsonb),
    p_customer_signature, p_driver_signature, nullif(trim(p_signer_name), ''),
    now(), v_by, p_lat, p_lng, p_pdf_path, case when v_cust is not null then v_event end);

  -- בלי מספר לקוח אין לאן לצרף בפריוריטי. הטופס נשמר אצלנו בכל מקרה.
  -- ⭐ 17/10/2026: גם מספר לקוח שאין לו כרטיס אצלנו (לקוח בדיקה, מספר שגוי)
  -- לא נשלח: הכתיבה הייתה נכשלת ב-404 וממלאת את התור והתראות `push-parked`.
  if v_cust is not null and exists (select 1 from public.priority_customers where custname = v_cust) then
    insert into public.timeline_events (
      id, order_id, service_call_id, calendar_stop_id, customer_number, type, user_id, user_name,
      content, files, metadata)
    values (
      v_event, v_stop.order_id, v_stop.service_call_id, v_stop.id, v_cust, 'file_upload', 'driver-app', v_by,
      'טופס נחתם: ' || coalesce(p_file_des, p_form_key), array[coalesce(p_file_des, p_form_key) || '.pdf'],
      jsonb_build_object('fileUrls', jsonb_build_array('sb://signed-forms/' || p_pdf_path),
                         'fileDes', p_file_des, 'signedFormId', v_id, 'formKey', p_form_key));
  end if;

  return v_id;
end;
$$;
revoke all on function public.submit_signed_form(uuid, text, text, text, jsonb, text, text, text, numeric, numeric, text, text) from public, anon;
grant execute on function public.submit_signed_form(uuid, text, text, text, jsonb, text, text, text, numeric, numeric, text, text) to authenticated;

-- ─── אחסון: נהג מעלה רק לתיקיית עצירה שלו ───────────────────────────────
--
-- 🔴 עד היום כל מחובר יכול היה להעלות לדלי לכל נתיב. עכשיו: משרד לכל נתיב,
-- נהג רק תחת `<stop_id>/` של עצירה שמותרת לו. קריאה: משרד בלבד (הנהג לא
-- צריך לקרוא בחזרה, ה-PDF נשאר אצלו בזיכרון עד ההעלאה).
create or replace function public.signed_form_object_writable(p_name text)
returns boolean
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_stop public.calendar_stops;
  v_id   uuid;
begin
  if public.is_office_staff() is true then return true; end if;
  begin
    v_id := split_part(p_name, '/', 1)::uuid;
  exception when others then
    return false;
  end;
  select * into v_stop from public.calendar_stops where id = v_id;
  if not found then return false; end if;
  return public.stop_form_access(v_stop) is true;
end;
$$;
revoke all on function public.signed_form_object_writable(text) from public, anon;
grant execute on function public.signed_form_object_writable(text) to authenticated;

drop policy if exists signed_forms_upload on storage.objects;
create policy signed_forms_upload on storage.objects
  for insert to authenticated
  with check (bucket_id = 'signed-forms' and public.signed_form_object_writable(name));

drop policy if exists signed_forms_office_read on storage.objects;
create policy signed_forms_office_read on storage.objects
  for select to authenticated
  using (bucket_id = 'signed-forms' and (select public.is_office_staff()) is true);

-- ─── מצב הטפסים לרשימת עצירות (לאפליקציה) ───────────────────────────────
--
-- קל במכוון: שורה לעצירה, בלי שורות הזמנה ובלי פרטי לקוח. האפליקציה שואלת
-- על כל היום בבת אחת ומחליטה אם להציג "טופס ✓" ואם לחסום "בוצע".
-- `crane_kind` לפי אותו כלל כמו `stop_form_context`.
create or replace function public.stops_form_status(p_stop_ids uuid[])
returns table (stop_id uuid, form_signed boolean, crane_kind text, crane_signed boolean)
language sql stable security definer
set search_path = public
as $$
  select s.id,
         exists (select 1 from public.signed_forms f where f.stop_id = s.id),
         case
           when c.device_name ~* '^G[0-9]{3}E?$' then 'inspection'
           when s.service_call_id is null and exists (
             select 1 from jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) i
              where coalesce(i->>'part', '') ~* '^G[0-9]{3}E?$') then 'training'
         end,
         exists (select 1 from public.crane_forms cf where cf.stop_id = s.id)
    from public.calendar_stops s
    left join public.service_calls c on c.id = s.service_call_id
    left join public.orders o on o.id = s.order_id
   where s.id = any(p_stop_ids)
     and public.stop_form_access(s) is true;
$$;
revoke all on function public.stops_form_status(uuid[]) from public, anon;
grant execute on function public.stops_form_status(uuid[]) to authenticated;

-- ─── הטופס גם לתעודת המשלוח (18/10/2026) ────────────────────────────────
--
-- עידן: "אני רוצה שזה ייכנס גם לתעודת משלוח או קריאת שירות". קריאה: דרך
-- `priority_call_push_queue` (מפתח `formdoc:`). אספקה: כאן. תעודת המשלוח
-- (`DOCUMENTS_D`, SH...) נמצאת לפי ההזמנה (`delivery_notes.source_order` =
-- `orders.priority_order_id`), בלי מבוטלת, האחרונה.
-- ⭐ אם עוד אין תעודה, הטופס מחכה ונבדק בכל ריצה עד 14 יום. אותו יומן כמו
-- הקריאות (`priority_call_push_log`, מפתח `formdn:`): תפיסה, אישור ועצירה
-- עם הסיבה כשפריוריטי דוחה.
create or replace function public.priority_dn_form_candidates(p_limit integer default 20)
returns table (key text, docno text, metadata jsonb, at timestamptz)
language sql stable security definer
set search_path = public
as $$
  select 'formdn:' || sf.id::text,
         dn.priority_doc_id,
         jsonb_build_object('fileUrls', jsonb_build_array('sb://signed-forms/' || sf.pdf_path),
                            'fileDes', te.metadata->>'fileDes'),
         sf.signed_at
    from public.signed_forms sf
    left join public.orders o on o.id = sf.order_id
    left join public.timeline_events te on te.id = sf.priority_event_id
    join lateral (
      -- ⭐ שני מסלולים (נמדד 18/10/2026 על 45 יום של אספקות שבוצעו): עצירת
      -- הזמנה לפי `source_order` (190 מ-196), ועצירת לקוח חדש בלי הזמנה לפי
      -- הלקוח ותעודה שנפתחה עד שבוע לפני החתימה או יום אחריה (15 מ-15).
      select d.priority_doc_id
        from public.delivery_notes d
       where coalesce(d.status, '') <> 'מבוטלת'
         and d.priority_doc_id ~ '^[A-Za-z0-9_-]{1,30}$'
         and (
           (o.id is not null and d.source_order = o.priority_order_id)
           or (o.id is null and sf.service_call_id is null and sf.pickup_id is null
               and d.customer_number = sf.customer_number
               and d.doc_date between (sf.signed_at at time zone 'Asia/Jerusalem')::date - 7
                                  and (sf.signed_at at time zone 'Asia/Jerusalem')::date + 1)
         )
       order by d.doc_date desc nulls last, d.created_at desc
       limit 1
    ) dn on true
    left join public.priority_call_push_log l on l.key = 'formdn:' || sf.id::text
   where sf.pdf_path is not null
     and sf.form_kind = 'delivery'
     and sf.signed_at > now() - interval '14 days'
     and l.pushed_at is null
     and l.failed_at is null
     and (l.claimed_at is null or l.claimed_at < now() - interval '10 minutes')
   order by sf.signed_at
   limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;
revoke all on function public.priority_dn_form_candidates(integer) from public, anon, authenticated;
