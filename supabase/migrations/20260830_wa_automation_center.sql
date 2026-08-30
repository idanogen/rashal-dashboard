-- ─── חדר הבקרה של אוטומציות הוואטסאפ · 30/08/2026 ──────────────────────
--
-- עידן: "יש לנו כמה תהליכי אוטומציה של הודעות וואטסאפ, אני רוצה שיהיה
-- לנו מקום אחד שהכל מרוכז. זה מתחיל להיות הרבה תהליכים וקשה לי לנהל."
--
-- שתי פונקציות: תמונת מצב אחת לכל המנועים, ומתג הפעלה/כיבוי. שתיהן
-- security definer עם השער בפנים, כי מסך שרק מסתיר כפתורים אינו הגנה.
--
-- ⭐ העלויות כאן זולות בכוונה: כל המונים הם על טבלאות קטנות (עשרות עד
-- מאות שורות) עם אינדקסים קיימים. אין נגיעה בטבלאות הגדולות.

create or replace function public.wa_automation_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  day_start timestamptz := date_trunc('day', now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem';
  week_ago  timestamptz := now() - interval '7 days';
begin
  -- מי שרואה את דשבורד ההנהלה רואה גם את זה. סדרן ונהג לא.
  if public.is_management() is not true then
    raise exception 'not authorized';
  end if;

  return jsonb_build_object(
    'surveys', (
      select jsonb_build_object(
        'enabled', s.enabled,
        'dry_run', s.dry_run,
        'sent_today', (select count(*) from public.customer_surveys c where c.sent_at >= day_start and c.is_test = false),
        'sent_7d',    (select count(*) from public.customer_surveys c where c.sent_at >= week_ago and c.is_test = false),
        'answered_7d',(select count(*) from public.customer_surveys c where c.answered_at >= week_ago and c.is_test = false),
        'queue',      (select count(*) from public.customer_surveys c where c.status = 'pending'),
        'failed_open',(select count(*) from public.customer_surveys c where c.status = 'failed'),
        'last_run_at',(select max(r.ran_at) from public.survey_engine_runs r)
      )
      from public.survey_settings s where s.id
    ),
    'media', (
      select jsonb_build_object(
        'enabled', m.enabled,
        'dry_run', m.dry_run,
        'sent_today', (select count(*) from public.media_requests q
                        where q.first_sent_at >= day_start or q.reminder_sent_at >= day_start),
        'waiting',    (select count(*) from public.media_requests q where q.state in ('first_sent','reminder_sent')),
        'queue',      (select count(*) from public.media_requests q where q.state = 'pending'),
        'received_7d',(select count(*) from public.media_requests q where q.media_received_at >= week_ago),
        'no_response_open', (select count(*) from public.media_requests q where q.state = 'no_response'),
        'no_phone_open',    (select count(*) from public.media_requests q where q.state = 'no_phone'),
        'failed_open',      (select count(*) from public.media_requests q where q.state = 'failed'),
        'last_run_at',(select max(r.ran_at) from public.media_request_runs r)
      )
      from public.media_request_settings m where m.id
    ),
    'on_way', (
      select jsonb_build_object(
        'enabled', w.enabled,
        'dry_run', w.dry_run,
        'sent_today', (select count(*) from public.on_way_notices n
                        where n.sent_at >= day_start and n.is_test = false),
        'sent_7d',    (select count(*) from public.on_way_notices n
                        where n.sent_at >= week_ago and n.is_test = false),
        'skipped_today', (select count(*) from public.on_way_events e
                           where e.created_at >= day_start
                             and e.result not in ('sent', 'claimed', 'dry')
                             and e.result is not null),
        'last_run_at',(select max(r.ran_at) from public.on_way_runs r)
      )
      from public.on_way_settings w where w.id
    ),
    -- התזכורת יום-לפני מנוהלת במשתנה סביבה בוורסל (WA_REMINDERS_ENABLED),
    -- ולכן אין לה מתג כאן, רק תמונת מצב מהיומן שלה.
    'reminders', jsonb_build_object(
      'sent_7d', (select count(*) from public.whatsapp_reminder_log l where l.sent_at >= week_ago),
      'last_at', (select max(l.sent_at) from public.whatsapp_reminder_log l)
    ),
    -- שליחות ידניות: תיאום הגעה מהדיאלוג, החלונית שבפריוריטי, והתיבה.
    'manual', jsonb_build_object(
      'sent_7d', (select count(*) from public.whatsapp_outbound o
                   where o.sent_at >= week_ago
                     and (o.triggered_by like 'priority-panel%' or o.triggered_by like 'user:%')),
      'last_at', (select max(o.sent_at) from public.whatsapp_outbound o
                   where o.triggered_by like 'priority-panel%' or o.triggered_by like 'user:%')
    ),
    'suppressed', (select count(*) from public.wa_suppressed),
    'delivery_failed_7d', (select count(*) from public.whatsapp_outbound o
                            where o.sent_at >= week_ago and o.status = 'failed'),
    'generated_at', now()
  );
end;
$fn$;

-- ── המתג ─────────────────────────────────────────────────────────────────
-- 🔴 מנהל מערכת בלבד. הדלקה וכיבוי של מנוע ששולח ללקוחות היא לא פעולת
-- צפייה, והנהלה שרואה מספרים אינה בהכרח מי שמושך בידית.
create or replace function public.wa_automation_toggle(p_engine text, p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if public.current_user_role() is distinct from 'admin' then
    raise exception 'not authorized';
  end if;

  if p_engine = 'surveys' then
    update public.survey_settings s set enabled = p_enabled where s.id;
  elsif p_engine = 'media' then
    update public.media_request_settings m set enabled = p_enabled where m.id;
  elsif p_engine = 'on_way' then
    update public.on_way_settings w set enabled = p_enabled where w.id;
  else
    raise exception 'unknown engine: %', p_engine;
  end if;

  return jsonb_build_object('engine', p_engine, 'enabled', p_enabled);
end;
$fn$;

revoke all on function public.wa_automation_overview() from public, anon;
revoke all on function public.wa_automation_toggle(text, boolean) from public, anon;
grant execute on function public.wa_automation_overview() to authenticated, service_role;
grant execute on function public.wa_automation_toggle(text, boolean) to authenticated, service_role;
