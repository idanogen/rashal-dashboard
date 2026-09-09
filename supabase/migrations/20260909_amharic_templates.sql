-- חמש התבניות עם כפתור אמהרית (09/09/2026). שוכפלו מהתבניות של 08/09
-- והכפתור החמישי "አማርኛ" נוסף; הגוף והמשתנים זהים בדיוק, ולכן החלפת
-- המזהה בטוחה. שורת 'he' ב-wa_template_langs היא "עברית עם כפתורי שפה",
-- כלומר מה שלקוח בלי שפה שמורה מקבל.
--
-- 🔴 תבנית נרשמת כאן **רק אחרי שמטא אישרה** (סטטוס "פעיל" ב-heyy).
-- רישום תבנית שבבדיקה שובר את השליחה בשקט.
--
-- המזהים של כל החמש (16:30-16:39):
--   survey_invite_lang2              b89b09ef-da70-4194-b088-d1b21c31e00d  ✅ אושרה
--   rashal_media_reminder_lang2      761de534-dff3-49ea-b147-ce35f1e0ae18  ✅ אושרה
--   rashal_media_request_lang2       7fa3a736-4572-401a-ae29-d659cb8becc5  ⏳ בבדיקה
--   rashal_on_the_way_lang2          c29cbf8f-c9ac-40cd-b53e-e48c5dba1680  ⏳ בבדיקה
--   rashal_visit_coordination_lang2  994df8db-89a7-490b-8fc0-e166023d11c0  ⏳ בבדיקה

insert into public.wa_template_langs (key, lang, heyy_template_id) values
  ('survey_invite',  'he', 'b89b09ef-da70-4194-b088-d1b21c31e00d'),
  ('media_reminder', 'he', '761de534-dff3-49ea-b147-ce35f1e0ae18')
on conflict (key, lang) do update set heyy_template_id = excluded.heyy_template_id, approved_at = now();

-- ⏳ להריץ כשמטא תאשר את השלוש (הסטטוס ב-heyy יעבור ל"פעיל"):
-- insert into public.wa_template_langs (key, lang, heyy_template_id) values
--   ('media_first',                'he', '7fa3a736-4572-401a-ae29-d659cb8becc5'),
--   ('on_the_way',                 'he', 'c29cbf8f-c9ac-40cd-b53e-e48c5dba1680'),
--   ('rashal_visit_coordination',  'he', '994df8db-89a7-490b-8fc0-e166023d11c0')
-- on conflict (key, lang) do update set heyy_template_id = excluded.heyy_template_id, approved_at = now();
