-- 🔴🔴 שמונה Edge Functions קיבלו כל קריאה עם המפתח הציבורי (23/09/2026):
-- אפשר היה להפעיל שליחת סקרים ובקשות מדיה ללקוחות, לעקוף את מתג ה-dry_run,
-- לקבל בחזרה שמות וטלפונים, לשלוח את דוח הבוקר למנהלים בלי הגבלה ולדחוף
-- כתיבות לפריוריטי. התיקון בשני שלבים:
--   1) (הקובץ הזה) כל קורא (pg_cron + שני טריגרים) שולח `x-sync-secret`.
--      הפונקציות מתעלמות מכותרת עודפת, ולכן השלב הזה לא שובר כלום.
--   2) כל פונקציה דוחה בקשה בלי הסוד (`_shared/require-secret.ts`).
-- הסוד: `public.sync_secret()` מה-Vault, אותו מנגנון של rashal-sync מ-07/09.
-- 🔴 עוטפים רק את הערך ולא את `headers :=` (ניסיון ראשון נכשל בתחביר ונגלל אחורה).

do $$
declare j record;
begin
  for j in select jobid, command from cron.job
            where command ilike '%functions/v1/%' and command not ilike '%x-sync-secret%'
  loop
    perform cron.alter_job(j.jobid, command := regexp_replace(j.command,
      '(headers\s*:=\s*)(''[^'']*''::jsonb)',
      '\1(\2 || jsonb_build_object(''x-sync-secret'', public.sync_secret()))'));
  end loop;
end $$;

do $$
declare f text; def text;
begin
  foreach f in array array['public.driver_push_kick()', 'public.on_way_capture()'] loop
    def := pg_get_functiondef(f::regprocedure);
    if def ilike '%x-sync-secret%' then continue; end if;
    def := regexp_replace(def,
      '(headers\s*:=\s*)(''[^'']*''::jsonb)',
      '\1(\2 || jsonb_build_object(''x-sync-secret'', public.sync_secret()))');
    execute def;
  end loop;
end $$;
