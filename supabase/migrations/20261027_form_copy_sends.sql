-- ═══════════════════════════════════════════════════════════════════════════
-- העתק של טופס חתום ללקוח (27/10/2026)
--
-- עמי, 27/10: "הלקוח באיסוף/אספקה צריך לקבל העתק טופס החתימה... לפי דרישתו,
-- בהפעלה של הטכנאי/נהג". הכרעות עידן באותו יום:
--   · וואטסאפ ומייל בלבד (בלי SMS).
--   · רק כשהלקוח מבקש, ורק טופס אספקה או החזרה (form_kind delivery/return).
--     אישור ההדרכה למנוף לא נשלח.
--   · מה שהנהג מקליד נשמר כאן בלבד, ולא נכתב לכרטיס הלקוח בפריוריטי.
--
-- הזרימה: האפליקציה → Edge Function `rashal-form-copy` (עם ה-JWT של הנהג)
-- → `form_copy_context` כאן בודקת שהטופס שלו → וואטסאפ דרך `api/heyy-send`
-- (תבנית `ogen_send_document` עם ה-PDF) או מייל דרך Resend → שורה ביומן.
--
-- 🔴 הנהג לא כותב ליומן ישירות. הכתיבה רק מהפונקציה (service role), כדי
-- שלא תהיה שורת "נשלח" שלא עברה בשליחה.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.form_copy_sends (
  id               uuid primary key default gen_random_uuid(),
  signed_form_id   uuid not null references public.signed_forms(id) on delete cascade,
  channel          text not null check (channel in ('whatsapp', 'email')),
  recipient        text not null,
  -- מאיפה הנמען: הטלפון בעצירה, שדה בטופס, כרטיס הלקוח, איש קשר, או הקלדה.
  recipient_source text not null check (recipient_source in ('stop', 'form', 'customer', 'contact', 'typed')),
  recipient_label  text,
  status           text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  detail           text,
  provider_id      text,
  requested_by     uuid,
  requested_name   text,
  created_at       timestamptz not null default now(),
  sent_at          timestamptz
);

create index if not exists form_copy_sends_form_idx on public.form_copy_sends (signed_form_id, created_at desc);

alter table public.form_copy_sends enable row level security;

drop policy if exists form_copy_sends_office_read on public.form_copy_sends;
create policy form_copy_sends_office_read on public.form_copy_sends
  for select to authenticated
  using ((select public.is_office_staff()) is true);

-- ─── מה צריך כדי לשלוח העתק, ובדיקה שהטופס של הקורא ─────────────────────
--
-- ⭐ אותה בדיקת גישה כמו בשאר הטפסים (`stop_form_access`): משרד, או הנהג
-- של העצירה. טופס בלי עצירה פתוח למשרד בלבד.
-- 🔴 security definer כי `signed_forms` למשרד בלבד; ההרשאה נבדקת כאן.
create or replace function public.form_copy_context(p_form_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_form  public.signed_forms;
  v_stop  public.calendar_stops;
  v_doc   text;
  v_name  text;
begin
  select * into v_form from public.signed_forms where id = p_form_id;
  if not found then raise exception 'form not found'; end if;

  if v_form.stop_id is not null then
    select * into v_stop from public.calendar_stops where id = v_form.stop_id;
  end if;
  if not (public.is_office_staff() is true
          or (v_stop.id is not null and public.stop_form_access(v_stop) is true)) then
    raise exception 'not authorized';
  end if;
  if v_form.form_kind not in ('delivery', 'return') then
    raise exception 'form kind % is not sent to customers', v_form.form_kind;
  end if;
  if v_form.pdf_path is null then raise exception 'form has no pdf'; end if;

  v_doc := nullif(trim(v_form.payload->>'docno'), '');
  if v_doc is null and v_form.order_id is not null then
    select priority_order_id into v_doc from public.orders where id = v_form.order_id;
  end if;
  if v_doc is null and v_form.pickup_id is not null then
    select priority_pickup_id into v_doc from public.pickups where id = v_form.pickup_id;
  end if;

  v_name := coalesce(nullif(trim(v_stop.customer_name), ''), nullif(trim(v_form.signer_name), ''), '');

  return jsonb_build_object(
    'form_id', v_form.id,
    'form_key', v_form.form_key,
    'form_kind', v_form.form_kind,
    'pdf_path', v_form.pdf_path,
    'customer_number', nullif(trim(coalesce(v_form.customer_number, v_stop.customer_number)), ''),
    'customer_name', v_name,
    'doc_number', v_doc,
    'stop_phone', nullif(trim(v_stop.phone), ''),
    -- טלפונים שהנהג הקליד בטופס עצמו (טופס החזרה של משרד הבריאות ודומיו).
    'form_phones', (select coalesce(jsonb_agg(distinct v), '[]'::jsonb)
                      from (select nullif(trim(v_form.payload->>k), '') v
                              from unnest(array['mobile', 'phone', 'returnerMobile', 'returnerPhone', 'phoneAlt']) k) x
                     where v is not null),
    'signed_at', v_form.signed_at,
    'sends', (select coalesce(jsonb_agg(jsonb_build_object(
                'channel', s.channel, 'recipient', s.recipient, 'status', s.status, 'created_at', s.created_at)
                order by s.created_at), '[]'::jsonb)
                from public.form_copy_sends s where s.signed_form_id = v_form.id)
  );
end;
$$;
revoke all on function public.form_copy_context(uuid) from public, anon;
grant execute on function public.form_copy_context(uuid) to authenticated;
