-- הקרון של הדוח השבועי (20261113_wa_failure_report.sql). מוחל רק אחרי שעידן אישר את נוסח המייל.
-- הקרון: ראשון 05:00 ו-06:00 UTC, הפונקציה שולחת רק כשבישראל השעה 8 (קיץ וחורף).
do $$
declare
  fn text := 'https://kukstfxtznymfkirdmty.supabase.co/functions/v1/rashal-wa-failure-report';
  anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a3N0Znh0em55bWZraXJkbXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNDQ2MjMsImV4cCI6MjA5MTgyMDYyM30.oF-pwjnAki4LiDE8nLa6SIjHHP_tLvsoZwEyxlu2f6E';
  cmd text;
begin
  cmd := format($c$select net.http_post(url:=%L, headers:=(%L::jsonb || jsonb_build_object('x-sync-secret', public.sync_secret())), body:='{}'::jsonb, timeout_milliseconds:=60000)$c$,
                fn, format('{"Content-Type":"application/json","Authorization":"Bearer %s"}', anon));
  perform cron.schedule('rashal-wa-failure-report', '0 5,6 * * 0', cmd);
end $$;
