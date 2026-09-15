-- כתיבה שוטפת של סטטוס קריאת שירות לפריוריטי מסימון הטכנאי (עידן, 15/09/2026).
--
-- "סיימתי כאן" → בוצעה · "המשך טיפול" → להמשך טיפול · "לא בוצע" → כלום.
-- זו אותה טבלה ואותה פונקציה של גל ההשלמה (20260915_priority_call_status_writes.sql),
-- עם מקור חדש `stop`: הטריגר כותב שורה ממתינה, והקרון מריץ את `rashal-call-status`.
--
-- ⭐ שורה ממתינה אחת לכל קריאה. אם הטכנאי סימן "המשך טיפול" ואחר כך "בוצע"
-- לפני שהכתיבה יצאה, השורה מתעדכנת לסימון האחרון ולא נכתבים שני סטטוסים.
-- ⭐ סימון שהתבטל לפני היציאה ("לא בוצע", או עצירה שנפתחה מחדש) מסמן את
-- השורה הממתינה כ-skipped עם הסיבה.
-- ⭐ שלוש דקות חסד: הקרון ופונקציית הכתיבה לוקחים רק שורות בנות שלוש דקות
-- ומעלה, כדי שלחיצה בטעות שתוקנה מיד לא תגיע לפריוריטי.
-- 🔴 כותבים רק מסטטוס פעיל שאינו סופי (`allowed_from`, לפי הגדרות הסטטוסים של
-- ר.שעל, meetings/rashal/2026-09-15-סטטוסים-לקריאות-שירות-מפריוריטי.xlsx). סופית,
-- מבוטלת, טופל טכנאי, טיוטא והשלמת פרטים לא נדרסים לעולם.

alter table public.priority_call_status_writes alter column expected_from drop not null;
alter table public.priority_call_status_writes add column if not exists allowed_from text[] not null default '{}';
update public.priority_call_status_writes
   set allowed_from = array[expected_from]
 where expected_from is not null and allowed_from = '{}';

-- הייחודיות המקורית (מקור + קריאה) מתאימה לגל ההשלמה ולא לזרם שוטף, שבו
-- אותה קריאה יכולה לקבל כמה כתיבות לאורך זמן (המשך טיפול ואז בוצעה).
alter table public.priority_call_status_writes drop constraint if exists priority_call_status_writes_source_priority_call_id_key;
create unique index if not exists priority_call_status_writes_backfill_uq
  on public.priority_call_status_writes (source, priority_call_id) where source <> 'stop';
create unique index if not exists priority_call_status_writes_stop_pending_uq
  on public.priority_call_status_writes (priority_call_id) where source = 'stop' and state = 'pending';

create or replace function public.enqueue_call_status_from_stop()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_docno text;
  v_target text;
begin
  begin
    if new.service_call_id is null then
      return new;
    end if;
    if new.status is not distinct from old.status
       and new.resolution_kind is not distinct from old.resolution_kind then
      return new;
    end if;

    v_target := case
      when new.status = 'completed' then 'בוצעה'
      when new.status = 'not_completed' and new.resolution_kind = 'follow_up' then 'להמשך טיפול'
    end;

    if v_target is null then
      update public.priority_call_status_writes
         set state = 'skipped', attempted_at = now(),
             error = case when new.status = 'not_completed'
                          then 'הטכנאי סימן "לא בוצע" לפני שהכתיבה יצאה'
                          else 'העצירה נפתחה מחדש לפני שהכתיבה יצאה' end
       where source = 'stop' and state = 'pending' and calendar_stop_id = new.id;
      return new;
    end if;

    select sc.priority_call_id into v_docno
      from public.service_calls sc where sc.id = new.service_call_id;
    if v_docno is null or v_docno !~ '^SC[0-9]+$' then
      return new;
    end if;

    insert into public.priority_call_status_writes
      (source, priority_call_id, service_call_id, calendar_stop_id, technician, visit_completed_at,
       expected_from, allowed_from, target_status)
    values
      ('stop', v_docno, new.service_call_id, new.id, new.driver::text, coalesce(new.completed_at, now()),
       null, array['לביצוע', 'שובצה', 'להמשך טיפול', 'חזר מט. שטח', 'טכנאי טיוטא'], v_target)
    on conflict (priority_call_id) where source = 'stop' and state = 'pending'
    do update set target_status = excluded.target_status,
                  calendar_stop_id = excluded.calendar_stop_id,
                  technician = excluded.technician,
                  visit_completed_at = excluded.visit_completed_at,
                  created_at = now();
  exception when others then
    -- 🔴 לעולם לא מפילים את סימון הטכנאי בגלל התור.
    raise warning 'enqueue_call_status_from_stop: %', sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.enqueue_call_status_from_stop() from public, anon, authenticated;

drop trigger if exists trg_enqueue_call_status on public.calendar_stops;
create trigger trg_enqueue_call_status
  after update of status, resolution_kind on public.calendar_stops
  for each row execute function public.enqueue_call_status_from_stop();

-- ── הקרון: כל 5 דקות, קורא לפונקציה רק כשיש מה לכתוב ─────────────────
-- 🔴 בלי השורה הממתינה אין קריאה בכלל, אחרת כל 5 דקות נרשמת ריצה ריקה.
do $$
declare
  fn text := 'https://kukstfxtznymfkirdmty.supabase.co/functions/v1/rashal-call-status';
  anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a3N0Znh0em55bWZraXJkbXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNDQ2MjMsImV4cCI6MjA5MTgyMDYyM30.oF-pwjnAki4LiDE8nLa6SIjHHP_tLvsoZwEyxlu2f6E';
begin
  perform cron.schedule('rashal-call-status-from-stops', '*/5 * * * *', format(
    $c$select net.http_post(url:=%L, headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s','x-sync-secret', public.sync_secret()), body:='{"mode":"live","source":"stop","max":40,"key_form":"typed"}'::jsonb, timeout_milliseconds:=150000) where exists (select 1 from public.priority_call_status_writes where source = 'stop' and state = 'pending' and created_at < now() - interval '3 minutes')$c$,
    fn, anon));
end $$;
