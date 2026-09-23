-- 🔴🔴 סגירת כל מה שנגיש עם המפתח הציבורי בלי התחברות (23/09/2026, עידן:
-- "אסור שתהיה זליגת נתונים"). המפתח הציבורי נמצא בחבילה של הדפדפן, ולכן
-- כל הרשאה ל-anon היא הרשאה לכל העולם.

-- 1) פונקציות security definer שרצות רק מהשרת (Edge Functions עם service role,
--    pg_cron, טריגרים). anon ו-authenticated לא צריכים אותן. בלי זה כל אחד יכול
--    היה לתפוס את תור הסקרים/בקשות המדיה/"בדרך אליך" ולהקפיא שליחות.
--    טריגר לא בודק EXECUTE בזמן הירי, ולכן הטריגרים ממשיכים לעבוד.
do $$
declare f text;
begin
  foreach f in array array[
    'public.survey_claim_due(integer)', 'public.media_claim_due(integer)',
    'public.on_way_claim(boolean, integer)', 'public.purge_password_reset_tokens()',
    'public.driver_push_kick()', 'public.driver_push_capture_chat()', 'public.driver_push_capture_stop()',
    'public.on_way_capture()', 'public.sync_profile_phone_from_assignee()',
    'public.wa_refresh_human_summary(uuid)', 'public.rashal_mgmt_overview(date, date)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- 2) פונקציות שהדשבורד קורא אחרי התחברות ובודקות תפקיד בפנים: רק anon יוצא.
revoke all on function public.security_matrix() from public, anon;
revoke all on function public.field_suggestions() from public, anon;

-- 3) טבלאות הזמנת החלפים (rashal-eparts): מדיניות ל-anon עם קריאה, הוספה ועדכון
--    חופשיים. האפליקציה מעולם לא עלתה לאוויר (הזמנה אחת, בדיקה מ-16/06).
--    כשתעלה: דרך השרת עם service role, לא עם המפתח הציבורי.
revoke all on public.parts_orders, public.parts_order_items, public.parts_technicians from anon;

-- 4) תצוגת בריאות מנוע הסקרים (מספרים בלבד, אבל אין סיבה שתהיה ציבורית).
revoke all on public.survey_engine_health from anon;
