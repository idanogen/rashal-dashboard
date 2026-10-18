-- ═══════════════════════════════════════════════════════════════════════════
-- תעודות המשלוח המקוריות מפריוריטי, להחתמת הלקוח באפליקציה (18/10/2026)
--
-- הרקע: הגישה שלנו ל-shaal היא טוקן ולא משתמש, ולכן אין הדפסה מהשרת (Web SDK).
-- עידן הגדיר חוק עסקי 1172 על "משלוחים ללקוח": כל שינוי סטטוס שולח מייל עם
-- ה-PDF של התעודה אל rashal-docs@intake.ogensolutions.biz, ובנושא
-- "<מספר תעודה>*<סטטוס>". תיבת הקליטה (AWS, ~/Idan-HQ/company/intake-mailbox)
-- מעבירה כל מייל כזה לפונקציה `rashal-doc-intake`, שכותבת לכאן שורה ושומרת
-- את ה-PDF ואת תמונות העמודים בדלי הפרטי `delivery-note-docs`.
--
-- ⭐ עידן, 18/10: "מחתים את הלקוח". הטכנאי פותח בכרטיס האספקה את התעודה
-- המקורית, הלקוח חותם, והחתימה מוטבעת על התמונה של המקור. השמירה עוברת
-- ב-`submit_signed_form` (form_key = 'delivery_note'), ומשם בצינור הקיים גם
-- לכרטיס הלקוח וגם לתעודה עצמה בפריוריטי (`priority_dn_form_candidates`).
--
-- 🔴 שורה לכל מייל, לא לכל תעודה. התעודה העדכנית = המייל האחרון שלה. ביטול
-- לא מוחק כלום: תעודה שהמייל האחרון שלה "מבוטלת" פשוט לא מוצגת.
-- 🔴 המייל השני שהחוק שולח על אותו מעבר (נושא = מספר ההזמנה, SO...) לא מגיע
-- לכאן בכלל: הפונקציה מדלגת על נושא בלי SH.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.delivery_note_docs (
  id              uuid primary key default gen_random_uuid(),
  mail_key        text not null unique,          -- המפתח של המייל הגולמי בדלי ogen-intake-mail
  docno           text not null,                 -- SH...
  status          text,                          -- מהנושא: טיוטא · סופית · מבוטלת
  subject         text,
  received_at     timestamptz not null,
  doc_date        date,                          -- "תאריך התעודה" מתוך ה-PDF
  customer_number text,                          -- "מס. לקוח" מתוך ה-PDF
  order_numbers   text[] not null default '{}',  -- כל SO... שמופיע ב-PDF
  pdf_path        text not null,                 -- בדלי delivery-note-docs
  page_paths      text[] not null default '{}',  -- PNG לכל עמוד, באותו דלי
  page_size       jsonb,                         -- {"w":595,"h":842} בנקודות
  anchors         jsonb,                         -- מיקומי החתימה, בשברים מגודל העמוד
  created_at      timestamptz not null default now()
);

create index if not exists delivery_note_docs_docno_idx    on public.delivery_note_docs (docno, received_at desc);
create index if not exists delivery_note_docs_customer_idx on public.delivery_note_docs (customer_number, doc_date);
create index if not exists delivery_note_docs_orders_idx   on public.delivery_note_docs using gin (order_numbers);

alter table public.delivery_note_docs enable row level security;

drop policy if exists delivery_note_docs_office_read on public.delivery_note_docs;
create policy delivery_note_docs_office_read on public.delivery_note_docs
  for select to authenticated
  using ((select public.is_office_staff()) is true);

insert into storage.buckets (id, name, public)
values ('delivery-note-docs', 'delivery-note-docs', false)
on conflict (id) do nothing;

-- ─── איזו תעודה שייכת לעצירה ─────────────────────────────────────────────
--
-- אותם שני מסלולים כמו `priority_dn_form_candidates` (נמדד 18/10 על 45 יום):
-- עצירת הזמנה לפי מספר ההזמנה, ועצירת לקוח חדש בלי הזמנה לפי הלקוח ותעודה
-- מעד שבוע לפני יום העצירה ועד יום אחריו.
-- ⭐ מספרי ההזמנה והלקוח נקראים מה-PDF עצמו, ולכן תעודה שנפתחה לפני רגע
-- נמצאת גם לפני שהסנכרון הביא אותה ל-`delivery_notes`. `delivery_notes` משמש
-- רק כגיבוי לשיוך ולביטול.
create or replace function public.stop_delivery_doc(p_stop public.calendar_stops)
returns public.delivery_note_docs
language sql stable security definer
set search_path = public
as $$
  with latest as (
    select distinct on (d.docno) d.*
      from public.delivery_note_docs d
     order by d.docno, d.received_at desc
  ),
  ctx as (
    select o.priority_order_id as order_no,
           coalesce(nullif(trim(p_stop.customer_number), ''), nullif(trim(o.customer_number), '')) as cust
      from (select 1) x
      left join public.orders o on o.id = p_stop.order_id
  )
  select l.*
    from latest l
    cross join ctx
    left join public.delivery_notes dn on dn.priority_doc_id = l.docno
   where p_stop.source_type in ('delivery', 'customer')
     and coalesce(l.status, '') <> 'מבוטלת'
     and coalesce(dn.status, '') <> 'מבוטלת'
     and (
       (ctx.order_no is not null and (ctx.order_no = any(l.order_numbers) or dn.source_order = ctx.order_no))
       or (p_stop.order_id is null and ctx.cust is not null
           and l.customer_number = ctx.cust
           and l.doc_date between p_stop.delivery_date - 7 and p_stop.delivery_date + 1)
     )
   order by l.received_at desc
   limit 1;
$$;
revoke all on function public.stop_delivery_doc(public.calendar_stops) from public, anon, authenticated;

-- ─── לרשימת העצירות באפליקציה: יש תעודה? נחתמה? ──────────────────────────
create or replace function public.stops_delivery_notes(p_stop_ids uuid[])
returns table (stop_id uuid, docno text, status text, signed boolean)
language sql stable security definer
set search_path = public
as $$
  select s.id, d.docno, d.status,
         exists (select 1 from public.signed_forms f
                  where f.stop_id = s.id and f.form_key = 'delivery_note')
    from public.calendar_stops s
    cross join lateral public.stop_delivery_doc(s) d
   where s.id = any(p_stop_ids)
     and s.source_type in ('delivery', 'customer')
     and d.docno is not null
     and public.stop_form_access(s) is true;
$$;
revoke all on function public.stops_delivery_notes(uuid[]) from public, anon;
grant execute on function public.stops_delivery_notes(uuid[]) to authenticated;

-- ─── התעודה של עצירה אחת, למסך ההחתמה ────────────────────────────────────
create or replace function public.stop_delivery_note(p_stop_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_stop public.calendar_stops;
  v_doc  public.delivery_note_docs;
begin
  select * into v_stop from public.calendar_stops where id = p_stop_id;
  if not found then return null; end if;
  if public.stop_form_access(v_stop) is not true then
    raise exception 'not authorized';
  end if;
  v_doc := public.stop_delivery_doc(v_stop);
  if v_doc.id is null then return null; end if;
  return jsonb_build_object(
    'doc_id', v_doc.id,
    'docno', v_doc.docno,
    'status', v_doc.status,
    'received_at', v_doc.received_at,
    'doc_date', v_doc.doc_date,
    'pdf_path', v_doc.pdf_path,
    'page_paths', to_jsonb(v_doc.page_paths),
    'page_size', v_doc.page_size,
    'anchors', v_doc.anchors,
    'customer_name', v_stop.customer_name,
    'signed', (select coalesce(jsonb_agg(jsonb_build_object(
                 'id', f.id, 'signed_at', f.signed_at, 'signed_by', f.signed_by,
                 'docno', f.payload->>'docno') order by f.signed_at), '[]'::jsonb)
                 from public.signed_forms f
                where f.stop_id = v_stop.id and f.form_key = 'delivery_note')
  );
end;
$$;
revoke all on function public.stop_delivery_note(uuid) from public, anon;
grant execute on function public.stop_delivery_note(uuid) to authenticated;

-- ─── אחסון: הנהג קורא רק תעודה של עצירה שלו ──────────────────────────────
--
-- הנתיב בדלי הוא `<SH>/...`. נהג רשאי לקרוא אותו רק אם התעודה שייכת לעצירה
-- שלו מהימים האחרונים (אותה הרשאה כמו `stop_form_access`). כתיבה: רק service
-- role (הפונקציה), אין מדיניות insert.
create or replace function public.delivery_note_object_readable(p_name text)
returns boolean
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_docno text := split_part(p_name, '/', 1);
  v_drv   text;
begin
  if public.is_office_staff() is true then return true; end if;
  if public.current_user_role() is distinct from 'driver' then return false; end if;
  v_drv := public.current_user_driver();
  if v_drv is null or v_docno !~ '^SH[0-9]+$' then return false; end if;
  return exists (
    select 1 from public.calendar_stops s
     where s.driver = v_drv
       and s.source_type in ('delivery', 'customer')
       and s.delivery_date between public.israel_today() - 3 and public.israel_today()
       and (public.stop_delivery_doc(s)).docno = v_docno);
end;
$$;
revoke all on function public.delivery_note_object_readable(text) from public, anon;
grant execute on function public.delivery_note_object_readable(text) to authenticated;

drop policy if exists delivery_note_docs_read on storage.objects;
create policy delivery_note_docs_read on storage.objects
  for select to authenticated
  using (bucket_id = 'delivery-note-docs' and public.delivery_note_object_readable(name));
