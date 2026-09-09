-- ההודעות האוטומטיות בארבע שפות (עידן, 08/09/2026, מסמך האפיון
-- ~/Idan-HQ/meetings/rashal/2026-09-08-הודעות-אוטומטיות-בארבע-שפות-אפיון.html).
--
-- הבחירות: כפתורי שפה על כל הודעה ללקוח שהשפה שלו לא ידועה · נוסחים
-- קבועים שנבדקים על ידי דובר שפת אם · תבניות בכל שפה (שלב ב) · תרגום
-- אוטומטי של תשובות (שלב ד).
--
-- כאן שלב א: איפה השפה נשמרת, מה הנוסחים, ואיך מזהים תבנית לפי מזהה.
--
-- 🔴 השפה נשמרת על הטלפון (השיחה) ועל הלקוח יחד. בן משפחה מקושר שבחר
-- רוסית מקבל רוסית גם כשהלקוח עצמו מקבל עברית, ולכן הטלפון גובר.


-- טלפון בכל צורה → E.164 (כמו toE164 בצד השרת): 05x → +9725x, 972… → +972…
create or replace function public.wa_to_e164(raw text)
returns text
language sql immutable as $$
  select case
    when raw is null then null
    when d = '' then null
    when d like '972%' then '+' || d
    when d like '0%' then '+972' || substr(d, 2)
    when length(d) = 9 and d like '5%' then '+972' || d
    else '+' || d end
  from (select regexp_replace(raw, '\D', '', 'g') as d) x;
$$;

alter table public.wa_conversations
  add column if not exists lang text check (lang in ('he','en','ar','ru','th')),
  add column if not exists lang_set_at timestamptz,
  add column if not exists lang_source text;
comment on column public.wa_conversations.lang is 'השפה שהלקוח בחר בכפתור (או שעובד קבע). NULL = לא ידוע, יוצא עברית עם כפתורי שפה.';

create table if not exists public.customer_language (
  customer_number text primary key,
  lang text not null check (lang in ('he','en','ar','ru','th')),
  set_at timestamptz not null default now(),
  source text
);
alter table public.customer_language enable row level security;
drop policy if exists customer_language_select_office on public.customer_language;
create policy customer_language_select_office on public.customer_language
  for select to authenticated using (true);

alter table public.customer_surveys add column if not exists answered_lang text;

-- ── הנוסחים ────────────────────────────────────────────────
-- מפתח + שפה → גוף. המשתנים בתחביר של heyy ({{var.name}}), כמו בתבניות,
-- כדי שאותו מנגנון מילוי ישמש את שניהם. ערכי הרשימות הסגורות (מטרת
-- הביקור, ימי השבוע, טכנאי/נהג) יושבים כאן גם הם, במפתח 'v:<ערך עברי>'.
create table if not exists public.wa_texts (
  key text not null,
  lang text not null check (lang in ('he','en','ar','ru','th')),
  body text not null,
  primary key (key, lang)
);
alter table public.wa_texts enable row level security;
drop policy if exists wa_texts_select_office on public.wa_texts;
create policy wa_texts_select_office on public.wa_texts for select to authenticated using (true);

insert into public.wa_texts (key, lang, body) values
-- תיאום הגעה
('rashal_visit_coordination','en', E'Hello {{var.customer_name}}, this is R. Shaal Ltd.\nWe would like to come to you {{var.purpose}} on {{var.day}}, between {{var.hours}}.\nPlease let us know if this time works for you. If not, reply here with a time that suits you and we will arrange another visit.\nReply "Works for me" or "Doesn\'t work".'),
('rashal_visit_coordination','ar', E'مرحباً {{var.customer_name}}، معك شركة ر. شعل م.ض.\nنودّ الوصول إليكم {{var.purpose}} يوم {{var.day}}، بين الساعة {{var.hours}}.\nيسعدنا معرفة ما إذا كان الموعد مناسباً لكم. إن لم يكن، يمكنكم الرد هنا بالوقت المناسب لكم وسننسّق موعداً آخر.\nللرد: "مناسب لي" أو "غير مناسب".'),
('rashal_visit_coordination','ru', E'Здравствуйте, {{var.customer_name}}, это компания Р. Шааль.\nМы хотели бы приехать к вам {{var.purpose}} в {{var.day}}, с {{var.hours}}.\nСообщите, пожалуйста, подходит ли вам это время. Если нет, напишите здесь, когда вам удобно, и мы согласуем другое время.\nОтветьте "Мне подходит" или "Не подходит".'),
('rashal_visit_coordination','th', E'สวัสดีคุณ {{var.customer_name}} นี่คือบริษัท R. Shaal จำกัด\nเราต้องการไปหาคุณ{{var.purpose}}ในวัน{{var.day}} ระหว่างเวลา {{var.hours}}\nกรุณาแจ้งให้เราทราบว่าเวลานี้สะดวกสำหรับคุณหรือไม่ หากไม่สะดวก สามารถตอบกลับที่นี่พร้อมระบุเวลาที่สะดวก แล้วเราจะนัดหมายใหม่\nตอบกลับ "สะดวก" หรือ "ไม่สะดวก"'),
-- אישור מועד
('rashal_visit_confirmed','en', E'Hello {{var.customer_name}}, this is R. Shaal Ltd.\nWe will come to you {{var.purpose}} on {{var.day}}, between {{var.hours}}.\nIf this time does not suit you, reply here and we will reschedule.'),
('rashal_visit_confirmed','ar', E'مرحباً {{var.customer_name}}، معك شركة ر. شعل م.ض.\nسنصل إليكم {{var.purpose}} يوم {{var.day}}، بين الساعة {{var.hours}}.\nإذا لم يكن الموعد مناسباً، يمكنكم الرد هنا وسننسّق موعداً جديداً.'),
('rashal_visit_confirmed','ru', E'Здравствуйте, {{var.customer_name}}, это компания Р. Шааль.\nМы приедем к вам {{var.purpose}} в {{var.day}}, с {{var.hours}}.\nЕсли это время вам не подходит, напишите здесь, и мы перенесём визит.'),
('rashal_visit_confirmed','th', E'สวัสดีคุณ {{var.customer_name}} นี่คือบริษัท R. Shaal จำกัด\nเราจะไปหาคุณ{{var.purpose}}ในวัน{{var.day}} ระหว่างเวลา {{var.hours}}\nหากเวลานี้ไม่สะดวก กรุณาตอบกลับที่นี่ แล้วเราจะนัดหมายใหม่'),
-- תזכורת יום לפני
('rashal_visit_reminder','en', E'Hello {{var.customer_name}}, this is R. Shaal Ltd.\nReminder: tomorrow, {{var.day}}, we will come to you {{var.purpose}} between {{var.hours}}.\nIf anything has changed, reply here.'),
('rashal_visit_reminder','ar', E'مرحباً {{var.customer_name}}، معك شركة ر. شعل م.ض.\nتذكير: غداً، يوم {{var.day}}، سنصل إليكم {{var.purpose}} بين الساعة {{var.hours}}.\nإذا تغيّر شيء، يمكنكم الرد هنا.'),
('rashal_visit_reminder','ru', E'Здравствуйте, {{var.customer_name}}, это компания Р. Шааль.\nНапоминание: завтра, {{var.day}}, мы приедем к вам {{var.purpose}} с {{var.hours}}.\nЕсли что-то изменилось, напишите здесь.'),
('rashal_visit_reminder','th', E'สวัสดีคุณ {{var.customer_name}} นี่คือบริษัท R. Shaal จำกัด\nแจ้งเตือน: พรุ่งนี้ วัน{{var.day}} เราจะไปหาคุณ{{var.purpose}}ระหว่างเวลา {{var.hours}}\nหากมีการเปลี่ยนแปลง กรุณาตอบกลับที่นี่'),
-- בדרך אליך (הגרסה עם שם וטלפון של העובד; בלי טלפון, שתי הפסקאות האחרונות נופלות)
('on_the_way','en', E'Hello {{var.name}},\nR. Shaal\'s {{var.worker}} has finished the previous visit and is now on the way to you. For any questions you can call {{var.worker_name}} directly: {{var.worker_phone}}. Thank you, the R. Shaal team'),
('on_the_way','ar', E'مرحباً {{var.name}}،\n{{var.worker}} شركة ر. شعل أنهى الزيارة السابقة وهو الآن في الطريق إليكم. للاستفسار يمكنكم الاتصال مباشرة بـ{{var.worker_name}}: {{var.worker_phone}}. شكراً، فريق ر. شعل'),
('on_the_way','ru', E'Здравствуйте, {{var.name}},\n{{var.worker}} компании Р. Шааль завершил предыдущий визит и сейчас едет к вам. По вопросам можно позвонить напрямую: {{var.worker_name}}, {{var.worker_phone}}. Спасибо, команда Р. Шааль'),
('on_the_way','th', E'สวัสดีคุณ {{var.name}}\n{{var.worker}}ของ R. Shaal เสร็จจากงานก่อนหน้าแล้ว และกำลังเดินทางมาหาคุณ หากมีคำถาม โทรหาคุณ {{var.worker_name}} ได้โดยตรงที่ {{var.worker_phone}} ขอบคุณค่ะ/ครับ ทีมงาน R. Shaal'),
('on_the_way_v1','en', E'Hello {{var.name}},\nR. Shaal\'s {{var.worker}} has finished the previous visit and is now on the way to you.'),
('on_the_way_v1','ar', E'مرحباً {{var.name}}،\n{{var.worker}} شركة ر. شعل أنهى الزيارة السابقة وهو الآن في الطريق إليكم.'),
('on_the_way_v1','ru', E'Здравствуйте, {{var.name}},\n{{var.worker}} компании Р. Шааль завершил предыдущий визит и сейчас едет к вам.'),
('on_the_way_v1','th', E'สวัสดีคุณ {{var.name}}\n{{var.worker}}ของ R. Shaal เสร็จจากงานก่อนหน้าแล้ว และกำลังเดินทางมาหาคุณ'),
-- הזמנה לסקר (הקישור בגוף, כי טקסט חופשי לא נושא כפתור קישור)
('survey_invite','en', E'Hello {{var.name}},\nYou recently received service from R. Shaal Ltd.\nWe would appreciate your answers to two short questions about the service, less than a minute:\n{{var.link}}'),
('survey_invite','ar', E'مرحباً {{var.name}}،\nلقد تلقّيتم مؤخراً خدمة من شركة ر. شعل م.ض.\nيسعدنا الإجابة عن سؤالين قصيرين حول الخدمة، أقل من دقيقة:\n{{var.link}}'),
('survey_invite','ru', E'Здравствуйте, {{var.name}},\nНедавно вы получили услугу от компании Р. Шааль.\nБудем благодарны за ответ на два коротких вопроса об услуге, меньше минуты:\n{{var.link}}'),
('survey_invite','th', E'สวัสดีคุณ {{var.name}}\nเมื่อเร็วๆ นี้คุณได้รับบริการจากบริษัท R. Shaal จำกัด\nเรายินดีหากคุณช่วยตอบคำถามสั้นๆ 2 ข้อเกี่ยวกับบริการ ใช้เวลาไม่ถึงหนึ่งนาที:\n{{var.link}}'),
-- בקשת תמונה לפני טכנאי
('media_first','en', E'Hello {{var.name}},\nA service call has been opened for you at R. Shaal for the product: {{var.product}}.\nTo continue handling it, please send a photo or a video showing the fault in the product.\nWithout this information we will not be able to schedule a technician.'),
('media_first','ar', E'مرحباً {{var.name}}،\nتم فتح طلب خدمة لكم في شركة ر. شعل للمنتج: {{var.product}}.\nلمتابعة المعالجة، يرجى إرسال صورة أو فيديو يوضّح العطل في المنتج.\nبدون هذه المعلومات لن نتمكّن من تنسيق زيارة فنّي.'),
('media_first','ru', E'Здравствуйте, {{var.name}},\nВ компании Р. Шааль открыта сервисная заявка по изделию: {{var.product}}.\nЧтобы продолжить обработку, пожалуйста, отправьте фото или видео, на котором видна неисправность.\nБез этой информации мы не сможем назначить визит техника.'),
('media_first','th', E'สวัสดีคุณ {{var.name}}\nบริษัท R. Shaal ได้เปิดคำขอบริการสำหรับสินค้า: {{var.product}}\nเพื่อดำเนินการต่อ กรุณาส่งรูปถ่ายหรือวิดีโอที่แสดงอาการชำรุดของสินค้า\nหากไม่มีข้อมูลนี้ เราจะไม่สามารถนัดหมายช่างได้'),
-- תזכורת לתמונה
('media_reminder','en', E'A reminder: a service call has been opened for you at R. Shaal for the product: {{var.product}}.\nTo continue handling it, please send a photo or a video showing the fault in the product.\nWithout this information we will not be able to schedule a technician.'),
('media_reminder','ar', E'تذكير: تم فتح طلب خدمة لكم في شركة ر. شعل للمنتج: {{var.product}}.\nلمتابعة المعالجة، يرجى إرسال صورة أو فيديو يوضّح العطل في المنتج.\nبدون هذه المعلومات لن نتمكّن من تنسيق زيارة فنّي.'),
('media_reminder','ru', E'Напоминаем: в компании Р. Шааль открыта сервисная заявка по изделию: {{var.product}}.\nЧтобы продолжить обработку, пожалуйста, отправьте фото или видео, на котором видна неисправность.\nБез этой информации мы не сможем назначить визит техника.'),
('media_reminder','th', E'ขอแจ้งเตือน: บริษัท R. Shaal ได้เปิดคำขอบริการสำหรับสินค้า: {{var.product}}\nเพื่อดำเนินการต่อ กรุณาส่งรูปถ่ายหรือวิดีโอที่แสดงอาการชำรุดของสินค้า\nหากไม่มีข้อมูลนี้ เราจะไม่สามารถนัดหมายช่างได้'),
-- רשימות סגורות: ערכים עבריים שמגיעים במשתנים
('v:לאספקת הציוד','en','to deliver the equipment'),('v:לאספקת הציוד','ar','لتسليم المعدّات'),('v:לאספקת הציוד','ru','для доставки оборудования'),('v:לאספקת הציוד','th','เพื่อส่งมอบอุปกรณ์'),
('v:לאיסוף הציוד','en','to collect the equipment'),('v:לאיסוף הציוד','ar','لاستلام المعدّات'),('v:לאיסוף הציוד','ru','для забора оборудования'),('v:לאיסוף הציוד','th','เพื่อรับอุปกรณ์คืน'),
('v:לביקור טכנאי','en','for a technician visit'),('v:לביקור טכנאי','ar','لزيارة الفنّي'),('v:לביקור טכנאי','ru','для визита техника'),('v:לביקור טכנאי','th','เพื่อให้ช่างเข้าตรวจ'),
('v:להתקנת הציוד','en','to install the equipment'),('v:להתקנת הציוד','ar','لتركيب المعدّات'),('v:להתקנת הציוד','ru','для установки оборудования'),('v:להתקנת הציוד','th','เพื่อติดตั้งอุปกรณ์'),
('v:טכנאי','en','technician'),('v:טכנאי','ar','فنّي'),('v:טכנאי','ru','техник'),('v:טכנאי','th','ช่างเทคนิค'),
('v:נהג','en','driver'),('v:נהג','ar','سائق'),('v:נהג','ru','водитель'),('v:נהג','th','พนักงานขับรถ'),
('v:המוצר שברשותך','en','the product you have'),('v:המוצר שברשותך','ar','المنتج الذي بحوزتكم'),('v:המוצר שברשותך','ru','имеющееся у вас изделие'),('v:המוצר שברשותך','th','สินค้าที่คุณมี'),
('v:ראשון','en','Sunday'),('v:ראשון','ar','الأحد'),('v:ראשון','ru','воскресенье'),('v:ראשון','th','อาทิตย์'),
('v:שני','en','Monday'),('v:שני','ar','الاثنين'),('v:שני','ru','понедельник'),('v:שני','th','จันทร์'),
('v:שלישי','en','Tuesday'),('v:שלישי','ar','الثلاثاء'),('v:שלישי','ru','вторник'),('v:שלישי','th','อังคาร'),
('v:רביעי','en','Wednesday'),('v:רביעי','ar','الأربعاء'),('v:רביעי','ru','среду'),('v:רביעי','th','พุธ'),
('v:חמישי','en','Thursday'),('v:חמישי','ar','الخميس'),('v:חמישי','ru','четверг'),('v:חמישי','th','พฤหัสบดี'),
('v:שישי','en','Friday'),('v:שישי','ar','الجمعة'),('v:שישי','ru','пятницу'),('v:שישי','th','ศุกร์'),
('v:שבת','en','Saturday'),('v:שבת','ar','السبت'),('v:שבת','ru','субботу'),('v:שבת','th','เสาร์'),
-- "09:00 עד 13:00": המילה בין השעות
('v:עד','en','and'),('v:עד','ar','و'),('v:עד','ru','до'),('v:עד','th','ถึง')
on conflict (key, lang) do update set body = excluded.body;

-- ── פונקציות ───────────────────────────────────────────────

-- השפה של הנמען: הטלפון גובר, אחריו הלקוח, ואחרת עברית.
create or replace function public.wa_language_for(p_phone text default null, p_customer text default null)
returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select c.lang from public.wa_conversations c
      where p_phone is not null and c.phone_e164 = public.wa_to_e164(p_phone) and c.lang is not null limit 1),
    (select l.lang from public.customer_language l
      where nullif(p_customer, '') is not null and l.customer_number = p_customer limit 1),
    'he');
$$;

-- שמירת השפה: על השיחה של הטלפון, ועל הלקוח שהשיחה מזוהה איתו.
-- מחזירה את מספר הלקוח שעודכן (או NULL).
create or replace function public.wa_set_language(p_phone text, p_lang text, p_source text default 'button')
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_e164 text := public.wa_to_e164(p_phone);
  v_customer text;
begin
  -- 09/09/2026: אמהרית נוספה (20260909_amharic).
  if p_lang not in ('he','en','ar','ru','th','am') then
    raise exception 'unknown language %', p_lang;
  end if;
  update public.wa_conversations
     set lang = p_lang, lang_set_at = now(), lang_source = p_source
   where phone_e164 = v_e164
   returning customer_number into v_customer;
  if not found then
    -- אין עוד שיחה לטלפון הזה (למשל בחירה מכרטיס הלקוח לפני הודעה
    -- ראשונה). יוצרים שורה רזה, כדי שהשפה תחכה להודעה הבאה.
    insert into public.wa_conversations (phone_e164, phone_local, lang, lang_set_at, lang_source)
    values (v_e164, public.wa_normalize_phone(p_phone), p_lang, now(), p_source)
    on conflict (phone_e164) do update set lang = excluded.lang, lang_set_at = now(), lang_source = excluded.lang_source
    returning customer_number into v_customer;
  end if;
  if nullif(v_customer, '') is not null then
    insert into public.customer_language (customer_number, lang, set_at, source)
    values (v_customer, p_lang, now(), p_source)
    on conflict (customer_number) do update set lang = excluded.lang, set_at = now(), source = excluded.source;
  end if;
  return v_customer;
end $$;

-- מזהה תבנית של heyy → המפתח של הנוסח אצלנו. התבניות של המנועים
-- (בדרך אליך, תמונה, סקר) רשומות בטבלאות ההגדרות שלהם ולא ב-wa_templates.
create or replace function public.wa_template_key(p_template_id text)
returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select case t.key when 'survey_invite' then 'survey_invite' else t.key end
       from public.wa_templates t where t.heyy_template_id = p_template_id limit 1),
    (select case when s.template_v2_id = p_template_id then 'on_the_way'
                 when s.template_id = p_template_id then 'on_the_way_v1' end
       from public.on_way_settings s
      where p_template_id in (s.template_id, s.template_v2_id) limit 1),
    (select case when m.template_first_id = p_template_id then 'media_first'
                 when m.template_reminder_id = p_template_id then 'media_reminder' end
       from public.media_request_settings m
      where p_template_id in (m.template_first_id, m.template_reminder_id) limit 1),
    (select 'survey_invite' from public.survey_settings v where v.template_id = p_template_id limit 1));
$$;

revoke all on function public.wa_language_for(text, text) from public, anon;
revoke all on function public.wa_set_language(text, text, text) from public, anon;
revoke all on function public.wa_template_key(text) from public, anon;
grant execute on function public.wa_language_for(text, text) to authenticated, service_role;
grant execute on function public.wa_set_language(text, text, text) to authenticated, service_role;
grant execute on function public.wa_template_key(text) to service_role;

-- מי שקורא את השיחות דרך RPC/API רואה את השפה. ה-API (inbox.ts) בוחר עמודות
-- מפורשות, ולכן שם נוספת lang בקוד.
