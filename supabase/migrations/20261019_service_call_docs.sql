-- ═══════════════════════════════════════════════════════════════════════════
-- טופסי קריאות השירות המקוריים מפריוריטי, לתצוגה לנהג בכרטיס הקריאה (19/10/2026)
--
-- הרקע: החוק העסקי בפריוריטי ששולח תעודות משלוח למייל (1172) יורה גם על
-- קריאות שירות: נושא "<SC...>*<סטטוס>" עם ה-PDF של טופס הקריאה. עד היום
-- הקליטה דילגה עליהן ("נושא בלי SH"). עידן, 19/10: "גם קריאות שירות וגם
-- משלוחים ללקוח אלה דברים שאנחנו רוצים להציג לנהגים ב-PDF".
--
-- אותו מבנה כמו `delivery_note_docs`, עם שני הבדלים:
-- ⭐ השיוך ישיר ולא היוריסטי: docno = service_calls.priority_call_id, והעצירה
--    מחזיקה service_call_id. אין צורך במסלול לקוח+תאריך.
-- ⭐ אין עוגני חתימה: בטופס קריאת שירות של ר.שעל אין את טבלת "אישור הלקוח"
--    (נבדק על SC2603758 ו-SC2603563). העמודה נשארת לעתיד, הלמדה שולחת {}.
--
-- 🔴 שורה לכל מייל, לא לכל קריאה. הטופס העדכני = המייל האחרון. קריאה
-- שהמייל האחרון שלה "מבוטלת" לא מוצגת.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.service_call_docs (
  id              uuid primary key default gen_random_uuid(),
  mail_key        text not null unique,          -- המפתח של המייל הגולמי בדלי ogen-intake-mail
  docno           text not null,                 -- SC...
  status          text,                          -- מהנושא: טיוטא · לביצוע · בוצעה · סופית · מבוטלת
  subject         text,
  received_at     timestamptz not null,
  doc_date        date,                          -- "תאריך הקריאה" מתוך ה-PDF
  customer_number text,                          -- "מס. לקוח" מתוך ה-PDF
  pdf_path        text not null,                 -- בדלי service-call-docs
  page_paths      text[] not null default '{}',  -- PNG לכל עמוד, באותו דלי
  page_size       jsonb,                         -- {"w":595,"h":842} בנקודות
  anchors         jsonb,                         -- ריק היום; נשמר לעתיד
  created_at      timestamptz not null default now()
);

create index if not exists service_call_docs_docno_idx    on public.service_call_docs (docno, received_at desc);
create index if not exists service_call_docs_customer_idx on public.service_call_docs (customer_number, doc_date);

alter table public.service_call_docs enable row level security;

drop policy if exists service_call_docs_office_read on public.service_call_docs;
create policy service_call_docs_office_read on public.service_call_docs
  for select to authenticated
  using ((select public.is_office_staff()) is true);

insert into storage.buckets (id, name, public)
values ('service-call-docs', 'service-call-docs', false)
on conflict (id) do nothing;

-- ─── הטופס העדכני של קריאה, לכרטיס ───────────────────────────────────────
-- פנימית. המייל האחרון של הקריאה; "מבוטלת" = אין טופס.
create or replace function public.service_call_latest_doc(p_docno text)
returns public.service_call_docs
language sql stable security definer
set search_path = public
as $$
  select d.*
    from public.service_call_docs d
   where d.docno = p_docno
   order by d.received_at desc
   limit 1;
$$;
revoke all on function public.service_call_latest_doc(text) from public, anon, authenticated;

-- ─── הטופס נכנס לכרטיס הקריאה ────────────────────────────────────────────
-- ⭐ הכרטיס נבנה רק כאן (call_info_payload): גם הנהג (stop_call_info) וגם
-- המשרד (service_call_info) מקבלים את המפתח 'doc' בלי שינוי נוסף.
-- ההגדרה זהה לחיה (אומתה מול pg_get_functiondef ב-19/10), בתוספת v_doc.
create or replace function public.call_info_payload(p_call_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_call  public.service_calls;
  v_media jsonb;
  v_texts jsonb;
  v_note  jsonb;
  v_req   jsonb;
  v_docr  public.service_call_docs;
  v_doc   jsonb;
begin
  select * into v_call from public.service_calls where id = p_call_id;
  if not found then
    return null;
  end if;

  -- תמונות, סרטונים והקלטות שנשמרו אצלנו. 🔴 הנתיב חוזר רק לקורא מורשה,
  -- והחתימה עצמה עוברת גם את מדיניות האחסון.
  select coalesce(jsonb_agg(jsonb_build_object(
           'message_id', x.message_id,
           'i', x.idx - 1,
           'at', x.at,
           'type', x.a->>'type',
           'path', x.a->>'stored_path',
           'content_type', x.a->'file'->>'contentType'
         ) order by x.at, x.idx), '[]'::jsonb)
    into v_media
    from (
      select i.message_id, i.at, t.a, t.idx
        from public.call_customer_inbound(v_call.id) i,
             jsonb_array_elements(i.attachments) with ordinality as t(a, idx)
       where t.a ? 'stored_path'
         and t.a->>'type' in ('image', 'video', 'audio')
       order by i.at desc
       limit 40
    ) x;

  -- מה שהלקוח כתב, בלי תשובות כפתור. 12 האחרונות, מוצגות לפי הסדר.
  select coalesce(jsonb_agg(jsonb_build_object('message_id', y.message_id, 'at', y.at, 'body', y.body)
                            order by y.at), '[]'::jsonb)
    into v_texts
    from (
      select i.message_id, i.at, btrim(i.body) as body
        from public.call_customer_inbound(v_call.id) i
       where nullif(btrim(coalesce(i.body, '')), '') is not null
         and not i.is_button_reply
       order by i.at desc
       limit 12
    ) y;

  -- ההערה האחרונה של המשרד בצ'אט הקריאה (לא של נהג, לא של הלקוח).
  select jsonb_build_object('user_name', t.user_name, 'content', t.content, 'at', t.created_at)
    into v_note
    from public.timeline_events t
    join public.profiles p on p.id::text = t.user_id
   where t.service_call_id = v_call.id
     and t.type = 'comment'
     and p.role in ('admin', 'management', 'team_manager', 'dispatcher')
     and nullif(btrim(coalesce(t.content, '')), '') is not null
   order by t.created_at desc
   limit 1;

  -- בקשת "תמונה לפני טכנאי", כדי שגיליון ריק יגיד מה חסר ולמה.
  select jsonb_build_object('state', r.state, 'sent_at', r.first_sent_at, 'received_at', r.media_received_at)
    into v_req
    from public.media_requests r
   where r.service_call_id = v_call.id
     and r.is_test is not true
   order by r.created_at desc
   limit 1;

  -- טופס הקריאה המקורי מפריוריטי (מהמייל), אם נקלט ולא בוטל.
  if v_call.priority_call_id is not null then
    v_docr := public.service_call_latest_doc(v_call.priority_call_id);
    if v_docr.id is not null and coalesce(v_docr.status, '') <> 'מבוטלת' then
      v_doc := jsonb_build_object(
        'docno', v_docr.docno,
        'status', v_docr.status,
        'doc_date', v_docr.doc_date,
        'received_at', v_docr.received_at,
        'pdf_path', v_docr.pdf_path,
        'page_paths', to_jsonb(v_docr.page_paths),
        'page_size', v_docr.page_size
      );
    end if;
  end if;

  return jsonb_build_object(
    'call', jsonb_build_object(
      'id', v_call.id,
      'docno', v_call.priority_call_id,
      'fault_text', v_call.fault_text,
      'opened_at', v_call.created_at,
      'device_name', v_call.device_name,
      'device_desc', v_call.device_desc,
      'device_serial', v_call.device_serial,
      'warranty_until', v_call.warranty_until,
      'service_type', v_call.service_type
    ),
    'media', v_media,
    'texts', v_texts,
    'office_note', v_note,
    'media_request', v_req,
    'doc', v_doc
  );
end;
$$;
revoke all on function public.call_info_payload(uuid) from public, anon, authenticated;

-- ─── אחסון: הנהג קורא רק טופס של קריאה בעצירה שלו ────────────────────────
-- הנתיב בדלי הוא `<SC>/...`. אותו חלון כמו תעודות המשלוח: עצירת שירות שלו
-- מהימים האחרונים. כתיבה: רק service role (הפונקציה), אין מדיניות insert.
create or replace function public.service_call_doc_object_readable(p_name text)
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
  if v_drv is null or v_docno !~ '^SC[0-9]+$' then return false; end if;
  return exists (
    select 1
      from public.calendar_stops s
      join public.service_calls c on c.id = s.service_call_id
     where s.driver = v_drv
       and s.source_type = 'service'
       and s.delivery_date between public.israel_today() - 3 and public.israel_today()
       and c.priority_call_id = v_docno);
end;
$$;
revoke all on function public.service_call_doc_object_readable(text) from public, anon;
grant execute on function public.service_call_doc_object_readable(text) to authenticated;

drop policy if exists service_call_docs_read on storage.objects;
create policy service_call_docs_read on storage.objects
  for select to authenticated
  using (bucket_id = 'service-call-docs' and public.service_call_doc_object_readable(name));
