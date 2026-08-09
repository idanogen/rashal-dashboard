-- לקוח חדש כמקור עבודה · 09/08/2026
--
-- ברשעל אספקה נשענת ברוב המקרים על פתיחת לקוח חדש בפריוריטי. הזמנה לא תמיד
-- נפתחת, ואם היא נפתחת היא עלולה להיסגר מיד. עד היום `priority_customers`
-- שימשה כ-cache להעשרת כתובות בלבד, ואף מסך לא הציג אותה, ולכן אספקות שלמות
-- לא היו גלויות לסדרן. החודש 50 מתוך 81 לקוחות חדשים היו בלי הזמנה.
--
-- כאן נוסף סוג עצירה חמישי, 'customer', שמאפשר לשבץ אספקה ישירות מהלקוח
-- החדש בלי להמתין להזמנה.

-- הקישור חזרה ללקוח. אין FK כי priority_customers הוא cache שנמחק ונטען
-- מחדש מפריוריטי, ומחיקה שלו לא אמורה להפיל עצירה שכבר משובצת ביומן.
alter table public.calendar_stops
  add column if not exists customer_number text;

comment on column public.calendar_stops.customer_number is
  'CUSTNAME של הלקוח בפריוריטי. חובה כש-source_type=''customer'', ומשמש גם כדי לא להציג שוב לקוח שכבר שובץ.';

create index if not exists calendar_stops_customer_number_idx
  on public.calendar_stops (customer_number)
  where customer_number is not null;

-- הרחבת רשימת הסוגים המותרים
alter table public.calendar_stops drop constraint if exists calendar_stops_source_type_check;
alter table public.calendar_stops add constraint calendar_stops_source_type_check
  check (source_type = any (array['delivery','service','task','inspection','pickup','customer']));

-- הרחבת אילוץ "בדיוק מקור אחד". עצירת לקוח לא נושאת אף FK לישות, בדיוק כמו
-- task, אבל היא כן מחייבת customer_number כדי שתמיד יהיה אפשר לחזור ללקוח.
alter table public.calendar_stops drop constraint if exists calendar_stops_source_check;
alter table public.calendar_stops add constraint calendar_stops_source_check check (
  (source_type = 'delivery'   and order_id is not null and service_call_id is null and inspection_id is null and pickup_id is null) or
  (source_type = 'service'    and service_call_id is not null and order_id is null and inspection_id is null and pickup_id is null) or
  (source_type = 'task'       and order_id is null and service_call_id is null and inspection_id is null and pickup_id is null) or
  (source_type = 'inspection' and inspection_id is not null and order_id is null and service_call_id is null and pickup_id is null) or
  (source_type = 'pickup'     and pickup_id is not null and order_id is null and service_call_id is null and inspection_id is null) or
  (source_type = 'customer'   and customer_number is not null and order_id is null and service_call_id is null and inspection_id is null and pickup_id is null)
);
