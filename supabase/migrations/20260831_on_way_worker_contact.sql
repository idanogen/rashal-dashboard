-- ─── "בדרך אליך" עם שם וטלפון של העובד · 31/08/2026 ─────────────────────
--
-- בקשת שלומי: ההודעה ללקוח הבא תכלול את שם הנהג/טכנאי ואת הטלפון שלו.
-- תבנית חדשה rashal_on_the_way_v2 (heyy e095de1a-5ccf-4811-8836-1cfd6596e609):
-- "שלום {{name}}, {{worker}} של ר.שעל סיים את הביקור הקודם ונמצא כעת בדרך
--  אליך. לשאלות אפשר לחייג ישירות אל {{worker_name}}: {{worker_phone}}.
--  תודה, צוות ר.שעל"
--
-- הפריסה בטוחה: template_v2_id ריק = הכל ממשיך בתבנית הישנה. מחווטים את
-- המזהה רק אחרי אישור מטא (ובדיקה שהקטגוריה נשארה שירות!). עובד בלי טלפון
-- בטבלת הצוות = נסיגה אוטומטית לתבנית הישנה, אין הודעה עם חור.

alter table public.on_way_settings add column if not exists template_v2_id text;

-- שינוי חתימת ההחזרה מחייב drop (אי אפשר להוסיף עמודות OUT ב-or replace).
drop function if exists public.on_way_claim(boolean, int);

create function public.on_way_claim(p_dry boolean default false, p_limit int default 20)
returns table (event_id bigint, next_stop_id uuid, customer_name text,
               phone_e164 text, worker text, resolved_stop_id uuid,
               worker_name text, worker_phone text)
language plpgsql security definer set search_path = public
as $fn$
declare
  cfg public.on_way_settings;
  ev record;
  nxt record;
  verdict text;
begin
  select * into cfg from public.on_way_settings s where s.id;

  update public.on_way_events e
     set processed_at = now(), result = 'stale'
   where e.processed_at is null
     and e.created_at < now() - make_interval(mins => cfg.stale_minutes);

  for ev in
    select * from public.on_way_events e
     where e.processed_at is null
     order by e.created_at
     limit p_limit
     for update skip locked
  loop
    select s.*,
           nullif(substring(coalesce(s.time_window_start, '') from '^\d{1,2}:\d{2}'), '')::time as win_start
      into nxt
      from public.calendar_stops s
     where s.driver::text = ev.driver
       and s.delivery_date = ev.delivery_date
       and s.status = 'planned'
     order by (nullif(substring(coalesce(s.time_window_start, '') from '^\d{1,2}:\d{2}'), '') is null),
              nullif(substring(coalesce(s.time_window_start, '') from '^\d{1,2}:\d{2}'), '')::time,
              s.sequence
     limit 1;

    if nxt.id is null then
      verdict := 'last_stop';
    elsif exists (select 1 from public.on_way_notices n where n.stop_id = nxt.id) then
      verdict := 'already_notified';
    elsif regexp_replace(coalesce(nxt.phone, ''), '\D', '', 'g') !~ '^0?5[0-9]{8}$' then
      verdict := 'no_mobile';
    elsif not public.on_way_window_open() then
      verdict := 'after_hours';
    elsif nxt.win_start is not null
      and (ev.delivery_date + nxt.win_start) at time zone 'Asia/Jerusalem'
          > now() + make_interval(mins => cfg.lead_minutes) then
      verdict := 'too_early';
    else
      verdict := case when p_dry then 'dry' else 'claimed' end;
    end if;

    update public.on_way_events e
       set processed_at = now(),
           result = verdict,
           next_stop_id = nxt.id
     where e.id = ev.id;

    if verdict in ('claimed', 'dry') then
      event_id := ev.id;
      next_stop_id := nxt.id;
      customer_name := nxt.customer_name;
      phone_e164 := '+972' || right(regexp_replace(nxt.phone, '\D', '', 'g'), 9);
      worker := case when nxt.source_type = 'service' then 'טכנאי' else 'נהג' end;
      resolved_stop_id := ev.resolved_stop_id;
      -- שם העובד והטלפון שלו, מטבלת הצוות. אין טלפון = null, והפונקציה
      -- בענן נסוגה לתבנית הישנה בלי הפרטים.
      worker_name := ev.driver;
      select a.phone into worker_phone from public.assignees a where a.name = ev.driver;
      return next;
    end if;
  end loop;
end;
$fn$;

revoke all on function public.on_way_claim(boolean, int) from public, anon, authenticated;
grant execute on function public.on_way_claim(boolean, int) to service_role;
