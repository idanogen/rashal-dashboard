-- תזמון הסנכרון הישיר (מחליף את התזמונים של Make) + watchdog.
-- שעון UTC; ישראל בקיץ = UTC+3. ה-Bearer הוא מפתח ה-anon (ציבורי, בטוח לגיט).
-- הערה: החלונות ב-UTC — בחורף (UTC+2) חלון הפעילות יזוז שעה, לעדכן בהחלפת שעון.
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  fn_sync text := 'https://kukstfxtznymfkirdmty.supabase.co/functions/v1/rashal-sync';
  fn_push text := 'https://kukstfxtznymfkirdmty.supabase.co/functions/v1/rashal-push';
  fn_wd   text := 'https://kukstfxtznymfkirdmty.supabase.co/functions/v1/rashal-watchdog';
  hdrs jsonb := jsonb_build_object(
    'Content-Type','application/json',
    'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a3N0Znh0em55bWZraXJkbXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNDQ2MjMsImV4cCI6MjA5MTgyMDYyM30.oF-pwjnAki4LiDE8nLa6SIjHHP_tLvsoZwEyxlu2f6E'
  );
begin
  perform cron.schedule('rashal-pull-core', '*/20 4-14 * * 0-4', format(
    $j$select net.http_post(url:='%s', headers:='%s'::jsonb, body:='{"job":"pull-core","trigger":"cron"}'::jsonb, timeout_milliseconds:=300000)$j$, fn_sync, hdrs::text));
  perform cron.schedule('rashal-pull-core-1800il', '0 15 * * 0-4', format(
    $j$select net.http_post(url:='%s', headers:='%s'::jsonb, body:='{"job":"pull-core","trigger":"cron"}'::jsonb, timeout_milliseconds:=300000)$j$, fn_sync, hdrs::text));
  perform cron.schedule('rashal-pull-core-weekend', '0 7 * * 5,6', format(
    $j$select net.http_post(url:='%s', headers:='%s'::jsonb, body:='{"job":"pull-core","trigger":"cron"}'::jsonb, timeout_milliseconds:=300000)$j$, fn_sync, hdrs::text));
  perform cron.schedule('rashal-pull-pickups', '0,30 4-14 * * 0-4', format(
    $j$select net.http_post(url:='%s', headers:='%s'::jsonb, body:='{"job":"pull-pickups","trigger":"cron"}'::jsonb, timeout_milliseconds:=300000)$j$, fn_sync, hdrs::text));
  perform cron.schedule('rashal-pull-pickup-addresses', '15,45 4-14 * * 0-4', format(
    $j$select net.http_post(url:='%s', headers:='%s'::jsonb, body:='{"job":"pull-pickup-addresses","trigger":"cron"}'::jsonb, timeout_milliseconds:=300000)$j$, fn_sync, hdrs::text));
  perform cron.schedule('rashal-push-chat', '*/15 * * * *', format(
    $j$select net.http_post(url:='%s', headers:='%s'::jsonb, body:='{"trigger":"cron"}'::jsonb, timeout_milliseconds:=300000)$j$, fn_push, hdrs::text));
  perform cron.schedule('rashal-watchdog', '5 * * * *', format(
    $j$select net.http_post(url:='%s', headers:='%s'::jsonb, body:='{}'::jsonb, timeout_milliseconds:=60000)$j$, fn_wd, hdrs::text));
end $$;
