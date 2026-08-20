-- שדות שמסתנכרנים מ-heyy, והדגל שאי אפשר להסיק ממנה.
-- הוחל בפרודקשן 20/08/2026. ראה STATUS.md.
--
-- ⭐ ל-heyy **יש** API לתבניות, ב-v3: `POST /v3/message_templates/search`.
-- 🔴 הבדיקה הראשונה רצה על v2.0 והחזירה 404, ומזה הוסק בטעות שאין API.
alter table public.wa_templates
  add column if not exists variables          text[]      not null default '{}',
  add column if not exists attachment_kind    text,
  add column if not exists attachment_id      text,
  add column if not exists attachment_file_id text,
  add column if not exists heyy_status        text,
  add column if not exists synced_at          timestamptz,
  -- 🔴 ההבחנה שאי אפשר להסיק מהנתונים, ושתפסה תקלה חמורה רגע לפני
  -- שהזיקה: כל תבנית עם מדיה נושאת ב-heyy קובץ אחד, זה שהוגש למטא.
  -- אצל `ogen_send_document` הקובץ הזה הוא **תעודת דוגמה**, וכלל
  -- זמינות שנשען על "יש קובץ" היה שולח אותה ללקוח אמיתי.
  --   false  מדיה קבועה (סרטון הדרכה)   ⟵ נשלחת שוב עם אותו מזהה
  --   true   מדיה פר נמען (מסמך)        ⟵ חייבת הפקה בכל שליחה
  add column if not exists media_per_message  boolean     not null default false;

-- 🔴 הסנכרון מזהה תבנית לפי המזהה ב-heyy ולא לפי המפתח הפנימי, כי מנהל
-- יכול לשנות תווית אבל לא את מה ש-heyy קבעה. בלי אילוץ ייחודי ה-upsert
-- מוסיף כפילות בכל סנכרון.
create unique index if not exists wa_templates_heyy_id_key
  on public.wa_templates (heyy_template_id);
