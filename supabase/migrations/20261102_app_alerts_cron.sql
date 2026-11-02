-- ─────────────────────────────────────────────────────────────────────────
-- rashal-app-alerts — הפעמון של לוגי ההרצה (02/11/2026, שלב 3 בתוכנית הלוגים).
-- כל 5 דקות: דיווח "יש בעיה" חדש → מייל לעידן; ובימים א-ו מ-7:00 סיכום
-- בוקר אחד על יום העבודה הקודם. הפונקציה מחליטה מה לשלוח (sync_alerts).
-- אותו אימות של שאר הקרונים: מפתח anon + x-sync-secret מ-sync_secret().
-- ─────────────────────────────────────────────────────────────────────────
select cron.unschedule('rashal-app-alerts')
  where exists (select 1 from cron.job where jobname = 'rashal-app-alerts');

do $$
declare
  fn text := 'https://kukstfxtznymfkirdmty.supabase.co/functions/v1/rashal-app-alerts';
  anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a3N0Znh0em55bWZraXJkbXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNDQ2MjMsImV4cCI6MjA5MTgyMDYyM30.oF-pwjnAki4LiDE8nLa6SIjHHP_tLvsoZwEyxlu2f6E';
  cmd text;
begin
  cmd := format($c$select net.http_post(url:=%L, headers:=(%L::jsonb || jsonb_build_object('x-sync-secret', public.sync_secret())), body:='{}'::jsonb, timeout_milliseconds:=60000)$c$,
                fn, format('{"Content-Type":"application/json","Authorization":"Bearer %s"}', anon));
  perform cron.schedule('rashal-app-alerts', '*/5 * * * *', cmd);
end $$;
