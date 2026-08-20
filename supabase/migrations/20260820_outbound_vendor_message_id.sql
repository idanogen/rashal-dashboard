-- מזהה ההודעה אצל מטא (wamid). heyy מחזיק שני מזהים לכל הודעה:
--   data.id        מזהה פנימי של heyy  → wa_message_id
--   data.vendorId  wamid.* של מטא      → vendor_message_id
-- שומרים את שניהם, כי עדכון סטטוס עלול להגיע לפי כל אחד מהם.
--
-- 🔴 הרקע: עד 20/08/2026 הקוד חיפש בתשובת heyy שדה בשם `waMessageId`,
-- שלא קיים בסכימה שלהם בכלל. התוצאה היתה מחרוזת ריקה בכל שורה יוצאת,
-- וכל הודעה שאי פעם נשלחה נשארה `pending` לנצח, כולל הודעות הסקר
-- שאנחנו יודעים בוודאות שנמסרו ונענו. בלי מזהה אין מעקב מסירה.

alter table public.whatsapp_outbound
  add column if not exists vendor_message_id text;

create index if not exists whatsapp_outbound_vendor_msg_idx
  on public.whatsapp_outbound (vendor_message_id)
  where vendor_message_id is not null;

-- מחרוזת ריקה אינה מזהה, והיא גם שוברת כל התאמה עתידית. מנרמלים ל-NULL.
update public.whatsapp_outbound
   set wa_message_id = null
 where wa_message_id = '';

create index if not exists whatsapp_outbound_wa_msg_idx
  on public.whatsapp_outbound (wa_message_id)
  where wa_message_id is not null;
