-- אמהרית (עידן, 09/09/2026: "להוסיף שפה נוספת להכל, אמהרית"). השפה החמישית
-- אחרי אנגלית, ערבית, רוסית ותאית: אותו צינור בדיוק (wa_texts, wa_language_for,
-- wa_pick_template, עמוד הסקר), רק שורות חדשות. הנוסחים כתובים כאן וממתינים
-- לדובר שפת אם, כמו ארבע האחרות. 🔴 הכפתור "አማርኛ" חייב להתווסף לחמש
-- התבניות ב-heyy (תבניות חדשות לאישור מטא) ולהירשם ב-wa_template_langs.

alter table public.wa_conversations drop constraint if exists wa_conversations_lang_check;
alter table public.wa_conversations add constraint wa_conversations_lang_check check (lang in ('he','en','ar','ru','th','am'));
alter table public.customer_language drop constraint if exists customer_language_lang_check;
alter table public.customer_language add constraint customer_language_lang_check check (lang in ('he','en','ar','ru','th','am'));
alter table public.wa_texts drop constraint if exists wa_texts_lang_check;
alter table public.wa_texts add constraint wa_texts_lang_check check (lang in ('he','en','ar','ru','th','am'));
alter table public.wa_template_langs drop constraint if exists wa_template_langs_lang_check;
alter table public.wa_template_langs add constraint wa_template_langs_lang_check check (lang in ('he','en','ar','ru','th','am'));

insert into public.wa_texts (key, lang, body) values
  ('media_first', 'am', E'ሰላም {{var.name}}፣\nበር. ሻአል ለምርትዎ {{var.product}} የአገልግሎት ጥሪ ተከፍቷል።\nአያያዙን ለመቀጠል እባክዎ በምርቱ ላይ ያለውን ብልሽት የሚያሳይ ፎቶ ወይም ቪዲዮ ይላኩልን።\nያለዚህ መረጃ ቴክኒሻን ማስያዝ አንችልም።'),
  ('media_reminder', 'am', E'ማስታወሻ፦ በር. ሻአል ለምርትዎ {{var.product}} የአገልግሎት ጥሪ ተከፍቷል።\nአያያዙን ለመቀጠል እባክዎ በምርቱ ላይ ያለውን ብልሽት የሚያሳይ ፎቶ ወይም ቪዲዮ ይላኩልን።\nያለዚህ መረጃ ቴክኒሻን ማስያዝ አንችልም።'),
  ('on_the_way', 'am', E'ሰላም {{var.name}}፣\nየር. ሻአል {{var.worker}} የቀደመውን ጉብኝት ጨርሶ አሁን ወደ እርስዎ በመንገድ ላይ ነው። ለማንኛውም ጥያቄ ወደ {{var.worker_name}} በቀጥታ መደወል ይችላሉ፦ {{var.worker_phone}}። እናመሰግናለን፣ የር. ሻአል ቡድን'),
  ('on_the_way_v1', 'am', E'ሰላም {{var.name}}፣\nየር. ሻአል {{var.worker}} የቀደመውን ጉብኝት ጨርሶ አሁን ወደ እርስዎ በመንገድ ላይ ነው።'),
  ('rashal_visit_confirmed', 'am', E'ሰላም {{var.customer_name}}፣ ይህ ር. ሻአል ኃ.የተ.የግ.ማ. ነው።\n{{var.day}} ቀን ከ{{var.hours}} ባለው ሰዓት {{var.purpose}} ወደ እርስዎ እንመጣለን።\nይህ ሰዓት የማይመችዎ ከሆነ እዚህ ይመልሱልን፣ ሌላ ቀን እናዘጋጃለን።'),
  ('rashal_visit_coordination', 'am', E'ሰላም {{var.customer_name}}፣ ይህ ር. ሻአል ኃ.የተ.የግ.ማ. ነው።\n{{var.day}} ቀን ከ{{var.hours}} ባለው ሰዓት {{var.purpose}} ወደ እርስዎ መምጣት እንፈልጋለን።\nይህ ሰዓት ይመችዎ እንደሆነ እባክዎ ያሳውቁን። ካልመቸዎ፣ የሚመችዎን ሰዓት እዚህ ይጻፉልን፣ ሌላ ጉብኝት እናዘጋጃለን።\n"ይመቸኛል" ወይም "አይመቸኝም" ብለው ይመልሱ።'),
  ('rashal_visit_reminder', 'am', E'ሰላም {{var.customer_name}}፣ ይህ ር. ሻአል ኃ.የተ.የግ.ማ. ነው።\nማስታወሻ፦ ነገ {{var.day}} ከ{{var.hours}} ባለው ሰዓት {{var.purpose}} ወደ እርስዎ እንመጣለን።\nየተለወጠ ነገር ካለ እዚህ ይመልሱልን።'),
  ('survey_invite', 'am', E'ሰላም {{var.name}}፣\nበቅርቡ ከር. ሻአል ኃ.የተ.የግ.ማ. አገልግሎት አግኝተዋል።\nስለ አገልግሎቱ ሁለት አጭር ጥያቄዎችን ቢመልሱልን እናመሰግናለን፣ ከአንድ ደቂቃ በታች ነው፦\n{{var.link}}'),
  ('v:המוצר שברשותך', 'am', E'በእጅዎ ያለው ምርት'),
  ('v:טכנאי', 'am', E'ቴክኒሻን'),
  ('v:נהג', 'am', E'ሹፌር'),
  ('v:לאיסוף הציוד', 'am', E'መሣሪያውን ለመሰብሰብ'),
  ('v:לאספקת הציוד', 'am', E'መሣሪያውን ለማድረስ'),
  ('v:לביקור טכנאי', 'am', E'ለቴክኒሻን ጉብኝት'),
  ('v:להתקנת הציוד', 'am', E'መሣሪያውን ለመትከል'),
  ('v:עד', 'am', E'እስከ'),
  ('v:ראשון', 'am', E'እሁድ'),
  ('v:שני', 'am', E'ሰኞ'),
  ('v:שלישי', 'am', E'ማክሰኞ'),
  ('v:רביעי', 'am', E'ረቡዕ'),
  ('v:חמישי', 'am', E'ሐሙስ'),
  ('v:שישי', 'am', E'ዓርብ'),
  ('v:שבת', 'am', E'ቅዳሜ')
on conflict (key, lang) do update set body = excluded.body;
