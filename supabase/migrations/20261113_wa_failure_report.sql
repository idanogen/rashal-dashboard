-- ─── דוח שבועי: לקוחות שלא הצלחנו להגיע אליהם בוואטסאפ (13/11/2026) ───
--
-- הכרעת עידן 13/11: פעם בשבוע מייל לעמי, רונן, שלומי והמשרד עם ההודעות שנכשלו
-- וסיבת הכשלון. מדידה באותו יום: 201 מתוך 206 כשלונות בחודש הם "המספר אינו מספר
-- וואטסאפ" (טלפון כשר / בלי וואטסאפ), על 89 לקוחות, עד 7 ניסיונות ללקוח.
-- לכן הדוח בנוי לפי טלפון ולא לפי הודעה, ומה שחוסם עבודה (בקשת תמונה על קריאה
-- שעוד פתוחה) ראשון. סקר ותשובות שפה לא נכנסים: אין למשרד מה לעשות איתם.
-- כשלון טכני (לא "אינו מספר וואטסאפ") נספר בשורה נפרדת, הוא של עוגן ולא של המשרד.
--
-- הנמענים בטבלה ולא בקוד. השליחה ב-`rashal-wa-failure-report`, ראשון 08:00 שעון ישראל.

create table if not exists public.wa_failure_report_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  -- [{"name": "עמי גז", "email": "ami@mishal.co.il"}]
  recipients jsonb not null default '[]'::jsonb,
  last_result jsonb,
  updated_at timestamptz not null default now()
);
insert into public.wa_failure_report_settings (id, recipients) values (true, jsonb_build_array(
  jsonb_build_object('name', 'עמי גז', 'email', 'ami@mishal.co.il'),
  jsonb_build_object('name', 'רונן', 'email', 'ronen@mishal.co.il'),
  jsonb_build_object('name', 'שלומי קורן', 'email', 'shlomi@mishal.co.il'),
  jsonb_build_object('name', 'המשרד', 'email', 'info@mishal.co.il')
)) on conflict (id) do nothing;

alter table public.wa_failure_report_settings enable row level security;
drop policy if exists wa_failure_report_settings_read on public.wa_failure_report_settings;
create policy wa_failure_report_settings_read on public.wa_failure_report_settings
  for select to authenticated using ((select public.is_office_staff()));

-- שורה לכל שבוע. השורה נתפסת לפני השליחה (insert ... on conflict do nothing),
-- כך ששתי קריאות קרון לא שולחות פעמיים. ok נכתב רק אחרי ש-Resend החזיר 200.
create table if not exists public.wa_failure_report_log (
  week_start date primary key,
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  ok boolean,
  error text,
  recipients jsonb,
  customers int
);
alter table public.wa_failure_report_log enable row level security;

-- הנתונים לשבוע [p_from, p_to) בשעון ישראל.
create or replace function public.wa_failure_report_data(p_from date, p_to date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with win as (
    select (p_from::timestamp at time zone 'Asia/Jerusalem') t0,
           (p_to::timestamp   at time zone 'Asia/Jerusalem') t1
  ),
  failed as (
    select o.*,
      case
        when o.reminder_kind::text = 'visit_reminder' then 'visit_reminder'
        when o.reminder_kind::text = 'crane_guide' then 'crane'
        when o.triggered_by like 'media-request-%' then 'media'
        when o.triggered_by like 'on-way-engine%' then 'on_way'
        when o.triggered_by like 'survey-engine%' then 'survey'
        when o.triggered_by like 'language-reply%' then 'language'
        when o.triggered_by like 'form-copy%' then 'document'
        else 'manual'
      end as kind,
      (o.status_detail ilike '%unable to deliver%') as unreachable,
      (select p->>'value' from jsonb_array_elements(case when jsonb_typeof(o.template_params) = 'array'
                                                         then o.template_params else '[]'::jsonb end) p
        where p->>'name' in ('name', 'customer_name') limit 1) as param_name
    from whatsapp_outbound o, win
    where o.created_at >= win.t0 and o.created_at < win.t1
      and o.status::text = 'failed'
      and not coalesce(o.is_demo, false)
  ),
  phones as (
    select f.phone_e164,
      max(f.param_name) as name,
      array_agg(distinct f.kind order by f.kind) as kinds,
      count(*) as attempts,
      max(f.created_at) as last_at
    from failed f
    where f.unreachable and f.kind not in ('survey', 'language')
    group by f.phone_e164
  ),
  rows as (
    select p.*,
      exists (select 1 from whatsapp_outbound d
               where d.phone_e164 = p.phone_e164 and d.status::text in ('delivered', 'read')
                 and d.created_at > now() - interval '180 days') as ever_delivered,
      coalesce((
        select jsonb_agg(jsonb_build_object(
                 'call', m.priority_call_id, 'product', m.device_name,
                 'state', m.state, 'priority_status', s.priority_status, 'call_status', s.service_call_status)
               order by m.created_at desc)
          from media_requests m
          left join service_calls s on s.id = m.service_call_id
         where m.phone_e164 = p.phone_e164
           and not m.is_test
           and m.state not in ('media_received', 'cancelled')
           and m.created_at >= (select t0 from win) - interval '14 days'
      ), '[]'::jsonb) as calls,
      coalesce(p.name, (select m.customer_name from media_requests m
                         where m.phone_e164 = p.phone_e164 and m.customer_name is not null
                         order by m.created_at desc limit 1)) as display_name
    from phones p
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'customers', coalesce((select jsonb_agg(jsonb_build_object(
        'phone', r.phone_e164, 'name', r.display_name, 'kinds', to_jsonb(r.kinds),
        'attempts', r.attempts, 'last_at', r.last_at, 'ever_delivered', r.ever_delivered,
        'calls', r.calls)
      order by (jsonb_array_length(r.calls) > 0) desc, ('media' = any(r.kinds)) desc, r.attempts desc)
      from rows r), '[]'::jsonb),
    'unreachable_total', (select count(*) from failed where unreachable),
    'survey_only', (select count(distinct phone_e164) from failed f where f.unreachable and f.kind in ('survey', 'language')
                      and not exists (select 1 from phones p where p.phone_e164 = f.phone_e164)),
    'technical', (select count(*) from failed where not unreachable),
    'technical_sample', (select left(status_detail, 160) from failed where not unreachable
                          group by left(status_detail, 160) order by count(*) desc limit 1)
  );
$$;
revoke all on function public.wa_failure_report_data(date, date) from public, anon, authenticated;
grant execute on function public.wa_failure_report_data(date, date) to service_role;
