-- סריקה מלאה של כרטיסי הלקוח, פעם בשבועיים.
--
-- 🔴🔴 **למה סריקה מלאה ולא דלתא.** עידן עדכן טלפון ללקוח קיים
-- ב-25/08/2026 והעדכון לא הגיע, וגם לא היה מגיע לעולם: המשיכה השוטפת
-- מסננת `CREATEDDATE ge <watermark>`, שהוא תאריך **פתיחת** הלקוח ואינו
-- זז בעריכה. נבדקו כל החלופות, ואין דלתא זולה:
--   · `STATUSDATE` זז על רשומות ישנות אבל **לא** על עריכת טלפון
--     (נמדד עם בקרה חיובית: הלקוח שנערך לא הופיע בשום חלון).
--   · `UNLOADTIME` הוא `Edm.String` ולא תאריך.
--   · `CHANGES_LOG_SUBFORM` קיים ומדויק, אבל אי אפשר לסנן לפיו את האב:
--     `any()` מוחזר 403 מדף HTML של שער ה-CDN, והנתיב הישיר
--     `CHANGES_LOG_SUBFORM/UDATE ge X` מחזיר 200 **ומתעלם מהתאריך**.
--   · אין ישות עצמאית ליומן השינויים (שמונה שמות נוסו, כולן 404).
-- הפירוט המלא בבית הידע של רוני, `knowledge/priority/learnings.md`.
--
-- ⭐ **העלות נמדדה:** 42,752 שורות לסריקה, פעמיים בחודש, כלומר כ-4.3%
-- ממכסת הקריאה החודשית של פריוריטי. 🔴 חריגה מהמכסה מפילה את ה-API
-- של **כל החברה** ולא רק שלנו, ולכן זה נמדד לפני ולא אחרי.
--
-- 🔴 **ומפוצל לשניים בכוונה.** ריצה אחת של כל 42,752 השורות ארכה
-- **142 שניות**, מול תקרה של כ-150 לפונקציית Edge. זה עבר, בלי מרווח.
-- שני חצאים לוקחים כ-40 שניות כל אחד, ואומת שהם מכסים בדיוק את אותן
-- 42,752 שורות בלי חפיפה ובלי חור (22,000 + 20,752).
--
-- ⭐ החצי השני נמשך עד הסוף (`maxPages` גדול) ולא בדיוק 11 עמודים, כדי
-- שגידול בבסיס הלקוחות ייכנס מעצמו במקום להישאר מחוץ לסריקה בשקט.

-- החצי הראשון: עמודים 0 עד 10.
select cron.unschedule('rashal-customers-scan-a')
 where exists (select 1 from cron.job where jobname = 'rashal-customers-scan-a');
select cron.schedule(
  'rashal-customers-scan-a', '0 2 1,15 * *',
  $j$select net.http_post(
       url:='https://kukstfxtznymfkirdmty.supabase.co/functions/v1/rashal-sync',
       headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a3N0Znh0em55bWZraXJkbXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNDQ2MjMsImV4cCI6MjA5MTgyMDYyM30.oF-pwjnAki4LiDE8nLa6SIjHHP_tLvsoZwEyxlu2f6E"}'::jsonb,
       body:='{"job":"backfill","entity":"customers_all","from":"-","to":"-","startPage":0,"maxPages":11,"trigger":"cron"}'::jsonb,
       timeout_milliseconds:=180000);$j$);

-- החצי השני: מעמוד 11 ועד הסוף.
select cron.unschedule('rashal-customers-scan-b')
 where exists (select 1 from cron.job where jobname = 'rashal-customers-scan-b');
select cron.schedule(
  'rashal-customers-scan-b', '15 2 1,15 * *',
  $j$select net.http_post(
       url:='https://kukstfxtznymfkirdmty.supabase.co/functions/v1/rashal-sync',
       headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a3N0Znh0em55bWZraXJkbXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNDQ2MjMsImV4cCI6MjA5MTgyMDYyM30.oF-pwjnAki4LiDE8nLa6SIjHHP_tLvsoZwEyxlu2f6E"}'::jsonb,
       body:='{"job":"backfill","entity":"customers_all","from":"-","to":"-","startPage":11,"maxPages":40,"trigger":"cron"}'::jsonb,
       timeout_milliseconds:=180000);$j$);
